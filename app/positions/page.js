"use client";

import React from "react";
import { AppShell } from "@/app/components/PageNav";
import PositionsDashboard from "@/components/PositionsDashboard";
import { MandatePanel } from "@/components/MandatePanel";
import NarrativeSteps from "@/components/NarrativeSteps";
import RouteGuide from "@/components/RouteGuide";

export default function PositionsPage() {
  return (
    <AppShell
      title="Allocator Diligence"
      subtitle="Why should you let this agent touch capital? The answer is behaviour, not performance — policy adherence, receipt coverage, decision discipline, and calibration after resolution. Every number below recomputes from the public decision ledger."
      maxWidth="max-w-4xl"
      subheader={<NarrativeSteps currentStep="scored" />}
    >
      <RouteGuide route="positions" />
      {/* Hero — allocator diligence, not a portfolio dashboard. */}
      <div className="mb-10">
        <MandatePanel />
      </div>

      {/* Secondary — positions/P&L demoted. Reputation through behaviour leads. */}
      <section className="platform-open-section mt-10" aria-label="Positions and P&L">
        <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
          <span className="mc-kicker">Positions & P&L · secondary to adherence</span>
        </div>
        <div className="px-1 py-5 sm:px-3">
          <PositionsDashboard />
        </div>
      </section>
    </AppShell>
  );
}
