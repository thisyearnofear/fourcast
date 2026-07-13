'use client';

import React from 'react';
import { AppShell } from '@/app/components/PageNav';
import { AgentDashboard } from '@/components/AgentDashboard';
import NarrativeSteps from '@/components/NarrativeSteps';
import { BRAND } from '@/constants/brand';

export default function AgentPage() {
  return (
    <AppShell
      title={BRAND.agent.title}
      subtitle={BRAND.agent.subtitle}
      maxWidth="max-w-4xl"
      subheader={
        <div>
          <div className="mb-1.5 flex items-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-cyan-300">
              <span>🤖</span>
              <span>{BRAND.agent.badge}</span>
            </div>
          </div>
          {/* The 4-step loop — all steps shown as completed (observed) */}
          <NarrativeSteps currentStep="scored" isNight={true} />
        </div>
      }
    >
      <AgentDashboard isNight={true} />

      {/* Labs CTA */}
      <div className="mt-12 text-center">
        <p className="mb-3 text-xs font-light text-white/[0.45]">
          {BRAND.agent.labsCta}
        </p>
        <a
          href="/labs"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-light text-white/70 transition hover:bg-white/10"
        >
          <span>🧪</span>
          Visit Labs for Autopilot & Builder
        </a>
      </div>
    </AppShell>
  );
}
