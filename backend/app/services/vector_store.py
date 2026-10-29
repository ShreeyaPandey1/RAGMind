import re
from typing import List, Tuple, Optional, Dict, Any
import numpy as np
from sqlalchemy.orm import Session
from sqlalchemy import text, and_, or_
from app.db.models import DocumentChunk, Document
from app.core.config import settings
from app.core.logging import logger

STOP_WORDS = {
    "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
    "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
    "below", "between", "both", "but", "by", "can", "cannot", "could", "did", "didn't",
    "do", "does", "doesn't", "doing", "don't", "down", "during", "each", "few", "for",
    "from", "further", "had", "has", "have", "having", "he", "her", "here", "hers",
    "herself", "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't",
    "it", "its", "itself", "me", "more", "most", "my", "myself", "no", "nor", "not",
    "of", "off", "on", "once", "only", "or", "other", "ought", "our", "ours", "ourselves",
    "out", "over", "own", "same", "she", "should", "so", "some", "such", "than", "that",
    "the", "their", "theirs", "them", "themselves", "then", "there", "these", "they",
    "this", "those", "through", "to", "too", "under", "until", "up", "very", "was",
    "we", "were", "what", "when", "where", "which", "while", "who", "whom", "why", "with",
    "would", "you", "your", "yours", "yourself", "yourselves"
}

def _compute_lexical_score(query_text: str, chunk_text: str) -> float:
    raw_query_words = re.findall(r'[a-zA-Z0-9]+', query_text.lower())
    if not raw_query_words:
        return 0.0
    content_words = [w for w in raw_query_words if w not in STOP_WORDS]
    words_to_match = content_words if content_words else raw_query_words

    chunk_words = set(re.findall(r'[a-zA-Z0-9]+', chunk_text.lower()))
    if not chunk_words:
        return 0.0

    matched = sum(1 for w in words_to_match if w in chunk_words)
    return matched / len(words_to_match)

class RetrievedChunk:
    def __init__(
        self,
        chunk: DocumentChunk,
        document_filename: str,
        score: float,
        semantic_score: float = 0.0,
        lexical_score: float = 0.0
    ):
        self.chunk = chunk
        self.document_filename = document_filename
        self.score = score
        self.semantic_score = semantic_score
        self.lexical_score = lexical_score

class VectorStoreService:
    @staticmethod
    def search_similar(
        db: Session,
        query_vector: List[float],
        query_text: str,
        allowed_document_ids: Optional[List[str]] = None,
        top_k: int = 5,
        min_relevance_threshold: float = 0.35,
        enable_hybrid: bool = True
    ) -> List[RetrievedChunk]:
        """
        Executes hybrid semantic vector search + lexical search over document chunks.
        Supports both PostgreSQL + pgvector and SQLite fallback.
        """
        bind = db.get_bind()
        is_postgres = (bind.dialect.name == "postgresql") if bind is not None else False

        # Build base filter for document IDs and ready status
        doc_query = db.query(Document.id, Document.original_filename).filter(Document.processing_status == "READY")
        if allowed_document_ids is not None:
            if not allowed_document_ids:
                return []
            doc_query = doc_query.filter(Document.id.in_(allowed_document_ids))

        valid_docs = {doc.id: doc.original_filename for doc in doc_query.all()}
        if not valid_docs:
            return []

        doc_ids = list(valid_docs.keys())

        if is_postgres:
            return VectorStoreService._search_postgres_pgvector(
                db=db,
                query_vector=query_vector,
                query_text=query_text,
                doc_ids=doc_ids,
                valid_docs=valid_docs,
                top_k=top_k,
                min_threshold=min_relevance_threshold,
                enable_hybrid=enable_hybrid
            )
        else:
            return VectorStoreService._search_local_vector(
                db=db,
                query_vector=query_vector,
                query_text=query_text,
                doc_ids=doc_ids,
                valid_docs=valid_docs,
                top_k=top_k,
                min_threshold=min_relevance_threshold,
                enable_hybrid=enable_hybrid
            )

    @staticmethod
    def _search_postgres_pgvector(
        db: Session,
        query_vector: List[float],
        query_text: str,
        doc_ids: List[str],
        valid_docs: Dict[str, str],
        top_k: int,
        min_threshold: float,
        enable_hybrid: bool
    ) -> List[RetrievedChunk]:
        """PGVector cosine distance retrieval with optional full-text hybrid fusion."""
        # Convert vector to string representation for pgvector: '[0.1, 0.2, ...]'
        vec_str = "[" + ",".join(f"{x:.6f}" for x in query_vector) + "]"
        
        # In pgvector, cosine distance <=> ranges from 0 (identical) to 2 (opposite).
        # Cosine similarity = 1 - (embedding <=> vec)
        sql = text("""
            SELECT id, document_id, chunk_index, text, page_number, section_metadata,
                   char_offset_start, char_offset_end, token_count, created_at,
                   1 - (embedding <=> :vec::vector) AS cosine_sim
            FROM document_chunks
            WHERE document_id = ANY(:doc_ids) AND embedding IS NOT NULL
            ORDER BY embedding <=> :vec::vector ASC
            LIMIT :limit
        """)

        try:
            results = db.execute(sql, {"vec": vec_str, "doc_ids": doc_ids, "limit": top_k * 2}).fetchall()
            retrieved = []
            query_words = set(query_text.lower().split())

            for row in results:
                c_sim = float(row.cosine_sim)
                lex_score = _compute_lexical_score(query_text, row.text)
                if enable_hybrid:
                    blended = 0.6 * c_sim + 0.4 * lex_score
                    final_score = max(blended, lex_score * 0.85, c_sim)
                else:
                    final_score = c_sim

                if final_score >= min_threshold:
                    dummy_chunk = DocumentChunk(
                        id=row.id,
                        document_id=row.document_id,
                        chunk_index=row.chunk_index,
                        text=row.text,
                        page_number=row.page_number,
                        section_metadata=row.section_metadata,
                        char_offset_start=row.char_offset_start,
                        char_offset_end=row.char_offset_end,
                        token_count=row.token_count,
                        created_at=row.created_at
                    )
                    retrieved.append(RetrievedChunk(
                        chunk=dummy_chunk,
                        document_filename=valid_docs.get(row.document_id, "Unknown"),
                        score=final_score,
                        semantic_score=c_sim,
                        lexical_score=lex_score
                    ))

            retrieved.sort(key=lambda x: x.score, reverse=True)
            return retrieved[:top_k]

        except Exception as e:
            logger.warning(f"Error querying pgvector in PostgreSQL ({e}). Falling back to local vector scoring.")
            return VectorStoreService._search_local_vector(
                db, query_vector, query_text, doc_ids, valid_docs, top_k, min_threshold, enable_hybrid
            )

    @staticmethod
    def _search_local_vector(
        db: Session,
        query_vector: List[float],
        query_text: str,
        doc_ids: List[str],
        valid_docs: Dict[str, str],
        top_k: int,
        min_threshold: float,
        enable_hybrid: bool
    ) -> List[RetrievedChunk]:
        """In-database vector scoring using NumPy cosine similarity over chunk embeddings."""
        chunks = db.query(DocumentChunk).filter(
            DocumentChunk.document_id.in_(doc_ids)
        ).all()

        if not chunks:
            return []

        q_vec = np.array(query_vector, dtype=np.float32)
        q_norm = np.linalg.norm(q_vec)
        if q_norm == 0:
            return []

        query_words = set(query_text.lower().split())
        scored_chunks: List[RetrievedChunk] = []

        for chunk in chunks:
            emb = chunk.embedding
            if not emb:
                continue

            c_vec = np.array(emb, dtype=np.float32)
            c_norm = np.linalg.norm(c_vec)
            if c_norm == 0:
                continue

            cosine_sim = float(np.dot(q_vec, c_vec) / (q_norm * c_norm))

            # Normalize negative cosine to 0
            cosine_sim = max(0.0, cosine_sim)

            # Lexical score
            lex_score = _compute_lexical_score(query_text, chunk.text)
            if enable_hybrid:
                blended = 0.6 * cosine_sim + 0.4 * lex_score
                final_score = max(blended, lex_score * 0.85, cosine_sim)
            else:
                final_score = cosine_sim

            if final_score >= min_threshold:
                scored_chunks.append(RetrievedChunk(
                    chunk=chunk,
                    document_filename=valid_docs.get(chunk.document_id, "Unknown"),
                    score=final_score,
                    semantic_score=cosine_sim,
                    lexical_score=lex_score
                ))

        scored_chunks.sort(key=lambda x: x.score, reverse=True)
        return scored_chunks[:top_k]
