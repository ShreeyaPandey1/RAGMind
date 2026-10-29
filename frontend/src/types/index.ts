export type DocumentStatus = 'PENDING' | 'PARSING' | 'CHUNKING' | 'EMBEDDING' | 'READY' | 'FAILED';

export interface DocumentChunk {
  id: string;
  chunk_index: number;
  text: string;
  page_number?: number | null;
  section_metadata?: string | null;
  token_count: number;
  char_offset_start?: number | null;
  char_offset_end?: number | null;
  created_at: string;
}

export interface DocumentItem {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  file_size: number;
  content_hash: string;
  processing_status: DocumentStatus;
  error_message?: string | null;
  extracted_page_count: number;
  chunk_count: number;
  collection_id?: string | null;
  created_at: string;
  updated_at: string;
  chunks?: DocumentChunk[];
}

export interface CollectionItem {
  id: string;
  name: string;
  description?: string | null;
  created_at: string;
  updated_at: string;
  document_count?: number;
}

export interface AnswerSource {
  id: string;
  citation_number: number;
  document_id: string;
  document_name: string;
  chunk_id?: string | null;
  page_number?: number | null;
  relevance_score: number;
  excerpt: string;
}

export interface MessageItem {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  is_abstention: boolean;
  retrieval_diagnostics?: string | null;
  created_at: string;
  sources?: AnswerSource[];
}

export interface ConversationItem {
  id: string;
  title: string;
  document_scope_type: 'ALL' | 'COLLECTION' | 'DOCUMENTS';
  selected_scope_ids?: string[];
  created_at: string;
  updated_at: string;
  message_count?: number;
  messages?: MessageItem[];
}

export interface RetrievalDiagnostic {
  query_latency_ms: number;
  retrieval_latency_ms: number;
  generation_latency_ms: number;
  total_latency_ms: number;
  chunks_retrieved: number;
  top_score: number;
  scope_type: string;
  documents_searched: number;
}

export interface ChatResponse {
  conversation_id: string;
  message_id: string;
  question: string;
  answer: string;
  is_abstention: boolean;
  sources: AnswerSource[];
  diagnostics: RetrievalDiagnostic;
}

export interface DocumentStats {
  total_documents: number;
  ready_documents: number;
  processing_documents: number;
  failed_documents: number;
  total_chunks: number;
  recent_activity: Array<{
    id: string;
    filename: string;
    status: DocumentStatus;
    chunks: number;
    created_at: string;
  }>;
}

export interface SettingsData {
  project_name: string;
  version: string;
  database_url_masked: string;
  active_database_type: string;
  llm_provider: string;
  llm_model: string;
  llm_base_url: string;
  llm_api_key_configured: boolean;
  embedding_provider: string;
  embedding_model: string;
  embedding_dimensions: number;
  chunk_size: number;
  chunk_overlap: number;
  retrieval_top_k: number;
  min_relevance_threshold: number;
  temperature: number;
  max_generation_tokens: number;
  enable_hybrid_search: boolean;
  upload_dir: string;
  max_upload_size_mb: number;
}

export interface DiagnosticsData {
  status: string;
  system: {
    os: string;
    python_version: string;
    app_version: string;
  };
  database: {
    type: string;
    connected: boolean;
    total_documents: number;
    total_chunks: number;
    total_conversations: number;
    total_messages: number;
  };
  storage: {
    upload_dir: string;
    used_bytes: number;
    used_mb: number;
    max_file_size_mb: number;
  };
  models: {
    llm_provider: string;
    llm_model: string;
    llm_configured: boolean;
    embedding_provider: string;
    embedding_model: string;
    embedding_dim: number;
  };
  retrieval: {
    top_k: number;
    min_relevance_threshold: number;
    hybrid_enabled: boolean;
  };
}

export interface HealthStatus {
  status: string;
  database_connected: boolean;
  database_type: string;
  ai_provider_ready: boolean;
  version: string;
  timestamp: string;
}
