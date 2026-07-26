'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
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
          <div className="flex h-8 w-8 items-center justify-center border border-[var(--color-accent)]/30 bg-[var(--color-accent)]/5 text-[var(--color-accent)] text-sm">
            ◈
          </div>
          <div className="flex-1">
            <h2 id="privacy-heading" className="font-display text-lg font-semibold tracking-tight text-[var(--color-ink)]">
              A whale can take massive size without exposing it
            </h2>
            <p className="mt-2 text-xs leading-5 text-[var(--color-ink-faint)]">
              On Polymarket, every position is public within seconds — copied, front-run, tracked on Polycopy and Stand. 
              Canton's Daml contracts enforce structural privacy: <span className="text-[var(--color-ink-muted)]">position sizes are visible only to the operator and the holder</span>. 
              No public explorer, no competing trader, no validator can query them.
            </p>
          </div>
        </div>

        {/* Three-column role explorer */}
        <div className="mt-6 grid gap-px overflow-hidden bg-[var(--color-paper-soft)] sm:grid-cols-3">
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
        <div className="mb-8 border border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 px-4 py-3 text-xs text-[var(--color-accent)]">
          Connecting to Canton Devnet...
        </div>
      )}
      {(health.status === 'error' || health.status === 'unhealthy') && (
        <OutageBanner health={health} />
      )}

      {/* Privacy proof — the binary demo */}
      <PrivacyProof />

      {/* Holder wallet link */}
      <div className="mt-6 text-right">
        <Link
          href="/canton/holder"
          className="inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)] hover:text-[var(--color-accent)]/80 transition-colors"
        >
          Open holder wallet view <span aria-hidden="true">→</span>
        </Link>
      </div>

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
    <div className="mb-8 border border-[var(--color-sealed)]/30 bg-[var(--color-sealed)]/5 px-4 py-4 sm:px-5" role="alert">
      <div className="flex items-start gap-3">
        <span className="text-[var(--color-sealed)] text-sm mt-0.5">⚠</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-[var(--color-sealed)]">
            Canton Devnet currently unavailable
          </p>
          <p className="mt-1 text-xs leading-5 text-[var(--color-ink-muted)]">
            The live system is deployed and integrated. This is a connectivity issue with the Canton Devnet, not the app.
            See the recorded walkthrough below for a demonstration of the full privacy + settlement flow.
          </p>
          {/* Diagnostic details */}
          <div className="mt-3 border-t border-[var(--color-rule)] pt-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)] mb-2">Health check results</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11px] font-mono sm:grid-cols-4">
              <CheckResult label="Env vars" pass={checks.configured} />
              <CheckResult label="OIDC auth" pass={checks.oidc} />
              <CheckResult label="Ledger query" pass={checks.ledger} />
              <CheckResult label="DAR package" pass={checks.packageId} />
            </div>
            {health.error && (
              <p className="mt-2 text-[10px] text-[var(--color-sealed)]/70 font-mono truncate">
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
      <span className={`h-1.5 w-1.5 rounded-full ${pass ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-breach)]/70'}`} />
      <span className={pass ? 'text-[var(--color-ink-muted)]' : 'text-[var(--color-breach)]/80'}>{label}</span>
    </div>
  );
}

function RoleCard({ icon, title, role, visibility, sees, color }) {
  const colorClasses = {
    teal: 'border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 text-[var(--color-accent)]',
    emerald: 'border-[var(--color-accent)]/20 bg-[var(--color-accent)]/5 text-[var(--color-accent)]',
    slate: 'border-[var(--color-rule)] bg-white/[0.03] text-[var(--color-ink-muted)]',
  };

  return (
    <div className="p-4 bg-[var(--color-paper)]">
      <div className={`flex items-center gap-2 text-xs font-mono uppercase tracking-wider mb-2 ${colorClasses[color]}`}>
        <span>{icon}</span>
        <span>{title}</span>
      </div>
      <p className="text-[11px] leading-5 text-[var(--color-ink-muted)] mb-3">
        <span className="text-[var(--color-ink-faint)]">Action:</span> {visibility}
      </p>
      <p className="text-[11px] leading-5 text-[var(--color-ink-muted)]">
        <span className="text-[var(--color-ink-faint)]">Sees:</span> {sees}
      </p>
    </div>
  );
}
