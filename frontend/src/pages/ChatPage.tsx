import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import {
  Send,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Check,
  FileText,
  Filter,
  Layers,
  Sparkles,
  Info,
  Clock,
  ExternalLink,
  ChevronDown
} from 'lucide-react';
import { conversationsApi, chatApi, documentsApi, collectionsApi } from '../api/client';
import { ConversationItem, MessageItem, AnswerSource, DocumentItem } from '../types';
import { Button } from '../components/common/Button';
import { Badge } from '../components/common/Badge';
import { Card } from '../components/common/Card';
import { SourceInspector } from '../components/chat/SourceInspector';

export const ChatPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [questionInput, setQuestionInput] = useState('');
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  // Scope State
  const [scopeType, setScopeType] = useState<'ALL' | 'COLLECTION' | 'DOCUMENTS'>('ALL');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('');
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [isScopeMenuOpen, setIsScopeMenuOpen] = useState(false);

  // Sources Inspector Drawer state
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [activeSources, setActiveSources] = useState<AnswerSource[]>([]);
  const [highlightCitation, setHighlightCitation] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load conversations
  const { data: conversations = [], refetch: refetchConvs } = useQuery({
    queryKey: ['conversationsList'],
    queryFn: conversationsApi.list,
  });

  // Load active conversation details
  const { data: activeConversation, isLoading: isConvLoading, refetch: refetchActiveConv } = useQuery({
    queryKey: ['conversationDetail', activeConvId],
    queryFn: () => (activeConvId ? conversationsApi.get(activeConvId) : null),
    enabled: Boolean(activeConvId),
  });

  // Load documents and collections for scope selection
  const { data: documents = [] } = useQuery({
    queryKey: ['readyDocuments'],
    queryFn: () => documentsApi.list({ status: 'READY' }),
  });

  const { data: collections = [] } = useQuery({
    queryKey: ['collectionsList'],
    queryFn: collectionsApi.list,
  });

  // Automatically select first conversation if none selected
  useEffect(() => {
    if (!activeConvId && conversations.length > 0) {
      setActiveConvId(conversations[0].id);
    }
  }, [conversations, activeConvId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeConversation?.messages]);

  // Mutations
  const newChatMutation = useMutation({
    mutationFn: () =>
      conversationsApi.create({
        title: 'New Conversation',
        document_scope_type: scopeType,
        selected_scope_ids: scopeType === 'COLLECTION' && selectedCollectionId ? [selectedCollectionId] : selectedDocIds,
      }),
    onSuccess: (newConv) => {
      queryClient.invalidateQueries({ queryKey: ['conversationsList'] });
      setActiveConvId(newConv.id);
    },
  });

  const deleteConvMutation = useMutation({
    mutationFn: (id: string) => conversationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversationsList'] });
      setActiveConvId(null);
    },
  });

  const chatMutation = useMutation({
    mutationFn: (payload: { question: string }) =>
      chatApi.send({
        question: payload.question,
        conversation_id: activeConvId || undefined,
        document_scope_type: scopeType,
        selected_scope_ids: scopeType === 'COLLECTION' && selectedCollectionId ? [selectedCollectionId] : selectedDocIds,
      }),
    onSuccess: (res) => {
      if (!activeConvId) {
        setActiveConvId(res.conversation_id);
      }
      queryClient.invalidateQueries({ queryKey: ['conversationsList'] });
      queryClient.invalidateQueries({ queryKey: ['conversationDetail', res.conversation_id] });
    },
    onError: (err: Error) => {
      alert('Error generating answer: ' + err.message);
    },
  });

  const handleSend = () => {
    const q = questionInput.trim();
    if (!q || chatMutation.isPending) return;
    setQuestionInput('');
    chatMutation.mutate({ question: q });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopyAnswer = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const openSourceInspector = (sources: AnswerSource[], citationNumber?: number) => {
    setActiveSources(sources);
    setHighlightCitation(citationNumber || null);
    setInspectorOpen(true);
  };

  const starters = [
    'What are the core technical capabilities outlined in the documents?',
    'Summarize the primary conclusions and supporting evidence.',
    'What key dates, milestones, or people are mentioned?',
  ];

  return (
    <div className="h-full flex overflow-hidden bg-background">
      {/* Conversations Left Sidebar */}
      <aside className="w-64 border-r border-border/80 bg-card/40 flex flex-col shrink-0 hidden md:flex">
        <div className="p-3.5 border-b border-border/60 flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Conversations</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => newChatMutation.mutate()}
            className="h-7 px-2 text-xs gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            New
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <p className="text-[11px] text-muted-foreground text-center py-8">No past chats.</p>
          ) : (
            conversations.map(c => {
              const isActive = activeConvId === c.id;
              return (
                <div
                  key={c.id}
                  onClick={() => setActiveConvId(c.id)}
                  className={`group flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                    isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  }`}
                >
                  <span className="truncate flex-1 pr-2">{c.title}</span>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      deleteConvMutation.mutate(c.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </aside>

      {/* Main Chat Workspace */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Active Scope Bar */}
        <div className="h-12 px-6 border-b border-border/80 flex items-center justify-between bg-card/60 gap-4 shrink-0 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground font-medium flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-primary" />
              Document Scope:
            </span>

            {/* Scope Selector Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsScopeMenuOpen(!isScopeMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card font-medium text-foreground hover:bg-muted/60"
              >
                <span>
                  {scopeType === 'ALL' && 'All Ready Documents'}
                  {scopeType === 'COLLECTION' && (
                    collections.find(c => c.id === selectedCollectionId)?.name || 'Select Collection'
                  )}
                  {scopeType === 'DOCUMENTS' && `${selectedDocIds.length} Selected Documents`}
                </span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>

              {isScopeMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-xl shadow-lg p-2 z-40 space-y-2">
                  <div
                    onClick={() => { setScopeType('ALL'); setIsScopeMenuOpen(false); }}
                    className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                      scopeType === 'ALL' ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-muted text-foreground'
                    }`}
                  >
                    All Ready Documents ({documents.length})
                  </div>

                  <div className="pt-1 border-t border-border/60">
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold px-2 block mb-1">
                      By Collection
                    </span>
                    {collections.map(col => (
                      <div
                        key={col.id}
                        onClick={() => {
                          setScopeType('COLLECTION');
                          setSelectedCollectionId(col.id);
                          setIsScopeMenuOpen(false);
                        }}
                        className={`px-3 py-1 rounded-lg text-xs cursor-pointer ${
                          scopeType === 'COLLECTION' && selectedCollectionId === col.id
                            ? 'bg-primary/10 text-primary font-medium'
                            : 'hover:bg-muted text-foreground'
                        }`}
                      >
                        {col.name} ({col.document_count ?? 0})
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground hidden sm:block">
            Answers are strictly grounded with clickable citations.
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {(!activeConversation?.messages || activeConversation.messages.length === 0) && (
            <div className="max-w-2xl mx-auto py-12 text-center space-y-6">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-foreground">Ask RAGMind</h3>
                <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                  Ask questions about your uploaded documents. RAGMind will retrieve relevant passages and generate factual answers with citations.
                </p>
              </div>

              {/* Starters */}
              <div className="space-y-2 text-left max-w-lg mx-auto">
                <span className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider block text-center">
                  Suggested Questions
                </span>
                {starters.map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setQuestionInput(s);
                      textareaRef.current?.focus();
                    }}
                    className="w-full text-left p-3 rounded-xl border border-border/80 bg-card hover:border-primary/40 hover:bg-muted/30 transition-all text-xs text-foreground/90 font-medium"
                  >
                    "{s}"
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeConversation?.messages?.map(msg => {
            const isUser = msg.role === 'user';
            const sources = msg.sources || [];

            let diagnosticsData = null;
            if (msg.retrieval_diagnostics) {
              try {
                diagnosticsData = JSON.parse(msg.retrieval_diagnostics);
              } catch {}
            }

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-3xl mx-auto w-full`}
              >
                {/* Bubble */}
                <div
                  className={`rounded-2xl p-4 md:p-5 text-xs md:text-sm leading-relaxed space-y-3 ${
                    isUser
                      ? 'bg-primary text-primary-foreground max-w-xl shadow-xs'
                      : 'bg-card text-card-foreground border border-border/80 shadow-xs max-w-full w-full'
                  }`}
                >
                  {/* Markdown or plain text */}
                  {isUser ? (
                    <div className="font-medium whitespace-pre-wrap">{msg.content}</div>
                  ) : (
                    <div>
                      {msg.is_abstention && (
                        <div className="mb-3 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 text-xs font-medium">
                          <Info className="w-3.5 h-3.5" />
                          Insufficient Document Evidence
                        </div>
                      )}

                      {/* Answer body with custom citation rendering */}
                      <RenderAnswerWithCitations
                        content={msg.content}
                        sources={sources}
                        onCitationClick={cNum => openSourceInspector(sources, cNum)}
                      />
                    </div>
                  )}

                  {/* Assistant Footer: Sources Bar & Copy */}
                  {!isUser && (
                    <div className="pt-3 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                      {sources.length > 0 ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground font-medium">Sources:</span>
                          {sources.map(s => (
                            <button
                              key={s.id}
                              onClick={() => openSourceInspector(sources, s.citation_number)}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/5 hover:bg-primary/10 border border-primary/20 text-primary text-[11px] font-mono transition-colors"
                            >
                              <span className="font-bold">[{s.citation_number}]</span>
                              <span className="truncate max-w-[120px]">{s.document_name}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div />
                      )}

                      <div className="flex items-center gap-2">
                        {diagnosticsData && (
                          <span className="text-[10px] text-muted-foreground font-mono">
                            {diagnosticsData.total_latency_ms}ms • {diagnosticsData.chunks_retrieved} chunks
                          </span>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyAnswer(msg.content, msg.id)}
                          className="h-6 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1"
                        >
                          {copiedMsgId === msg.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                          Copy
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {chatMutation.isPending && (
            <div className="max-w-3xl mx-auto w-full">
              <div className="bg-card border border-border/80 rounded-2xl p-4 space-y-2.5 max-w-sm">
                <div className="flex items-center gap-2 text-xs text-primary font-medium">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  Retrieving passages & synthesizing answer...
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary animate-pulse w-3/4" />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Composer */}
        <div className="p-4 md:p-6 border-t border-border/80 bg-card/60 backdrop-blur-sm">
          <div className="max-w-3xl mx-auto relative bg-card border border-border rounded-2xl shadow-sm focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
            <textarea
              ref={textareaRef}
              rows={2}
              value={questionInput}
              onChange={e => setQuestionInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about the active document scope... (Shift+Enter for newline)"
              className="w-full p-3.5 text-xs md:text-sm bg-transparent focus:outline-none resize-none text-foreground placeholder:text-muted-foreground"
            />
            <div className="px-3 pb-2.5 flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">
                Enter to send • Shift+Enter for newline
              </span>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSend}
                disabled={!questionInput.trim() || chatMutation.isPending}
                className="h-8 px-3 rounded-lg gap-1.5 shadow-xs"
              >
                Send
                <Send className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-over Source Inspector Drawer */}
      <SourceInspector
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        sources={activeSources}
        highlightCitationNumber={highlightCitation}
      />
    </div>
  );
};

// Custom Citation Component: turns "[1]", "[2]" in Markdown text into interactive clickable chips!
const RenderAnswerWithCitations: React.FC<{
  content: string;
  sources: AnswerSource[];
  onCitationClick: (num: number) => void;
}> = ({ content, sources, onCitationClick }) => {
  // Regex splitting by bracket citations e.g. [1], [2], [1, 2]
  const parts = content.split(/(\[\d+(?:\s*,\s*\d+)*\])/g);

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed whitespace-pre-wrap">
      {parts.map((part, i) => {
        const citationMatch = part.match(/^\[([\d,\s]+)\]$/);
        if (citationMatch) {
          const numbers = citationMatch[1].split(',').map(n => parseInt(n.trim(), 10));
          return (
            <span key={i} className="inline-flex gap-1 mx-0.5">
              {numbers.map(num => (
                <button
                  key={num}
                  type="button"
                  onClick={() => onCitationClick(num)}
                  className="inline-flex items-center justify-center px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950/70 text-indigo-700 dark:text-indigo-300 font-mono text-[10px] font-bold hover:bg-primary hover:text-white transition-colors cursor-pointer border border-indigo-200 dark:border-indigo-800"
                  title={`Inspect supporting passage [${num}]`}
                >
                  [{num}]
                </button>
              ))}
            </span>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </div>
  );
};
