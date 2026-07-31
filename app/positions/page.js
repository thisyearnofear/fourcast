"use client";

import React, { useState, useEffect } from "react";
import { AppShell, SecondaryNav } from "@/app/components/PageNav";
import PositionsDashboard from "@/components/PositionsDashboard";
import CantonHolderDashboard from "@/components/CantonHolderDashboard";
import { MandatePanel } from "@/components/MandatePanel";
import NarrativeSteps from "@/components/NarrativeSteps";
import RouteGuide from "@/components/RouteGuide";
import Reveal from "@/components/motion/Reveal";
import InfoTip from "@/components/InfoTip";
import { AUDIENCE_META, useAudience } from "@/hooks/useAudience";

const MODE_HINT = {
  analyst: 'You\u2019re reading as Analyst. The discipline numbers lead; the position detail collapses by default.',
  operator: 'You\u2019re reading as Operator. Policy adherence and discipline are surfaced first.',
  allocator: 'You\u2019re reading as Allocator. Calibration and adherence lead; the run ledger sits beneath.',
};

export default function PositionsPage() {
  const { mode } = useAudience();
  const meta = AUDIENCE_META[mode] ?? AUDIENCE_META.allocator;

  // Public (Arc) vs Private (Canton) — all your positions in one diligence
  // surface, the chain a property not a page. /canton/holder dissolved here.
  const [view, setView] = useState("public");
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "private") setView("private");
  }, []);

  return (
    <AppShell
      title="Allocator Diligence"
      subtitle={
        <>
          Behaviour, not performance — adherence, coverage, discipline, and calibration
          <InfoTip term="calibration" className="ml-1" />
          . Every number recomputes from the public decision ledger.
        </>
      }
      maxWidth="max-w-4xl"
      actions={
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-ink-faint)]">
          mode · {meta.label.toLowerCase()}
        </span>
      }
      subheader={
        <div className="space-y-2">
          <NarrativeSteps currentStep="scored" />
          <SecondaryNav
            items={[
              { id: "public", label: "Public (Arc)", icon: "◆" },
              { id: "private", label: "Private (Canton)", icon: "◈" },
            ]}
            activeItem={view}
            onChange={setView}
          />
        </div>
      }
    >
      {view === "private" ? (
        <Reveal>
          <CantonHolderDashboard />
        </Reveal>
      ) : (
        <>
          <RouteGuide route="positions" />
          <p key={mode} className="fc-market-slide mb-6 border-l-2 border-[var(--color-accent)]/40 bg-[var(--color-accent-quiet)] px-3 py-2 text-xs leading-5 text-[var(--color-ink-muted)]">
            {MODE_HINT[mode] ?? MODE_HINT.allocator}
          </p>
          {/* Hero — allocator diligence, not a portfolio dashboard. */}
          <Reveal>
            <div className="mb-10">
              <MandatePanel />
            </div>
          </Reveal>

          {/* Secondary — positions/P&L demoted. Reputation through behaviour leads. */}
          <Reveal delay={80}>
            <section className="platform-open-section mt-10" aria-label="Positions and P&L">
              <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
                <span className="mc-kicker">Positions & P&L · secondary to adherence</span>
              </div>
              <div className="px-1 py-5 sm:px-3">
                <PositionsDashboard />
              </div>
            </section>
          </Reveal>
        </>
      )}
    </AppShell>
  );
}
