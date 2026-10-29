import os
import uuid
import shutil
from typing import Optional, List
from sqlalchemy.orm import Session
from app.db.models import Document, DocumentChunk, Base
from app.core.config import settings
from app.core.logging import logger
from app.core.security import sanitize_filename, calculate_sha256
from app.core.exceptions import (
    UnsupportedFileTypeError,
    DuplicateDocumentError,
    DocumentProcessingError,
    DocumentNotFoundError
)
from app.services.document_parser import DocumentParserService
from app.services.chunking import ChunkingService
from app.services.embeddings import EmbeddingService

class IngestionService:
    def __init__(
        self,
        chunking_service: Optional[ChunkingService] = None,
        embedding_service: Optional[EmbeddingService] = None
    ):
        self.chunking_service = chunking_service or ChunkingService()
        self.embedding_service = embedding_service or EmbeddingService()

    def process_upload(
        self,
        db: Session,
        file_bytes: bytes,
        original_filename: str,
        collection_id: Optional[str] = None
    ) -> Document:
        """
        Executes end-to-end ingestion pipeline:
        Validate -> Hash/Duplicate check -> Save -> Parse -> Chunk -> Embed -> Save Chunks -> READY
        """
        # 1. Validate file size
        file_size = len(file_bytes)
        max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
        if file_size > max_bytes:
            raise DocumentProcessingError(
                f"File size ({round(file_size / (1024*1024), 2)} MB) exceeds allowed limit of {settings.MAX_UPLOAD_SIZE_MB} MB."
            )
        if file_size == 0:
            raise DocumentProcessingError("Uploaded file is empty (0 bytes).")

        # 2. Validate extension
        clean_filename = sanitize_filename(original_filename)
        ext = os.path.splitext(clean_filename)[1].lower()
        if ext not in settings.ALLOWED_EXTENSIONS:
            raise UnsupportedFileTypeError(
                f"File extension '{ext}' is not supported. Supported extensions: {', '.join(settings.ALLOWED_EXTENSIONS)}"
            )

        # 3. Calculate SHA-256 hash and check duplicate
        content_hash = calculate_sha256(file_bytes)
        existing_doc = db.query(Document).filter(Document.content_hash == content_hash).first()
        if existing_doc:
            raise DuplicateDocumentError(
                f"Document '{original_filename}' is identical to already uploaded document '{existing_doc.original_filename}'."
            )

        # 4. Safe persistent storage
        storage_id = str(uuid.uuid4())
        storage_filename = f"{storage_id}_{clean_filename}"
        storage_path = os.path.join(settings.UPLOAD_DIR, storage_filename)

        with open(storage_path, "wb") as f:
            f.write(file_bytes)

        # Determine MIME
        mime_map = {
            ".pdf": "application/pdf",
            ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            ".txt": "text/plain",
            ".md": "text/markdown"
        }
        mime_type = mime_map.get(ext, "application/octet-stream")

        # 5. Create initial Document record
        doc = Document(
            id=storage_id,
            filename=storage_filename,
            original_filename=original_filename,
            mime_type=mime_type,
            file_size=file_size,
            content_hash=content_hash,
            storage_path=storage_path,
            processing_status="PENDING",
            collection_id=collection_id
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)

        # 6. Execute processing pipeline
        self._run_pipeline(db, doc)
        return doc

    def retry_ingestion(self, db: Session, document_id: str) -> Document:
        """Retry a failed or stalled document ingestion."""
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise DocumentNotFoundError()

        if not os.path.exists(doc.storage_path):
            raise DocumentProcessingError("Underlying document file was removed from storage. Please re-upload.")

        # Clear existing chunks if any
        db.query(DocumentChunk).filter(DocumentChunk.document_id == doc.id).delete()
        doc.processing_status = "PENDING"
        doc.error_message = None
        db.commit()

        self._run_pipeline(db, doc)
        return doc

    def delete_document(self, db: Session, document_id: str) -> bool:
        """Safely delete document, database chunks, and disk storage."""
        doc = db.query(Document).filter(Document.id == document_id).first()
        if not doc:
            raise DocumentNotFoundError()

        # Remove file from disk
        if os.path.exists(doc.storage_path):
            try:
                os.remove(doc.storage_path)
            except Exception as e:
                logger.warning(f"Could not remove physical file {doc.storage_path}: {e}")

        # Delete document record (cascade deletes chunks and answer sources)
        db.delete(doc)
        db.commit()
        return True

    def _run_pipeline(self, db: Session, doc: Document):
        try:
            # Step A: Text Extraction
            doc.processing_status = "PARSING"
            db.commit()

            parsed = DocumentParserService.parse_file(
                file_path=doc.storage_path,
                mime_type=doc.mime_type,
                original_filename=doc.original_filename
            )
            doc.extracted_page_count = parsed.total_pages

            # Step B: Semantic Chunking
            doc.processing_status = "CHUNKING"
            db.commit()

            chunks = self.chunking_service.chunk_document(parsed.pages)
            if not chunks:
                raise DocumentProcessingError("Document chunking produced 0 chunks. Document contains no readable words.")

            # Step C: Generate Vector Embeddings
            doc.processing_status = "EMBEDDING"
            db.commit()

            chunk_texts = [c.text for c in chunks]
            embeddings = self.embedding_service.get_embeddings_batch(chunk_texts)

            # Step D: Persist Chunks and Vectors in Database
            for idx, c in enumerate(chunks):
                emb = embeddings[idx] if idx < len(embeddings) else None
                chunk_record = DocumentChunk(
                    id=str(uuid.uuid4()),
                    document_id=doc.id,
                    chunk_index=c.chunk_index,
                    text=c.text,
                    embedding=emb,
                    page_number=c.page_number,
                    section_metadata=c.section_metadata,
                    char_offset_start=c.char_offset_start,
                    char_offset_end=c.char_offset_end,
                    token_count=c.token_count
                )
                db.add(chunk_record)

            doc.chunk_count = len(chunks)
            doc.processing_status = "READY"
            doc.error_message = None
            db.commit()
            db.refresh(doc)
            logger.info(f"Document '{doc.original_filename}' successfully indexed with {len(chunks)} chunks.")

        except Exception as e:
            logger.error(f"Failed to ingest document '{doc.original_filename}': {str(e)}")
            db.rollback()
            # Fetch document fresh to set failure status
            failed_doc = db.query(Document).filter(Document.id == doc.id).first()
            if failed_doc:
                failed_doc.processing_status = "FAILED"
                failed_doc.error_message = str(e)
                db.commit()
            raise e
