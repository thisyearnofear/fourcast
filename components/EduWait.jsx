'use client';

import { useEffect, useState } from 'react';

/**
 * EduWait — one-line teaching that only appears after a short delay.
 *
 * Rules: ≤ ~8 words, replaces empty wait chrome, gone when `active` flips false.
 * Skips flash for sub-400ms waits so instant loads stay silent.
 */
export default function EduWait({
  active = false,
  line,
  delayMs = 400,
  className = '',
}) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!active) {
      setShown(false);
      return undefined;
    }
    const t = window.setTimeout(() => setShown(true), delayMs);
    return () => window.clearTimeout(t);
  }, [active, delayMs, line]);

  if (!active || !shown || !line) return null;

  return (
    <p
      role="status"
      aria-live="polite"
      className={`fc-edu-wait inline-flex items-center gap-2 text-xs text-[var(--color-ink-muted)] ${className}`}
    >
      <span className="mc-lamp mc-lamp--live shrink-0" aria-hidden="true" />
      <span>{line}</span>
    </p>
  );
}
