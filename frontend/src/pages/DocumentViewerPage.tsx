import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  FileSearch,
  Search,
  Layers,
  FileText,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';
import { documentsApi } from '../api/client';
import { DocumentChunk, DocumentItem } from '../types';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Badge } from '../components/common/Badge';
import { StatusBadge, roundBytes } from './DashboardPage';
import { EmptyState } from '../components/common/EmptyState';

export const DocumentViewerPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const selectedDocId = searchParams.get('doc') || '';
  const targetChunkId = searchParams.get('chunk') || '';

  const [chunkFilterQuery, setChunkFilterQuery] = useState('');
  const [selectedChunk, setSelectedChunk] = useState<DocumentChunk | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'chunks' | 'fulltext'>('chunks');

  // Load documents list for switcher
  const { data: documents = [] } = useQuery({
    queryKey: ['documentsList'],
    queryFn: () => documentsApi.list({ status: 'READY' }),
  });

  // Load active document details
  const { data: currentDoc, isLoading: isDocLoading } = useQuery({
    queryKey: ['documentDetail', selectedDocId],
    queryFn: () => documentsApi.get(selectedDocId),
    enabled: Boolean(selectedDocId),
  });

  // Load document chunks
  const { data: chunks = [], isLoading: isChunksLoading } = useQuery({
    queryKey: ['documentChunks', selectedDocId],
    queryFn: () => documentsApi.chunks(selectedDocId),
    enabled: Boolean(selectedDocId),
  });

  // Auto-select first doc if none selected
  useEffect(() => {
    if (!selectedDocId && documents.length > 0) {
      setSearchParams({ doc: documents[0].id });
    }
  }, [selectedDocId, documents, setSearchParams]);

  // Auto-focus chunk if targetChunkId
  useEffect(() => {
    if (targetChunkId && chunks.length > 0) {
      const match = chunks.find(c => c.id === targetChunkId);
      if (match) {
        setSelectedChunk(match);
      }
    } else if (chunks.length > 0 && !selectedChunk) {
      setSelectedChunk(chunks[0]);
    }
  }, [targetChunkId, chunks]);

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredChunks = chunks.filter(c =>
    c.text.toLowerCase().includes(chunkFilterQuery.toLowerCase())
  );

  if (documents.length === 0 && !isDocLoading) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <EmptyState
          icon={FileText}
          title="No documents to view"
          description="Upload documents in the Document Library to inspect their extracted chunks."
          actionLabel="Go to Library"
          onAction={() => navigate('/documents')}
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-background">
      {/* Top Controls Bar */}
      <div className="h-14 px-6 border-b border-border/80 flex items-center justify-between bg-card/60 gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-muted-foreground">Document:</label>
          <select
            value={selectedDocId}
            onChange={e => setSearchParams({ doc: e.target.value })}
            className="px-2.5 py-1 text-xs rounded-lg border border-border bg-card font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-xs truncate"
          >
            {documents.map(d => (
              <option key={d.id} value={d.id}>{d.original_filename}</option>
            ))}
          </select>
        </div>

        {currentDoc && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="hidden sm:inline">Pages: <strong className="text-foreground">{currentDoc.extracted_page_count}</strong></span>
            <span>Chunks: <strong className="text-foreground">{currentDoc.chunk_count}</strong></span>
            <span className="hidden md:inline">Size: <strong className="text-foreground">{roundBytes(currentDoc.file_size)}</strong></span>
            <div className="flex border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setViewMode('chunks')}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === 'chunks' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                Chunk View
              </button>
              <button
                onClick={() => setViewMode('fulltext')}
                className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${
                  viewMode === 'fulltext' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground'
                }`}
              >
                Continuous
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main Split Inspector View */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sub-sidebar: Chunks Navigator */}
        <div className="w-80 md:w-96 border-r border-border/80 bg-card/40 flex flex-col shrink-0">
          <div className="p-3 border-b border-border/60">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search chunks..."
                value={chunkFilterQuery}
                onChange={e => setChunkFilterQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {filteredChunks.map(c => {
              const isSelected = selectedChunk?.id === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setSelectedChunk(c)}
                  className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border/60 bg-card hover:border-border'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-primary text-[11px]">
                      Chunk #{c.chunk_index + 1}
                    </span>
                    <Badge variant="outline" size="sm">
                      {c.page_number ? `Page ${c.page_number}` : 'Doc'}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground line-clamp-3 leading-relaxed text-[11px]">
                    {c.text}
                  </p>
                  <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/40 text-[10px] text-muted-foreground font-mono">
                    <span>{c.token_count} tokens</span>
                    <span className="truncate max-w-[120px]">{c.id.substring(0, 8)}...</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Panel: Detail Chunk / Full Document View */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          {viewMode === 'chunks' ? (
            selectedChunk ? (
              <div className="max-w-3xl space-y-6">
                {/* Chunk Header */}
                <div className="flex items-center justify-between pb-4 border-b border-border/60">
                  <div>
                    <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
                      Chunk #{selectedChunk.chunk_index + 1} Details
                      {targetChunkId === selectedChunk.id && (
                        <Badge variant="indigo" size="sm">Cited In Chat</Badge>
                      )}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5 font-mono">
                      ID: {selectedChunk.id}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCopy(selectedChunk.text, selectedChunk.id)}
                    className="gap-1.5"
                  >
                    {copiedId === selectedChunk.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        Copy Chunk
                      </>
                    )}
                  </Button>
                </div>

                {/* Metadata Pills */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-card border border-border/80 p-3 rounded-xl">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Page</span>
                    <p className="text-sm font-bold text-foreground mt-0.5">
                      {selectedChunk.page_number ? `Page ${selectedChunk.page_number}` : 'N/A'}
                    </p>
                  </div>
                  <div className="bg-card border border-border/80 p-3 rounded-xl">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Est. Tokens</span>
                    <p className="text-sm font-bold text-foreground mt-0.5">{selectedChunk.token_count}</p>
                  </div>
                  <div className="bg-card border border-border/80 p-3 rounded-xl">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Character Length</span>
                    <p className="text-sm font-bold text-foreground mt-0.5">{selectedChunk.text.length} chars</p>
                  </div>
                  <div className="bg-card border border-border/80 p-3 rounded-xl">
                    <span className="text-[10px] text-muted-foreground uppercase font-medium">Offset</span>
                    <p className="text-sm font-bold text-foreground mt-0.5 font-mono text-xs">
                      {selectedChunk.char_offset_start ?? 0}..{selectedChunk.char_offset_end ?? selectedChunk.text.length}
                    </p>
                  </div>
                </div>

                {/* Passage Text Box */}
                <div>
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Extracted Passage Text
                  </h4>
                  <div className="p-5 rounded-xl border border-border/80 bg-card font-sans text-xs md:text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap shadow-xs">
                    {selectedChunk.text}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground text-center py-12">Select a chunk to view details.</p>
            )
          ) : (
            /* Continuous View */
            <div className="max-w-3xl space-y-6">
              <h3 className="text-base font-semibold text-foreground border-b border-border pb-3">
                Full Continuous Extracted Document
              </h3>
              <div className="space-y-4">
                {chunks.map(ch => (
                  <div key={ch.id} className="p-4 rounded-xl border border-border/60 bg-card/60 text-xs md:text-sm leading-relaxed">
                    <div className="text-[10px] font-mono text-muted-foreground mb-1">
                      [Page {ch.page_number || '1'} | Chunk #{ch.chunk_index + 1}]
                    </div>
                    {ch.text}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
