'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, FlaskConical, SlidersHorizontal, RotateCcw } from 'lucide-react';
import { AppShell } from '@/app/components/PageNav';
import { MandateControl } from '@/components/MandateControl';
import { AgentDashboard } from '@/components/AgentDashboard';
import { AgentRunLedger } from '@/components/AgentRunLedger';
import { HistoricalLabPanel } from '@/components/HistoricalLabPanel';
import RouteGuide from '@/components/RouteGuide';
import MandateBuilder from '@/components/MandateBuilder';
import { BRAND } from '@/constants/brand';
import { AUDIENCE_META, useAudience } from '@/hooks/useAudience';
import { useCountUp } from '@/hooks/useCountUp';
import Reveal from '@/components/motion/Reveal';

// Each section keyed by id so the audience mode can reorder without
// re-rendering cost and without losing disclosure state.
const AGENT_SECTIONS = {
  'mandate-builder': { id: 'mandate-builder', render: () => <MandateBuilder />, wrap: false },
  'mandate-control': { id: 'mandate-control', render: () => <MandateControl />, wrap: false },
  'operator-controls': { id: 'operator-controls', render: OperatorControlsSection, wrap: true },
  'historical-lab': { id: 'historical-lab', render: () => <HistoricalLabPanel />, wrap: true },
  'run-ledger': { id: 'run-ledger', render: () => <AgentRunLedger />, wrap: true },
};

function OperatorControlsSection() {
  const [open, setOpen] = useState(false);
  return (
    <section className="platform-open-section mt-10" aria-label="Operator controls — manual investigation">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
      >
        <div className="flex items-center gap-2.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-white/45" />
          <span className="mc-kicker">Operator controls · manual investigation</span>
        </div>
        <ChevronDown className={`h-4 w-4 text-white/45 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="border-t border-[var(--mc-rule)] px-4 py-5 sm:px-5">
          <p className="mb-4 text-xs leading-5 text-white/45">
            Manual on-demand scans — every run still produces a hash-bound receipt.
          </p>
          <AgentDashboard />
        </div>
      )}
    </section>
  );
}

function SectionWrap({ children }) {
  return <div className="platform-open-section mt-10">{children}</div>;
}

// Replay banner is mounted only when historical replay is active, so the
// count-up hooks can live here and fire on mount (the counts are evidence
// of how many cached fixtures/receipts were processed).
function ReplayBanner({ info }) {
  const [fixtureRef, fixtureCount] = useCountUp(info.fixtureCount, { duration: 900 });
  const [receiptRef, receiptCount] = useCountUp(info.receiptCount, { duration: 900 });
  return (
    <div className="mb-6 border border-[var(--mc-sealed)]/30 bg-[var(--mc-sealed)]/5 p-4">
      <div className="flex items-start gap-3">
        <RotateCcw className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--mc-sealed)]" />
        <div className="flex-1">
          <p className="text-sm font-medium text-white/80">
            Historical replay ·{' '}
            <span ref={fixtureRef} className="font-mono tabular-nums">{Math.round(fixtureCount)}</span>{' '}
            cached {info.fixtureCount === 1 ? 'fixture' : 'fixtures'},{' '}
            <span ref={receiptRef} className="font-mono tabular-nums">{Math.round(receiptCount)}</span>{' '}
            {info.receiptCount === 1 ? 'receipt' : 'receipts'}
          </p>
          <p className="mt-1 text-xs leading-5 text-white/60">
            The TxLINE replay window closed on July 19. The agent is now replaying
            cached fixtures, odds, and outcomes. The decision engine and proof
            pipeline run live against historical data.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AgentPage() {
  const [replayInfo, setReplayInfo] = useState(null);
  const { mode } = useAudience();

  useEffect(() => {
    Promise.all([
      fetch('/api/agent/historical-lab', { cache: 'no-store' }).then(r => r.json()),
      fetch('/api/worldcup/fixtures', { cache: 'no-store' }).then(r => r.json()),
    ])
      .then(([labData, fxData]) => {
        if (!labData.status?.dryRun) return;
        const receipts = labData.status.receipts || [];
        const fixtureCount = fxData.fixtures?.length || labData.status.fixtureCount || 0;
        const fixtureNames = (fxData.fixtures || []).slice(0, 3)
          .map(f => `${f.home?.name || 'Home'} v ${f.away?.name || 'Away'}`);
        setReplayInfo({ fixtureCount, fixtureNames, receiptCount: receipts.length });
      })
      .catch(() => {});
  }, []);

  // Mode-aware section ordering. Allocator leads with the run ledger so the
  // diligence reader sees what the agent did first; analyst leads with the
  // flagship so the discovery reader sees proof; operator keeps the current
  // build-then-observe path.
  const order = AUDIENCE_META[mode]?.agentOrder ?? AUDIENCE_META.operator.agentOrder;

  const modeMeta = AUDIENCE_META[mode] ?? AUDIENCE_META.operator;

  return (
    <AppShell
      title="Mandate Control"
      subtitle="An agent is alive, operating under a mandate, making constrained decisions, and leaving behind evidence nobody — including its operator — can rewrite."
      maxWidth="max-w-4xl"
      actions={
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
          mode · {modeMeta.label.toLowerCase()}
        </span>
      }
    >
      <RouteGuide route="agent" />

      {replayInfo && (
        <Reveal>
          <ReplayBanner info={replayInfo} />
        </Reveal>
      )}

      {order.map((sectionId, idx) => {
        const section = AGENT_SECTIONS[sectionId];
        if (!section) return null;
        const content = section.render();
        const wrapped = section.wrap ? <SectionWrap>{content}</SectionWrap> : content;
        return (
          <Reveal key={section.id} delay={Math.min(idx, 4) * 60}>
            {wrapped}
          </Reveal>
        );
      })}

      {/* Labs CTA — supporting capability, not a peer product. */}
      <div className="mt-10 text-center">
        <p className="mb-3 text-xs font-light text-white/[0.45]">
          {BRAND.agent.labsCta}
        </p>
        <a
          href="/labs"
          className="mc-action"
        >
          <FlaskConical className="h-3.5 w-3.5" />
          Visit Labs for Autopilot & Builder
        </a>
      </div>
    </AppShell>
  );
}
