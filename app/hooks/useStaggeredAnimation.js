"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Coordinate a staggered reveal animation across N items.
 *
 * @param {number} itemCount - Number of items to stagger
 * @param {number} [staggerMs=45] - Delay between each item appearing
 * @param {function(number): void} onUpdate - Called with the latest visible count (0..N)
 * @returns {{ visibleCount: number }}
 */
export function useStaggeredAnimation(itemCount, staggerMs = 45, onUpdate) {
  const visibleCountRef = useRef(0);
  const onUpdateRef = useRef(onUpdate);
  const timersRef = useRef([]);

  onUpdateRef.current = onUpdate;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  useEffect(() => {
    clearTimers();
    visibleCountRef.current = 0;

    // Immediately apply first item reveal after a single tick so parent re-renders
    // with `visibleCount = 0` first (all items rendered as hidden placeholders).
    const start = requestAnimationFrame(() => {
      for (let i = 0; i < itemCount; i++) {
        const t = window.setTimeout(() => {
          visibleCountRef.current = i + 1;
          onUpdateRef.current?.(visibleCountRef.current);
        }, (i + 1) * staggerMs + 150);
        timersRef.current.push(t);
      }
    });

    return () => {
      cancelAnimationFrame(start);
      clearTimers();
    };
  }, [itemCount, staggerMs, clearTimers]);

  return { visibleCount: visibleCountRef.current };
}
