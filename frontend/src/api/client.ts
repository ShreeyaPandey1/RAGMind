import {
  DocumentItem,
  DocumentChunk,
  DocumentStats,
  CollectionItem,
  ConversationItem,
  ChatResponse,
  AnswerSource,
  SettingsData,
  DiagnosticsData,
  HealthStatus
} from '../types';

const BASE_URL = '/api';

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let errorDetail = 'An unexpected error occurred.';
    try {
      const data = await res.json();
      errorDetail = data.detail || data.error || errorDetail;
    } catch {
      errorDetail = await res.text() || res.statusText;
    }
    throw new Error(errorDetail);
  }

  return res.json();
}

export const documentsApi = {
  list: (params?: { status?: string; collection_id?: string; search?: string }) => {
    const q = new URLSearchParams();
    if (params?.status) q.append('status', params.status);
    if (params?.collection_id) q.append('collection_id', params.collection_id);
    if (params?.search) q.append('search', params.search);
    const queryStr = q.toString() ? `?${q.toString()}` : '';
    return request<DocumentItem[]>(`/documents${queryStr}`);
  },
  stats: () => request<DocumentStats>('/documents/stats'),
  get: (id: string) => request<DocumentItem>(`/documents/${id}`),
  chunks: (id: string) => request<DocumentChunk[]>(`/documents/${id}/chunks`),
  preview: (id: string) => request<{ id: string; filename: string; preview: string; page_count: number; chunk_count: number }>(`/documents/${id}/preview`),
  upload: (file: File, collectionId?: string) => {
    const formData = new FormData();
    formData.append('file', file);
    if (collectionId) formData.append('collection_id', collectionId);
    return request<DocumentItem>('/documents/upload', {
      method: 'POST',
      body: formData,
    });
  },
  retry: (id: string) => request<DocumentItem>(`/documents/${id}/retry`, { method: 'POST' }),
  delete: (id: string) => request<{ success: boolean; message: string }>(`/documents/${id}`, { method: 'DELETE' }),
  update: (id: string, data: { collection_id?: string | null }) =>
    request<DocumentItem>(`/documents/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};

export const collectionsApi = {
  list: () => request<CollectionItem[]>('/collections'),
  create: (data: { name: string; description?: string }) =>
    request<CollectionItem>('/collections', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request<CollectionItem>(`/collections/${id}`),
  update: (id: string, data: { name?: string; description?: string }) =>
    request<CollectionItem>(`/collections/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ success: boolean; message: string }>(`/collections/${id}`, { method: 'DELETE' }),
};

export const conversationsApi = {
  list: () => request<ConversationItem[]>('/conversations'),
  create: (data: { title?: string; document_scope_type?: string; selected_scope_ids?: string[] }) =>
    request<ConversationItem>('/conversations', { method: 'POST', body: JSON.stringify(data) }),
  get: (id: string) => request<ConversationItem>(`/conversations/${id}`),
  update: (id: string, data: { title?: string; document_scope_type?: string; selected_scope_ids?: string[] }) =>
    request<ConversationItem>(`/conversations/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => request<{ success: boolean; message: string }>(`/conversations/${id}`, { method: 'DELETE' }),
};

export const chatApi = {
  send: (data: {
    question: string;
    conversation_id?: string;
    document_scope_type?: string;
    selected_scope_ids?: string[];
    top_k?: number;
    min_relevance_threshold?: number;
  }) => request<ChatResponse>('/chat', { method: 'POST', body: JSON.stringify(data) }),
  getMessageSources: (messageId: string) => request<AnswerSource[]>(`/messages/${messageId}/sources`),
};

export const settingsApi = {
  get: () => request<SettingsData>('/settings'),
  update: (data: Partial<SettingsData>) =>
    request<SettingsData>('/settings', { method: 'PATCH', body: JSON.stringify(data) }),
};

export const diagnosticsApi = {
  get: () => request<DiagnosticsData>('/diagnostics'),
  health: () => request<HealthStatus>('/health'),
};
