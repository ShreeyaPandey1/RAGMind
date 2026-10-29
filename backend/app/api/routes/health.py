from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db, active_db_type
from app.core.config import settings
from app.schemas.settings import HealthStatus

router = APIRouter(prefix="", tags=["Health"])

@router.get("/health", response_model=HealthStatus)
def get_health(db: Session = Depends(get_db)):
    db_connected = False
    try:
        db.execute(text("SELECT 1"))
        db_connected = True
    except Exception:
        db_connected = False

    ai_provider_ready = bool(settings.OPENAI_API_KEY) or settings.LLM_PROVIDER == "local"

    return HealthStatus(
        status="healthy" if db_connected else "degraded",
        database_connected=db_connected,
        database_type=active_db_type,
        ai_provider_ready=ai_provider_ready,
        version=settings.VERSION,
        timestamp=datetime.now(timezone.utc).isoformat()
    )

@router.get("/health/ready")
def get_readiness(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {"ready": True}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database not ready: {str(e)}")
