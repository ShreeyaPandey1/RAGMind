import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Badge, StatusBadge } from '../components/common/Badge';
import { Button } from '../components/common/Button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/common/Card';
import { EmptyState } from '../components/common/EmptyState';
import { SourceInspector } from '../components/chat/SourceInspector';
import { AnswerSource } from '../types';

describe('UI Design System Components', () => {
  it('renders Button component with variant styles and responds to clicks', () => {
    const handleClick = vi.fn();
    render(
      <Button variant="primary" onClick={handleClick}>
        Ask RAGMind
      </Button>
    );

    const button = screen.getByRole('button', { name: /ask ragmind/i });
    expect(button).toBeInTheDocument();
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('renders Button in loading state and disables click', () => {
    const handleClick = vi.fn();
    render(
      <Button isLoading onClick={handleClick}>
        Submit
      </Button>
    );

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders Badge with correct status variants', () => {
    const { rerender } = render(<StatusBadge status="READY" />);
    expect(screen.getByText('READY')).toBeInTheDocument();

    rerender(<StatusBadge status="PROCESSING" />);
    expect(screen.getByText('PROCESSING')).toBeInTheDocument();

    rerender(<StatusBadge status="FAILED" />);
    expect(screen.getByText('FAILED')).toBeInTheDocument();

    rerender(<Badge variant="outline">Custom Tag</Badge>);
    expect(screen.getByText('Custom Tag')).toBeInTheDocument();
  });

  it('renders Card with header and content', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Total Documents</CardTitle>
        </CardHeader>
        <CardContent>
          <p>42 Indexed</p>
        </CardContent>
      </Card>
    );

    expect(screen.getByText('Total Documents')).toBeInTheDocument();
    expect(screen.getByText('42 Indexed')).toBeInTheDocument();
  });

  it('renders EmptyState with action trigger', () => {
    const onAction = vi.fn();
    render(
      <EmptyState
        title="No Documents Found"
        description="Upload your first PDF or DOCX file to get started."
        actionLabel="Upload Now"
        onAction={onAction}
      />
    );

    expect(screen.getByText('No Documents Found')).toBeInTheDocument();
    expect(screen.getByText(/upload your first pdf or docx/i)).toBeInTheDocument();
    const actionBtn = screen.getByRole('button', { name: /upload now/i });
    fireEvent.click(actionBtn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('renders SourceInspector drawer with retrieved passages and citations', () => {
    const mockSources: AnswerSource[] = [
      {
        id: 'src-1',
        citation_number: 1,
        document_id: 'doc-uuid-1',
        document_name: 'quantum_computing.pdf',
        page_number: 3,
        chunk_id: 'chunk-uuid-1',
        excerpt: 'Quantum entanglement enables instantaneous correlations between qubits regardless of distance.',
        relevance_score: 0.94,
      },
      {
        id: 'src-2',
        citation_number: 2,
        document_id: 'doc-uuid-2',
        document_name: 'superconductivity.pdf',
        page_number: 12,
        chunk_id: 'chunk-uuid-2',
        excerpt: 'Type-II superconductors exhibit vortex states under high magnetic fields.',
        relevance_score: 0.88,
      },
    ];

    const onClose = vi.fn();

    render(
      <MemoryRouter>
        <SourceInspector
          isOpen={true}
          onClose={onClose}
          sources={mockSources}
          highlightCitationNumber={1}
        />
      </MemoryRouter>
    );

    expect(screen.getByText(/Retrieved Sources & Evidence/i)).toBeInTheDocument();
    expect(screen.getByText('quantum_computing.pdf')).toBeInTheDocument();
    expect(screen.getByText(/Quantum entanglement enables instantaneous/i)).toBeInTheDocument();
    expect(screen.getByText('superconductivity.pdf')).toBeInTheDocument();
    expect(screen.getByText(/94% match/i)).toBeInTheDocument();
    expect(screen.getByText(/88% match/i)).toBeInTheDocument();
  });
});
