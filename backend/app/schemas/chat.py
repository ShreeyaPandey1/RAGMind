from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from app.schemas.conversations import AnswerSourceResponse, MessageResponse

class ChatRequest(BaseModel):
    conversation_id: Optional[str] = None
    question: str = Field(..., min_length=1, max_length=4000)
    document_scope_type: str = Field(default="ALL") # ALL, COLLECTION, DOCUMENTS
    selected_scope_ids: List[str] = Field(default_factory=list)
    top_k: Optional[int] = Field(default=None, ge=1, le=20)
    min_relevance_threshold: Optional[float] = Field(default=None, ge=0.0, le=1.0)

class RetrievalDiagnostic(BaseModel):
    query_latency_ms: float
    retrieval_latency_ms: float
    generation_latency_ms: float
    total_latency_ms: float
    chunks_retrieved: int
    top_score: float
    scope_type: str
    documents_searched: int

class ChatResponse(BaseModel):
    conversation_id: str
    message_id: str
    question: str
    answer: str
    is_abstention: bool
    sources: List[AnswerSourceResponse] = []
    diagnostics: RetrievalDiagnostic
