'use client';

import { useEffect, useRef, useState } from 'react';
import { Compass, LineChart, ShieldCheck } from 'lucide-react';
import { AUDIENCE_MODES, AUDIENCE_META, useAudience } from '@/hooks/useAudience';

/**
 * AudienceSwitcher — quiet meta-control in the app chrome.
 *
 * Renders a single icon button showing the active mode's icon. Clicking
 * opens a small popover with all three modes. Click outside / Esc closes.
 *
 * Color/contrast discipline: only --color-accent on the active state;
 * --color-rule for the inactive border; no decoration.
 */

const MODE_ICONS = {
  analyst: Compass,
  operator: LineChart,
  allocator: ShieldCheck,
};

export default function AudienceSwitcher() {
  const { mode, setMode } = useAudience();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const ActiveIcon = MODE_ICONS[mode] ?? Compass;
  const activeMeta = AUDIENCE_META[mode];

  return (
    <div ref={rootRef} className="relative" data-audience-mode={mode}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Reading mode · ${activeMeta.label}. ${activeMeta.description}`}
        title={`Reading mode · ${activeMeta.label}`}
        className={`inline-flex h-8 w-8 items-center justify-center border bg-[var(--color-paper-glass)] transition ${
          open
            ? 'border-[var(--color-accent)]/60 text-[var(--color-accent)]'
            : 'border-[var(--color-rule)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-ink)]'
        }`}
      >
        <ActiveIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          aria-label="Reading mode"
          className="absolute right-0 top-full z-[60] mt-1.5 w-56 border border-[var(--color-rule)] bg-[var(--color-paper-deep)] p-1 shadow-xl"
        >
          {AUDIENCE_MODES.map((m) => {
            const Icon = MODE_ICONS[m];
            const meta = AUDIENCE_META[m];
            const isActive = m === mode;
            return (
              <button
                key={m}
                type="button"
                role="menuitemradio"
                aria-checked={isActive}
                onClick={() => {
                  setMode(m);
                  setOpen(false);
                }}
                className={`flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition ${
                  isActive
                    ? 'bg-[var(--color-accent-quiet)] text-[var(--color-accent)]'
                    : 'text-[var(--color-ink)] hover:bg-white/[0.04]'
                }`}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.12em]">
                    {meta.label}
                  </span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-ink-muted)]">
                    {meta.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
