'use client';

import { useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * ExpandPanel — height-animated collapsible panel.
 *
 * Replaces flat collapsible sections (`useState` + conditional render) with a
 * smooth height transition. Uses `maxHeight` (not fixed `height`) so the
 * browser auto-measures the content's natural height and animates between
 * 0 → auto. Avoids the race condition that happens when you measure
 * `scrollHeight` in a useEffect that fires *after* the parent is already
 * `height: 0`.
 *
 * Usage:
 *   <ExpandPanel title="Filters" subtitle="category · platform · date">
 *     <FiltersForm />
 *   </ExpandPanel>
 */
export default function ExpandPanel({ title, subtitle, defaultOpen = false, children, ...props }) {
  const [open, setOpen] = useState(defaultOpen);

  const toggle = useCallback(() => {
    setOpen((prev) => !prev);
  }, []);

  return (
    <div className="overflow-hidden" {...props}>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left no-underline"
        aria-expanded={open}
      >
        <div>
          <span className="font-display text-[15px] font-semibold text-[var(--color-ink)]">{title}</span>
          {subtitle && (
            <span className="ml-2 text-xs font-normal normal-case tracking-normal text-[var(--color-ink-faint)]">
              {subtitle}
            </span>
          )}
        </div>
        <ChevronDown
          className={`h-4 w-4 text-[var(--color-ink-muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      <div
        style={{
          maxHeight: open ? '40rem' : '0',
          overflow: 'hidden',
          transition: 'max-height 0.35s cubic-bezier(0.23, 1, 0.32, 1)',
        }}
      >
        <div className="px-4 pb-4">{children}</div>
      </div>
    </div>
  );
}