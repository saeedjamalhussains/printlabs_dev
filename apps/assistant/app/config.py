import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    EXPRESS_API_URL: str = os.getenv("EXPRESS_API_URL", "http://localhost:5001/api")
    # Shared secret between the Express API and this service. No default,
    # for the same reason as above — a published default is not a secret.
    INTERNAL_API_KEY: str = os.getenv("INTERNAL_API_KEY", "")
    QDRANT_COLLECTION_NAME: str = "poster_vectors"
    VECTOR_SIZE: int = 384

    # Browser origins allowed to call this service directly. Normally
    # empty: the storefront calls Express, which proxies here. Set it
    # only if a browser genuinely needs to reach the service.
    # Comma-separated in the environment, e.g. "http://localhost:5173".
    ALLOWED_ORIGINS: list[str] = []

    # Page size used when pulling the catalogue from Express. The Express
    # endpoint caps `limit` at 100, so asking for more silently truncates;
    # the indexer pages through instead.
    CATALOG_PAGE_SIZE: int = 100

    # Minimum cosine similarity for a vector hit to count.
    #
    # Measured against this catalogue with bge-small-en-v1.5 (vectors are
    # L2-normalised, so the dot product is the cosine):
    #
    #   relevant matches    0.5247 - 0.8008   (mean 0.69)
    #   irrelevant queries  0.5051 - 0.5720   (mean 0.54)
    #     e.g. "car insurance quotes" peaks at 0.5720
    #
    # 0.60 sits in the gap: it admits every strong match (0.62+) and
    # rejects every off-topic query tested. It is deliberately NOT the
    # 0.72 that the model card's "unrelated text scores 0.6-0.7" rule of
    # thumb suggests — that guess would have dropped most real matches.
    # Re-measure if the catalogue changes character.
    SEARCH_SCORE_THRESHOLD: float = 0.60

    # The bands overlap slightly: a vaguely-worded but genuine query
    # ("something dark and moody" -> 0.5247) can score below an off-topic
    # one. No single cut-off separates those, so a miss at the primary
    # threshold retries this much lower rather than answering "nothing
    # found" to a real question.
    SEARCH_RELAXED_DELTA: float = 0.12
    # No default. A fallback here is a credential in source control, and
    # this one was: the previous literal is in the git history and must be
    # treated as leaked and rotated. Absent configuration should stop the
    # service at startup rather than let it run on someone else's key.
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_MODEL: str = os.getenv("OPENROUTER_MODEL", "google/gemini-2.5-flash")

    # ─── Trending-topic correlation ──────────────────────────────────
    # Google Trends publishes daily trending searches as RSS with no API
    # account, which is why it is the default source. {geo} is filled in
    # from TRENDS_GEO. Point this at another feed to change provider; the
    # parser expects the same Google Trends RSS shape.
    TRENDS_ENABLED: bool = os.getenv("TRENDS_ENABLED", "true").lower() == "true"
    TRENDS_FEED_URL: str = os.getenv(
        "TRENDS_FEED_URL", "https://trends.google.com/trending/rss?geo={geo}"
    )
    TRENDS_GEO: str = os.getenv("TRENDS_GEO", "IN")

    # How often the background task rebuilds the correlation map. Daily
    # trends move slowly; refreshing faster spends CPU on re-embedding
    # for no benefit.
    TRENDS_REFRESH_MINUTES: int = int(os.getenv("TRENDS_REFRESH_MINUTES", "30"))
    TRENDS_TIMEOUT_SECONDS: float = float(os.getenv("TRENDS_TIMEOUT_SECONDS", "8"))
    TRENDS_MAX_TOPICS: int = int(os.getenv("TRENDS_MAX_TOPICS", "20"))
    # One poster per topic. A news story is about a single thing, so the
    # runner-up is usually a same-genre neighbour riding in on shared
    # vocabulary: a Spider-Man trailer scored 0.7210 against the
    # Spider-Man poster and 0.5875 against Doom, which would have had
    # Fabi telling a customer that Doom was "everywhere right now" on the
    # strength of a Spider-Man story. Raise this only if the catalogue
    # grows enough to hold several genuinely distinct posters per topic.
    TRENDS_MATCHES_PER_TOPIC: int = int(os.getenv("TRENDS_MATCHES_PER_TOPIC", "1"))

    # Minimum similarity for "this poster relates to that trend".
    #
    # Measured, not guessed — against this catalogue, scoring the topic
    # plus its news headlines as one query:
    #
    #   poster-relevant topics   0.5934 - 0.7106   (n=8,  mean 0.63)
    #     e.g. "Doctor Doom confirmed as the villain..." -> 0.6185
    #   real off-topic trends    0.4246 - 0.5516   (n=14, mean 0.49)
    #     e.g. Djokovic, Binance, exam answer keys, gold rates
    #
    # 0.59 sits just under the weakest genuine match. It started at 0.58
    # on the numbers above, until a live topic — "fool.com", carrying a
    # Meta AI headline — scored 0.5810 against a candle poster and was
    # admitted. Bare domains are now dropped before scoring (they are
    # navigational searches, not events), and this moved up the last
    # 0.01 as well.
    #
    # An earlier guess of 0.68 looked "safely strict" and in fact kept
    # only 1 of the 8 genuine matches — the feature would have appeared
    # to work while silently correlating almost nothing.
    #
    # Bias when re-tuning: a false negative costs one missed marketing
    # line, a false positive has Fabi assert a link between a poster and
    # an unrelated news story to a customer. Move it up, not down.
    TRENDS_MATCH_THRESHOLD: float = float(os.getenv("TRENDS_MATCH_THRESHOLD", "0.59"))

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()


def verify_required_settings(settings: "Settings") -> None:
    """
    Stop the process when a credential is missing.

    Starting without these does not fail loudly — the service comes up,
    accepts traffic, and then errors on the first real request, which is
    much harder to diagnose than a refusal to boot.
    """
    missing = [
        name
        for name in ("OPENROUTER_API_KEY", "INTERNAL_API_KEY")
        if not getattr(settings, name, "")
    ]
    if missing:
        raise RuntimeError(
            "Missing required environment variables: "
            + ", ".join(missing)
            + ". Copy apps/assistant/.env.example to .env and fill them in."
        )
