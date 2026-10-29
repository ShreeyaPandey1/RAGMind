import os
import pytest

def pytest_configure(config):
    # Set test environment variables before any app modules are loaded
    os.environ["DATABASE_URL"] = "sqlite:///./data/ragmind_test.db"
    os.environ["ALLOW_SQLITE_FALLBACK"] = "true"
    os.environ["LLM_PROVIDER"] = "local"
    os.environ["EMBEDDING_PROVIDER"] = "local"
    os.environ["OPENAI_API_KEY"] = ""

@pytest.fixture(autouse=True)
def setup_test_environment():
    from app.core.config import settings
    from app.api.routes.chat import retrieval_service, generation_service
    from app.api.routes.documents import ingestion_service

    settings.LLM_PROVIDER = "local"
    settings.EMBEDDING_PROVIDER = "local"
    settings.OPENAI_API_KEY = None

    retrieval_service.embedding_service.provider = "local"
    generation_service.provider = "local"
    ingestion_service.embedding_service.provider = "local"
    yield
