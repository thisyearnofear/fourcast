'use client';

import { Zap } from 'lucide-react';
import { AppShell } from '@/app/components/PageNav';
import CantonSettlementHub from '@/components/CantonSettlementHub';

/**
 * Canton Operator Console — ops tooling, not a product surface.
 *
 * Lives under /labs (execution capability) alongside Autopilot and Builder.
 * Create markets, resolve outcomes, and atomically settle positions on the
 * Canton Devnet — all via the server-side ledger client (no browser
 * extension needed). Moved here from the old /canton product page so the
 * public-facing app no longer exposes operator mechanics as a destination.
 */
export default function LabsCantonPage() {
  return (
    <AppShell
      title="Canton ops"
      subtitle="Create · resolve · settle private CBTC markets"
      maxWidth="max-w-5xl"
      actions={
        <span className="inline-flex items-center gap-1.5 border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--color-accent)]">
          <Zap className="h-3 w-3" />
          Ops
        </span>
      }
    >
      <CantonSettlementHub />
    </AppShell>
  );
}
