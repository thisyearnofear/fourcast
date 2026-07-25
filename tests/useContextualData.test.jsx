import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import useContextualData from '@/hooks/useContextualData';

beforeEach(() => {
  global.fetch = vi.fn();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useContextualData', () => {
  it('returns empty array when title is empty', () => {
    const { result } = renderHook(() => useContextualData(''));
    expect(result.current.items).toEqual([]);
  });

  it('fetches contextual data for a market title', async () => {
    const items = [
      { label: 'BTC spot', value: '$97,000 +2.3%', raw: 97000 },
      { label: 'Crypto Fear & Greed', value: '72 · Greed', raw: 72 },
    ];
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, items }),
    });

    const { result } = renderHook(() => useContextualData('Will Bitcoin exceed $150K?'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0].label).toBe('BTC spot');
  });

  it('falls back to empty array on fetch failure', async () => {
    global.fetch.mockRejectedValue(new Error('network'));

    const { result } = renderHook(() => useContextualData('Will BTC hit $200k?'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.items).toEqual([]);
  });

  it('debounces — does not fire immediately', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, items: [] }),
    });

    renderHook(() => useContextualData('Will ETH flip $5k?'));
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
