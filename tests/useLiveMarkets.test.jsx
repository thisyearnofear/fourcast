import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useLiveMarkets from '@/hooks/useLiveMarkets';

const SAMPLE_MARKET = {
  marketID: 'abc-123',
  title: 'Will Bitcoin exceed $150K by August 2026?',
  platform: 'polymarket',
  ask: 0.42,
  bid: 0.58,
  edgeScore: 0.16,
  currentOdds: { yes: 0.42, no: 0.58 },
};

function mockFetchSuccess(markets = [SAMPLE_MARKET]) {
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ success: true, markets }),
  });
}

function mockFetchFailure() {
  global.fetch = vi.fn().mockRejectedValue(new Error('network'));
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query.includes('reduce') ? false : false,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  }));
  Object.defineProperty(document, 'hidden', { value: false, configurable: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useLiveMarkets', () => {
  it('starts loading then populates from /api/markets/live', async () => {
    mockFetchSuccess();
    const { result } = renderHook(() => useLiveMarkets());

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isLive).toBe(true);
    expect(result.current.markets).toHaveLength(1);
    expect(result.current.markets[0].title).toBe(SAMPLE_MARKET.title);
    expect(result.current.error).toBeNull();
  });

  it('derives signals from real edge scores', async () => {
    const m = { ...SAMPLE_MARKET, edgeScore: 0.18 };
    mockFetchSuccess([m]);
    const { result } = renderHook(() => useLiveMarkets());

    await waitFor(() => expect(result.current.isLive).toBe(true));

    expect(result.current.signals.length).toBeGreaterThan(0);
    expect(result.current.signals[0]).toContain('EDGE');
    expect(result.current.signals[0]).toContain('POLYMARK');
  });

  it('counts edges >= 5%', async () => {
    const markets = [
      { ...SAMPLE_MARKET, marketID: '1', edgeScore: 0.16 },
      { ...SAMPLE_MARKET, marketID: '2', edgeScore: 0.03 },
      { ...SAMPLE_MARKET, marketID: '3', edgeScore: 0.08 },
    ];
    mockFetchSuccess(markets);
    const { result } = renderHook(() => useLiveMarkets());

    await waitFor(() => expect(result.current.isLive).toBe(true));

    expect(result.current.edgeCount).toBe(2);
  });

  it('falls back gracefully on fetch failure', async () => {
    mockFetchFailure();
    const { result } = renderHook(() => useLiveMarkets());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isLive).toBe(false);
    expect(result.current.markets).toEqual([]);
    expect(result.current.error).toBeTruthy();
  });

  it('does not poll when prefers-reduced-motion is set', async () => {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: query.includes('reduce'),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }));
    mockFetchSuccess();

    const { result } = renderHook(() => useLiveMarkets());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsAfterFirst = global.fetch.mock.calls.length;

    // Wait past the normal poll interval; no additional fetches should fire.
    await new Promise((r) => setTimeout(r, 100));

    expect(global.fetch.mock.calls.length).toBe(callsAfterFirst);
  });
});
