'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowUpRight, Fingerprint, Lock, ShieldCheck, X } from 'lucide-react';

/* --------------------------------------------------------------------------
   Decision Dossier — one judge-friendly explanation of a complete decision.

   Opens as a right-side drawer from Mandate Control. Fetches the canonical
   /api/worldcup/verify chain (receipt → TxLINE proof → Solana validation →
   reconciliation) and answers the five questions an allocator would ask,
   in order. The full JSON remains available behind "View raw receipt."
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

export function DecisionDossier({ fixtureId, fixture, onClose }) {
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [showRaw, setShowRaw] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/worldcup/verify?fixtureId=${encodeURIComponent(fixtureId)}`, { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Verification unavailable');
      setState({ loading: false, data, error: null });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [fixtureId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  const receipt = state.data?.receipt || {};
  const decision = receipt.decision || {};
  const simulation = receipt.simulation || {};
  const integrity = receipt.integrity || {};
  const forecast = receipt.decisions?.[0]?.forecast || {};
  const reconciliation = state.data?.reconciliation || {};
  const verification = state.data?.verification || {};
  const proof = state.data?.proof || {};
  const outcome = reconciliation.outcome || {};
  const comparison = reconciliation.decisionVsOutcome || {};
  const adherence = reconciliation.adherence || {};
  const recIntegrity = reconciliation.integrity || {};

  const verdict = (decision.verdict || 'REVIEW').toUpperCase();
  const verdictStamp =
    verdict === 'ALLOCATE' ? 'mc-stamp--allocate' :
    verdict === 'PASS' ? 'mc-stamp--pass' :
    verdict === 'BREACH' ? 'mc-stamp--breach' : 'mc-stamp--review';

  const headline = fixture
    ? `${fixture.home?.name || 'Home'} v ${fixture.away?.name || 'Away'}`
    : `Fixture ${fixtureId}`;

  return (
    <>
      <div className="mc-drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside
        className="mc-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dossier-heading"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-[var(--mc-rule)] bg-[var(--mc-panel)] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="mc-kicker">Decision dossier · {fixtureId}</span>
              <h2 id="dossier-heading" className="fc-display mt-2 font-display text-xl font-semibold tracking-tight text-white">
                {headline}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center border border-[var(--mc-rule)] text-white/55 transition hover:border-[var(--mc-rule-strong)] hover:text-white"
              aria-label="Close decision dossier"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className={`mc-stamp ${verdictStamp}`}>{verdict}</span>
            {decision.allocationPct > 0 && (
              <span className="font-mono text-[11px] text-white/70">
                {pct(decision.allocationPct)} of capital
              </span>
            )}
            {recIntegrity.receiptIntact && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--mc-reconciled)]/80">
                <Fingerprint className="h-3 w-3" /> receipt intact
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-5">
          {state.loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-20 animate-pulse border border-[var(--mc-rule)] bg-[var(--mc-panel-ink)]" />
              ))}
            </div>
          )}

          {state.error && (
            <p className="border border-[var(--mc-breach)]/30 bg-[var(--mc-breach)]/10 p-3 font-mono text-[11px] text-[var(--mc-breach)]">
              {state.error}
            </p>
          )}

          {!state.loading && !state.error && (
            <>
              {/* 1. What did the agent know? */}
              <DossierBlock index="01" kicker="What did the agent know?">
                <DossierRow label="Evidence sources" value={(receipt.evidence?.sources || ['txline']).join(' · ')} />
                <DossierRow label="Snapshot captured" value={formatTime(receipt.evidence?.snapshot?.capturedAt)} />
                <DossierRow label="Consensus · home" value={pct(receipt.evidence?.snapshot?.consensusOdds?.implied?.home)} />
                <DossierRow label="Consensus · draw" value={pct(receipt.evidence?.snapshot?.consensusOdds?.implied?.draw)} />
                <DossierRow label="Consensus · away" value={pct(receipt.evidence?.snapshot?.consensusOdds?.implied?.away)} />
                <DossierRow label="Fair probability" value={pct(forecast.probability ?? simulation.winProbability)} />
                <DossierRow label="Market odds" value={pct(forecast.marketOdds)} accent />
              </DossierBlock>

              {/* 2. What did it decide? */}
              <DossierBlock index="02" kicker="What did it decide?">
                <p className="text-sm leading-6 text-white/80">{decision.rationale || 'Decision rationale unavailable.'}</p>
                <div className="mt-3 grid grid-cols-3 gap-px border border-[var(--mc-rule)] bg-[var(--mc-rule)]">
                  <DossierMetric label="Verdict" value={verdict} />
                  <DossierMetric label="Allocation" value={pct(decision.allocationPct)} />
                  <DossierMetric label="Edge" value={pct(forecast.edge)} />
                </div>
                <div className="mt-3">
                  <p className="mc-kicker mb-2">Simulation · {simulation.runs?.toLocaleString() || '—'} seeded paths</p>
                  <SimulationRange simulation={simulation} />
                </div>
              </DossierBlock>

              {/* 3. What prevented it from overreaching? */}
              <DossierBlock index="03" kicker="What prevented it from overreaching?">
                <p className="mb-3 text-xs leading-5 text-white/55">
                  Policy <span className="font-mono text-white/75">{receipt.policy?.version || 'decision-policy/v1'}</span> — every gate must clear before capital moves.
                </p>
                <ul className="space-y-2">
                  {(decision.riskChecks || []).map((gate) => (
                    <RiskGate key={gate.id} gate={gate} />
                  ))}
                  {decision.riskChecks?.length === 0 && (
                    <li className="font-mono text-[11px] text-white/40">No risk checks recorded on this receipt.</li>
                  )}
                </ul>
              </DossierBlock>

              {/* 4. When was the result unavailable? */}
              <DossierBlock index="04" kicker="When was the result unavailable?">
                <div className="flex items-start gap-2">
                  <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--mc-sealed)]" />
                  <p className="text-sm leading-6 text-white/75">
                    Receipt sealed at <span className="font-mono text-white/90">{formatTime(receipt.createdAt)}</span>.
                    Outcome remained locked until <span className="font-mono text-white/90">{formatTime(receipt.evidence?.historicalReplay?.outcomeAvailableAt)}</span>.
                  </p>
                </div>
                <p className="mt-2 text-xs leading-5 text-white/50">
                  The agent could not read the final score when it decided. The proof was revealed only after the replay clock crossed settlement — a lookahead guard asserts this on every receipt.
                </p>
              </DossierBlock>

              {/* 5. What later verified the decision? */}
              <DossierBlock index="05" kicker="What later verified the decision?">
                <DossierRow label="Outcome" value={outcome.homeScore != null ? `${outcome.homeScore}–${outcome.awayScore} · ${outcome.winner || '—'}` : 'pending'} />
                <DossierRow label="Reconciliation" value={(reconciliation.status || 'pending').replace(/_/g, ' ')} accent={reconciliation.status === 'reconciled'} />
                <DossierRow label="Policy adherence" value={adherence.policyAdhered == null ? '—' : (adherence.policyAdhered ? 'adhered' : 'exception')} accent={adherence.policyAdhered === true} />
                <DossierRow label="Calibration error" value={adherence.calibrationError != null ? adherence.calibrationError.toFixed(3) : '—'} />
                <DossierRow label="Decision vs outcome" value={comparison.notes || '—'} />
                <div className="mt-3 border-t border-[var(--mc-rule)] pt-3">
                  <p className="mc-kicker mb-2">TxLINE proof · Solana anchor</p>
                  <DossierRow label="Merkle root" value={proof.merkleRoot ? `${proof.merkleRoot.slice(0, 18)}…` : '—'} mono />
                  <DossierRow label="On-chain verdict" value={verification.verdict || '—'} accent={verification.verdict === 'verified' || verification.verdict === 'proof-present'} />
                  <DossierRow label="Receipt hash" value={recIntegrity.receiptHash || integrity.contentHash || '—'} mono />
                  {verification.explorerUrl && (
                    <a
                      href={verification.explorerUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 font-mono text-[10px] text-[var(--mc-reconciled)]/85 underline decoration-[var(--mc-reconciled)]/40 underline-offset-4 hover:text-white"
                    >
                      View PDA on Solana explorer <ArrowUpRight className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </DossierBlock>

              {/* Raw receipt toggle */}
              <hr className="mc-rule mt-6" />
              <button
                type="button"
                className="mc-action mt-4 w-full"
                onClick={() => setShowRaw((v) => !v)}
                aria-expanded={showRaw}
              >
                {showRaw ? 'Hide raw receipt' : 'View raw receipt'}
              </button>
              {showRaw && (
                <pre className="mt-3 max-h-96 overflow-auto border border-[var(--mc-rule)] bg-black/40 p-3 font-mono text-[10px] leading-4 text-white/65">
                  {JSON.stringify(state.data, null, 2)}
                </pre>
              )}

              <div className="mt-6 flex flex-wrap gap-3">
                <a
                  className="mc-action mc-action--primary"
                  href={`/api/worldcup/verify?fixtureId=${encodeURIComponent(fixtureId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Open full verification
                  <ArrowUpRight className="h-3 w-3" />
                </a>
                <a
                  className="mc-action"
                  href={`/world-cup?fixture=${encodeURIComponent(fixtureId)}`}
                >
                  View in proof theatre
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
}

/* --------------------------------- atoms --------------------------------- */

function DossierBlock({ index, kicker, children }) {
  return (
    <section className="mt-5 first:mt-0">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-[10px] text-[var(--mc-reconciled)]/70">{index}</span>
        <span className="mc-kicker">{kicker}</span>
      </div>
      <hr className="mc-rule mt-2" />
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DossierRow({ label, value, mono = false, accent = false }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-[var(--mc-rule)]/60 py-1.5 last:border-0">
      <span className="text-[11px] text-white/45">{label}</span>
      <span className={`text-[12px] text-right ${accent ? 'text-[var(--mc-reconciled)]' : 'text-white/80'} ${mono ? 'font-mono' : ''}`}>
        {value}
      </span>
    </div>
  );
}

function DossierMetric({ label, value }) {
  return (
    <div className="bg-black/30 px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-wider text-white/40">{label}</p>
      <p className="mt-1 font-mono text-sm text-white/85">{value}</p>
    </div>
  );
}

function RiskGate({ gate }) {
  const passed = gate.passed;
  return (
    <li className="flex items-start gap-2.5">
      <span
        className="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center border font-mono text-[9px]"
        style={{
          borderColor: passed ? 'var(--mc-reconciled)' : 'var(--mc-breach)',
          color: passed ? 'var(--mc-reconciled)' : 'var(--mc-breach)',
          background: passed ? 'rgba(121,245,183,0.08)' : 'rgba(255,122,111,0.08)',
        }}
      >
        {passed ? '✓' : '✕'}
      </span>
      <div className="min-w-0">
        <p className={`font-mono text-[10px] uppercase tracking-wider ${passed ? 'text-white/65' : 'text-[var(--mc-breach)]'}`}>
          {gate.label || gate.id}
        </p>
        <p className="text-[11px] leading-4 text-white/50">{gate.description}</p>
      </div>
    </li>
  );
}

function SimulationRange({ simulation }) {
  if (!simulation || simulation.valid === false || !simulation.interval) {
    return <p className="font-mono text-[10px] text-white/40">Simulation interval unavailable.</p>;
  }
  const { p05, p50, p95 } = simulation.interval;
  return (
    <div>
      <div className="flex items-center justify-between font-mono text-[9px] uppercase tracking-wider text-white/40">
        <span>seed {simulation.seed ?? '—'}</span>
        <span>loss {pct(simulation.lossProbability)}</span>
      </div>
      <div className="mt-1 flex items-center gap-1 font-mono text-[10px]">
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
