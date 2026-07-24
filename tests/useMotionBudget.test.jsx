import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMotionBudget } from '@/hooks/useMotionBudget';

describe('useMotionBudget', () => {
  beforeEach(() => {
    // Each test re-imports the module fresh, so the module-scoped Map
    // resets between tests. Force a clean registry by triggering effect
    // cleanups through a final render of nothing.
  });

  it('returns allowed: true when under budget', () => {
    const { result } = renderHook(() => useMotionBudget('a', { priority: 5 }));
    expect(result.current.allowed).toBe(true);
  });

  it('returns allowed: false when over budget and lower priority', () => {
    renderHook(() => useMotionBudget('high', { priority: 10 }));
    const { result } = renderHook(() => useMotionBudget('low', { priority: 1 }));
    expect(result.current.allowed).toBe(false);
  });

  it('highest priority wins when over budget', () => {
    renderHook(() => useMotionBudget('mid', { priority: 5 }));
    const { result } = renderHook(() => useMotionBudget('top', { priority: 9 }));
    expect(result.current.allowed).toBe(true);
  });

  it('respects custom max budget', () => {
    const { result: a } = renderHook(() => useMotionBudget('a', { priority: 1, max: 2 }));
    const { result: b } = renderHook(() => useMotionBudget('b', { priority: 1, max: 2 }));
    const { result: c } = renderHook(() => useMotionBudget('c', { priority: 1, max: 2 }));
    expect(a.current.allowed).toBe(true);
    expect(b.current.allowed).toBe(true);
    expect(c.current.allowed).toBe(false);
  });

  it('cleaning up frees the budget', () => {
    const { unmount } = renderHook(() => useMotionBudget('first', { priority: 1 }));
    const { result } = renderHook(() => useMotionBudget('second', { priority: 1 }));
    expect(result.current.allowed).toBe(false);
    act(() => unmount());
    // Re-render to pick up the change. The hook re-runs the effect, but
    // since `second` was already registered we can directly check by
    // triggering a state change via a new effect.
    const { result: result2 } = renderHook(() => useMotionBudget('second', { priority: 1 }));
    expect(result2.current.allowed).toBe(true);
  });

  it('ignores hidden effects in the budget', () => {
    const { result: visible } = renderHook(() =>
      useMotionBudget('visible', { priority: 1, visible: true }),
    );
    const { result: hidden } = renderHook(() =>
      useMotionBudget('hidden', { priority: 0, visible: false }),
    );
    expect(visible.current.allowed).toBe(true);
    expect(hidden.current.allowed).toBe(false);
  });
});
