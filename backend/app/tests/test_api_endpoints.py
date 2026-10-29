import io
import uuid
from fastapi import UploadFile
from app.db.session import SessionLocal
from app.api.routes.documents import upload_document, get_document_chunks, delete_document, list_documents
from app.api.routes.collections import create_collection, list_collections
from app.api.routes.chat import chat_endpoint
from app.schemas.collections import CollectionCreate
from app.schemas.chat import ChatRequest

def test_document_ingestion_and_chat_flow():
    db = SessionLocal()
    try:
        # 1. Upload a text document with unique content
        unique_run_id = uuid.uuid4().hex[:8]
        doc_content = (
            f"Project Apollo {unique_run_id} was the third United States human spaceflight program carried out by NASA. "
            f"It succeeded in landing the first humans on the Moon in 1969. "
            f"Neil Armstrong was the first person to walk on the Moon."
        ).encode("utf-8")
        upload_file = UploadFile(
            file=io.BytesIO(doc_content),
            filename=f"apollo_mission_{unique_run_id}.txt"
        )
        doc = upload_document(file=upload_file, collection_id=None, db=db)
        assert doc.original_filename == f"apollo_mission_{unique_run_id}.txt"
        assert doc.processing_status == "READY"
        assert doc.chunk_count > 0

        # 2. Check chunks
        chunks = get_document_chunks(document_id=doc.id, db=db)
        assert len(chunks) > 0
        assert "Apollo" in chunks[0].text

        # 3. Create collection
        coll_name = f"Space Missions {uuid.uuid4().hex[:6]}"
        coll = create_collection(payload=CollectionCreate(name=coll_name, description="NASA archive"), db=db)
        assert coll.name == coll_name

        # 4. Chat with question in document
        chat_req = ChatRequest(
            question="Who was the first person to walk on the Moon in Project Apollo?",
            document_scope_type="ALL"
        )
        chat_res = chat_endpoint(payload=chat_req, db=db)
        assert chat_res.is_abstention is False
        assert len(chat_res.sources) > 0
        assert "Neil Armstrong" in chat_res.answer or "Apollo" in chat_res.answer

        # 5. Chat with question absent from document (verifying abstention)
        absent_req = ChatRequest(
            question="What is the secret recipe for Belgian chocolate waffles?",
            document_scope_type="ALL",
            min_relevance_threshold=0.50
        )
        absent_res = chat_endpoint(payload=absent_req, db=db)
        assert absent_res.is_abstention is True

        # 6. Delete document
        del_res = delete_document(document_id=doc.id, db=db)
        assert del_res["success"] is True

    finally:
        db.close()
