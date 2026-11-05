import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import ExpandPanel from '@/components/ui/ExpandPanel';

describe('ExpandPanel (filters)', () => {
  it('renders collapsed by default — content hidden from first viewport', () => {
    render(
      <ExpandPanel title="Filters" subtitle="category · platform · date">
        <div>filter controls</div>
      </ExpandPanel>
    );
    const btn = screen.getByRole('button', { name: /filters/i });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
  });

  it('renders expanded when defaultOpen is passed', () => {
    render(
      <ExpandPanel title="Filters" defaultOpen>
        <div>filter controls</div>
      </ExpandPanel>
    );
    expect(screen.getByRole('button').getAttribute('aria-expanded')).toBe('true');
  });
});

describe('AgentRail', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, latest: null, runs: [] }),
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('renders nothing when the feed is empty (no dead strip)', async () => {
    const { default: AgentRail } = await import('@/components/AgentRail');
    const { container } = render(<AgentRail />);
    await waitFor(() => expect(container.firstChild).toBeNull());
  });
});

describe('LatestExecutionCard', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, runs: [] }),
    }));
  });
  afterEach(() => vi.unstubAllGlobals());

  it('falls back to the canonical sealed receipt when no live execution exists', async () => {
    const { default: LatestExecutionCard } = await import('@/components/LatestExecutionCard');
    render(<LatestExecutionCard />);
    await waitFor(() => expect(screen.getByText(/France v Sweden/i)).toBeTruthy());
    expect(screen.getByRole('link', { name: /open receipt/i })).toBeTruthy();
  });
});
