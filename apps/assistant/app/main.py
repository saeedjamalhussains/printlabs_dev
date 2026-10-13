import asyncio
import logging
import secrets
from contextlib import asynccontextmanager
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from app.config import settings
from app.services.indexer import sync_catalog
from app.services.rag import process_rag_pipeline
from app.services.trends import current_trends, refresh_trends, trends_refresh_loop

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("fabi_main")


def require_internal_key(x_internal_api_key: str = Header(None)) -> None:
    """
    Reject callers that do not present the shared service key.

    This previously logged a warning and carried on, which left both
    endpoints open to anyone who could reach the port. That matters more
    than a normal missing auth check would: every /chat call spends
    OpenRouter credits, so an open endpoint is a billable one.

    Setting INTERNAL_API_KEY to an empty string disables the check — an
    explicit opt-out for local work, rather than the old behaviour of
    being permanently off whatever the config said.
    """
    expected = settings.INTERNAL_API_KEY
    if not expected:
        return

    # compare_digest keeps the comparison constant-time, so the key
    # cannot be recovered a character at a time by timing responses.
    if not x_internal_api_key or not secrets.compare_digest(x_internal_api_key, expected):
        logger.warning("Rejected request with missing or invalid internal API key.")
        raise HTTPException(status_code=401, detail="Invalid or missing internal API key.")

# Startup ordering is not guaranteed — this service and Express are
# separate processes, and `npm run dev` may not have finished booting.
STARTUP_RETRY_DELAYS = (2, 5, 10, 30, 60)


async def index_with_retry():
    """
    Seed the vector store, retrying until Express answers.

    A single attempt at startup meant that losing the race with Express
    left the service running with an empty index and no way back: it
    served "no posters found" to every query until somebody happened to
    edit a product. Backing off and retrying makes boot order irrelevant.
    """
    for attempt, delay in enumerate((0, *STARTUP_RETRY_DELAYS), start=1):
        if delay:
            await asyncio.sleep(delay)
        try:
            count = await sync_catalog()
            if count > 0:
                logger.info(f"Startup indexing complete: {count} vectors loaded.")
                return
            logger.warning(
                f"Startup indexing attempt {attempt} loaded nothing "
                "(Express may still be starting)."
            )
        except Exception as err:
            logger.warning(f"Startup indexing attempt {attempt} failed: {err}")

    logger.error(
        "Could not index the catalogue at startup. The chatbot will answer "
        "from the Express keyword fallback until the next product change."
    )


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting Print Labs AI Microservice...")
    # Runs in the background so the service accepts requests immediately
    # rather than blocking the port behind a model download plus retries.
    tasks = [asyncio.create_task(index_with_retry())]

    # Trend correlation is refreshed on its own schedule and never in the
    # request path, so an unreachable feed costs a log line, not latency.
    if settings.TRENDS_ENABLED:
        tasks.append(asyncio.create_task(trends_refresh_loop()))
    else:
        logger.info("Trend correlation disabled (TRENDS_ENABLED=false).")

    yield

    for task in tasks:
        task.cancel()
    logger.info("Shutting down Print Labs AI Microservice.")

app = FastAPI(
    title="Print Labs AI Poster Assistant Microservice",
    version="1.0.0",
    lifespan=lifespan
)

# No browser ever calls this service directly — the storefront talks to
# Express, which proxies to /api/v1/chat server-to-server. So the default
# origin list is empty and CORS grants nothing.
#
# The previous `allow_origins=["*"]` with `allow_credentials=True` was also
# invalid per the CORS spec: browsers refuse a wildcard origin on a
# credentialed request, so it never granted what it appeared to.
if settings.ALLOWED_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.ALLOWED_ORIGINS,
        allow_credentials=True,
        allow_methods=["POST", "GET", "OPTIONS"],
        allow_headers=["Content-Type", "X-Internal-API-Key"],
    )

# Roughly a long paragraph. Real product questions are far shorter.
MAX_QUERY_CHARS = 500


class ChatRequest(BaseModel):
    query: str

class ChatResponse(BaseModel):
    answer: str
    products: list[dict]

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "printlabs-ai-service"}

@app.post("/api/v1/chat", response_model=ChatResponse, dependencies=[Depends(require_internal_key)])
async def chat_endpoint(payload: ChatRequest):
    query = (payload.query or "").strip()
    if not query:
        raise HTTPException(status_code=400, detail="Query cannot be empty.")

    # Bound the prompt. Without a cap a caller can paste an arbitrarily
    # long body straight into the LLM request and drive up token cost.
    if len(query) > MAX_QUERY_CHARS:
        raise HTTPException(
            status_code=400,
            detail=f"Query is too long (max {MAX_QUERY_CHARS} characters).",
        )

    return await process_rag_pipeline(query)


@app.post("/api/v1/reindex", dependencies=[Depends(require_internal_key)])
async def reindex_endpoint():
    # Previously unauthenticated, so anyone reachable could force a full
    # re-embed of the catalogue on demand.
    count = await sync_catalog()
    return {"status": "success", "indexed_count": count}


@app.get("/api/v1/trends", dependencies=[Depends(require_internal_key)])
async def trends_endpoint():
    """
    What is currently trending and which posters it was matched to.

    Operational visibility, not a customer endpoint: correlating nothing
    is the normal case, and this is how you tell that apart from a
    broken feed.
    """
    return {"status": "success", **current_trends()}


@app.post("/api/v1/trends/refresh", dependencies=[Depends(require_internal_key)])
async def trends_refresh_endpoint():
    """Force a refresh instead of waiting for the next scheduled cycle."""
    await refresh_trends()
    return {"status": "success", **current_trends()}
