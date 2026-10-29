from datetime import datetime
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field, ConfigDict

class ChunkResponse(BaseModel):
    id: str
    chunk_index: int
    text: str
    page_number: Optional[int] = None
    section_metadata: Optional[str] = None
    token_count: int = 0
    char_offset_start: Optional[int] = None
    char_offset_end: Optional[int] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DocumentResponse(BaseModel):
    id: str
    filename: str
    original_filename: str
    mime_type: str
    file_size: int
    content_hash: str
    processing_status: str
    error_message: Optional[str] = None
    extracted_page_count: int
    chunk_count: int
    collection_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)

class DocumentDetailResponse(DocumentResponse):
    chunks: List[ChunkResponse] = []

class DocumentUpdate(BaseModel):
    collection_id: Optional[str] = None

class DocumentStats(BaseModel):
    total_documents: int
    ready_documents: int
    processing_documents: int
    failed_documents: int
    total_chunks: int
    recent_activity: List[Dict[str, Any]] = []
