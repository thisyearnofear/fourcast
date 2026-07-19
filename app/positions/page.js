"use client";

import React from "react";
import { AppShell } from "@/app/components/PageNav";
import PositionsDashboard from "@/components/PositionsDashboard";
import { MandatePanel } from "@/components/MandatePanel";
import NarrativeSteps from "@/components/NarrativeSteps";
import { BRAND } from "@/constants/brand";

export default function PositionsPage() {
  return (
    <AppShell
      title={BRAND.navLabels.positions ?? 'Track Record'}
      subtitle={BRAND.pages.positions}
      maxWidth="max-w-4xl"
      subheader={<NarrativeSteps currentStep="scored" />}
    >
      <div className="mb-6">
        <MandatePanel />
      </div>
      <PositionsDashboard />
    </AppShell>
  );
}
