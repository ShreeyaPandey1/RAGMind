import re
from typing import List, Dict, Any, Optional
from app.services.document_parser import ParsedPage
from app.core.config import settings

class ChunkItem:
    def __init__(
        self,
        chunk_index: int,
        text: str,
        page_number: Optional[int] = None,
        section_metadata: Optional[str] = None,
        char_offset_start: Optional[int] = None,
        char_offset_end: Optional[int] = None,
        token_count: int = 0,
        metadata: Optional[Dict[str, Any]] = None
    ):
        self.chunk_index = chunk_index
        self.text = text
        self.page_number = page_number
        self.section_metadata = section_metadata
        self.char_offset_start = char_offset_start
        self.char_offset_end = char_offset_end
        self.token_count = token_count
        self.metadata = metadata or {}

class ChunkingService:
    def __init__(self, chunk_size: Optional[int] = None, chunk_overlap: Optional[int] = None):
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap if chunk_overlap is not None else settings.CHUNK_OVERLAP

    def chunk_document(self, pages: List[ParsedPage]) -> List[ChunkItem]:
        """
        Split parsed document pages into semantically coherent, sentence-respecting chunks.
        Performs page-aware chunking so citations maintain precise page attribution.
        """
        chunks: List[ChunkItem] = []
        global_chunk_idx = 0

        for page in pages:
            page_text = page.text.strip()
            if not page_text:
                continue

            page_chunks = self._chunk_text(
                text=page_text,
                page_number=page.page_number,
                start_index=global_chunk_idx
            )
            for ch in page_chunks:
                chunks.append(ch)
                global_chunk_idx += 1

        return chunks

    def _chunk_text(self, text: str, page_number: int, start_index: int) -> List[ChunkItem]:
        # Split into sentences using punctuation boundaries
        sentence_delimiters = re.compile(r'(?<=[.!?\n])\s+')
        raw_sentences = [s.strip() for s in sentence_delimiters.split(text) if s.strip()]

        if not raw_sentences:
            return []

        chunks: List[ChunkItem] = []
        current_chunk_sentences: List[str] = []
        current_len = 0
        current_start_offset = 0
        running_char_offset = 0

        for sent in raw_sentences:
            sent_len = len(sent)
            # If a single sentence exceeds chunk_size, split by sub-phrases/words
            if sent_len > self.chunk_size:
                sub_parts = self._split_long_sentence(sent, self.chunk_size)
                for part in sub_parts:
                    if current_len + len(part) > self.chunk_size and current_chunk_sentences:
                        chunk_text = " ".join(current_chunk_sentences)
                        chunks.append(ChunkItem(
                            chunk_index=start_index + len(chunks),
                            text=chunk_text,
                            page_number=page_number,
                            char_offset_start=current_start_offset,
                            char_offset_end=current_start_offset + len(chunk_text),
                            token_count=max(1, len(chunk_text) // 4)
                        ))
                        # Compute overlap
                        current_chunk_sentences = self._get_overlap_sentences(current_chunk_sentences)
                        current_len = sum(len(s) for s in current_chunk_sentences)
                        current_start_offset = running_char_offset - current_len

                    current_chunk_sentences.append(part)
                    current_len += len(part)
                    running_char_offset += len(part)
                continue

            if current_len + sent_len > self.chunk_size and current_chunk_sentences:
                chunk_text = " ".join(current_chunk_sentences)
                chunks.append(ChunkItem(
                    chunk_index=start_index + len(chunks),
                    text=chunk_text,
                    page_number=page_number,
                    char_offset_start=current_start_offset,
                    char_offset_end=current_start_offset + len(chunk_text),
                    token_count=max(1, len(chunk_text) // 4)
                ))
                # Overlap retention
                current_chunk_sentences = self._get_overlap_sentences(current_chunk_sentences)
                current_len = sum(len(s) for s in current_chunk_sentences)
                current_start_offset = running_char_offset - current_len

            current_chunk_sentences.append(sent)
            current_len += sent_len
            running_char_offset += sent_len

        if current_chunk_sentences:
            chunk_text = " ".join(current_chunk_sentences)
            if chunk_text.strip():
                chunks.append(ChunkItem(
                    chunk_index=start_index + len(chunks),
                    text=chunk_text,
                    page_number=page_number,
                    char_offset_start=current_start_offset,
                    char_offset_end=current_start_offset + len(chunk_text),
                    token_count=max(1, len(chunk_text) // 4)
                ))

        return chunks

    def _get_overlap_sentences(self, sentences: List[str]) -> List[str]:
        overlap_sentences: List[str] = []
        accumulated_len = 0
        for sent in reversed(sentences):
            if accumulated_len + len(sent) <= self.chunk_overlap or not overlap_sentences:
                overlap_sentences.insert(0, sent)
                accumulated_len += len(sent)
            else:
                break
        return overlap_sentences

    def _split_long_sentence(self, sentence: str, max_size: int) -> List[str]:
        words = sentence.split()
        parts = []
        curr = []
        curr_len = 0
        for w in words:
            if curr_len + len(w) + 1 > max_size and curr:
                parts.append(" ".join(curr))
                curr = [w]
                curr_len = len(w)
            else:
                curr.append(w)
                curr_len += len(w) + 1
        if curr:
            parts.append(" ".join(curr))
        return parts
