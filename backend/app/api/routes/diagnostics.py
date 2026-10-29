import sys
import platform
import os
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db, active_db_type
from app.core.config import settings
from app.db.models import Document, DocumentChunk, Conversation, Message

router = APIRouter(prefix="/diagnostics", tags=["Diagnostics"])

@router.get("")
def get_diagnostics(db: Session = Depends(get_db)):
    # DB status & stats
    db_healthy = False
    try:
        db.execute(text("SELECT 1"))
        db_healthy = True
    except Exception:
        db_healthy = False

    doc_count = db.query(Document).count()
    chunk_count = db.query(DocumentChunk).count()
    conv_count = db.query(Conversation).count()
    msg_count = db.query(Message).count()

    # Storage stats
    storage_size_bytes = 0
    if os.path.exists(settings.UPLOAD_DIR):
        for root, _, files in os.walk(settings.UPLOAD_DIR):
            for f in files:
                fp = os.path.join(root, f)
                if os.path.isfile(fp):
                    storage_size_bytes += os.path.getsize(fp)

    return {
        "status": "operational" if db_healthy else "degraded",
        "system": {
            "os": platform.system(),
            "python_version": sys.version.split()[0],
            "app_version": settings.VERSION,
        },
        "database": {
            "type": active_db_type,
            "connected": db_healthy,
            "total_documents": doc_count,
            "total_chunks": chunk_count,
            "total_conversations": conv_count,
            "total_messages": msg_count,
        },
        "storage": {
            "upload_dir": settings.UPLOAD_DIR,
            "used_bytes": storage_size_bytes,
            "used_mb": round(storage_size_bytes / (1024 * 1024), 2),
            "max_file_size_mb": settings.MAX_UPLOAD_SIZE_MB,
        },
        "models": {
            "llm_provider": settings.LLM_PROVIDER,
            "llm_model": settings.LLM_MODEL,
            "llm_configured": bool(settings.OPENAI_API_KEY),
            "embedding_provider": settings.EMBEDDING_PROVIDER,
            "embedding_model": settings.EMBEDDING_MODEL,
            "embedding_dim": settings.EMBEDDING_DIMENSIONS,
        },
        "retrieval": {
            "top_k": settings.RETRIEVAL_TOP_K,
            "min_relevance_threshold": settings.MIN_RELEVANCE_THRESHOLD,
            "hybrid_enabled": settings.ENABLE_HYBRID_SEARCH,
        }
    }
