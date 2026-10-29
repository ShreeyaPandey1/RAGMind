from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.session import get_db, active_db_type
from app.core.config import settings
from app.schemas.settings import SettingsResponse, SettingsUpdate

router = APIRouter(prefix="/settings", tags=["Settings"])

@router.get("", response_model=SettingsResponse)
def get_current_settings():
    # Mask database URL credentials
    masked_db = settings.DATABASE_URL
    if "@" in masked_db:
        prefix, host_part = masked_db.split("@", 1)
        protocol = prefix.split("://")[0]
        masked_db = f"{protocol}://****:****@{host_part}"

    return SettingsResponse(
        project_name=settings.PROJECT_NAME,
        version=settings.VERSION,
        database_url_masked=masked_db,
        active_database_type=active_db_type,
        llm_provider=settings.LLM_PROVIDER,
        llm_model=settings.LLM_MODEL,
        llm_base_url=settings.LLM_BASE_URL,
        llm_api_key_configured=bool(settings.OPENAI_API_KEY),
        embedding_provider=settings.EMBEDDING_PROVIDER,
        embedding_model=settings.EMBEDDING_MODEL,
        embedding_dimensions=settings.EMBEDDING_DIMENSIONS,
        chunk_size=settings.CHUNK_SIZE,
        chunk_overlap=settings.CHUNK_OVERLAP,
        retrieval_top_k=settings.RETRIEVAL_TOP_K,
        min_relevance_threshold=settings.MIN_RELEVANCE_THRESHOLD,
        temperature=settings.TEMPERATURE,
        max_generation_tokens=settings.MAX_GENERATION_TOKENS,
        enable_hybrid_search=settings.ENABLE_HYBRID_SEARCH,
        upload_dir=settings.UPLOAD_DIR,
        max_upload_size_mb=settings.MAX_UPLOAD_SIZE_MB
    )

@router.patch("", response_model=SettingsResponse)
def update_settings(payload: SettingsUpdate):
    if payload.llm_provider is not None:
        settings.LLM_PROVIDER = payload.llm_provider
    if payload.llm_model is not None:
        settings.LLM_MODEL = payload.llm_model
    if payload.embedding_provider is not None:
        settings.EMBEDDING_PROVIDER = payload.embedding_provider
    if payload.embedding_model is not None:
        settings.EMBEDDING_MODEL = payload.embedding_model
    if payload.retrieval_top_k is not None:
        settings.RETRIEVAL_TOP_K = payload.retrieval_top_k
    if payload.min_relevance_threshold is not None:
        settings.MIN_RELEVANCE_THRESHOLD = payload.min_relevance_threshold
    if payload.temperature is not None:
        settings.TEMPERATURE = payload.temperature
    if payload.max_generation_tokens is not None:
        settings.MAX_GENERATION_TOKENS = payload.max_generation_tokens
    if payload.enable_hybrid_search is not None:
        settings.ENABLE_HYBRID_SEARCH = payload.enable_hybrid_search
    if payload.chunk_size is not None:
        settings.CHUNK_SIZE = payload.chunk_size
    if payload.chunk_overlap is not None:
        settings.CHUNK_OVERLAP = payload.chunk_overlap

    return get_current_settings()
