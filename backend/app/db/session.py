import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings
from app.core.logging import logger
from app.db.models import Base

DATABASE_URL = settings.DATABASE_URL
active_db_type = "postgresql"

# Use local test database during automated test executions
if os.environ.get("PYTEST_CURRENT_TEST"):
    DATABASE_URL = "sqlite:///./data/ragmind_test.db"

engine = None
SessionLocal = None

def init_engine():
    global engine, SessionLocal, active_db_type, DATABASE_URL

    connect_args = {}
    is_sqlite = DATABASE_URL.startswith("sqlite")

    if is_sqlite:
        connect_args["check_same_thread"] = False
        active_db_type = "sqlite"
    else:
        # Fast timeout for postgres test connection so it doesn't hang if service is offline
        connect_args["connect_timeout"] = 2

    try:
        test_engine = create_engine(
            DATABASE_URL,
            connect_args=connect_args,
            pool_pre_ping=True
        )
        with test_engine.connect() as conn:
            if not is_sqlite:
                try:
                    conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                    conn.commit()
                    logger.info("Successfully verified/enabled pgvector extension on PostgreSQL.")
                except Exception as ext_err:
                    logger.warning(f"Note on pgvector extension: {ext_err}")
            else:
                logger.info("Using SQLite database engine.")

        engine = test_engine
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        logger.info(f"Database connected successfully ({active_db_type}).")

    except Exception as e:
        if settings.ALLOW_SQLITE_FALLBACK and not is_sqlite:
            logger.warning(
                f"PostgreSQL connection to {DATABASE_URL} failed: {e}. "
                "Falling back to local persistent SQLite database for standalone execution."
            )
            DATABASE_URL = "sqlite:///./data/ragmind.db"
            active_db_type = "sqlite"
            engine = create_engine(
                DATABASE_URL,
                connect_args={"check_same_thread": False},
                pool_pre_ping=True
            )
            SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
            logger.info("SQLite fallback engine initialized at ./data/ragmind.db")
        else:
            logger.error(f"Database connection error: {e}")
            raise e

    Base.metadata.create_all(bind=engine)
    logger.info("Database schema validated and initialized.")

init_engine()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
