from app.services.document_parser import ParsedPage
from app.services.chunking import ChunkingService

def test_chunking_preserves_page_metadata():
    pages = [
        ParsedPage(page_number=1, text="First sentence on page one. Second sentence on page one."),
        ParsedPage(page_number=2, text="First sentence on page two. Second sentence on page two.")
    ]
    service = ChunkingService(chunk_size=100, chunk_overlap=20)
    chunks = service.chunk_document(pages)

    assert len(chunks) >= 2
    # Verify page attribution
    page_numbers = {c.page_number for c in chunks}
    assert 1 in page_numbers
    assert 2 in page_numbers
    assert all(c.token_count > 0 for c in chunks)
    assert all(len(c.text.strip()) > 0 for c in chunks)

def test_chunking_is_deterministic():
    pages = [ParsedPage(page_number=1, text="The quick brown fox jumps over the lazy dog. Repeat statement again.")]
    service = ChunkingService(chunk_size=50, chunk_overlap=10)
    
    chunks_1 = service.chunk_document(pages)
    chunks_2 = service.chunk_document(pages)

    assert len(chunks_1) == len(chunks_2)
    for c1, c2 in zip(chunks_1, chunks_2):
        assert c1.text == c2.text
        assert c1.chunk_index == c2.chunk_index
        assert c1.char_offset_start == c2.char_offset_start
