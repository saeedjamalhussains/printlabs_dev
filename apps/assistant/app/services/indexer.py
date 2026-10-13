import asyncio
import hashlib
import logging
import httpx
from app.config import settings
from app.services.embedder import embed_texts
from app.services.vector_store import reset_collection, upsert_products

logger = logging.getLogger("fabi_indexer")


def point_id(product_id: str) -> int:
    """
    Stable numeric Qdrant id derived from the Mongo _id.

    Python's built-in hash() is salted per process, so the same product
    got a different vector id on every restart. That is harmless while
    the store is in-memory and rebuilt each boot, but it silently
    duplicates every product the moment the store is made persistent.
    blake2b is deterministic across processes and runs.
    """
    digest = hashlib.blake2b(product_id.encode("utf-8"), digest_size=6).hexdigest()
    return int(digest, 16)

def build_rich_text(p: dict) -> str:
    title = p.get("title", "")
    category = p.get("category", "")
    description = p.get("description", "")
    sizes = p.get("sizes", [])
    sizes_str = ", ".join([s.get("label", "") for s in sizes if isinstance(s, dict)]) if sizes else ""
    stock = p.get("stock", 0)
    stock_str = "In Stock" if stock > 0 else "Out of Stock"
    
    return f"Title: {title} | Category: {category} | Description: {description} | Sizes: {sizes_str} | Availability: {stock_str}"

async def fetch_all_products(client: httpx.AsyncClient) -> list[dict]:
    """
    Pull the whole active catalogue, one page at a time.

    The previous single request asked for `limit=1000`, but the Express
    endpoint clamps `limit` to 100 — so anything past the hundredth
    product was silently never indexed and the chatbot simply could not
    see it. Paging makes the size of the catalogue irrelevant.

    `includeDescription` is required: descriptions are excluded from the
    default projection, so without it every product was embedded with an
    empty description — the single richest signal for semantic search.
    """
    page_size = settings.CATALOG_PAGE_SIZE
    products: list[dict] = []
    page = 1

    while True:
        url = (
            f"{settings.EXPRESS_API_URL}/products"
            f"?limit={page_size}&page={page}&includeDescription=true"
        )
        resp = await client.get(url)
        if resp.status_code != 200:
            logger.error(f"Express catalog request failed with status {resp.status_code} (page {page})")
            break

        body = resp.json()
        data = body.get("data", {}) if isinstance(body.get("data"), dict) else {}
        batch = data.get("products") or body.get("products") or []
        products.extend(batch)

        pagination = data.get("pagination") or {}
        total_pages = pagination.get("pages")

        # Stop on the reported last page; fall back to a short page when
        # the endpoint does not report pagination.
        if total_pages is not None:
            if page >= total_pages:
                break
        elif len(batch) < page_size:
            break

        page += 1

        # Belt and braces: never loop forever if pagination misreports.
        if page > 200:
            logger.warning("Catalog paging stopped at 200 pages — check pagination metadata.")
            break

    return products


# Serialises rebuilds. Two overlapping syncs would interleave their
# reset/upsert and could leave the collection holding a mixture of both
# runs — trivially reachable by saving two products in quick succession.
_sync_lock = asyncio.Lock()


async def sync_catalog():
    async with _sync_lock:
        return await _sync_catalog_locked()


async def _sync_catalog_locked():
    logger.info(f"Fetching catalogue from {settings.EXPRESS_API_URL}/products (paged)")
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            products = await fetch_all_products(client)
            if not products:
                logger.warning("No active products returned from catalog endpoint.")
                return 0

            rich_texts = [build_rich_text(p) for p in products]
            embeddings = embed_texts(rich_texts)
            
            points = []
            for idx, (p, vec) in enumerate(zip(products, embeddings)):
                if not vec:
                    continue
                prod_id = str(p.get("_id", idx))
                id_num = point_id(prod_id)
                
                images = p.get("images", [])
                image_url = ""
                if images and isinstance(images, list) and len(images) > 0:
                    first_img = images[0]
                    if isinstance(first_img, dict):
                        image_url = first_img.get("url", "")
                    elif isinstance(first_img, str):
                        image_url = first_img
                if not image_url:
                    image_url = p.get("imageUrl", "") or p.get("image", "")
                
                payload = {
                    "_id": prod_id,
                    "productId": prod_id,
                    "title": p.get("title", ""),
                    "description": p.get("description", ""),
                    "price": p.get("price", 0),
                    "category": p.get("category", ""),
                    "stock": p.get("stock", 0),
                    "imageUrl": image_url,
                    "image": image_url,
                    "images": images if isinstance(images, list) else [],
                }
                points.append({
                    "id_num": id_num,
                    "product_id": prod_id,
                    "vector": vec,
                    "payload": payload
                })
            
            # Never destroy a working index to replace it with nothing.
            #
            # embed_texts swallows its own exceptions and returns [], so a
            # transient failure (model cache, OOM, a bad download) used to
            # produce zero points, reset the collection anyway, and log
            # "Successfully indexed 0 products" — the chatbot then answered
            # nothing for every query until the next successful sync.
            # Keeping the previous vectors is strictly better than serving
            # an empty catalogue.
            if not points:
                logger.error(
                    f"Embedding produced no vectors for {len(products)} product(s); "
                    "keeping the existing index rather than clearing it."
                )
                return 0

            # Rebuild rather than merge, so products that have been
            # discontinued or deleted since the last sync disappear from
            # search instead of lingering.
            reset_collection()
            upsert_products(points)
            logger.info(f"Successfully indexed {len(points)} products into Qdrant vector store.")
            return len(points)
            
    except Exception as e:
        logger.error(f"Failed to sync product catalog from Express: {e}")
        return 0
