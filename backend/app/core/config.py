import os
import json
from typing import List, Optional, Union
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "RAGMind"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/api"

    # Database
    DATABASE_URL: str = Field(
        default="postgresql+psycopg2://ragmind:ragmind@localhost:5432/ragmind_db",
        description="Database connection string (PostgreSQL with pgvector or SQLite for local demo/testing)"
    )
    ALLOW_SQLITE_FALLBACK: bool = True

    # Storage
    UPLOAD_DIR: str = Field(default="./data/uploads", description="Directory for document file storage")
    MAX_UPLOAD_SIZE_MB: int = Field(default=25, description="Maximum upload size in megabytes")
    ALLOWED_EXTENSIONS: List[str] = [".pdf", ".docx", ".txt", ".md"]

    # AI / LLM Configuration
    OPENAI_API_KEY: Optional[str] = Field(default=None, description="OpenAI or OpenAI-compatible API key")
    LLM_PROVIDER: str = Field(default="local", description="LLM provider: openai or local")
    LLM_BASE_URL: str = Field(default="https://api.openai.com/v1", description="LLM base URL")
    LLM_MODEL: str = Field(default="gpt-4o-mini", description="Generation model name")
    TEMPERATURE: float = Field(default=0.2, description="Sampling temperature")
    MAX_GENERATION_TOKENS: int = Field(default=1500, description="Max tokens for generated response")

    # Embedding Configuration
    EMBEDDING_PROVIDER: str = Field(default="local", description="Embedding provider: openai or local")
    EMBEDDING_BASE_URL: str = Field(default="https://api.openai.com/v1", description="Embedding base URL")
    EMBEDDING_MODEL: str = Field(default="text-embedding-3-small", description="Embedding model name")
    EMBEDDING_DIMENSIONS: int = Field(default=1536, description="Embedding vector dimensions")

    # Ingestion & Chunking
    CHUNK_SIZE: int = Field(default=800, description="Target chunk size in characters")
    CHUNK_OVERLAP: int = Field(default=150, description="Chunk overlap in characters")

    # Retrieval Configuration
    RETRIEVAL_TOP_K: int = Field(default=5, description="Number of passages to retrieve")
    MIN_RELEVANCE_THRESHOLD: float = Field(default=0.35, description="Minimum cosine similarity / relevance score")
    ENABLE_HYBRID_SEARCH: bool = Field(default=True, description="Combine vector similarity with lexical matching")
    HYBRID_ALPHA: float = Field(default=0.7, description="Weight for vector search vs lexical search (0 to 1)")

    # Security & CORS
    CORS_ORIGINS: Union[List[str], str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173"
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def assemble_cors_origins(cls, v):
        if isinstance(v, str):
            if v.startswith("[") and v.endswith("]"):
                try:
                    return json.loads(v)
                except Exception:
                    pass
            return [i.strip() for i in v.split(",") if i.strip()]
        return v

    def get_cors_origins(self) -> List[str]:
        if isinstance(self.CORS_ORIGINS, list):
            return self.CORS_ORIGINS
        return [i.strip() for i in str(self.CORS_ORIGINS).split(",") if i.strip()]


settings = Settings()

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
os.makedirs("./data", exist_ok=True)
