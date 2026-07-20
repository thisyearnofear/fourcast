'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Database, Fingerprint, Lock, ShieldCheck, X } from 'lucide-react';

/* --------------------------------------------------------------------------
   Proof Theatre — the final act of a decision, not a sports-data utility.

   Given a selected fixture, this panel renders the vertical evidence
   timeline that makes the on-chain distinction obvious:

     1. Pre-match evidence and consensus odds
     2. Seeded simulation output
     3. Versioned policy gates (including failures)
     4. Immutable decision receipt
     5. TxLINE Merkle proof + Solana validation
     6. Reconciliation: decision quality, policy adherence, calibration

   Composed entirely from /api/worldcup/verify — no parallel data model.
   -------------------------------------------------------------------------- */

function formatTime(value) {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat('en', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function pct(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  return `${(p * 100).toFixed(1)}%`;
}

export function ProofTheatre({ fixture, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });

  const load = useCallback(async () => {
    if (!fixture?.id) return;
    try {
      const res = await fetch(`/api/worldcup/verify?fixtureId=${encodeURIComponent(fixture.id)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Verification unavailable');
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [fixture?.id]);

  useEffect(() => { load(); }, [load]);

  const receipt = state.data?.receipt || {};
  const decision = receipt.decision || {};
  const simulation = receipt.simulation || {};
  const forecast = receipt.decisions?.[0]?.forecast || {};
  const integrity = receipt.integrity || {};
  const reconciliation = state.data?.reconciliation || {};
  const verification = state.data?.verification || {};
  const proof = state.data?.proof || {};
  const outcome = reconciliation.outcome || {};
  const comparison = reconciliation.decisionVsOutcome || {};
  const adherence = reconciliation.adherence || {};
  const recIntegrity = reconciliation.integrity || {};

  const verdict = (decision.verdict || 'REVIEW').toUpperCase();
  const reconciled = reconciliation.status === 'reconciled';

  const stages = [
    { key: 'evidence', label: 'Pre-match evidence', detail: 'TxLINE consensus + cross-venue prices recorded pre-match' },
    { key: 'simulation', label: 'Seeded simulation', detail: 'Monte Carlo over the agent fair probability' },
    { key: 'policy', label: 'Versioned policy gates', detail: 'every gate must clear before capital moves' },
    { key: 'receipt', label: 'Immutable decision receipt', detail: 'evidence + policy + simulation bound into one hash' },
    { key: 'proof', label: 'TxLINE Merkle proof + Solana validation', detail: 'on-chain anchor of the finalised stat' },
    { key: 'reconcile', label: 'Reconciliation', detail: 'decision quality, policy adherence, calibration' },
  ];

  return (
    <section className="mc-panel relative overflow-hidden" aria-labelledby="proof-theatre-heading">
      <div className="pointer-events-none absolute inset-0 mc-grid--sparse opacity-[0.3]" aria-hidden="true" />

      {/* Header */}
      <div className="relative flex flex-wrap items-start justify-between gap-3 border-b border-[var(--mc-rule)] px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <span className="mc-kicker">Proof theatre · {fixture?.id}</span>
          <h2 id="proof-theatre-heading" className="fc-display mt-2 font-display text-xl font-semibold tracking-tight text-white sm:text-2xl">
            {fixture ? `${fixture.home?.name} v ${fixture.away?.name}` : 'Selected fixture'}
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/55">
            The final act of an autonomous decision — from sealed evidence to independently verifiable outcome. Fourcast doesn&apos;t ask you to trust a chart; it asks you to recompute the receipt.
          </p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[var(--mc-rule)] text-white/55 transition hover:border-[var(--mc-rule-strong)] hover:text-white"
            aria-label="Close proof theatre"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="relative px-4 py-5 sm:px-6">
        {state.loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 animate-pulse border border-[var(--mc-rule)] bg-[var(--mc-panel-ink)]" />
            ))}
          </div>
        )}

        {state.error && (
          <p className="border border-[var(--mc-breach)]/30 bg-[var(--mc-breach)]/10 p-3 font-mono text-[11px] text-[var(--mc-breach)]">
            {state.error}
          </p>
        )}

        {!state.loading && !state.error && (
          <ol className="relative">
            {/* Vertical spine */}
            <span className="absolute left-[11px] top-2 bottom-2 w-px bg-[var(--mc-rule)]" aria-hidden="true" />

            {/* 1. Pre-match evidence */}
            <TheatreStage index="01" stage={stages[0]} color="var(--mc-evidence)">
              <div className="grid grid-cols-3 gap-px border border-[var(--mc-rule)] bg-[var(--mc-rule)]">
                <TheatreMetric label={fixture?.home?.code || 'HOME'} value={pct(receipt.evidence?.snapshot?.consensusOdds?.implied?.home)} />
                <TheatreMetric label="DRAW" value={pct(receipt.evidence?.snapshot?.consensusOdds?.implied?.draw)} />
                <TheatreMetric label={fixture?.away?.code || 'AWAY'} value={pct(receipt.evidence?.snapshot?.consensusOdds?.implied?.away)} />
              </div>
              <p className="mt-2 font-mono text-[10px] text-white/45">
                captured {formatTime(receipt.evidence?.snapshot?.capturedAt)} · sources {(receipt.evidence?.sources || ['txline']).join(' + ')}
              </p>
            </TheatreStage>

            {/* 2. Seeded simulation */}
            <TheatreStage index="02" stage={stages[1]} color="var(--mc-evidence)">
              <p className="font-mono text-[11px] text-white/70">
                {simulation.runs?.toLocaleString() || '—'} seeded paths · seed <span className="text-white/90">{simulation.seed ?? '—'}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 font-mono text-[10px] text-white/55">
                <span>win {pct(simulation.winProbability)}</span>
                <span>loss {pct(simulation.lossProbability)}</span>
                <span>fair {pct(forecast.probability)}</span>
                <span>edge {pct(forecast.edge)}</span>
              </div>
              <SimulationRange simulation={simulation} />
            </TheatreStage>

            {/* 3. Versioned policy gates */}
            <TheatreStage index="03" stage={stages[2]} color={verdict === 'ALLOCATE' ? 'var(--mc-reconciled)' : 'var(--mc-sealed)'}>
              <p className="mb-2 font-mono text-[10px] text-white/45">
                policy {receipt.policy?.version || 'decision-policy/v1'} · max {(receipt.policy?.maxAllocationPct * 100).toFixed(1)}% · min edge {(receipt.policy?.minAbsoluteEdge * 100).toFixed(0)}% · tail ≤ {(receipt.policy?.maxLossProbability * 100).toFixed(0)}%
              </p>
              <ul className="space-y-1.5">
                {(decision.riskChecks || []).map((gate) => (
                  <li key={gate.id} className="flex items-start gap-2">
                    <span
                      className="mt-0.5 inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center border font-mono text-[8px]"
                      style={{
                        borderColor: gate.passed ? 'var(--mc-reconciled)' : 'var(--mc-breach)',
                        color: gate.passed ? 'var(--mc-reconciled)' : 'var(--mc-breach)',
                      }}
                    >
                      {gate.passed ? '✓' : '✕'}
                    </span>
                    <span className={`font-mono text-[10px] uppercase tracking-wider ${gate.passed ? 'text-white/60' : 'text-[var(--mc-breach)]'}`}>
                      {gate.label || gate.id}
                    </span>
                  </li>
                ))}
                {decision.riskChecks?.length === 0 && (
                  <li className="font-mono text-[10px] text-white/40">No risk checks recorded.</li>
                )}
              </ul>
            </TheatreStage>

            {/* 4. Immutable decision receipt */}
            <TheatreStage index="04" stage={stages[3]} color="var(--mc-sealed)">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`mc-stamp mc-seal-animate ${verdict === 'ALLOCATE' ? 'mc-stamp--allocate' : verdict === 'PASS' ? 'mc-stamp--pass' : 'mc-stamp--review'}`}>{verdict}</span>
                {decision.allocationPct > 0 && <span className="font-mono text-[11px] text-white/70">{pct(decision.allocationPct)} of capital</span>}
              </div>
              <p className="mt-2 text-xs leading-5 text-white/70">{decision.rationale}</p>
              <div className="mt-2 flex items-start gap-2 font-mono text-[10px] text-white/45">
                <Lock className="mt-0.5 h-3 w-3 shrink-0 text-[var(--mc-sealed)]" />
                sealed {formatTime(receipt.createdAt)} — outcome locked until {formatTime(receipt.evidence?.historicalReplay?.outcomeAvailableAt)}
              </div>
              <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-white/55">
                <Fingerprint className="h-3 w-3 text-[var(--mc-reconciled)]/70" />
                <span className="break-all mc-seal-animate">{integrity.contentHash || recIntegrity.receiptHash || '—'}</span>
              </div>
            </TheatreStage>

            {/* 5. TxLINE Merkle proof + Solana validation */}
            <TheatreStage index="05" stage={stages[4]} color={verification.verdict === 'verified' || verification.verdict === 'proof-present' ? 'var(--mc-reconciled)' : 'var(--mc-sealed)'}>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] text-white/55">
                <span>Merkle root <span className="text-white/80">{proof.merkleRoot ? `${proof.merkleRoot.slice(0, 16)}…` : '—'}</span></span>
                <span>seq <span className="text-white/80">{proof.sequence ?? '—'}</span></span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`mc-stamp ${(verification.verdict === 'verified' || verification.verdict === 'proof-present') ? 'mc-signal-animate' : ''}`}
                  style={{
                    color: verification.verdict === 'verified' || verification.verdict === 'proof-present' ? 'var(--mc-reconciled)' : verification.verdict?.includes('error') ? 'var(--mc-breach)' : 'var(--mc-sealed)',
                    background: verification.verdict === 'verified' || verification.verdict === 'proof-present' ? 'rgba(121,245,183,0.08)' : 'rgba(245,197,107,0.08)',
                  }}
                >
                  Solana · {verification.verdict || 'pending'}
                </span>
                {verification.explorerUrl && (
                  <a href={verification.explorerUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--mc-reconciled)]/85 underline decoration-[var(--mc-reconciled)]/40 underline-offset-4 hover:text-white">
                    <Database className="h-3 w-3" /> PDA <ArrowUpRight className="h-3 w-3" />
                  </a>
                )}
              </div>
              {(verification.checks || []).length > 0 && (
                <ul className="mt-2 space-y-1">
                  {verification.checks.map((c) => (
                    <li key={c.name} className="flex items-start gap-2 font-mono text-[10px]">
                      <span className={`mt-0.5 inline-block h-1.5 w-1.5 ${c.ok === true ? 'bg-[var(--mc-reconciled)]' : c.ok === false ? 'bg-[var(--mc-breach)]' : 'bg-white/30'}`} />
                      <span className="text-white/70">{c.name}</span>
                      {c.detail && <span className="text-white/40"> — {c.detail}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </TheatreStage>

            {/* 6. Reconciliation */}
            <TheatreStage index="06" stage={stages[5]} color={reconciled ? 'var(--mc-reconciled)' : 'var(--mc-sealed)'} last>
              {reconciled && <div className="mc-proof-flash mb-2" />}
              <div className="grid grid-cols-2 gap-px border border-[var(--mc-rule)] bg-[var(--mc-rule)] sm:grid-cols-4">
                <TheatreMetric label="Outcome" value={outcome.homeScore != null ? `${outcome.homeScore}–${outcome.awayScore}` : 'pending'} />
                <TheatreMetric label="Reconciliation" value={(reconciliation.status || 'pending').replace(/_/g, ' ')} accent={reconciled} />
                <TheatreMetric label="Policy" value={adherence.policyAdhered == null ? '—' : (adherence.policyAdhered ? 'adhered' : 'exception')} accent={adherence.policyAdhered === true} />
                <TheatreMetric label="Calibration" value={adherence.calibrationError != null ? adherence.calibrationError.toFixed(3) : '—'} />
              </div>
              {comparison.notes && <p className="mt-2 text-xs leading-5 text-white/65">{comparison.notes}</p>}
              {recIntegrity.receiptIntact !== undefined && (
                <p className="mt-2 flex items-center gap-1.5 font-mono text-[10px] text-white/45">
                  <ShieldCheck className={`h-3 w-3 ${recIntegrity.receiptIntact ? 'text-[var(--mc-reconciled)]/70' : 'text-[var(--mc-breach)]/70'}`} />
                  {recIntegrity.receiptIntact ? 'SHA-256 receipt intact — recompute it yourself.' : 'Receipt integrity check failed.'}
                </p>
              )}
            </TheatreStage>
          </ol>
        )}
      </div>
    </section>
  );
}

/* --------------------------------- atoms --------------------------------- */

function TheatreStage({ index, stage, color, last = false, children }) {
  return (
    <li className="relative pl-9 pb-6 last:pb-0">
      <span
        className="absolute left-0 top-0.5 inline-flex h-6 w-6 items-center justify-center border font-mono text-[10px]"
        style={{ borderColor: color, color, background: `${color === 'var(--mc-reconciled)' ? 'rgba(121,245,183,0.08)' : color === 'var(--mc-evidence)' ? 'rgba(91,156,255,0.08)' : 'rgba(245,197,107,0.08)'}` }}
      >
        {index}
      </span>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-white/80">{stage.label}</p>
      <p className="mt-0.5 text-[10px] leading-4 text-white/40">{stage.detail}</p>
      <div className="mt-2.5">{children}</div>
    </li>
  );
}

function TheatreMetric({ label, value, accent = false }) {
  return (
    <div className="bg-black/30 px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p className={`mt-1 font-mono text-sm ${accent ? 'text-[var(--mc-reconciled)]' : 'text-white/85'}`}>{value}</p>
    </div>
  );
}

function SimulationRange({ simulation }) {
  if (!simulation || simulation.valid === false || !simulation.interval) return null;
  const { p05, p50, p95 } = simulation.interval;
  return (
    <div className="mt-2">
      <div className="flex items-center gap-1 font-mono text-[10px]">
        <span className="text-[var(--mc-breach)]/80">{p05 > 0 ? '+' : ''}{p05?.toFixed(2)}</span>
        <div className="relative h-1 flex-1 bg-white/10">
          <div className="absolute inset-y-0 bg-gradient-to-r from-[var(--mc-breach)]/60 via-white/40 to-[var(--mc-reconciled)]/70" style={{ left: '15%', right: '10%' }} />
          <div className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-white/80" style={{ left: '50%' }} />
        </div>
        <span className="text-[var(--mc-reconciled)]/90">+{p95?.toFixed(2)}</span>
      </div>
      <p className="mt-0.5 font-mono text-[9px] text-white/35">p05 / median {p50 > 0 ? '+' : ''}{p50?.toFixed(2)} / p95 · per unit staked</p>
    </div>
  );
}
