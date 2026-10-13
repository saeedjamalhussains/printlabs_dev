"""
Correlate what the internet is searching for with what we have on the wall.

Google Trends publishes daily trending searches as a keyless RSS feed, so
this needs no API account. Each trending topic is embedded and matched
against the poster index; anything that clears the threshold is recorded
as "this poster is topical right now, because of X".

Two design rules matter here:

1. **Never in the request path.** The feed is fetched by a background
   task and the correlation map is precomputed, so answering a customer
   is a dictionary lookup. A slow or unreachable Google must not add a
   second to a chat reply.
2. **Fail soft, and keep the last good map.** A failed refresh leaves the
   previous correlations in place rather than blanking them, because a
   stale trend is far better than an answer that suddenly loses its
   marketing hook mid-afternoon.

Expect most refreshes to correlate nothing. India's daily trends are
mostly cricket, politics and TV; a poster shop legitimately has no
answer to those. Surfacing nothing is the correct outcome, not a bug —
the alternative is pretending a Marvel print relates to an election.
"""

import asyncio
import logging
import re
import time
from xml.etree import ElementTree

import httpx

from app.config import settings
from app.services.embedder import embed_query
from app.services.vector_store import count_points, search_products

logger = logging.getLogger("fabi_trends")

_NS = {"ht": "https://trends.google.com/trending/rss"}

# Topics whose text is mostly non-Latin are skipped: the embedding model
# is bge-small-en, so a Hindi or Tamil headline lands somewhere arbitrary
# in the vector space and produces confident nonsense matches.
_LATIN = re.compile(r"[A-Za-z]")

# Bare site names ("fool.com", "bbc", "binance") are navigational
# searches — someone reaching for a website, not a cultural moment a
# poster can relate to. They still carry news headlines, so they embed
# like real topics and score like them: "fool.com" (a Meta AI story)
# reached 0.5810 against a candle poster, above every genuinely
# off-topic score measured. Dropping them is a cleaner fix than chasing
# the threshold up into the range where real matches live.
_DOMAIN_LIKE = re.compile(r"^[\w-]+\.(com|net|org|io|co|in|news|tv)$", re.IGNORECASE)

# The correlation map, and when it was last successfully rebuilt.
_state: dict = {"topics": [], "by_product": {}, "fetched_at": 0.0}
_lock = asyncio.Lock()


def _is_usable_topic(text: str) -> bool:
    """Enough Latin characters for an English embedding to mean anything."""
    if not text or len(text) < 3:
        return False
    if _DOMAIN_LIKE.match(text.strip()):
        return False
    letters = _LATIN.findall(text)
    return len(letters) >= max(3, len(text.replace(" ", "")) * 0.5)


def parse_trends_rss(xml_text: str, limit: int) -> list[dict]:
    """
    Pull topics out of the Google Trends RSS document.

    Each item carries a title and, usually, a few news headlines. The
    headlines are kept because a bare topic ("Deadpool") is a thin thing
    to embed, while the headline around it says what is actually
    happening and matches a poster description far more reliably.
    """
    topics: list[dict] = []

    try:
        root = ElementTree.fromstring(xml_text)
    except ElementTree.ParseError as err:
        logger.warning(f"Trends feed was not valid XML: {err}")
        return topics

    for item in root.iter("item"):
        title = (item.findtext("title") or "").strip()
        if not _is_usable_topic(title):
            continue

        headlines = [
            (news.findtext("ht:news_item_title", namespaces=_NS) or "").strip()
            for news in item.findall("ht:news_item", namespaces=_NS)
        ]
        headlines = [h for h in headlines if h][:3]

        topics.append(
            {
                "topic": title,
                "headlines": headlines,
                "traffic": (item.findtext("ht:approx_traffic", namespaces=_NS) or "").strip(),
            }
        )

        if len(topics) >= limit:
            break

    return topics


async def fetch_trending_topics() -> list[dict]:
    """Fetch and parse the trending-search feed. Returns [] on any failure."""
    url = settings.TRENDS_FEED_URL.format(geo=settings.TRENDS_GEO)
    try:
        async with httpx.AsyncClient(timeout=settings.TRENDS_TIMEOUT_SECONDS) as client:
            response = await client.get(url, headers={"User-Agent": "PrintLabs-Fabi/1.0"})
            if response.status_code != 200:
                logger.warning(f"Trends feed returned {response.status_code}.")
                return []
            return parse_trends_rss(response.text, settings.TRENDS_MAX_TOPICS)
    except Exception as err:
        logger.warning(f"Could not reach the trends feed: {err}")
        return []


def correlate(topics: list[dict]) -> dict:
    """
    Match each topic against the poster index.

    The topic is the search side of the pair, so it is embedded with
    embed_query (the BGE instruction belongs on queries); the posters
    were indexed bare. Getting that backwards silently wrecks the scores.
    """
    by_product: dict[str, dict] = {}
    matched_topics: list[dict] = []

    for entry in topics:
        # Embed the topic together with its headlines: more context, and
        # a much better match than two words on their own.
        text = " ".join([entry["topic"], *entry["headlines"]])
        vector = embed_query(text)
        if not vector:
            continue

        hits = search_products(
            vector,
            top_k=settings.TRENDS_MATCHES_PER_TOPIC,
            score_threshold=settings.TRENDS_MATCH_THRESHOLD,
        )
        if not hits:
            continue

        matched_topics.append({**entry, "matches": [h.get("title") for h in hits]})

        for hit in hits:
            product_id = str(hit.get("productId") or hit.get("_id") or "")
            if not product_id:
                continue
            existing = by_product.get(product_id)
            # A poster can ride more than one trend; keep the strongest,
            # since that is the one worth mentioning to a customer.
            if not existing or hit.get("score", 0) > existing["score"]:
                by_product[product_id] = {
                    "topic": entry["topic"],
                    "headline": entry["headlines"][0] if entry["headlines"] else "",
                    "score": hit.get("score", 0),
                }

    return {"topics": matched_topics, "by_product": by_product}


async def refresh_trends() -> dict:
    """
    Rebuild the correlation map. Concurrency-safe and non-destructive:
    a failed fetch leaves the previous map untouched.
    """
    async with _lock:
        # Correlating against an empty index yields zero matches that are
        # indistinguishable from a quiet news day, and the next attempt
        # would be a full refresh interval away. At startup this task and
        # the initial catalogue sync run concurrently, so this is the
        # normal case for the first few seconds, not an edge case.
        if count_points() == 0:
            logger.info("Poster index is not ready; deferring trend correlation.")
            return _state

        topics = await fetch_trending_topics()
        if not topics:
            logger.info("No usable trending topics this cycle; keeping the previous map.")
            return _state

        # Embedding is synchronous CPU work; keep it off the event loop so
        # chat requests in flight are not blocked by the refresh.
        result = await asyncio.to_thread(correlate, topics)

        _state["topics"] = result["topics"]
        _state["by_product"] = result["by_product"]
        _state["fetched_at"] = time.time()

        logger.info(
            f"Trends refreshed: {len(topics)} topic(s) fetched, "
            f"{len(result['topics'])} correlated to "
            f"{len(result['by_product'])} poster(s)."
        )
        return _state


def trend_for_product(product_id: str) -> dict | None:
    """The live trend a poster is riding, if any."""
    if not product_id:
        return None
    return _state["by_product"].get(str(product_id))


def current_trends() -> dict:
    """Snapshot for the /trends endpoint and for suggestion chips."""
    return {
        "topics": _state["topics"],
        "products": len(_state["by_product"]),
        "fetched_at": _state["fetched_at"],
        "age_seconds": round(time.time() - _state["fetched_at"]) if _state["fetched_at"] else None,
    }


async def trends_refresh_loop():
    """Background refresher. Started on app startup, cancelled on shutdown."""
    while True:
        ready = True
        try:
            ready = count_points() > 0
            await refresh_trends()
        except Exception as err:
            # A refresh must never kill the loop; the next cycle retries.
            logger.warning(f"Trend refresh cycle failed: {err}")

        # Waiting a full interval because the index happened not to be
        # ready would leave the shop with no trend data for half an hour
        # after every restart. Retry shortly instead.
        delay = settings.TRENDS_REFRESH_MINUTES * 60 if ready else 15
        await asyncio.sleep(delay)
