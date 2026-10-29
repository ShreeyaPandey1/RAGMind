import io
import uuid
import pytest
import fitz # PyMuPDF
from fastapi import UploadFile
from app.db.session import SessionLocal
from app.api.routes.documents import upload_document, get_document_chunks, delete_document
from app.api.routes.chat import chat_endpoint
from app.schemas.chat import ChatRequest
from app.db.models import DocumentChunk, Document

def generate_sample_pdf_bytes(unique_tag: str) -> bytes:
    """Generates an in-memory 3-page PDF with distinct information per page."""
    doc = fitz.open()
    
    # Page 1: System Specifications
    page1 = doc.new_page()
    page1.insert_textbox(
        fitz.Rect(50, 50, 550, 750),
        f"Project Chronos Specification [{unique_tag}].\n\n"
        "The primary synchronization frequency is calibrated to 4.85 GHz using atomic rubidium standards. "
        "The active cooling subsystem stabilizes the operational temperature at 12 Kelvin. "
        "Peak electric power consumption is measured at 650 Watts during burst cycles."
    )
    
    # Page 2: Security Architecture
    page2 = doc.new_page()
    page2.insert_textbox(
        fitz.Rect(50, 50, 550, 750),
        f"Security and Governance Architecture [{unique_tag}].\n\n"
        "Authentication mandates Ed25519 asymmetric cryptographic signatures with 15-minute token rotation. "
        "Data at rest is secured via AES-256-GCM encryption. "
        "The manual emergency shutdown trigger is designated as code-red-protocol-omega."
    )
    
    # Page 3: Benchmarks & Latency
    page3 = doc.new_page()
    page3.insert_textbox(
        fitz.Rect(50, 50, 550, 750),
        f"Benchmarking and Reliability Telemetry [{unique_tag}].\n\n"
        "Under sustained workload of 10,000 concurrent requests, the 99th percentile end-to-end latency is 42 milliseconds. "
        "Packet transmission loss threshold is strictly maintained below 0.001%. "
        "Cluster failover recovery initiates automatically within 350 milliseconds of heartbeat interruption."
    )

    pdf_buffer = io.BytesIO()
    doc.save(pdf_buffer)
    doc.close()
    return pdf_buffer.getvalue()


def test_complete_pdf_pipeline_end_to_end():
    db = SessionLocal()
    unique_run_id = uuid.uuid4().hex[:8]
    pdf_bytes = generate_sample_pdf_bytes(unique_run_id)
    filename = f"chronos_architecture_{unique_run_id}.pdf"

    try:
        # 1. Upload & Ingest PDF
        upload_file = UploadFile(
            file=io.BytesIO(pdf_bytes),
            filename=filename
        )
        doc = upload_document(file=upload_file, collection_id=None, db=db)

        assert doc.original_filename == filename
        assert doc.processing_status == "READY"
        assert doc.extracted_page_count == 3
        assert doc.chunk_count >= 3
        doc_id = doc.id

        # 2. Check extracted chunks and page attribution
        chunks = get_document_chunks(document_id=doc_id, db=db)
        assert len(chunks) >= 3

        page_numbers_in_chunks = {c.page_number for c in chunks}
        assert 1 in page_numbers_in_chunks
        assert 2 in page_numbers_in_chunks
        assert 3 in page_numbers_in_chunks

        # Check chunk content on page 1
        page1_chunks = [c for c in chunks if c.page_number == 1]
        assert any("4.85 GHz" in c.text for c in page1_chunks)

        # Check chunk content on page 2
        page2_chunks = [c for c in chunks if c.page_number == 2]
        assert any("code-red-protocol-omega" in c.text for c in page2_chunks)

        # 3. Grounded Chat Query for Page 1 content
        q1 = f"What is the synchronization frequency of Chronos {unique_run_id}?"
        res1 = chat_endpoint(
            payload=ChatRequest(
                question=q1,
                document_scope_type="DOCUMENTS",
                selected_scope_ids=[doc_id]
            ),
            db=db
        )
        assert res1.is_abstention is False
        assert len(res1.sources) > 0
        assert "4.85 GHz" in res1.answer or "4.85" in res1.answer
        # Verify citation attribution points to Page 1
        assert res1.sources[0].page_number == 1
        assert res1.sources[0].document_name == filename

        # 4. Grounded Chat Query for Page 2 content
        q2 = f"What is the designated emergency shutdown trigger in {unique_run_id}?"
        res2 = chat_endpoint(
            payload=ChatRequest(
                question=q2,
                document_scope_type="DOCUMENTS",
                selected_scope_ids=[doc_id]
            ),
            db=db
        )
        assert res2.is_abstention is False
        assert len(res2.sources) > 0
        assert "code-red-protocol-omega" in res2.answer
        # Verify citation attribution points to Page 2
        assert res2.sources[0].page_number == 2

        # 5. Grounded Chat Query for Page 3 content
        q3 = f"What is the 99th percentile end-to-end latency under 10000 concurrent requests in {unique_run_id}?"
        res3 = chat_endpoint(
            payload=ChatRequest(
                question=q3,
                document_scope_type="DOCUMENTS",
                selected_scope_ids=[doc_id]
            ),
            db=db
        )
        assert res3.is_abstention is False
        assert len(res3.sources) > 0
        assert "42 milliseconds" in res3.answer or "42" in res3.answer
        # Verify citation attribution points to Page 3
        assert res3.sources[0].page_number == 3

        # 6. Abstention Test on out-of-domain question
        ood_q = "What is the secret recipe for baking artisanal Italian sourdough bread?"
        ood_res = chat_endpoint(
            payload=ChatRequest(
                question=ood_q,
                document_scope_type="DOCUMENTS",
                selected_scope_ids=[doc_id]
            ),
            db=db
        )
        assert ood_res.is_abstention is True
        assert (
            "couldn't find enough relevant information" in ood_res.answer.lower()
            or "not enough information" in ood_res.answer.lower()
        )

        # 7. Empty Scope Abstention Test
        empty_res = chat_endpoint(
            payload=ChatRequest(
                question=q1,
                document_scope_type="DOCUMENTS",
                selected_scope_ids=[str(uuid.uuid4())] # Non-existent document ID
            ),
            db=db
        )
        assert empty_res.is_abstention is True

        # 8. Clean Document Deletion & Cascade Verification
        delete_res = delete_document(document_id=doc_id, db=db)
        assert delete_res["success"] is True

        # Ensure chunks are cascaded and removed
        remaining_chunks = db.query(DocumentChunk).filter(DocumentChunk.document_id == doc_id).all()
        assert len(remaining_chunks) == 0

        # Ensure document is gone
        remaining_doc = db.query(Document).filter(Document.id == doc_id).first()
        assert remaining_doc is None

    finally:
        db.close()
