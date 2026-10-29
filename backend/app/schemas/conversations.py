from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field, ConfigDict

class AnswerSourceResponse(BaseModel):
    id: str
    citation_number: int
    document_id: str
    document_name: str
    chunk_id: Optional[str] = None
    page_number: Optional[int] = None
    relevance_score: float
    excerpt: str

    model_config = ConfigDict(from_attributes=True)

class MessageResponse(BaseModel):
    id: str
    conversation_id: str
    role: str
    content: str
    is_abstention: bool
    retrieval_diagnostics: Optional[str] = None
    created_at: datetime
    sources: List[AnswerSourceResponse] = []

    model_config = ConfigDict(from_attributes=True)

class ConversationBase(BaseModel):
    title: str = Field(default="New Conversation")
    document_scope_type: str = Field(default="ALL")
    selected_scope_ids: Optional[List[str]] = Field(default_factory=list)

class ConversationCreate(ConversationBase):
    pass

class ConversationUpdate(BaseModel):
    title: Optional[str] = None
    document_scope_type: Optional[str] = None
    selected_scope_ids: Optional[List[str]] = None

class ConversationResponse(ConversationBase):
    id: str
    created_at: datetime
    updated_at: datetime
    message_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)

class ConversationDetailResponse(ConversationResponse):
    messages: List[MessageResponse] = []
