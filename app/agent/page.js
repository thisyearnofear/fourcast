'use client';

import React, { useState } from 'react';
import { ChevronDown, FlaskConical, SlidersHorizontal } from 'lucide-react';
import { AppShell } from '@/app/components/PageNav';
import { MandateControl } from '@/components/MandateControl';
import { AgentDashboard } from '@/components/AgentDashboard';
import { AgentRunLedger } from '@/components/AgentRunLedger';
import { HistoricalLabPanel } from '@/components/HistoricalLabPanel';
import RouteGuide from '@/components/RouteGuide';
import MandateBuilder from '@/components/MandateBuilder';
import { BRAND } from '@/constants/brand';

export default function AgentPage() {
  const [operatorOpen, setOperatorOpen] = useState(false);

  return (
    <AppShell
      title="Mandate Control"
      subtitle="An agent is alive, operating under a mandate, making constrained decisions, and leaving behind evidence nobody — including its operator — can rewrite."
      maxWidth="max-w-4xl"
    >
      <RouteGuide route="agent" />
      {/* Self-serve mandate builder + dry-run preview — the in-browser version
          of the concierge test's "hand-roll a mandate" step. */}
      <MandateBuilder />
      {/* Flagship — the autonomous system, not a button simulation, is the protagonist. */}
      <MandateControl />

      {/* Operator controls — demoted. The manual runner is a capability, not the hero. */}
      <section className="platform-open-section mt-10" aria-label="Operator controls — manual investigation">
        <button
          type="button"
          onClick={() => setOperatorOpen((v) => !v)}
          aria-expanded={operatorOpen}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left sm:px-5"
        >
          <div className="flex items-center gap-2.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-white/45" />
            <span className="mc-kicker">Operator controls · manual investigation</span>
          </div>
          <ChevronDown className={`h-4 w-4 text-white/45 transition-transform ${operatorOpen ? 'rotate-180' : ''}`} />
        </button>
        {operatorOpen && (
          <div className="border-t border-[var(--mc-rule)] px-4 py-5 sm:px-5">
            <p className="mb-4 text-xs leading-5 text-white/45">
              The manual runner scans markets on demand. It is a capability for investigation, not the autonomous mandate above — every manual run still produces a hash-bound receipt in the ledger below.
            </p>
            <AgentDashboard />
          </div>
        )}
      </section>

      {/* Canonical supporting surfaces — kept, not duplicated. */}
      <div className="platform-open-section mt-10">
        <HistoricalLabPanel />
      </div>
      <div className="platform-open-section mt-10">
        <AgentRunLedger />
      </div>

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
