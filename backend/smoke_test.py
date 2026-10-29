import io
import uuid
import fitz # PyMuPDF
from app.db.session import SessionLocal, active_db_type
from app.core.config import settings
from app.api.routes.health import get_health
from app.api.routes.documents import upload_document, get_document_chunks, get_document_stats, delete_document
from app.api.routes.chat import chat_endpoint
from app.schemas.chat import ChatRequest
from fastapi import UploadFile

def generate_test_pdf(unique_tag: str) -> bytes:
    doc = fitz.open()
    # Page 1: Space Telescope Specs
    p1 = doc.new_page()
    p1.insert_textbox(
        fitz.Rect(50, 50, 550, 750),
        f"Helios Orbital Telescope Documentation [{unique_tag}].\n\n"
        "The primary beryllium mirror array measures 8.4 meters in diameter. "
        "The focal length is calibrated to 142.6 meters for deep infrared astronomy. "
        "Operating orbit is maintained at the Sun-Earth L2 Lagrange point."
    )
    # Page 2: Instrument & Detector
    p2 = doc.new_page()
    p2.insert_textbox(
        fitz.Rect(50, 50, 550, 750),
        f"Helios Sensor Telemetry & Encryption [{unique_tag}].\n\n"
        "The mercury-cadmium-telluride detector array operates at 7 Kelvin. "
        "Telemetry downlink bandwidth is capped at 120 Megabits per second. "
        "Quantum-resistant lattice cryptography is deployed for uplink commanding."
    )
    buf = io.BytesIO()
    doc.save(buf)
    doc.close()
    return buf.getvalue()

def run_smoke_test():
    print("=== RAGMind System Smoke Test ===")
    print(f"Project: {settings.PROJECT_NAME} v{settings.VERSION}")
    print(f"Active DB Engine: {active_db_type}")
    print(f"Embedding Provider: {settings.EMBEDDING_PROVIDER} ({settings.EMBEDDING_MODEL})")
    print(f"LLM Provider: {settings.LLM_PROVIDER} ({settings.LLM_MODEL})")

    db = SessionLocal()
    try:
        # 1. Health check
        print("\n[1/6] Checking System Health...")
        health = get_health(db=db)
        print(f"  Status: {health.status}, DB Connected: {health.database_connected}, AI Ready: {health.ai_provider_ready}")
        assert health.database_connected is True

        # 2. Text Upload
        print("\n[2/6] Ingesting Plain Text Document...")
        txt_id = uuid.uuid4().hex[:8]
        txt_bytes = (
            f"Quantum Supremacy Protocol {txt_id}.\n"
            f"The quantum processor Sycamore performed a benchmark calculation in 200 seconds. "
            f"A classical supercomputer would require approximately 10,000 years to execute the same task. "
            f"The experiment utilizes superconducting transmon qubits cooled to 20 millikelvin."
        ).encode("utf-8")
        
        txt_file = UploadFile(
            file=io.BytesIO(txt_bytes),
            filename=f"quantum_supremacy_{txt_id}.txt"
        )
        txt_doc = upload_document(file=txt_file, collection_id=None, db=db)
        print(f"  Text Doc ID: {txt_doc.id}, Status: {txt_doc.processing_status}, Chunks: {txt_doc.chunk_count}")
        assert txt_doc.processing_status == "READY"

        # 3. PDF Upload
        print("\n[3/6] Ingesting Multi-Page PDF Document...")
        pdf_id = uuid.uuid4().hex[:8]
        pdf_bytes = generate_test_pdf(pdf_id)
        pdf_file = UploadFile(
            file=io.BytesIO(pdf_bytes),
            filename=f"helios_telescope_{pdf_id}.pdf"
        )
        pdf_doc = upload_document(file=pdf_file, collection_id=None, db=db)
        print(f"  PDF Doc ID: {pdf_doc.id}, Status: {pdf_doc.processing_status}")
        print(f"  Extracted Pages: {pdf_doc.extracted_page_count}, Chunks: {pdf_doc.chunk_count}")
        assert pdf_doc.processing_status == "READY"
        assert pdf_doc.extracted_page_count == 2
        assert pdf_doc.chunk_count >= 2

        # 4. Check PDF chunks & page numbers
        pdf_chunks = get_document_chunks(document_id=pdf_doc.id, db=db)
        assert len(pdf_chunks) >= 2
        assert any(c.page_number == 1 and "8.4 meters" in c.text for c in pdf_chunks)
        assert any(c.page_number == 2 and "7 Kelvin" in c.text for c in pdf_chunks)

        # 5. Targeted Chat Query on PDF Page 1
        print("\n[4/6] Querying PDF Page 1 with Citation Verification...")
        pdf_q1 = f"What is the diameter of the beryllium mirror in Helios {pdf_id}?"
        chat_req = ChatRequest(
            question=pdf_q1,
            document_scope_type="DOCUMENTS",
            selected_scope_ids=[pdf_doc.id]
        )
        chat_res = chat_endpoint(payload=chat_req, db=db)
        print(f"  Question: {pdf_q1}")
        print(f"  Answer: {chat_res.answer}")
        print(f"  Is Abstention: {chat_res.is_abstention}")
        assert chat_res.is_abstention is False
        assert len(chat_res.sources) > 0
        assert chat_res.sources[0].page_number == 1
        assert "8.4 meters" in chat_res.answer or "8.4" in chat_res.answer

        # 6. Targeted Chat Query on PDF Page 2
        print("\n[5/6] Querying PDF Page 2 with Citation Verification...")
        pdf_q2 = f"What is the detector operating temperature and downlink bandwidth in {pdf_id}?"
        chat_req2 = ChatRequest(
            question=pdf_q2,
            document_scope_type="DOCUMENTS",
            selected_scope_ids=[pdf_doc.id]
        )
        chat_res2 = chat_endpoint(payload=chat_req2, db=db)
        print(f"  Question: {pdf_q2}")
        print(f"  Answer: {chat_res2.answer}")
        print(f"  Is Abstention: {chat_res2.is_abstention}")
        assert chat_res2.is_abstention is False
        assert len(chat_res2.sources) > 0
        assert chat_res2.sources[0].page_number == 2
        assert "7 Kelvin" in chat_res2.answer or "120" in chat_res2.answer

        # 7. Grounding Guard / Abstention Check
        print("\n[6/6] Testing Abstention on Ungrounded Query...")
        ood_query = "What is the secret recipe for baking chocolate cupcakes on the telescope?"
        ood_req = ChatRequest(
            question=ood_query,
            document_scope_type="DOCUMENTS",
            selected_scope_ids=[pdf_doc.id]
        )
        ood_res = chat_endpoint(payload=ood_req, db=db)
        print(f"  OOD Question: {ood_query}")
        print(f"  OOD Answer: {ood_res.answer}")
        print(f"  Is Abstention: {ood_res.is_abstention}")
        assert ood_res.is_abstention is True

        # Clean up created PDF doc
        delete_document(document_id=pdf_doc.id, db=db)

        # Final Stats
        stats = get_document_stats(db=db)
        print(f"\n  Final Library Stats: {stats.total_documents} docs, {stats.total_chunks} chunks.")

        print("\n=======================================================")
        print(">>> ALL RAGMind END-TO-END SMOKE TESTS PASSED! <<<")
        print("=======================================================\n")

    finally:
        db.close()

if __name__ == "__main__":
    run_smoke_test()
