import json
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.db.session import get_db
from app.db.models import Conversation, Message, AnswerSource
from app.schemas.conversations import (
    ConversationResponse, ConversationDetailResponse, ConversationCreate, ConversationUpdate, MessageResponse, AnswerSourceResponse
)

router = APIRouter(prefix="/conversations", tags=["Conversations"])

@router.get("", response_model=List[ConversationResponse])
def list_conversations(db: Session = Depends(get_db)):
    convs = db.query(Conversation).order_by(desc(Conversation.updated_at)).all()
    results = []
    for c in convs:
        msg_count = db.query(Message).filter(Message.conversation_id == c.id).count()
        scope_ids = []
        try:
            scope_ids = json.loads(c.selected_scope_ids or "[]")
        except Exception:
            scope_ids = []

        results.append(
            ConversationResponse(
                id=c.id,
                title=c.title,
                document_scope_type=c.document_scope_type,
                selected_scope_ids=scope_ids,
                created_at=c.created_at,
                updated_at=c.updated_at,
                message_count=msg_count
            )
        )
    return results

@router.post("", response_model=ConversationResponse)
def create_conversation(payload: ConversationCreate, db: Session = Depends(get_db)):
    c = Conversation(
        title=payload.title,
        document_scope_type=payload.document_scope_type,
        selected_scope_ids=json.dumps(payload.selected_scope_ids or [])
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return ConversationResponse(
        id=c.id,
        title=c.title,
        document_scope_type=c.document_scope_type,
        selected_scope_ids=payload.selected_scope_ids or [],
        created_at=c.created_at,
        updated_at=c.updated_at,
        message_count=0
    )

@router.get("/{conversation_id}", response_model=ConversationDetailResponse)
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    c = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")

    messages = db.query(Message).filter(Message.conversation_id == conversation_id).order_by(Message.created_at).all()
    msg_responses = []

    for m in messages:
        sources = db.query(AnswerSource).filter(AnswerSource.message_id == m.id).order_by(AnswerSource.citation_number).all()
        src_responses = [
            AnswerSourceResponse(
                id=s.id,
                citation_number=s.citation_number,
                document_id=s.document_id,
                document_name=s.document_name,
                chunk_id=s.chunk_id,
                page_number=s.page_number,
                relevance_score=s.relevance_score,
                excerpt=s.excerpt
            )
            for s in sources
        ]
        msg_responses.append(
            MessageResponse(
                id=m.id,
                conversation_id=m.conversation_id,
                role=m.role,
                content=m.content,
                is_abstention=m.is_abstention,
                retrieval_diagnostics=m.retrieval_diagnostics,
                created_at=m.created_at,
                sources=src_responses
            )
        )

    scope_ids = []
    try:
        scope_ids = json.loads(c.selected_scope_ids or "[]")
    except Exception:
        scope_ids = []

    return ConversationDetailResponse(
        id=c.id,
        title=c.title,
        document_scope_type=c.document_scope_type,
        selected_scope_ids=scope_ids,
        created_at=c.created_at,
        updated_at=c.updated_at,
        message_count=len(messages),
        messages=msg_responses
    )

@router.patch("/{conversation_id}", response_model=ConversationResponse)
def update_conversation(conversation_id: str, payload: ConversationUpdate, db: Session = Depends(get_db)):
    c = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")

    if payload.title is not None:
        c.title = payload.title
    if payload.document_scope_type is not None:
        c.document_scope_type = payload.document_scope_type
    if payload.selected_scope_ids is not None:
        c.selected_scope_ids = json.dumps(payload.selected_scope_ids)

    db.commit()
    db.refresh(c)
    msg_count = db.query(Message).filter(Message.conversation_id == c.id).count()

    return ConversationResponse(
        id=c.id,
        title=c.title,
        document_scope_type=c.document_scope_type,
        selected_scope_ids=json.loads(c.selected_scope_ids or "[]"),
        created_at=c.created_at,
        updated_at=c.updated_at,
        message_count=msg_count
    )

@router.delete("/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    c = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(c)
    db.commit()
    return {"success": True, "message": "Conversation deleted."}
