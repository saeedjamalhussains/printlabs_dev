import logging
import re

import httpx
from app.config import settings
from app.services.embedder import embed_query, embed_texts
from app.services.trends import trend_for_product
from app.services.vector_store import search_products

logger = logging.getLogger("fabi_rag")


# Extract structured price constraints from natural-language queries.
# This runs before the LLM because the LLM cannot enforce a hard
# `price <= 299` rule — it can only rephrase what the retriever found.
# The regexes cover the natural ways a person asks: "under", "below",
# "around", "worth", "for Rs.250", and the range "between X and Y".
_CURRENCY = r"(?:₹|Rs\.?|INR)"
# A number that may or may not carry a currency marker. Safe after an
# explicit comparison word ("under 300" can only mean money here).
_PRICE_TOKEN = rf"{_CURRENCY}?\s*(\d+)"
# A number that MUST carry one. Used after weak words like "for", which
# are far more often about something else — "a poster for 2 kids".
_MONEY_TOKEN = rf"{_CURRENCY}\s*(\d+)"

_UNDER_RE = re.compile(
    rf"(?:under|less\s+than|below|up\s+to|max(?:imum)?|cheaper\s+than)\s*{_PRICE_TOKEN}",
    re.IGNORECASE,
)
_OVER_RE = re.compile(
    rf"(?:above|more\s+than|over|greater\s+than|at\s+least)\s*{_PRICE_TOKEN}",
    re.IGNORECASE,
)
# "around 250" reads as a price; "for 250" only does with a currency
# marker, so the weak openers are matched against _MONEY_TOKEN.
_TARGET_RE = re.compile(
    rf"(?:around|worth|approximately|priced\s+at)\s*{_PRICE_TOKEN}"
    rf"|(?:for|about|of)\s*{_MONEY_TOKEN}",
    re.IGNORECASE,
)
_RANGE_RE = re.compile(
    rf"between\s*{_PRICE_TOKEN}\s*(?:and|to|-)\s*{_PRICE_TOKEN}",
    re.IGNORECASE,
)


def extract_price_constraints(query: str) -> dict:
    """
    Pull structured price bounds out of a free-text query.

    Returns a dict with any of: ``min_price``, ``max_price``,
    ``target_price``. Missing keys mean "no constraint" — not "any
    value", so a query with no price mention produces ``{}`` and the
    retriever behaves as before.

    The parser is conservative: a "target" (e.g. "poster worth Rs.250")
    is treated as a soft constraint we can relax if nothing matches,
    while "under" / "between" are hard caps the user clearly expects.
    """
    constraints: dict = {}

    range_match = _RANGE_RE.search(query)
    if range_match:
        low, high = int(range_match.group(1)), int(range_match.group(2))
        if low > high:
            low, high = high, low
        constraints["min_price"] = low
        constraints["max_price"] = high
        return constraints

    under = _UNDER_RE.search(query)
    if under:
        constraints["max_price"] = int(under.group(1))

    over = _OVER_RE.search(query)
    if over:
        constraints["min_price"] = int(over.group(1))

    target = _TARGET_RE.search(query)
    if target:
        # The pattern has two alternatives, so exactly one group is set.
        digits = target.group(1) or target.group(2)
        constraints["target_price"] = int(digits)

    return constraints


def price_band(constraints: dict) -> tuple[int, int] | None:
    """
    Collapse extracted constraints into a concrete ``(min, max)`` band.

    Both retrieval paths need the same band — MongoDB filters on it and
    Qdrant filters on it — so it is computed once here rather than
    derived separately in each, which is how the two drifted apart.
    Returns ``None`` when the query carried no price at all.
    """
    if not constraints:
        return None

    target = constraints.get("target_price")
    max_p = constraints.get("max_price")
    min_p = constraints.get("min_price")

    if target is not None and max_p is None and min_p is None:
        # "poster for Rs.250" — a soft band of ±25% (at least Rs.30) so
        # nearby options surface, but a Rs.10 or Rs.5000 poster does not.
        margin = max(int(target * 0.25), 30)
        return max(0, target - margin), target + margin

    return (
        min_p if min_p is not None else 0,
        max_p if max_p is not None else 1_000_000,
    )


# Strip only the price numbers and currency symbols from the query so the
# embedder focuses on semantic intent (category, theme, style). We keep the
# surrounding words so the query structure stays meaningful.
#
# Handles: "Rs.250", "Rs 250", "₹250", "under Rs.299", "for Rs 250",
#         "between Rs.200 and Rs.400"
# Leaves: "Do you have a poster for ?" (space and punctuation cleaned up)
_PRICE_NUM_RE = re.compile(
    r"(?:Rs\.?|Rs|₹)\s*\d+"
    r"|"
    r"(?:Rs\.?|Rs|₹)\s*",
    re.IGNORECASE,
)
_RANGE_NUM_RE = re.compile(
    r"between\s+(?:Rs\.?\s*)?\d+\s+(?:and|to|-)\s+(?:Rs\.?\s*)?\d+",
    re.IGNORECASE,
)


def strip_price_phrases(query: str) -> str:
    """Remove price numbers so the semantic query focuses on the intent."""
    cleaned = _RANGE_NUM_RE.sub("", query)
    cleaned = _PRICE_NUM_RE.sub("", cleaned)
    cleaned = re.sub(r"\s+", " ", cleaned).strip(" ,.;:!?-")
    return cleaned or query

# Markdown the UI cannot render. The bubble prints plain text, so a
# model that reaches for a bulleted list produces literal asterisks and
# blank-line gaps on screen. The prompt asks for prose; this enforces it,
# because prompts are guidance and models drift.
_BULLET = re.compile(r"^[\s]*[-*\u2022\u2013\u2014]+\s+", re.MULTILINE)
_EMPHASIS = re.compile(r"(\*{1,3}|_{2,})(.+?)\1", re.DOTALL)
_HEADING = re.compile(r"^#{1,6}\s*", re.MULTILINE)
_CODE = re.compile(r"`+")
_LEFTOVER_STARS = re.compile(r"[*_#]{1,}")
_WHITESPACE = re.compile(r"\s+")
# Em and en dashes used as sentence connectors. ASCII hyphens are NOT
# touched: "SpiderMan - The Brand New Day" is a real product name, and
# stripping its hyphen would misname the poster.
_CONNECTOR_DASH = re.compile(r"\s*[\u2014\u2013]\s*")
# Models sometimes open with a speaker label ("Fabi:", "Fabi -"). The
# bubble is already attributed on screen, so it reads as a stutter.
_SPEAKER_PREFIX = re.compile(r"^\s*fabi\s*[:\-\u2013\u2014]\s*", re.IGNORECASE)


def clean_answer(text: str) -> str:
    """
    Flatten a model reply into one clean paragraph.

    Order matters: strip bullets and headings while the line starts still
    exist, unwrap emphasis before removing stray markers, and collapse
    whitespace last so the newlines those rules leave behind disappear.
    """
    if not text:
        return ""

    cleaned, stripped_prefix = _SPEAKER_PREFIX.subn("", text)
    cleaned = _HEADING.sub("", cleaned)
    cleaned = _BULLET.sub("", cleaned)
    cleaned = _EMPHASIS.sub(r"\2", cleaned)
    cleaned = _CODE.sub("", cleaned)
    cleaned = _LEFTOVER_STARS.sub("", cleaned)
    # Every newline becomes a space; the bubble is one paragraph.
    cleaned = _CONNECTOR_DASH.sub(", ", cleaned)
    cleaned = _WHITESPACE.sub(" ", cleaned)
    # Tidy the punctuation left where a bullet used to be.
    cleaned = re.sub(r"\s+([,.!?;:])", r"\1", cleaned)
    cleaned = cleaned.strip()
    # Removing a "Fabi:" label can leave the sentence starting lowercase.
    if stripped_prefix and cleaned:
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned


def build_fallback_answer(query: str, products: list[dict]) -> str:
    """
    The answer used when OpenRouter is unavailable.

    Written flat on purpose. This used to be a keyword ladder of canned
    sales lines — "Gear up your setup!", "Assemble your gallery!" — which
    were the most advertising-sounding sentences in the product and, worse,
    fired on a substring so "a poster for my son who hates gaming" got the
    high-energy gaming pitch. A plain sentence naming what was found is
    both friendlier and harder to get wrong.

    The customer sees a card for every poster below the message, so this
    does not repeat prices or descriptions.
    """
    if not products:
        return (
            "I couldn't find anything matching that. Try describing the look "
            "you're after, or a character or colour, and I'll take another go."
        )

    titles = [p.get("title", "") for p in products[:2] if p.get("title")]

    if len(titles) == 1:
        return f"{titles[0]} looks like the closest match. Have a look and see what you think."
    if len(titles) == 2:
        return f"{titles[0]} and {titles[1]} both look close to what you're after."
    return "Here's what came up closest."

async def call_openrouter_llm(query: str, products: list[dict]) -> str:
    """
    Call OpenRouter API with retrieved poster context using Gemini 2.5 Flash / OpenRouter model.
    """
    if not settings.OPENROUTER_API_KEY:
        return build_fallback_answer(query, products)

    # Format retrieved products as context for LLM prompt
    product_context_lines = []
    for idx, p in enumerate(products, 1):
        line = f"{idx}. Title: {p.get('title')} | Category: {p.get('category')} | Price: ₹{p.get('price')} | Description: {p.get('description')} | Stock: {p.get('stock')}"
        # A poster only gets a marketing hook if it is riding a live
        # trend AND was already retrieved for this query. The trend never
        # decides what is shown, only how what is shown gets described.
        trend = trend_for_product(str(p.get("_id") or p.get("productId") or ""))
        if trend:
            line += f" | TRENDING NOW: {trend['topic']}"
            if trend.get("headline"):
                line += f" ({trend['headline']})"
        product_context_lines.append(line)

    context_str = "\n".join(product_context_lines) if product_context_lines else "No matching products found in catalog."

    # The trend rules are only present when a poster actually carries a
    # trend. Including them unconditionally primes the model: asked for
    # Spider-Man with an empty correlation map, it still volunteered
    # "which is everywhere right now" — inventing the popularity claim
    # the section was there to govern. No marker, no mention of trends.
    has_trend = "TRENDING NOW:" in context_str
    trend_rules = (
        (
            "TRENDING:\n"
            "- A poster marked 'TRENDING NOW' is genuinely in the news today.\n"
            "  You may mention that in passing, the way a person would: 'a\n"
            "  lot of people have been asking about this one lately'. One\n"
            "  short clause inside a sentence you were writing anyway.\n"
            "- Keep it offhand. 'Everywhere right now', 'blowing up' and\n"
            "  'trending' itself all sound like an ad; a shop assistant\n"
            "  would just say people have been asking.\n"
            "- Only for posters you were already going to recommend, and\n"
            "  never name the news story. Skip it entirely if it does not\n"
            "  fit naturally.\n\n"
        )
        if has_trend
        else (
            "POPULARITY:\n"
            "- You have no sales or popularity data. Never say a poster is\n"
            "  trending, popular, a bestseller, 'everywhere right now', or\n"
            "  otherwise in demand. Recommend on what it looks like.\n\n"
        )
    )

    system_prompt = (
        "You are Fabi. You work at Print Labs, a poster shop, and you know "
        "the walls well. Your name is exactly 'Fabi' — never call yourself a "
        "bot, an AI, an assistant, or any variation such as FabiBot.\n\n"
        "Recommend posters based ONLY on the retrieved catalogue below.\n\n"
        "VOICE — this is the part that matters most:\n"
        "- Talk like a friend who happens to work here, not a shop selling to\n"
        "  a stranger. Relaxed, warm, specific. Contractions are good.\n"
        "- Say what a poster actually looks like and why it might suit them.\n"
        "  Concrete beats enthusiastic: 'it's mostly black with one red\n"
        "  figure' tells them more than 'it's stunning'.\n"
        "- BANNED, because they read as advertising copy rather than a\n"
        "  person: stunning, gorgeous, amazing, incredible, must-have,\n"
        "  perfect for you, elevate, transform your space, level up, gear up,\n"
        "  assemble, dive in, look no further, we've got you covered,\n"
        "  you'll love, absolutely, definitely worth. No exclamation marks.\n"
        "- Do not open with a sales flourish ('Great choice!', 'Ooh, nice!').\n"
        "  Just answer.\n"
        "- Do not end every reply with a pushy question. Ask one only when\n"
        "  you genuinely need to narrow something down.\n"
        "- If nothing really fits, say so plainly. 'We don't have anything\n"
        "  like that right now' is a good answer and builds more trust than\n"
        "  steering them to something unrelated.\n"
        "- Never call the customer 'buddy', 'mate', 'friend' or similar.\n"
        "  Being friendly is a manner, not a nickname.\n\n"
        "FORMAT — the reply is rendered as plain text in a small chat bubble:\n"
        "- Write 1-3 short sentences of flowing prose. Nothing longer.\n"
        "- No markdown whatsoever: no *, **, _, #, backticks, or bullet points.\n"
        "- No lists of any kind. No line breaks. One paragraph.\n"
        "- Never use a dash to join clauses. No em dashes, no en dashes, no\n"
        "  ' - '. Use a comma or a full stop. (A hyphen inside a poster's\n"
        "  actual name is fine, e.g. 'SpiderMan - The Brand New Day'.)\n"
        "- Do NOT state prices or repeat each poster's details. The customer\n"
        "  already sees a card for every poster you mention, with its image,\n"
        "  name and price, directly beneath your message. Repeating them\n"
        "  duplicates what is on screen.\n"
        "- Mention at most two posters by name, and only to say why they fit.\n"
        "- Never prefix the reply with your own name. The chat bubble is\n"
        "  already labelled, so 'Fabi: ...' reads as a stutter.\n\n"
        f"{trend_rules}"
        "BOUNDARIES:\n"
        "- Do NOT answer questions about payments, UPI, cards, billing, refunds\n"
        "  or transactions; those are refused before reaching you.\n"
        "- Do NOT invent posters that are not in the list below.\n\n"
        f"RETRIEVED POSTER CATALOG PRODUCTS:\n{context_str}"
    )

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Customer Question: '{query}'"}
    ]

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "HTTP-Referer": "https://printlabs.dev",
        "X-Title": "Print Labs AI Assistant",
        "Content-Type": "application/json"
    }

    payload = {
        "model": settings.OPENROUTER_MODEL,
        "messages": messages,
        "temperature": 0.5,
        # Generation time scales with tokens produced, and this is the
        # whole latency budget — retrieval is ~3ms, the model is 1.5-3.5s.
        # The system prompt already asks for 2-4 sentences, so 256 was
        # headroom the model occasionally spent.
        "max_tokens": 180,
    }

    try:
        async with httpx.AsyncClient(timeout=12.0) as client:
            resp = await client.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
            if resp.status_code == 200:
                data = resp.json()
                choices = data.get("choices", [])
                if choices and len(choices) > 0:
                    answer = clean_answer(
                        choices[0].get("message", {}).get("content", "")
                    )
                    if answer:
                        return answer
            else:
                logger.warning(f"OpenRouter API error {resp.status_code}: {resp.text}")
    except Exception as e:
        logger.error(f"Failed to call OpenRouter LLM: {e}")

    # Fallback to rule-based answer if API fails or times out
    return build_fallback_answer(query, products)

async def process_rag_pipeline(query: str) -> dict:
    # 1. Extract structured price constraints before any other processing.
    price_constraints = extract_price_constraints(query)
    logger.info(f"Price constraints extracted: {price_constraints}")

    # 2. Strip price numbers so the embedder focuses on intent.
    semantic_query = strip_price_phrases(query)

    # 3. Embed the cleaned query locally via FastEmbed (0-cost).
    #    embed_query adds the BGE retrieval instruction; the catalogue
    #    side must not have it.
    q_vec = embed_query(semantic_query)

    # 4. HYBRID RETRIEVAL
    #
    #    Price constraints change the retrieval shape. The naive path
    #    (embed → Qdrant top-k → filter) loses recall because the
    #    vector ranking does not know about price, and a generic query
    #    like "do you have a poster for Rs.250" pulls the most
    #    "poster-like" semantic match regardless of price.
    #
    #    When price constraints exist, fetch candidates from MongoDB
    #    by price first, then rerank semantically within that set.
    #    Without constraints, fall back to Qdrant similarity (the
    #    original behaviour).
    retrieved_products: list[dict] = []
    band = price_band(price_constraints)

    if band:
        mongo_min, mongo_max = band
        mongo_candidates = await _fetch_products_by_price(mongo_min, mongo_max)
        logger.info(
            f"Price band [Rs.{mongo_min}, Rs.{mongo_max}] → "
            f"{len(mongo_candidates)} MongoDB candidates."
        )

        if mongo_candidates:
            retrieved_products = _rerank_by_similarity(q_vec, mongo_candidates)[:8]
            logger.info(
                "Reranked top 3: "
                + ", ".join(
                    f"{p.get('title')} Rs.{p.get('price')}"
                    for p in retrieved_products[:3]
                )
            )

    if not retrieved_products:
        # No price constraint, or the MongoDB band was empty: use Qdrant.
        # The band is pushed down into the query so the bound is applied
        # *before* top-k, rather than shrinking an already-truncated list.
        filters = (
            {"min_price": band[0], "max_price": band[1]} if band else None
        )
        retrieved_products = search_products(q_vec, top_k=8, filters=filters)
        if not retrieved_products:
            relaxed = max(
                0.0, settings.SEARCH_SCORE_THRESHOLD - settings.SEARCH_RELAXED_DELTA
            )
            logger.info(
                f"No hits above {settings.SEARCH_SCORE_THRESHOLD}; "
                f"retrying at {relaxed:.2f}."
            )
            retrieved_products = search_products(
                q_vec, top_k=8, score_threshold=relaxed, filters=filters
            )

    # 5. Refresh from MongoDB so prices, stock and availability are
    #    current. The Qdrant payload may be stale if a product was
    #    updated since the last sync.
    if retrieved_products:
        fresh_ids = [
            str(p.get("productId") or p.get("_id")) for p in retrieved_products
        ]
        fresh_products = await _fetch_fresh_products(fresh_ids)
        if fresh_products:
            retrieved_products = fresh_products

    # 6. Generate a natural answer using the OpenRouter LLM.
    answer = await call_openrouter_llm(query, retrieved_products)

    return {
        "answer": answer,
        "products": retrieved_products,
    }


def _rerank_by_similarity(q_vec: list[float], products: list[dict]) -> list[dict]:
    """
    Order a MongoDB candidate set by semantic closeness to the query.

    Two details matter here and are easy to get wrong:

    - The candidates are *documents*, so they are embedded with
      ``embed_texts``. ``embed_query`` prepends the BGE retrieval
      instruction, which belongs on the query side only; putting it on
      the catalogue side puts the two in different regions of the space
      and quietly scrambles the ranking.
    - They are embedded in a single batch. fastembed is synchronous CPU
      work, so a per-candidate call both loses the batching and blocks
      the event loop for every other request in flight.
    """
    if not products or not q_vec:
        return products

    texts = [
        f"{p.get('title', '')} {p.get('category', '')} {p.get('description', '')}".strip()
        for p in products
    ]
    vectors = embed_texts(texts)
    if len(vectors) != len(products):
        # Embedding failed; keep MongoDB's price ordering rather than
        # dropping the candidates entirely.
        logger.warning("Rerank embedding failed; keeping price order.")
        return products

    # Vectors are L2-normalised, so the dot product is already the cosine.
    scored = [
        (sum(a * b for a, b in zip(q_vec, vec)), p)
        for vec, p in zip(vectors, products)
    ]
    scored.sort(key=lambda pair: pair[0], reverse=True)
    return [p for _, p in scored]


async def _fetch_fresh_products(product_ids: list[str]) -> list[dict]:
    """
    Pull the latest product data from MongoDB via the Express REST API.

    MongoDB is the source of truth for price, stock and availability.
    The vector store payload may be stale if a product was updated since
    the last sync. This call brings the returned products up to date.
    """
    if not product_ids:
        return []

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            # Build comma-separated IDs for the Express endpoint.
            ids_param = ",".join(str(i) for i in product_ids)
            resp = await client.get(
                f"{settings.EXPRESS_API_URL}/products",
                # This response *replaces* the retrieved list, so it must
                # carry everything the prompt needs. Without the opt-in
                # the projection drops descriptions and the LLM is asked
                # to recommend posters it has no description for.
                params={"ids": ids_param, "includeDescription": "true"},
            )
            if resp.status_code == 200:
                body = resp.json()
                products = (
                    body.get("data", {}).get("products")
                    or body.get("products", [])
                )
                logger.info(
                    f"Refreshed {len(products)} products from MongoDB. "
                    f"Prices: {[p.get('price') for p in products]}"
                )
                return products
            else:
                logger.warning(
                    f"Fresh product fetch returned {resp.status_code}: {resp.text[:200]}"
                )
    except Exception as e:
        logger.warning(f"Could not refresh products from MongoDB: {e}")

    return []


async def _fetch_products_by_price(min_price: float, max_price: float) -> list[dict]:
    """
    Fetch active products whose price is in ``[min_price, max_price]``.

    Used as the first stage of hybrid retrieval when the user query
    mentions a price. MongoDB is the source of truth for price, and
    it can filter the active catalogue by an exact price band without
    any ranking bias from the vector index.
    """
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{settings.EXPRESS_API_URL}/products",
                params={
                    "minPrice": int(min_price),
                    "maxPrice": int(max_price),
                    "limit": 50,
                    "sort": "price_asc",
                    "includeDescription": "true",
                },
            )
            if resp.status_code == 200:
                body = resp.json()
                products = (
                    body.get("data", {}).get("products")
                    or body.get("products", [])
                )
                return products
            else:
                logger.warning(
                    f"Price-band fetch returned {resp.status_code}: {resp.text[:200]}"
                )
    except Exception as e:
        logger.warning(f"Could not fetch products by price from MongoDB: {e}")
    return []
