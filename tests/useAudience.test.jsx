/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { AUDIENCE_MODES, AUDIENCE_META, useAudience } from '@/hooks/useAudience';

// next/navigation is only used for usePathname; we mock it to return a stable
// value so the route-derived default is deterministic.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useAudience', () => {
  it('exposes the three canonical modes', () => {
    expect(AUDIENCE_MODES).toEqual(['analyst', 'operator', 'allocator']);
    expect(AUDIENCE_META.analyst.label).toBe('Analyst');
    expect(AUDIENCE_META.operator.label).toBe('Operator');
    expect(AUDIENCE_META.allocator.label).toBe('Allocator');
  });

  it('defaults to analyst on the landing route', () => {
    const { result } = renderHook(() => useAudience());
    expect(result.current.mode).toBe('analyst');
    // After mount the hook has hydrated; in jsdom the effect flushes before
    // the next assertion. The "hydrated" flag exists primarily so consumers
    // can avoid SSR/CSR mismatches when reading storage.
    expect(result.current.hydrated).toBe(true);
  });

  it('persists setMode to localStorage', () => {
    const { result } = renderHook(() => useAudience());
    act(() => result.current.setMode('allocator'));
    expect(result.current.mode).toBe('allocator');
    expect(window.localStorage.getItem('fourcast:audience')).toBe('allocator');
  });

  it('hydrates from localStorage on mount when a valid mode is stored', () => {
    window.localStorage.setItem('fourcast:audience', 'operator');
    const { result } = renderHook(() => useAudience());
    expect(result.current.mode).toBe('operator');
  });

  it('ignores invalid stored values', () => {
    window.localStorage.setItem('fourcast:audience', 'bogus');
    const { result } = renderHook(() => useAudience());
    expect(result.current.mode).toBe('analyst');
  });

  it('reset clears stored mode and returns to route default', () => {
    const { result } = renderHook(() => useAudience());
    act(() => result.current.setMode('allocator'));
    expect(window.localStorage.getItem('fourcast:audience')).toBe('allocator');
    act(() => result.current.reset());
    expect(result.current.mode).toBe('analyst');
    expect(window.localStorage.getItem('fourcast:audience')).toBe(null);
  });

  it('ignores setMode calls with invalid values', () => {
    const { result } = renderHook(() => useAudience());
    const initial = result.current.mode;
    act(() => result.current.setMode('bogus'));
    expect(result.current.mode).toBe(initial);
    expect(window.localStorage.getItem('fourcast:audience')).toBe(null);
  });

  it('broadcasts changes via window event so other consumers stay in sync', () => {
    const { result } = renderHook(() => useAudience());
    const listener = vi.fn();
    window.addEventListener('fourcast:audience-change', listener);
    act(() => result.current.setMode('operator'));
    expect(listener).toHaveBeenCalled();
    const event = listener.mock.calls[listener.mock.calls.length - 1][0];
    expect(event.detail).toBe('operator');
    window.removeEventListener('fourcast:audience-change', listener);
  });
});
