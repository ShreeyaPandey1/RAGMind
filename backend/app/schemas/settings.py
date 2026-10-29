from typing import Optional, List
from pydantic import BaseModel, Field

class SettingsResponse(BaseModel):
    project_name: str
    version: str
    database_url_masked: str
    active_database_type: str
    llm_provider: str
    llm_model: str
    llm_base_url: str
    llm_api_key_configured: bool
    embedding_provider: str
    embedding_model: str
    embedding_dimensions: int
    chunk_size: int
    chunk_overlap: int
    retrieval_top_k: int
    min_relevance_threshold: float
    temperature: float
    max_generation_tokens: int
    enable_hybrid_search: bool
    upload_dir: str
    max_upload_size_mb: int

class SettingsUpdate(BaseModel):
    llm_provider: Optional[str] = None
    llm_model: Optional[str] = None
    embedding_provider: Optional[str] = None
    embedding_model: Optional[str] = None
    retrieval_top_k: Optional[int] = Field(None, ge=1, le=20)
    min_relevance_threshold: Optional[float] = Field(None, ge=0.0, le=1.0)
    temperature: Optional[float] = Field(None, ge=0.0, le=1.0)
    max_generation_tokens: Optional[int] = Field(None, ge=100, le=4096)
    enable_hybrid_search: Optional[bool] = None
    chunk_size: Optional[int] = Field(None, ge=100, le=3000)
    chunk_overlap: Optional[int] = Field(None, ge=0, le=1000)

class HealthStatus(BaseModel):
    status: str
    database_connected: bool
    database_type: str
    ai_provider_ready: bool
    version: str
    timestamp: str
