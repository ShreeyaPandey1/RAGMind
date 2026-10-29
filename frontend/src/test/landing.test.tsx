import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { LandingPage } from '../pages/LandingPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('LandingPage Component', () => {
  it('renders branding, product promise, and core benefits', () => {
    render(
      <MemoryRouter>
        <LandingPage />
      </MemoryRouter>
    );

    // Header branding
    expect(screen.getByText('RAGMind')).toBeInTheDocument();
    expect(screen.getAllByText(/AI Knowledge Engine/i).length).toBeGreaterThan(0);

    // Central promise
    expect(screen.getByText(/Your documents. Your knowledge./i)).toBeInTheDocument();
    expect(screen.getByText(/Answers you can verify./i)).toBeInTheDocument();

    // Core benefits
    expect(screen.getByText('Grounded Answers')).toBeInTheDocument();
    expect(screen.getByText('Traceable Citations')).toBeInTheDocument();
    expect(screen.getByText('Private Document Control')).toBeInTheDocument();

    // Open Workspace action
    const openWsBtns = screen.getAllByRole('button', { name: /open workspace/i });
    expect(openWsBtns.length).toBeGreaterThanOrEqual(1);

    fireEvent.click(openWsBtns[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });
});
