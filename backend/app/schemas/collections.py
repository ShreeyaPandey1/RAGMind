from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field, ConfigDict

class CollectionBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None

class CollectionCreate(CollectionBase):
    pass

class CollectionUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None

class CollectionResponse(CollectionBase):
    id: str
    created_at: datetime
    updated_at: datetime
    document_count: Optional[int] = 0

    model_config = ConfigDict(from_attributes=True)
