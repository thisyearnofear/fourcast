'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Compass, LineChart, ShieldCheck } from 'lucide-react';
import useAnchoredMenu from '@/hooks/useAnchoredMenu';
import { AUDIENCE_MODES, AUDIENCE_META, useAudience } from '@/hooks/useAudience';

/**
 * AudienceSwitcher — reading-mode control in the app chrome.
 *
 * Menu is portaled + fixed (same pattern as More nav) so clicks aren't
 * swallowed by overflow clipping / mousedown-outside races.
 */

const MODE_ICONS = {
  analyst: Compass,
  operator: LineChart,
  allocator: ShieldCheck,
};

export default function AudienceSwitcher() {
  const { mode, setMode } = useAudience();
  const { open, setOpen, mounted, coords, rootRef, menuRef } = useAnchoredMenu({ arrowNav: true });
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef(null);

  useEffect(() => () => {
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
  }, []);

  const pick = (next) => {
    setMode(next);
    setOpen(false);
    setFlash(true);
    if (flashTimer.current) window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(false), 1600);
  };

  const ActiveIcon = MODE_ICONS[mode] ?? Compass;
  const activeMeta = AUDIENCE_META[mode];

  const menu =
    open && mounted && coords
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="Reading mode"
            style={{ top: coords.top, right: coords.right }}
            className="fc-menu-pop fixed z-[var(--z-menu)] w-60 border border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)] p-1 shadow-xl backdrop-blur-[18px] backdrop-saturate-[1.2]"
          >
            <p className="px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
              Reading mode
            </p>
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
                  onClick={() => pick(m)}
                  className={`flex w-full items-start gap-2.5 px-2.5 py-2 text-left transition ${
                    isActive
                      ? 'bg-[var(--color-accent-quiet)] text-[var(--color-accent)]'
                      : 'text-[var(--color-ink)] hover:bg-white/[0.06]'
                  }`}
                >
                  <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-[11px] font-semibold uppercase tracking-[0.12em]">
                      {meta.label}
                      {isActive ? ' · on' : ''}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-ink-muted)] normal-case tracking-normal font-normal">
                      {meta.description}
                    </span>
                  </span>
                </button>
              );
            })}
            <p className="mt-1 border-t border-[var(--color-rule)] px-2.5 py-2 text-[10px] leading-4 text-[var(--color-ink-faint)]">
              Reorders Mandate &amp; dossier emphasis. Saved on this device.
            </p>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className="relative" data-audience-mode={mode}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Reading mode · ${activeMeta.label}. ${activeMeta.description}`}
        title={`Reading mode · ${activeMeta.label}`}
        className={`inline-flex h-8 items-center gap-1.5 border px-2 transition ${
          open || flash
            ? 'border-[var(--color-accent)]/60 bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
            : 'border-[var(--color-rule)] bg-[var(--color-paper-glass)] text-[var(--color-ink-muted)] hover:border-[var(--color-accent)]/40 hover:text-[var(--color-ink)]'
        }`}
      >
        <ActiveIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="hidden text-[10px] font-semibold uppercase tracking-[0.1em] sm:inline">
          {activeMeta.label}
        </span>
      </button>
      {menu}
    </div>
  );
}
