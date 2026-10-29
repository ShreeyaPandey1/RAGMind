# RAGMind — AI Knowledge Engine

> **“Your documents. Your knowledge. Answers you can verify.”**

RAGMind is an enterprise-grade, document-grounded Retrieval-Augmented Generation (RAG) platform. It empowers teams and researchers to upload multi-format documents (PDF, DOCX, TXT, Markdown), inspect extracted chunks, execute hybrid semantic and lexical retrieval, and ask natural language questions with source-grounded answers and traceable inline citations.

---

## Key Pillars

1. **Grounded Answers**: Every factual answer is generated strictly from retrieved document passages. Unsupported questions trigger explicit abstention rather than hallucinated facts.
2. **Traceable Citations**: Inline references (`[1]`, `[2]`) tie directly to immutable chunk IDs, page numbers, and exact text excerpts verifiable in the document viewer.
3. **Private Document Control**: Configurable document scopes (all ready documents, specific collections, or individual files) guarantee that retrieval only queries user-approved context.
4. **Transparent Diagnostics**: Real-time inspection of ingestion states, chunking parameters, embedding models, vector similarity scores, and provider health.

---

## Technical Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, Lucide Icons, React Router, TanStack Query, React Markdown.
- **Backend**: Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, PyMuPDF, python-docx.
- **Vector Database**: PostgreSQL 16 with pgvector extension (with persistent fallback for local sandbox/testing autonomy).
- **AI / LLM**: Configurable OpenAI-compatible LLM & Embedding provider with robust local fallback for offline evaluation.
- **Containerization**: Docker, Docker Compose.
