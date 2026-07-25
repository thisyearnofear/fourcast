'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * TweenNumber — rolls between numeric values instead of snapping.
 *
 * Odds, edges, and metrics on operator surfaces change live; a 450ms
 * ease-out roll (design.md: motion for state indication) makes the change
 * legible. Reduced-motion users get the final value instantly (no roll,
 * no displacement).
 *
 * Props:
 *   value     — target number
 *   format    — (v) => string, defaults to integer
 *   duration  — roll time in ms (default 450)
 *   className — passed through to the wrapper span
 */
export default function TweenNumber({
  value,
  format = (v) => String(Math.round(v)),
  duration = 450,
  className,
}) {
  const [display, setDisplay] = useState(value);
  const [rolling, setRolling] = useState(false);
  const displayRef = useRef(value); // latest shown value — retargets from here (interruptible)
  const prevTarget = useRef(value);
  const rafRef = useRef(0);
  const initial = useRef(true);

  useEffect(() => {
    if (initial.current) {
      initial.current = false;
      prevTarget.current = value;
      return undefined;
    }
    if (prevTarget.current === value) return undefined;
    prevTarget.current = value;

    const reduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || duration <= 0) {
      displayRef.current = value;
      setDisplay(value);
      return undefined;
    }

    const from = displayRef.current;
    const delta = value - from;
    const start = performance.now();
    setRolling(true);

    const tick = () => {
      // Anchor to performance.now() rather than the rAF timestamp — the
      // rAF callback's time origin differs from performance.now() in jsdom.
      const t = Math.min((performance.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      const next = from + delta * eased;
      setDisplay(next);
      if (t < 1) {
        displayRef.current = next;
        rafRef.current = requestAnimationFrame(tick);
      } else {
        displayRef.current = value;
        setRolling(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  return (
    <span className={`${className ?? ''} ${rolling ? 'fc-roll' : ''}`.trim()}>
      {format(display)}
    </span>
  );
}
