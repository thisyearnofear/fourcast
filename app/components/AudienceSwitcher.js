'use client';

import { Compass, LineChart, ShieldCheck } from 'lucide-react';
import { AUDIENCE_MODES, AUDIENCE_META, useAudience } from '@/hooks/useAudience';

/**
 * AudienceSwitcher — a three-icon segmented pill in the app chrome.
 *
 * Always visible in the top-right cluster, between OperatorPulse/StatusBadge
 * and WalletConnect. Square profile to match the rest of the chrome; emerald
 * border + accent-quiet fill on the active mode. Tooltips name the mode and
 * what it leads with so the choice is legible without taking real estate.
 *
 * Color/contrast discipline: only --color-accent on the active state;
 * --color-rule for the inactive border; no decoration.
 */

const MODE_ICONS = {
  analyst: Compass,
  operator: LineChart,
  allocator: ShieldCheck,
};

export default function AudienceSwitcher({ compact = false }) {
  const { mode, setMode } = useAudience();
  const ActiveIcon = MODE_ICONS[mode] ?? Compass;

  return (
    <div
      role="group"
      aria-label="Reading mode"
      className={`inline-flex items-center border border-[var(--color-rule)] bg-[var(--color-paper-glass)] ${
        compact ? 'h-8' : 'h-9'
      }`}
      data-audience-mode={mode}
    >
      {AUDIENCE_MODES.map((m) => {
        const Icon = MODE_ICONS[m];
        const meta = AUDIENCE_META[m];
        const isActive = m === mode;
        return (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={isActive}
            aria-label={`${meta.label} · ${meta.description}`}
            title={`${meta.label} · ${meta.description}`}
            className={`inline-flex h-full items-center justify-center gap-1.5 border-r border-[var(--color-rule)] px-2.5 text-[10px] uppercase tracking-[0.14em] transition last:border-r-0 ${
              isActive
                ? 'bg-[var(--color-accent-quiet)] text-[var(--color-accent)]'
                : 'text-[var(--color-ink-muted)] hover:bg-white/[0.04] hover:text-[var(--color-ink)]'
            }`}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {compact ? null : <span>{meta.label}</span>}
          </button>
        );
      })}
    </div>
  );
}
