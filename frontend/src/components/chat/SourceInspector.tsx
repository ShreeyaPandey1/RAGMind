import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Layers,
  ExternalLink,
} from 'lucide-react';
import { AnswerSource } from '../../types';
import { Badge } from '../common/Badge';
import { Button } from '../common/Button';

interface SourceInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  sources: AnswerSource[];
  highlightCitationNumber?: number | null;
}

export const SourceInspector: React.FC<SourceInspectorProps> = ({
  isOpen,
  onClose,
  sources,
  highlightCitationNumber,
}) => {
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] bg-card border-l border-border shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="h-16 px-6 border-b border-border/80 flex items-center justify-between bg-card/60">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Retrieved Sources & Evidence</h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Sources List */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {sources.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-12">No sources associated with this answer.</p>
        ) : (
          sources.map(src => {
            const isHighlighted = highlightCitationNumber === src.citation_number;
            const rawScore = src.relevance_score ?? (src as any).score;
            const scorePercent = typeof rawScore === 'number' && !isNaN(rawScore) ? Math.round(rawScore * 100) : null;

            return (
              <div
                key={src.id}
                className={`p-4 rounded-xl border text-xs transition-all space-y-2.5 ${
                  isHighlighted
                    ? 'border-primary ring-2 ring-primary/20 bg-primary/5'
                    : 'border-border/80 bg-card hover:border-border'
                }`}
              >
                {/* Source Badge & Title */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-primary/10 text-primary font-bold text-[11px] flex items-center justify-center shrink-0">
                      {src.citation_number}
                    </span>
                    <span className="font-semibold text-foreground truncate max-w-[200px]" title={src.document_name}>
                      {src.document_name}
                    </span>
                  </div>
                  {scorePercent !== null ? (
                    <Badge variant="indigo" size="sm">
                      {scorePercent}% match
                    </Badge>
                  ) : (
                    <Badge variant="indigo" size="sm">
                      Matched
                    </Badge>
                  )}
                </div>

                {/* Metadata */}
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                  {src.page_number && <span>Page {src.page_number}</span>}
                  {src.page_number && <span>•</span>}
                  <span className="truncate max-w-[130px]">Chunk: {src.chunk_id?.slice(0, 8)}...</span>
                </div>

                {/* Excerpt */}
                <div className="p-3 rounded-lg bg-muted/40 border border-border/40 text-[11px] leading-relaxed text-foreground/90 font-sans">
                  "{src.excerpt}"
                </div>

                {/* Direct Action Link */}
                <div className="pt-1 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      onClose();
                      navigate(`/documents/${src.document_id}${src.page_number ? `?page=${src.page_number}` : ''}`);
                    }}
                    className="h-7 px-2 text-[11px] text-primary gap-1"
                  >
                    Open in Viewer
                    <ExternalLink className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
