import json
import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.db.models import Conversation, Message, AnswerSource, Document
from app.schemas.chat import ChatRequest, ChatResponse, RetrievalDiagnostic
from app.schemas.conversations import AnswerSourceResponse
from app.services.retrieval import RetrievalService
from app.services.generation import GenerationService
from app.core.security import sanitize_user_input
from app.core.logging import logger

router = APIRouter(prefix="", tags=["Chat"])
retrieval_service = RetrievalService()
generation_service = GenerationService()

@router.post("/chat", response_model=ChatResponse)
def chat_endpoint(payload: ChatRequest, db: Session = Depends(get_db)):
    clean_question = sanitize_user_input(payload.question)
    if not clean_question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # 1. Resolve or create conversation
    conv = None
    if payload.conversation_id:
        conv = db.query(Conversation).filter(Conversation.id == payload.conversation_id).first()

    if not conv:
        # Create a new conversation with auto-generated title from question
        auto_title = clean_question[:45] + ("..." if len(clean_question) > 45 else "")
        conv = Conversation(
            title=auto_title,
            document_scope_type=payload.document_scope_type,
            selected_scope_ids=json.dumps(payload.selected_scope_ids)
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    # 2. Save user message
    user_msg = Message(
        conversation_id=conv.id,
        role="user",
        content=clean_question
    )
    db.add(user_msg)
    db.commit()

    # 3. Retrieve context
    retrieval_res = retrieval_service.retrieve(
        db=db,
        query=clean_question,
        scope_type=payload.document_scope_type,
        selected_scope_ids=payload.selected_scope_ids,
        top_k=payload.top_k,
        min_threshold=payload.min_relevance_threshold
    )

    # 4. Fetch recent conversation history
    past_messages = db.query(Message).filter(
        Message.conversation_id == conv.id,
        Message.id != user_msg.id
    ).order_by(Message.created_at).limit(6).all()

    history = [{"role": m.role, "content": m.content} for m in past_messages]

    # 5. Generate grounded answer
    gen_res = generation_service.generate_answer(
        question=clean_question,
        retrieved_chunks=retrieval_res.retrieved_chunks,
        conversation_history=history
    )

    # 6. Update diagnostics
    diagnostics = retrieval_res.diagnostics
    diagnostics["generation_latency_ms"] = gen_res.generation_time_ms
    diagnostics["total_latency_ms"] = round(diagnostics["total_latency_ms"] + gen_res.generation_time_ms, 2)

    # 7. Persist assistant message
    asst_msg = Message(
        conversation_id=conv.id,
        role="assistant",
        content=gen_res.answer,
        is_abstention=gen_res.is_abstention,
        retrieval_diagnostics=json.dumps(diagnostics)
    )
    db.add(asst_msg)
    db.commit()
    db.refresh(asst_msg)

    # 8. Persist Citations
    citation_responses = []
    for cit in gen_res.citations:
        import uuid
        src_id = str(uuid.uuid4())
        src = AnswerSource(
            id=src_id,
            message_id=asst_msg.id,
            chunk_id=cit.chunk_id,
            citation_number=cit.citation_number,
            document_id=cit.document_id,
            document_name=cit.document_name,
            page_number=cit.page_number,
            relevance_score=cit.relevance_score,
            excerpt=cit.excerpt
        )
        db.add(src)
        citation_responses.append(
            AnswerSourceResponse(
                id=src_id,
                citation_number=cit.citation_number,
                document_id=cit.document_id,
                document_name=cit.document_name,
                chunk_id=cit.chunk_id,
                page_number=cit.page_number,
                relevance_score=cit.relevance_score,
                excerpt=cit.excerpt
            )
        )
    db.commit()

    return ChatResponse(
        conversation_id=conv.id,
        message_id=asst_msg.id,
        question=clean_question,
        answer=gen_res.answer,
        is_abstention=gen_res.is_abstention,
        sources=citation_responses,
        diagnostics=RetrievalDiagnostic(**diagnostics)
    )

@router.post("/chat/stream")
def chat_stream_endpoint(payload: ChatRequest, db: Session = Depends(get_db)):
    """Server-Sent Events (SSE) streaming endpoint."""
    clean_question = sanitize_user_input(payload.question)
    if not clean_question:
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    conv = None
    if payload.conversation_id:
        conv = db.query(Conversation).filter(Conversation.id == payload.conversation_id).first()

    if not conv:
        auto_title = clean_question[:45] + ("..." if len(clean_question) > 45 else "")
        conv = Conversation(
            title=auto_title,
            document_scope_type=payload.document_scope_type,
            selected_scope_ids=json.dumps(payload.selected_scope_ids)
        )
        db.add(conv)
        db.commit()
        db.refresh(conv)

    user_msg = Message(conversation_id=conv.id, role="user", content=clean_question)
    db.add(user_msg)
    db.commit()

    def event_generator():
        yield f"event: start\ndata: {json.dumps({'conversation_id': conv.id})}\n\n"

        # 1. Retrieval
        retrieval_res = retrieval_service.retrieve(
            db=db,
            query=clean_question,
            scope_type=payload.document_scope_type,
            selected_scope_ids=payload.selected_scope_ids,
            top_k=payload.top_k,
            min_threshold=payload.min_relevance_threshold
        )

        gen_res = generation_service.generate_answer(
            question=clean_question,
            retrieved_chunks=retrieval_res.retrieved_chunks
        )

        # Stream words/tokens
        words = gen_res.answer.split(" ")
        for i, word in enumerate(words):
            chunk_delta = word if i == len(words) - 1 else word + " "
            yield f"event: token\ndata: {json.dumps({'delta': chunk_delta})}\n\n"
            time.sleep(0.02) # Simulates smooth streaming

        # Assistant message persist
        diagnostics = retrieval_res.diagnostics
        diagnostics["generation_latency_ms"] = gen_res.generation_time_ms
        diagnostics["total_latency_ms"] = round(diagnostics["total_latency_ms"] + gen_res.generation_time_ms, 2)

        asst_msg = Message(
            conversation_id=conv.id,
            role="assistant",
            content=gen_res.answer,
            is_abstention=gen_res.is_abstention,
            retrieval_diagnostics=json.dumps(diagnostics)
        )
        db.add(asst_msg)
        db.commit()
        db.refresh(asst_msg)

        sources_payload = []
        for cit in gen_res.citations:
            import uuid
            src_id = str(uuid.uuid4())
            src = AnswerSource(
                id=src_id,
                message_id=asst_msg.id,
                chunk_id=cit.chunk_id,
                citation_number=cit.citation_number,
                document_id=cit.document_id,
                document_name=cit.document_name,
                page_number=cit.page_number,
                relevance_score=cit.relevance_score,
                excerpt=cit.excerpt
            )
            db.add(src)
            sources_payload.append({
                "id": src_id,
                "citation_number": cit.citation_number,
                "document_id": cit.document_id,
                "document_name": cit.document_name,
                "chunk_id": cit.chunk_id,
                "page_number": cit.page_number,
                "relevance_score": cit.relevance_score,
                "excerpt": cit.excerpt
            })
        db.commit()

        yield f"event: sources\ndata: {json.dumps(sources_payload)}\n\n"
        yield f"event: done\ndata: {json.dumps({'message_id': asst_msg.id, 'diagnostics': diagnostics})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@router.get("/messages/{message_id}/sources", response_model=List[AnswerSourceResponse])
def get_message_sources(message_id: str, db: Session = Depends(get_db)):
    sources = db.query(AnswerSource).filter(AnswerSource.message_id == message_id).order_by(AnswerSource.citation_number).all()
    return sources
