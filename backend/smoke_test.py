import io
import uuid
from app.db.session import SessionLocal, active_db_type
from app.core.config import settings
from app.api.routes.health import get_health
from app.api.routes.documents import upload_document, get_document_chunks, list_documents, get_document_stats
from app.api.routes.chat import chat_endpoint
from app.schemas.chat import ChatRequest
from fastapi import UploadFile

def run_smoke_test():
    print("=== RAGMind System Smoke Test ===")
    print(f"Project: {settings.PROJECT_NAME} v{settings.VERSION}")
    print(f"Active DB Engine: {active_db_type}")
    print(f"Embedding Provider: {settings.EMBEDDING_PROVIDER} ({settings.EMBEDDING_MODEL})")
    print(f"LLM Provider: {settings.LLM_PROVIDER} ({settings.LLM_MODEL})")

    db = SessionLocal()
    try:
        # 1. Health check
        print("\n[1/5] Checking System Health...")
        health = get_health(db=db)
        print(f"  Status: {health.status}, DB Connected: {health.database_connected}, AI Ready: {health.ai_provider_ready}")
        assert health.database_connected is True

        # 2. Upload document
        print("\n[2/5] Uploading Document for Ingestion...")
        smoke_id = uuid.uuid4().hex[:8]
        doc_bytes = (
            f"Quantum Supremacy Protocol {smoke_id}.\n"
            f"The quantum processor Sycamore performed a benchmark calculation in 200 seconds. "
            f"A classical supercomputer would require approximately 10,000 years to execute the same task. "
            f"The experiment utilizes superconducting transmon qubits cooled to 20 millikelvin."
        ).encode("utf-8")
        
        file = UploadFile(
            file=io.BytesIO(doc_bytes),
            filename=f"quantum_supremacy_{smoke_id}.txt"
        )
        doc = upload_document(file=file, collection_id=None, db=db)
        print(f"  Document ID: {doc.id}")
        print(f"  Status: {doc.processing_status}")
        print(f"  Extracted Chunks: {doc.chunk_count}")
        assert doc.processing_status == "READY"
        assert doc.chunk_count > 0

        # 3. Retrieve chunks
        print("\n[3/5] Verifying Chunks & Embeddings in Vector Store...")
        chunks = get_document_chunks(document_id=doc.id, db=db)
        print(f"  Retrieved {len(chunks)} chunks from storage.")
        assert len(chunks) > 0
        first_chunk = chunks[0]
        print(f"  Chunk 0 Excerpt: {first_chunk.text[:80]}...")
        print(f"  Chunk Tokens: {first_chunk.token_count}, Page: {first_chunk.page_number}")

        # 4. Grounded Chat Query
        print("\n[4/5] Testing Grounded RAG Chat with Citation Tracking...")
        query = "How long did Sycamore take compared to a classical supercomputer?"
        chat_req = ChatRequest(
            question=query,
            document_scope_type="DOCUMENTS",
            selected_scope_ids=[doc.id]
        )
        chat_resp = chat_endpoint(payload=chat_req, db=db)
        print(f"  Question: {query}")
        print(f"  Answer: {chat_resp.answer}")
        print(f"  Is Abstention: {chat_resp.is_abstention}")
        print(f"  Number of Citations: {len(chat_resp.sources)}")
        for src in chat_resp.sources:
            print(f"    - Citation [{src.citation_number}] from '{src.document_name}': {src.excerpt[:60]}... (Score: {src.relevance_score})")
        assert chat_resp.is_abstention is False
        assert len(chat_resp.sources) > 0

        # 5. Abstention on ungrounded question
        print("\n[5/5] Testing Grounding Guard & Abstention on OOD Query...")
        ood_query = "What is the capital of Mars and the favorite color of Martian cats?"
        ood_req = ChatRequest(
            question=ood_query,
            document_scope_type="DOCUMENTS",
            selected_scope_ids=[doc.id]
        )
        ood_resp = chat_endpoint(payload=ood_req, db=db)
        print(f"  OOD Question: {ood_query}")
        print(f"  OOD Answer: {ood_resp.answer}")
        print(f"  Is Abstention: {ood_resp.is_abstention}")
        assert ood_resp.is_abstention is True

        # Stats check
        stats = get_document_stats(db=db)
        print(f"\n  Final Library Stats: {stats.total_documents} total docs, {stats.ready_documents} ready, {stats.total_chunks} chunks.")

        print("\n=======================================================")
        print(">>> ALL RAGMind END-TO-END SMOKE TESTS PASSED! <<<")
        print("=======================================================\n")

    finally:
        db.close()

if __name__ == "__main__":
    run_smoke_test()
