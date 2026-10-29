import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Unit testing the custom interactive citation parser used in Chat
const RenderAnswerWithCitations: React.FC<{
  content: string;
  onCitationClick: (num: number) => void;
}> = ({ content, onCitationClick }) => {
  const parts = content.split(/(\[\d+(?:\s*,\s*\d+)*\])/g);

  return (
    <div data-testid="answer-content">
      {parts.map((part, i) => {
        const citationMatch = part.match(/^\[([\d,\s]+)\]$/);
        if (citationMatch) {
          const numbers = citationMatch[1].split(',').map(n => parseInt(n.trim(), 10));
          return (
            <span key={i}>
              {numbers.map(num => (
                <button
                  key={num}
                  type="button"
                  data-testid={`citation-${num}`}
                  onClick={() => onCitationClick(num)}
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

describe('Chat Citations & Interaction', () => {
  it('identifies and turns inline bracket citations [1] and [2] into clickable buttons', () => {
    const onCitationClick = vi.fn();
    const answer = 'RAG pipelines retrieve relevant passages [1] and augment the generation prompt [2].';

    render(<RenderAnswerWithCitations content={answer} onCitationClick={onCitationClick} />);

    expect(screen.getByTestId('answer-content')).toBeInTheDocument();
    
    const cite1 = screen.getByTestId('citation-1');
    const cite2 = screen.getByTestId('citation-2');

    expect(cite1).toHaveTextContent('[1]');
    expect(cite2).toHaveTextContent('[2]');

    fireEvent.click(cite1);
    expect(onCitationClick).toHaveBeenCalledWith(1);

    fireEvent.click(cite2);
    expect(onCitationClick).toHaveBeenCalledWith(2);
  });

  it('handles multi-citation brackets like [1, 3] gracefully', () => {
    const onCitationClick = vi.fn();
    const answer = 'pgvector enables fast approximate nearest-neighbor search [1, 3].';

    render(<RenderAnswerWithCitations content={answer} onCitationClick={onCitationClick} />);

    const cite1 = screen.getByTestId('citation-1');
    const cite3 = screen.getByTestId('citation-3');

    expect(cite1).toBeInTheDocument();
    expect(cite3).toBeInTheDocument();

    fireEvent.click(cite3);
    expect(onCitationClick).toHaveBeenCalledWith(3);
  });
});
