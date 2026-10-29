import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings as SettingsIcon,
  Activity,
  Database,
  Cpu,
  Save,
  CheckCircle2,
  AlertTriangle,
  HardDrive,
  RefreshCw,
  Server
} from 'lucide-react';
import { settingsApi, diagnosticsApi } from '../api/client';
import { SettingsData } from '../types';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const { data: settingsData, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: settingsApi.get,
  });

  const { data: diagnostics, isLoading: isDiagLoading, refetch: refetchDiag } = useQuery({
    queryKey: ['systemDiagnostics'],
    queryFn: diagnosticsApi.get,
    refetchInterval: 6000,
  });

  const { data: health, isLoading: isHealthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: diagnosticsApi.health,
    refetchInterval: 6000,
  });

  // Local form state
  const [formData, setFormData] = useState<Partial<SettingsData>>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (settingsData) {
      setFormData({
        llm_provider: settingsData.llm_provider,
        llm_model: settingsData.llm_model,
        embedding_provider: settingsData.embedding_provider,
        embedding_model: settingsData.embedding_model,
        retrieval_top_k: settingsData.retrieval_top_k,
        min_relevance_threshold: settingsData.min_relevance_threshold,
        temperature: settingsData.temperature,
        max_generation_tokens: settingsData.max_generation_tokens,
        chunk_size: settingsData.chunk_size,
        chunk_overlap: settingsData.chunk_overlap,
        enable_hybrid_search: settingsData.enable_hybrid_search,
      });
    }
  }, [settingsData]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<SettingsData>) => settingsApi.update(data),
    onSuccess: () => {
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      queryClient.invalidateQueries({ queryKey: ['systemDiagnostics'] });
    },
    onError: (err: Error) => {
      alert('Error updating settings: ' + err.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  return (
    <div className="p-6 md:p-8 max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Settings & System Diagnostics
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Configure RAG hyperparameters, embedding models, and monitor engine availability.
          </p>
        </div>
      </div>

      {/* Live System Health Section */}
      <div className="space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-primary" />
          Live Infrastructure Health
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Backend Status */}
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Server className="w-4 h-4 text-primary" />
                FastAPI Backend
              </span>
              <Badge variant="success" size="sm">Online</Badge>
            </div>
            <p className="text-sm font-semibold text-foreground">v{settingsData?.version || '1.0.0'}</p>
            <p className="text-[11px] text-muted-foreground">Python {diagnostics?.system.python_version || '3.12'}</p>
          </Card>

          {/* Database Status */}
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Database className="w-4 h-4 text-emerald-500" />
                Database Engine
              </span>
              <Badge variant={health?.database_connected ? 'success' : 'error'} size="sm">
                {health?.database_connected ? 'Connected' : 'Disconnected'}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-foreground uppercase">
              {diagnostics?.database.type || 'PostgreSQL'}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {diagnostics?.database.total_chunks ?? 0} vectors stored
            </p>
          </Card>

          {/* AI Provider Status */}
          <Card className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-indigo-500" />
                AI Model Provider
              </span>
              <Badge variant="indigo" size="sm">
                {settingsData?.llm_provider === 'local' ? 'Local Engine' : 'OpenAI-Compatible'}
              </Badge>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">
              {settingsData?.llm_model || 'gpt-4o-mini'}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              Embed: {settingsData?.embedding_model || 'text-embedding-3-small'}
            </p>
          </Card>
        </div>
      </div>

      {/* Storage Diagnostics */}
      <Card className="p-5 space-y-3">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-xs font-semibold text-foreground">Storage Diagnostics</h4>
          </div>
          <Button variant="ghost" size="sm" onClick={() => refetchDiag()} className="h-7 px-2 text-xs gap-1">
            <RefreshCw className="w-3 h-3" />
            Refresh
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div>
            <span className="text-[11px] text-muted-foreground">Upload Path:</span>
            <p className="font-mono text-foreground mt-0.5">{diagnostics?.storage.upload_dir || './data/uploads'}</p>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground">Storage Used:</span>
            <p className="font-mono text-foreground mt-0.5">{diagnostics?.storage.used_mb ?? 0} MB</p>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground">Max File Size:</span>
            <p className="font-mono text-foreground mt-0.5">{diagnostics?.storage.max_file_size_mb ?? 25} MB</p>
          </div>
          <div>
            <span className="text-[11px] text-muted-foreground">Database URL:</span>
            <p className="font-mono text-foreground truncate mt-0.5" title={settingsData?.database_url_masked}>
              {settingsData?.database_url_masked || 'sqlite:///./data/ragmind.db'}
            </p>
          </div>
        </div>
      </Card>

      {/* Configuration Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="border border-border/80 rounded-2xl bg-card p-6 md:p-8 space-y-6">
          <div className="flex items-center justify-between border-b border-border/60 pb-4">
            <div>
              <h3 className="text-sm font-semibold text-foreground">RAG & Retrieval Hyperparameters</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Adjust chunking windows, top-k retrieval count, and relevance filtering.
              </p>
            </div>
            {saveSuccess && (
              <Badge variant="success" size="sm" className="gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Settings Saved
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
            {/* LLM Provider */}
            <div>
              <label className="block font-medium text-foreground mb-1.5">LLM Generation Provider</label>
              <select
                value={formData.llm_provider || 'local'}
                onChange={e => setFormData({ ...formData, llm_provider: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="local">Local Deterministic Synthesizer (Offline-Ready)</option>
                <option value="openai">OpenAI / OpenAI-Compatible API</option>
              </select>
            </div>

            {/* LLM Model */}
            <div>
              <label className="block font-medium text-foreground mb-1.5">Generation Model</label>
              <input
                type="text"
                value={formData.llm_model || ''}
                onChange={e => setFormData({ ...formData, llm_model: e.target.value })}
                placeholder="gpt-4o-mini"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
              />
            </div>

            {/* Embedding Provider */}
            <div>
              <label className="block font-medium text-foreground mb-1.5">Embedding Provider</label>
              <select
                value={formData.embedding_provider || 'local'}
                onChange={e => setFormData({ ...formData, embedding_provider: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="local">Local Deterministic Normalized Hash Vectors</option>
                <option value="openai">OpenAI Embeddings API</option>
              </select>
            </div>

            {/* Embedding Model */}
            <div>
              <label className="block font-medium text-foreground mb-1.5">Embedding Model</label>
              <input
                type="text"
                value={formData.embedding_model || ''}
                onChange={e => setFormData({ ...formData, embedding_model: e.target.value })}
                placeholder="text-embedding-3-small"
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono text-xs"
              />
            </div>

            {/* Retrieval Top-k */}
            <div>
              <label className="block font-medium text-foreground mb-1.5">
                Retrieval Top-K Chunks: <strong className="text-primary">{formData.retrieval_top_k ?? 5}</strong>
              </label>
              <input
                type="range"
                min="1"
                max="15"
                value={formData.retrieval_top_k ?? 5}
                onChange={e => setFormData({ ...formData, retrieval_top_k: parseInt(e.target.value, 10) })}
                className="w-full accent-primary"
              />
              <span className="text-[10px] text-muted-foreground">Number of highest-similarity passages to retrieve</span>
            </div>

            {/* Min Relevance Threshold */}
            <div>
              <label className="block font-medium text-foreground mb-1.5">
                Minimum Relevance Threshold: <strong className="text-primary">{formData.min_relevance_threshold ?? 0.35}</strong>
              </label>
              <input
                type="range"
                min="0.10"
                max="0.85"
                step="0.05"
                value={formData.min_relevance_threshold ?? 0.35}
                onChange={e => setFormData({ ...formData, min_relevance_threshold: parseFloat(e.target.value) })}
                className="w-full accent-primary"
              />
              <span className="text-[10px] text-muted-foreground">Scores below threshold trigger explicit abstention</span>
            </div>

            {/* Chunk Size */}
            <div>
              <label className="block font-medium text-foreground mb-1.5">Chunk Size (Characters)</label>
              <input
                type="number"
                min="200"
                max="3000"
                step="50"
                value={formData.chunk_size ?? 800}
                onChange={e => setFormData({ ...formData, chunk_size: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Chunk Overlap */}
            <div>
              <label className="block font-medium text-foreground mb-1.5">Chunk Overlap (Characters)</label>
              <input
                type="number"
                min="0"
                max="500"
                step="25"
                value={formData.chunk_overlap ?? 150}
                onChange={e => setFormData({ ...formData, chunk_overlap: parseInt(e.target.value, 10) })}
                className="w-full px-3 py-2 rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-border/60 flex items-center justify-between">
            <span className="text-xs text-muted-foreground">
              API Keys are securely managed via server environment variables.
            </span>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={updateMutation.isPending}
              className="gap-1.5 shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              Save Settings
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};
