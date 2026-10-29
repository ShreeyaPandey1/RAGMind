from typing import List, Optional
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, Query, BackgroundTasks
from sqlalchemy.orm import Session
from sqlalchemy import desc
from app.db.session import get_db
from app.db.models import Document, DocumentChunk, Collection
from app.schemas.documents import (
    DocumentResponse, DocumentDetailResponse, ChunkResponse, DocumentStats, DocumentUpdate
)
from app.services.ingestion import IngestionService
from app.core.exceptions import RAGMindException, DocumentNotFoundError
from app.core.logging import logger

router = APIRouter(prefix="/documents", tags=["Documents"])
ingestion_service = IngestionService()

@router.get("", response_model=List[DocumentResponse])
def list_documents(
    status: Optional[str] = None,
    collection_id: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    query = db.query(Document)
    if status:
        query = query.filter(Document.processing_status == status.upper())
    if collection_id:
        query = query.filter(Document.collection_id == collection_id)
    if search:
        search_filter = f"%{search}%"
        query = query.filter(Document.original_filename.ilike(search_filter))

    documents = query.order_by(desc(Document.created_at)).offset(offset).limit(limit).all()
    return documents

@router.get("/stats", response_model=DocumentStats)
def get_document_stats(db: Session = Depends(get_db)):
    total = db.query(Document).count()
    ready = db.query(Document).filter(Document.processing_status == "READY").count()
    processing = db.query(Document).filter(Document.processing_status.in_(["PENDING", "PARSING", "CHUNKING", "EMBEDDING"])).count()
    failed = db.query(Document).filter(Document.processing_status == "FAILED").count()
    total_chunks = db.query(DocumentChunk).count()

    recent = db.query(Document).order_by(desc(Document.created_at)).limit(5).all()
    recent_activity = [
        {
            "id": d.id,
            "filename": d.original_filename,
            "status": d.processing_status,
            "chunks": d.chunk_count,
            "created_at": d.created_at.isoformat()
        }
        for d in recent
    ]

    return DocumentStats(
        total_documents=total,
        ready_documents=ready,
        processing_documents=processing,
        failed_documents=failed,
        total_chunks=total_chunks,
        recent_activity=recent_activity
    )

@router.post("/upload", response_model=DocumentResponse)
def upload_document(
    file: UploadFile = File(...),
    collection_id: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    try:
        content = file.file.read()
        doc = ingestion_service.process_upload(
            db=db,
            file_bytes=content,
            original_filename=file.filename or "uploaded_document",
            collection_id=collection_id
        )
        return doc
    except RAGMindException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/{document_id}", response_model=DocumentDetailResponse)
def get_document(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc

@router.get("/{document_id}/status")
def get_document_status(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document.id, Document.processing_status, Document.error_message, Document.chunk_count).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return {
        "id": doc.id,
        "processing_status": doc.processing_status,
        "error_message": doc.error_message,
        "chunk_count": doc.chunk_count
    }

@router.get("/{document_id}/chunks", response_model=List[ChunkResponse])
def get_document_chunks(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index).all()
    return chunks

@router.get("/{document_id}/preview")
def get_document_preview(document_id: str, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == document_id).order_by(DocumentChunk.chunk_index).limit(10).all()
    preview_text = "\n\n".join([f"[Page {c.page_number or '1'} | Chunk #{c.chunk_index}]\n{c.text}" for c in chunks])
    return {
        "id": doc.id,
        "filename": doc.original_filename,
        "page_count": doc.extracted_page_count,
        "chunk_count": doc.chunk_count,
        "preview": preview_text
    }

@router.post("/{document_id}/retry", response_model=DocumentResponse)
def retry_document(document_id: str, db: Session = Depends(get_db)):
    try:
        doc = ingestion_service.retry_ingestion(db, document_id)
        return doc
    except RAGMindException as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.patch("/{document_id}", response_model=DocumentResponse)
def update_document(document_id: str, payload: DocumentUpdate, db: Session = Depends(get_db)):
    doc = db.query(Document).filter(Document.id == document_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if payload.collection_id is not None:
        if payload.collection_id != "":
            coll = db.query(Collection).filter(Collection.id == payload.collection_id).first()
            if not coll:
                raise HTTPException(status_code=404, detail="Collection not found")
            doc.collection_id = payload.collection_id
        else:
            doc.collection_id = None
    db.commit()
    db.refresh(doc)
    return doc

@router.delete("/{document_id}")
def delete_document(document_id: str, db: Session = Depends(get_db)):
    try:
        ingestion_service.delete_document(db, document_id)
        return {"success": True, "message": "Document and associated chunks deleted successfully."}
    except DocumentNotFoundError:
        raise HTTPException(status_code=404, detail="Document not found")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
