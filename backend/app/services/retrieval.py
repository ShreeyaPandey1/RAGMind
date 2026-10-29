import time
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from app.db.models import Document, Collection, DocumentChunk
from app.services.embeddings import EmbeddingService
from app.services.vector_store import VectorStoreService, RetrievedChunk
from app.core.config import settings
from app.core.logging import logger

class RetrievalResult:
    def __init__(
        self,
        retrieved_chunks: List[RetrievedChunk],
        diagnostics: Dict[str, Any],
        documents_searched: int
    ):
        self.retrieved_chunks = retrieved_chunks
        self.diagnostics = diagnostics
        self.documents_searched = documents_searched

class RetrievalService:
    def __init__(self, embedding_service: Optional[EmbeddingService] = None):
        self.embedding_service = embedding_service or EmbeddingService()

    def retrieve(
        self,
        db: Session,
        query: str,
        scope_type: str = "ALL",
        selected_scope_ids: Optional[List[str]] = None,
        top_k: Optional[int] = None,
        min_threshold: Optional[float] = None
    ) -> RetrievalResult:
        start_time = time.perf_counter()
        k = top_k or settings.RETRIEVAL_TOP_K
        threshold = min_threshold if min_threshold is not None else settings.MIN_RELEVANCE_THRESHOLD

        # 1. Resolve document scope
        allowed_doc_ids = self._resolve_scope(db, scope_type, selected_scope_ids or [])
        num_docs = len(allowed_doc_ids) if allowed_doc_ids is not None else 0

        if allowed_doc_ids is not None and len(allowed_doc_ids) == 0:
            return RetrievalResult(
                retrieved_chunks=[],
                diagnostics={
                    "query_latency_ms": 0.0,
                    "retrieval_latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                    "generation_latency_ms": 0.0,
                    "total_latency_ms": round((time.perf_counter() - start_time) * 1000, 2),
                    "chunks_retrieved": 0,
                    "top_score": 0.0,
                    "scope_type": scope_type,
                    "documents_searched": 0
                },
                documents_searched=0
            )

        # 2. Generate query embedding
        emb_start = time.perf_counter()
        query_vector = self.embedding_service.get_query_embedding(query)
        emb_time = (time.perf_counter() - emb_start) * 1000

        # 3. Search vector store
        search_start = time.perf_counter()
        results = VectorStoreService.search_similar(
            db=db,
            query_vector=query_vector,
            query_text=query,
            allowed_document_ids=allowed_doc_ids,
            top_k=k,
            min_relevance_threshold=threshold,
            enable_hybrid=settings.ENABLE_HYBRID_SEARCH
        )
        search_time = (time.perf_counter() - search_start) * 1000

        # 4. Deduplicate near identical chunks
        deduped_results = self._deduplicate_chunks(results)

        total_retrieval_time = (time.perf_counter() - start_time) * 1000
        top_score = deduped_results[0].score if deduped_results else 0.0

        diagnostics = {
            "query_latency_ms": round(emb_time, 2),
            "retrieval_latency_ms": round(search_time, 2),
            "generation_latency_ms": 0.0, # Filled after generation
            "total_latency_ms": round(total_retrieval_time, 2),
            "chunks_retrieved": len(deduped_results),
            "top_score": round(top_score, 4),
            "scope_type": scope_type,
            "documents_searched": num_docs
        }

        return RetrievalResult(
            retrieved_chunks=deduped_results,
            diagnostics=diagnostics,
            documents_searched=num_docs
        )

    def _resolve_scope(self, db: Session, scope_type: str, selected_ids: List[str]) -> Optional[List[str]]:
        """Resolves which document IDs are in-scope."""
        if scope_type == "ALL":
            ready_docs = db.query(Document.id).filter(Document.processing_status == "READY").all()
            return [d[0] for d in ready_docs]

        elif scope_type == "COLLECTION":
            if not selected_ids:
                return []
            ready_docs = db.query(Document.id).filter(
                Document.processing_status == "READY",
                Document.collection_id.in_(selected_ids)
            ).all()
            return [d[0] for d in ready_docs]

        elif scope_type == "DOCUMENTS":
            if not selected_ids:
                return []
            ready_docs = db.query(Document.id).filter(
                Document.processing_status == "READY",
                Document.id.in_(selected_ids)
            ).all()
            return [d[0] for d in ready_docs]

        return []

    def _deduplicate_chunks(self, chunks: List[RetrievedChunk]) -> List[RetrievedChunk]:
        """Removes duplicate chunk texts or overlapping content."""
        seen_texts = set()
        deduped = []
        for c in chunks:
            # Normalize text sample
            sample = c.chunk.text.strip()[:100]
            if sample not in seen_texts:
                seen_texts.add(sample)
                deduped.append(c)
        return deduped
