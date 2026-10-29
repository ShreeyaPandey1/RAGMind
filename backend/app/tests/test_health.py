from app.main import root
from app.api.routes.health import get_health, get_readiness
from app.db.session import SessionLocal

def test_root_endpoint():
    res = root()
    assert "RAGMind" in res["name"]

def test_health_endpoint():
    db = SessionLocal()
    try:
        res = get_health(db=db)
        assert res.status in ["healthy", "degraded"]
        assert res.database_connected is True
    finally:
        db.close()

def test_readiness_endpoint():
    db = SessionLocal()
    try:
        res = get_readiness(db=db)
        assert res["ready"] is True
    finally:
        db.close()
