'use client';

import Link from 'next/link';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import useAnchoredMenu from '@/hooks/useAnchoredMenu';
import useHealthSummary from '@/hooks/useHealthSummary';
import { useArenaAge, useOperatorPulse } from '@/components/OperatorPulse';
import { getSummaryAppearance, SUMMARY_LABEL, SUMMARY_SHORT_LABEL } from '@/utils/healthBadge';

/**
 * SystemHealthMenu — the single health indicator in the app chrome.
 *
 * Replaces the old side-by-side OperatorPulse lamp + StatusBadge pill: two
 * different signals (agent feed liveness vs provider health) that read as
 * one vague status. Now a single pill whose colour shows the worst state,
 * opening a popover that explains each signal in words and links to where
 * it lives: agent feed → /arena, providers → /status.
 */
export default function SystemHealthMenu({ className = '' }) {
  const { open, setOpen, mounted, coords, rootRef, menuRef } = useAnchoredMenu({ arrowNav: true });
  const { summary, lastUpdated } = useHealthSummary();
  const { loading, pulse } = useOperatorPulse();
  const arenaAge = useArenaAge();

  const appearance = getSummaryAppearance(summary);
  const degraded = summary === 'degraded';

  const marketsScanned = pulse?.marketsScanned ?? 0;
  const freshEdges = pulse?.freshEdges ?? 0;
  const feedActive = pulse?.mode === 'LIVE' || pulse?.mode === 'DRY RUN' || !!arenaAge;
  const feedLabel = pulse?.mode || (feedActive ? 'LIVE' : 'IDLE');

  // The pill leads with the worst signal — degraded health always outranks
  // feed liveness. Second line carries the detail inside the popover.
  const label = loading && summary === 'loading'
    ? 'Checking…'
    : degraded
      ? SUMMARY_SHORT_LABEL.degraded
      : feedLabel;

  const feedDescription = loading
    ? 'syncing'
    : [
        feedLabel.toLowerCase(),
        freshEdges > 0 ? `${freshEdges} fresh edges` : null,
        marketsScanned > 0 ? `${marketsScanned} markets` : null,
        arenaAge ? `arena ${arenaAge}` : null,
      ]
        .filter(Boolean)
        .join(' · ');

  const updatedAt = lastUpdated
    ? lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  const menu =
    open && mounted && coords
      ? createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label="System health"
            style={{ top: coords.top, right: coords.right }}
            className="fc-menu-pop fixed z-[var(--z-menu)] w-64 border border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)] p-1 shadow-xl backdrop-blur-[18px] backdrop-saturate-[1.2]"
          >
            <p className="px-2.5 py-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
              System health
            </p>
            <Link
              href="/status"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left no-underline transition-colors hover:bg-white/[0.04]"
            >
              <span className={`mt-1.5 h-2 w-2 shrink-0 ${appearance.dot}`} aria-hidden="true" />
              <span className="min-w-0">
                <span className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${appearance.text}`}>
                  Providers · {SUMMARY_SHORT_LABEL[summary] ?? 'checking…'}
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-ink-muted)] normal-case tracking-normal">
                  {SUMMARY_LABEL[summary] ?? 'Provider health unknown'}
                  {updatedAt ? ` · updated ${updatedAt}` : ''}
                </span>
              </span>
            </Link>
            <Link
              href="/arena"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="flex w-full items-start gap-2.5 px-2.5 py-2 text-left no-underline transition-colors hover:bg-white/[0.04]"
            >
              <span
                className={`mt-1.5 h-2 w-2 shrink-0 ${feedActive ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-ink-faint)]'}`}
                aria-hidden="true"
              />
              <span className="min-w-0">
                <span className={`block text-[11px] font-semibold uppercase tracking-[0.12em] ${feedActive ? 'text-[var(--color-accent)]' : 'text-[var(--color-ink)]'}`}>
                  Agent feed
                </span>
                <span className="mt-0.5 block text-[11px] leading-snug text-[var(--color-ink-muted)] normal-case tracking-normal">
                  {feedDescription}
                </span>
              </span>
            </Link>
          </div>,
          document.body
        )
      : null;

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`System health: ${degraded ? 'degraded providers' : `providers ${SUMMARY_SHORT_LABEL[summary] ?? 'checking'}, agent feed ${feedLabel.toLowerCase()}`}`}
        title={`Providers: ${SUMMARY_SHORT_LABEL[summary] ?? 'checking…'} · Feed: ${feedLabel.toLowerCase()}`}
        className="inline-flex items-center gap-1.5 border border-[var(--color-rule)] bg-[var(--color-paper-raised)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--color-ink)] transition-colors hover:bg-[var(--color-paper-soft)]"
      >
        <span className="relative flex h-2 w-2" aria-hidden="true">
          {summary === 'all_healthy' && feedActive && (
            <span className={`absolute inline-flex h-full w-full animate-ping ${appearance.dot} opacity-60`} />
          )}
          <span className={`relative inline-flex h-2 w-2 ${degraded ? appearance.dot : feedActive ? 'bg-[var(--color-accent)]' : appearance.dot}`} />
        </span>
        <span className={degraded ? appearance.text : 'text-[var(--color-ink)]'}>{label}</span>
        <ChevronDown
          className={`h-3 w-3 text-[var(--color-ink-muted)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      {menu}
    </div>
  );
}
