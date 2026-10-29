import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  UploadCloud,
  FolderPlus,
  ArrowRight,
  Search,
  MessageSquare,
  Sparkles,
  Layers
} from 'lucide-react';
import { documentsApi, collectionsApi } from '../api/client';
import { Card } from '../components/common/Card';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCollectionOpen, setIsCollectionOpen] = useState(false);
  const [collectionName, setCollectionName] = useState('');
  const [collectionDesc, setCollectionDesc] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: stats, isLoading: isStatsLoading, refetch: refetchStats } = useQuery({
    queryKey: ['documentStats'],
    queryFn: documentsApi.stats,
    refetchInterval: 5000,
  });

  const { data: documents, isLoading: isDocsLoading, refetch: refetchDocs } = useQuery({
    queryKey: ['documentsList'],
    queryFn: () => documentsApi.list(),
  });

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) return;
    setIsSubmitting(true);
    try {
      await documentsApi.upload(uploadFile);
      setIsSubmitting(false);
      setIsUploadOpen(false);
      setUploadFile(null);
      refetchStats();
      refetchDocs();
    } catch (err) {
      setIsSubmitting(false);
      alert('Upload failed: ' + (err as Error).message);
    }
  };

  const handleCreateCollection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!collectionName.trim()) return;
    setIsSubmitting(true);
    try {
      await collectionsApi.create({ name: collectionName.trim(), description: collectionDesc.trim() || undefined });
      setIsSubmitting(false);
      setIsCollectionOpen(false);
      setCollectionName('');
      setCollectionDesc('');
      navigate('/collections');
    } catch (err) {
      setIsSubmitting(false);
      alert('Failed to create collection: ' + (err as Error).message);
    }
  };

  const filteredDocs = (documents || []).filter(d =>
    d.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Workspace Header & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Workspace Dashboard
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Monitor document ingestion, chunk indexes, and knowledge collections.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={() => setIsCollectionOpen(true)} className="gap-1.5">
            <FolderPlus className="w-4 h-4 text-muted-foreground" />
            New Collection
          </Button>
          <Button variant="primary" size="sm" onClick={() => setIsUploadOpen(true)} className="gap-1.5 shadow-sm">
            <UploadCloud className="w-4 h-4" />
            Upload Document
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Documents</span>
            <FileText className="w-4 h-4 text-primary" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {isStatsLoading ? '...' : stats?.total_documents ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Ingested into repository</p>
        </Card>

        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Ready for Querying</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {isStatsLoading ? '...' : stats?.ready_documents ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Indexed with vector embeddings</p>
        </Card>

        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Processing / Pending</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400">
            {isStatsLoading ? '...' : stats?.processing_documents ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Currently chunking & embedding</p>
        </Card>

        <Card className="p-5 space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Total Chunks</span>
            <Layers className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold tracking-tight text-foreground">
            {isStatsLoading ? '...' : stats?.total_chunks ?? 0}
          </div>
          <p className="text-[11px] text-muted-foreground">Discrete searchable passages</p>
        </Card>
      </div>

      {/* Main Panels: Recent Activity & Documents */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2 cols): Documents Search & Quick Access */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Recent Documents</h3>
            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search documents..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          {filteredDocs.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No documents yet"
              description="Upload your first PDF, DOCX, or text file to start asking grounded questions."
              actionLabel="Upload Document"
              onAction={() => setIsUploadOpen(true)}
            />
          ) : (
            <div className="space-y-2.5">
              {filteredDocs.slice(0, 5).map(doc => (
                <div
                  key={doc.id}
                  onClick={() => navigate('/documents')}
                  className="flex items-center justify-between p-3.5 bg-card border border-border/70 rounded-xl hover:border-primary/40 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-primary">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-medium text-foreground">{doc.original_filename}</h4>
                      <p className="text-[11px] text-muted-foreground">
                        {roundBytes(doc.file_size)} • {doc.chunk_count} chunks • {formatDate(doc.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={doc.processing_status} />
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                </div>
              ))}

              <div className="pt-2 text-center">
                <Button variant="ghost" size="sm" onClick={() => navigate('/documents')} className="text-xs text-primary gap-1">
                  View all documents
                  <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column (1 col): Recent Activity Stream */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
          <Card className="p-4 space-y-4">
            {(!stats?.recent_activity || stats.recent_activity.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-6">No recent ingestion activity recorded.</p>
            ) : (
              <div className="space-y-3.5">
                {stats.recent_activity.map(act => (
                  <div key={act.id} className="flex items-start gap-3 text-xs pb-3 border-b border-border/40 last:border-0 last:pb-0">
                    <div className="mt-0.5">
                      {act.status === 'READY' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                      {act.status === 'FAILED' && <AlertCircle className="w-3.5 h-3.5 text-rose-500" />}
                      {act.status !== 'READY' && act.status !== 'FAILED' && <Clock className="w-3.5 h-3.5 text-amber-500 animate-pulse" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{act.filename}</p>
                      <p className="text-[11px] text-muted-foreground">
                        Status: <span className="font-mono">{act.status}</span> ({act.chunks} chunks)
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Quick Chat Callout */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-xs space-y-2.5">
            <div className="flex items-center gap-2 text-primary font-semibold">
              <MessageSquare className="w-4 h-4" />
              Ask RAGMind
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Ask natural-language questions across your ingested documents with citation inspection.
            </p>
            <Button variant="primary" size="sm" onClick={() => navigate('/chat')} className="w-full">
              Open Chat
            </Button>
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      <Modal isOpen={isUploadOpen} onClose={() => setIsUploadOpen(false)} title="Upload Document">
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary/50 transition-colors">
            <input
              type="file"
              id="dash-upload-file"
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.md"
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
            />
            <label htmlFor="dash-upload-file" className="cursor-pointer flex flex-col items-center">
              <UploadCloud className="w-8 h-8 text-primary/70 mb-2" />
              <span className="text-xs font-medium text-foreground">
                {uploadFile ? uploadFile.name : 'Choose a file or drag here'}
              </span>
              <span className="text-[11px] text-muted-foreground mt-1">PDF, DOCX, TXT, MD up to 25MB</span>
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsUploadOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} disabled={!uploadFile}>
              Upload & Ingest
            </Button>
          </div>
        </form>
      </Modal>

      {/* Collection Modal */}
      <Modal isOpen={isCollectionOpen} onClose={() => setIsCollectionOpen(false)} title="Create New Collection">
        <form onSubmit={handleCreateCollection} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Collection Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Legal Contracts, Technical Specs"
              value={collectionName}
              onChange={e => setCollectionName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Description (Optional)</label>
            <textarea
              rows={3}
              placeholder="Brief description of the documents in this collection..."
              value={collectionDesc}
              onChange={e => setCollectionDesc(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setIsCollectionOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm" isLoading={isSubmitting} disabled={!collectionName.trim()}>
              Create Collection
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'READY':
      return <Badge variant="success" size="sm">Ready</Badge>;
    case 'FAILED':
      return <Badge variant="error" size="sm">Failed</Badge>;
    default:
      return <Badge variant="warning" size="sm">{status}</Badge>;
  }
};

export const roundBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const formatDate = (isoStr: string): string => {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return isoStr;
  }
};
