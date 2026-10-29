import os
import pytest
import fitz # PyMuPDF
import docx
from app.services.document_parser import DocumentParserService
from app.core.exceptions import DocumentProcessingError, UnsupportedFileTypeError

def test_parse_text_file(tmp_path):
    txt_file = tmp_path / "sample.txt"
    txt_file.write_text("RAGMind is an AI knowledge engine.\nIt provides verifiable citations.", encoding="utf-8")
    
    parsed = DocumentParserService.parse_file(str(txt_file), "text/plain", "sample.txt")
    assert parsed.total_pages == 1
    assert len(parsed.pages) == 1
    assert "RAGMind" in parsed.pages[0].text
    assert "verifiable citations" in parsed.pages[0].text

def test_parse_markdown_file(tmp_path):
    md_file = tmp_path / "readme.md"
    md_file.write_text("# Overview\n\n- Grounded Answers\n- Traceable Citations", encoding="utf-8")
    
    parsed = DocumentParserService.parse_file(str(md_file), "text/markdown", "readme.md")
    assert parsed.total_pages == 1
    assert "Overview" in parsed.pages[0].text

def test_parse_empty_file_fails(tmp_path):
    empty_file = tmp_path / "empty.txt"
    empty_file.write_text("   \n\n  ", encoding="utf-8")
    
    with pytest.raises(DocumentProcessingError, match="empty"):
        DocumentParserService.parse_file(str(empty_file), "text/plain", "empty.txt")

def test_parse_pdf_generation_and_reading(tmp_path):
    pdf_file = tmp_path / "test_doc.pdf"
    doc = fitz.open()
    page1 = doc.new_page()
    page1.insert_text((50, 72), "DeepMind produces advanced agentic systems.")
    page2 = doc.new_page()
    page2.insert_text((50, 72), "Page two contains vector database instructions.")
    doc.save(str(pdf_file))
    doc.close()

    parsed = DocumentParserService.parse_file(str(pdf_file), "application/pdf", "test_doc.pdf")
    assert parsed.total_pages == 2
    assert len(parsed.pages) == 2
    assert "DeepMind" in parsed.pages[0].text
    assert parsed.pages[0].page_number == 1
    assert "vector database" in parsed.pages[1].text
    assert parsed.pages[1].page_number == 2

def test_parse_unsupported_file_extension(tmp_path):
    bin_file = tmp_path / "archive.zip"
    bin_file.write_bytes(b"PK000fakezip")
    
    with pytest.raises(UnsupportedFileTypeError):
        DocumentParserService.parse_file(str(bin_file), "application/zip", "archive.zip")
