import logging
from fastembed import TextEmbedding

logger = logging.getLogger("fabi_embedder")
_model = None

def get_model():
    global _model
    if _model is None:
        logger.info("Initializing fastembed model (BAAI/bge-small-en-v1.5)...")
        _model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")
    return _model

def embed_texts(texts: list[str]) -> list[list[float]]:
    if not texts:
        return []
    try:
        model = get_model()
        embeddings = list(model.embed(texts))
        return [e.tolist() for e in embeddings]
    except Exception as err:
        logger.error(f"Embedding error: {err}")
        return []

# BGE v1.5 retrieval models are trained asymmetrically: passages are
# embedded bare, but queries are expected to carry this instruction. Skip
# it and the query vector lands in a different region of the space from
# the catalogue vectors, which costs real recall — the model is doing
# sentence-similarity instead of the retrieval it was tuned for.
#
# Documents must NOT get the prefix; only the query side.
BGE_QUERY_INSTRUCTION = "Represent this sentence for searching relevant passages: "


def embed_query(query: str) -> list[float]:
    results = embed_texts([f"{BGE_QUERY_INSTRUCTION}{query}"])
    return results[0] if results else []
