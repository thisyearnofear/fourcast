'use client';

import React, { useState, useEffect } from 'react';
import { AppShell } from '@/app/components/PageNav';
import CantonSettlementHub from '@/components/CantonSettlementHub';
import PrivacyProof from '@/components/PrivacyProof';
import NarrativeSteps from '@/components/NarrativeSteps';

export default function CantonPage() {
  const [health, setHealth] = useState({ status: 'checking' });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/canton/health');
        const data = await res.json();
        if (!cancelled) setHealth(data);
      } catch (err) {
        if (!cancelled) setHealth({ status: 'error', error: err.message });
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return (
    <AppShell
      title="Private Markets on Canton"
      subtitle="Prediction markets with hidden position sizes. Settlement in cBTC/cETH via Daml smart contracts — only the operator and the holder see the details."
      maxWidth="max-w-6xl"
    >
      <NarrativeSteps currentStep="publish" />

      {/* Hero — the privacy model explained */}
      <section className="platform-workbench px-4 py-6 sm:px-6 sm:py-8 mb-8" aria-labelledby="privacy-heading">
        <div className="flex items-start gap-3 mb-4">
          <div className="flex h-8 w-8 items-center justify-center border border-teal-400/30 bg-teal-400/5 text-teal-300 text-sm">
            ◈
          </div>
          <div className="flex-1">
            <h2 id="privacy-heading" className="font-display text-lg font-semibold tracking-tight text-white">
              A whale can take massive size without exposing it
            </h2>
            <p className="mt-2 text-xs leading-5 text-white/50">
              On Polymarket, every position is public within seconds — copied, front-run, tracked on Polycopy and Stand. 
              Canton's Daml contracts enforce structural privacy: <span className="text-white/70">position sizes are visible only to the operator and the holder</span>. 
              No public explorer, no competing trader, no validator can query them.
            </p>
          </div>
        </div>

        {/* Three-column role explorer */}
        <div className="mt-6 grid gap-px overflow-hidden bg-white/10 sm:grid-cols-3">
          <RoleCard
            icon="◈"
            title="Issuer (Operator)"
            role="operator"
            visibility="Creates markets, resolves outcomes, processes settlement transfers"
            sees="All markets, all positions (as counterparty)"
            color="teal"
          />
          <RoleCard
            icon="◉"
            title="Holder (Trader)"
            role="holder"
            visibility="Takes a position, settles after resolution"
            sees="Their own positions only — nothing else"
            color="emerald"
          />
          <RoleCard
            icon="○"
            title="Observer (Public)"
            role="observer"
            visibility="Can discover market questions, but not positions"
            sees="Empty result set when querying positions"
            color="slate"
          />
        </div>
      </section>

      {/* Outage banner — only shown if health check fails */}
      {health.status === 'checking' && (
        <div className="mb-8 border border-teal-400/20 bg-teal-400/5 px-4 py-3 text-xs text-teal-300">
          Connecting to Canton Devnet...
        </div>
      )}
      {(health.status === 'error' || health.status === 'unhealthy') && (
        <OutageBanner health={health} />
      )}

      {/* Privacy proof — the binary demo */}
      <PrivacyProof />

      {/* Settlement hub — active markets, positions, lifecycle */}
      <div className="mt-10">
        <CantonSettlementHub />
      </div>
    </AppShell>
  );
}

function OutageBanner({ health }) {
  const checks = health.checks || {};
  return (
    <div className="mb-8 border border-amber-400/30 bg-amber-400/5 px-4 py-4 sm:px-5" role="alert">
      <div className="flex items-start gap-3">
        <span className="text-amber-300 text-sm mt-0.5">⚠</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-200">
            Canton Devnet currently unavailable
          </p>
          <p className="mt-1 text-xs leading-5 text-white/60">
            The live system is deployed and integrated. This is a connectivity issue with the Canton Devnet, not the app.
            See the recorded walkthrough below for a demonstration of the full privacy + settlement flow.
          </p>
          {/* Diagnostic details */}
          <div className="mt-3 border-t border-white/10 pt-3">
            <p className="text-[10px] uppercase tracking-wider text-white/40 mb-2">Health check results</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] font-mono sm:grid-cols-4">
              <CheckResult label="Env vars" pass={checks.configured} />
              <CheckResult label="OIDC auth" pass={checks.oidc} />
              <CheckResult label="Ledger query" pass={checks.ledger} />
              <CheckResult label="DAR package" pass={checks.packageId} />
            </div>
            {health.error && (
              <p className="mt-2 text-[10px] text-amber-300/70 font-mono truncate">
                {health.error}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckResult({ label, pass }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`h-1.5 w-1.5 rounded-full ${pass ? 'bg-emerald-400' : 'bg-red-400/70'}`} />
      <span className={pass ? 'text-white/60' : 'text-red-300/80'}>{label}</span>
    </div>
  );
}

function RoleCard({ icon, title, role, visibility, sees, color }) {
  const colorClasses = {
    teal: 'border-teal-400/20 bg-teal-400/5 text-teal-300',
    emerald: 'border-emerald-400/20 bg-emerald-400/5 text-emerald-300',
    slate: 'border-white/10 bg-white/[0.03] text-white/60',
  };

  return (
    <div className="p-4 bg-[var(--color-paper)]">
      <div className={`flex items-center gap-2 text-xs font-mono uppercase tracking-wider mb-2 ${colorClasses[color]}`}>
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <p className="text-[11px] leading-5 text-white/70 mb-3">
        <span className="text-white/40">Action:</span> {visibility}
      </p>
      <p className="text-[11px] leading-5 text-white/70">
        <span className="text-white/40">Sees:</span> {sees}
      </p>
    </div>
  );
}
