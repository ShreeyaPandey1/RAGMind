import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  FileText,
  UploadCloud,
  Trash2,
  RotateCw,
  Search,
  Filter,
  Eye,
  CheckCircle2,
  AlertCircle,
  Clock,
  FolderOpen
} from 'lucide-react';
import { documentsApi, collectionsApi } from '../api/client';
import { DocumentItem } from '../types';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { Modal } from '../components/common/Modal';
import { StatusBadge, roundBytes, formatDate } from './DashboardPage';
import { EmptyState } from '../components/common/EmptyState';

export const DocumentsPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [collectionFilter, setCollectionFilter] = useState<string>('ALL');
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Selected document for delete confirm or details modal
  const [docToDelete, setDocToDelete] = useState<DocumentItem | null>(null);
  const [docForDetails, setDocForDetails] = useState<DocumentItem | null>(null);

  const { data: documents = [], isLoading, refetch } = useQuery({
    queryKey: ['documentsList'],
    queryFn: () => documentsApi.list(),
    refetchInterval: 4000,
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['collectionsList'],
    queryFn: collectionsApi.list,
  });

  // Mutations
  const uploadMutation = useMutation({
    mutationFn: (file: File) => documentsApi.upload(file, collectionFilter !== 'ALL' ? collectionFilter : undefined),
    onSuccess: () => {
      setUploadError(null);
      queryClient.invalidateQueries({ queryKey: ['documentsList'] });
      queryClient.invalidateQueries({ queryKey: ['documentStats'] });
    },
    onError: (err: Error) => {
      setUploadError(err.message || 'Upload failed.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => documentsApi.delete(id),
    onSuccess: () => {
      setDocToDelete(null);
      queryClient.invalidateQueries({ queryKey: ['documentsList'] });
      queryClient.invalidateQueries({ queryKey: ['documentStats'] });
    },
    onError: (err: Error) => {
      alert('Delete failed: ' + err.message);
    },
  });

  const retryMutation = useMutation({
    mutationFn: (id: string) => documentsApi.retry(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentsList'] });
    },
    onError: (err: Error) => {
      alert('Retry failed: ' + err.message);
    },
  });

  const assignCollectionMutation = useMutation({
    mutationFn: ({ docId, collId }: { docId: string; collId: string | null }) =>
      documentsApi.update(docId, { collection_id: collId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documentsList'] });
    },
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  const filteredDocs = documents.filter(doc => {
    const matchesSearch = doc.original_filename.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || doc.processing_status === statusFilter;
    const matchesColl = collectionFilter === 'ALL' || doc.collection_id === collectionFilter;
    return matchesSearch && matchesStatus && matchesColl;
  });

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
            Document Library
          </h2>
          <p className="text-xs md:text-sm text-muted-foreground mt-0.5">
            Manage your knowledge corpus, inspect text extractions, and assign document collections.
          </p>
        </div>
      </div>

      {/* Drag & Drop Upload Banner */}
      <div
        onDragOver={e => {
          e.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
          isDragOver
            ? 'border-primary bg-primary/5 scale-[1.005]'
            : 'border-border/80 bg-card/40 hover:border-primary/40'
        }`}
      >
        <input
          type="file"
          id="lib-file-upload"
          className="hidden"
          accept=".pdf,.docx,.doc,.txt,.md"
          onChange={handleFileInput}
          disabled={uploadMutation.isPending}
        />
        <label htmlFor="lib-file-upload" className="cursor-pointer flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
            <UploadCloud className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-foreground">
            {uploadMutation.isPending ? 'Processing Document Ingestion...' : 'Click to upload or drag & drop documents'}
          </span>
          <span className="text-xs text-muted-foreground mt-1">
            Supports PDF (page-aware), DOCX, TXT, and Markdown (up to 25MB)
          </span>
        </label>
        {uploadError && (
          <div className="mt-3 text-xs text-rose-600 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded-lg border border-rose-200 dark:border-rose-900 inline-block">
            {uploadError}
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by filename..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Statuses</option>
            <option value="READY">Ready</option>
            <option value="PARSING">Parsing</option>
            <option value="CHUNKING">Chunking</option>
            <option value="EMBEDDING">Embedding</option>
            <option value="FAILED">Failed</option>
          </select>

          {/* Collection Filter */}
          <select
            value={collectionFilter}
            onChange={e => setCollectionFilter(e.target.value)}
            className="px-2.5 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="ALL">All Collections</option>
            {collections.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Documents Table */}
      {filteredDocs.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents match criteria"
          description="Upload documents or adjust your search filters."
          actionLabel="Upload New File"
          onAction={() => document.getElementById('lib-file-upload')?.click()}
        />
      ) : (
        <div className="border border-border/80 rounded-xl bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-4 py-3">Document</th>
                  <th className="px-4 py-3">Collection</th>
                  <th className="px-4 py-3">Size</th>
                  <th className="px-4 py-3">Chunks</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Uploaded</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {filteredDocs.map(doc => {
                  const assignedColl = collections.find(c => c.id === doc.collection_id);
                  return (
                    <tr key={doc.id} className="hover:bg-muted/30 transition-colors">
                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5 font-medium text-foreground">
                          <FileText className="w-4 h-4 text-primary shrink-0" />
                          <span className="truncate max-w-[220px]" title={doc.original_filename}>
                            {doc.original_filename}
                          </span>
                        </div>
                      </td>

                      {/* Collection Selector */}
                      <td className="px-4 py-3.5">
                        <select
                          value={doc.collection_id || ''}
                          onChange={e =>
                            assignCollectionMutation.mutate({
                              docId: doc.id,
                              collId: e.target.value || null,
                            })
                          }
                          className="bg-transparent text-[11px] border border-border/60 rounded px-2 py-0.5 text-muted-foreground hover:text-foreground focus:outline-none"
                        >
                          <option value="">Unassigned</option>
                          {collections.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3.5 text-muted-foreground font-mono text-[11px]">
                        {roundBytes(doc.file_size)}
                      </td>

                      {/* Chunks */}
                      <td className="px-4 py-3.5 text-muted-foreground font-mono text-[11px]">
                        {doc.chunk_count}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={doc.processing_status} />
                        {doc.error_message && (
                          <p className="text-[10px] text-rose-500 max-w-[180px] truncate mt-0.5" title={doc.error_message}>
                            {doc.error_message}
                          </p>
                        )}
                      </td>

                      {/* Upload Date */}
                      <td className="px-4 py-3.5 text-muted-foreground text-[11px]">
                        {formatDate(doc.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {doc.processing_status === 'READY' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => navigate(`/viewer?doc=${doc.id}`)}
                              className="h-7 px-2 text-[11px] gap-1"
                              title="View Document Chunks"
                            >
                              <Eye className="w-3.5 h-3.5 text-primary" />
                              View
                            </Button>
                          )}

                          {doc.processing_status === 'FAILED' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => retryMutation.mutate(doc.id)}
                              isLoading={retryMutation.isPending}
                              className="h-7 px-2 text-[11px] gap-1 text-amber-600 dark:text-amber-400"
                              title="Retry Ingestion"
                            >
                              <RotateCw className="w-3 h-3" />
                              Retry
                            </Button>
                          )}

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDocToDelete(doc)}
                            className="h-7 w-7 text-muted-foreground hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            title="Delete Document"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(docToDelete)}
        onClose={() => setDocToDelete(null)}
        title="Delete Document"
      >
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Are you sure you want to permanently delete{' '}
            <span className="font-semibold text-foreground">{docToDelete?.original_filename}</span>?
            This will remove all associated chunks and embeddings from the vector database.
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setDocToDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={deleteMutation.isPending}
              onClick={() => docToDelete && deleteMutation.mutate(docToDelete.id)}
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
