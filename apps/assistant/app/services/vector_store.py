import logging
from qdrant_client import QdrantClient
from qdrant_client.models import VectorParams, Distance, PointStruct, Filter, FieldCondition, Range
from app.config import settings

logger = logging.getLogger("fabi_qdrant")

# Initialize in-memory Qdrant instance (0-cost, sub-10ms similarity search)
qdrant_client = QdrantClient(":memory:")

def init_collection():
    try:
        collections = qdrant_client.get_collections().collections
        exists = any(c.name == settings.QDRANT_COLLECTION_NAME for c in collections)
        if not exists:
            logger.info(f"Creating Qdrant collection '{settings.QDRANT_COLLECTION_NAME}'...")
            qdrant_client.create_collection(
                collection_name=settings.QDRANT_COLLECTION_NAME,
                vectors_config=VectorParams(size=settings.VECTOR_SIZE, distance=Distance.COSINE),
            )
            logger.info("Qdrant collection created successfully.")
    except Exception as e:
        logger.error(f"Error initializing Qdrant collection: {e}")

def reset_collection():
    """
    Drop and recreate the collection so a sync reflects the catalogue
    exactly.

    A sync used to only upsert, which cannot express a removal: when a
    product was discontinued or deleted it simply stopped appearing in
    the Express response, so its vector was left behind and the bot kept
    recommending a poster nobody can buy. Rebuilding is cheap here — the
    store is in-memory and the whole catalogue is re-embedded anyway.
    """
    try:
        qdrant_client.delete_collection(collection_name=settings.QDRANT_COLLECTION_NAME)
    except Exception:
        # Nothing to drop on the first run.
        pass
    init_collection()


def upsert_products(product_points: list[dict]):
    """
    product_points format:
    [{ 'id_num': int, 'product_id': str, 'vector': [...], 'payload': {...} }]
    """
    if not product_points:
        return
    init_collection()
    points = [
        PointStruct(
            id=item['id_num'],
            vector=item['vector'],
            payload=item['payload']
        )
        for item in product_points
    ]
    qdrant_client.upsert(
        collection_name=settings.QDRANT_COLLECTION_NAME,
        points=points
    )
    logger.info(f"Successfully upserted {len(points)} product vectors to Qdrant.")

def count_points() -> int:
    """
    How many posters are currently indexed.

    Used to tell "nothing is trending" apart from "the index was not
    ready yet" — correlating against an empty collection silently
    produces zero matches and looks identical to a quiet news day.
    """
    try:
        init_collection()
        return qdrant_client.count(
            collection_name=settings.QDRANT_COLLECTION_NAME
        ).count
    except Exception as err:
        logger.warning(f"Could not count indexed points: {err}")
        return 0


def _build_price_filter(filters: dict | None):
    """
    Convert extracted price constraints into a Qdrant ``Filter``.

    Only numeric bounds are passed — categories, sizes, stock and other
    product attributes stay on the MongoDB side, where they belong.
    """
    if not filters:
        return None
    conditions = []
    if filters.get("max_price") is not None:
        conditions.append(
            FieldCondition(key="price", range=Range(lte=float(filters["max_price"])))
        )
    if filters.get("min_price") is not None:
        conditions.append(
            FieldCondition(key="price", range=Range(gte=float(filters["min_price"])))
        )
    if not conditions:
        return None
    return Filter(must=conditions)


def search_products(
    query_vector: list[float],
    top_k: int = 4,
    score_threshold: float | None = None,
    filters: dict | None = None,
) -> list[dict]:
    if not query_vector:
        return []
    init_collection()
    if score_threshold is None:
        score_threshold = settings.SEARCH_SCORE_THRESHOLD

    qdrant_filter = _build_price_filter(filters)

    try:
        # Use query_points for latest qdrant-client versions
        kwargs = dict(
            collection_name=settings.QDRANT_COLLECTION_NAME,
            query=query_vector,
            limit=top_k,
            # The previous hardcoded 0.35 sat below every score this
            # catalogue produces (off-topic queries still reach ~0.51), so
            # the "threshold" filtered nothing and every query returned
            # four posters whether or not any were relevant. See
            # SEARCH_SCORE_THRESHOLD for the measured distribution.
            score_threshold=score_threshold,
        )
        if qdrant_filter is not None:
            kwargs["query_filter"] = qdrant_filter

        results = qdrant_client.query_points(**kwargs).points

        matches = []
        for res in results:
            payload = res.payload
            payload['score'] = round(float(res.score), 4)
            matches.append(payload)
        return matches
    except Exception as e:
        logger.error(f"Error executing Qdrant search: {e}")
        return []
