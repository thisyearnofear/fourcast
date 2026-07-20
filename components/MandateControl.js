'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, FileSearch, Lock, Radio, RefreshCw, ShieldCheck } from 'lucide-react';
import { DecisionDossier } from '@/components/DecisionDossier';

/* --------------------------------------------------------------------------
   Mandate Control — flagship surface for /agent.

   The hero is driven by the real VPS heartbeat (/api/agent/historical-lab)
   and the latest sealed receipt, not by a manual run button. It composes the
   canonical receipt/policy/reconciliation data — no parallel data model.

   The one memorable detail is the proof timeline visibly crossing from
   "outcome withheld" into "proof available".
   -------------------------------------------------------------------------- */

const VERDICT_META = {
  allocate: { label: 'ALLOCATE', stamp: 'mc-stamp--allocate', lamp: 'var(--mc-reconciled)' },
  pass: { label: 'PASS', stamp: 'mc-stamp--pass', lamp: 'var(--mc-sealed)' },
  review: { label: 'REVIEW', stamp: 'mc-stamp--review', lamp: 'var(--mc-review)' },
};

const PROOF_STAGES = [
  { key: 'sealed', label: 'Evidence sealed', detail: 'pre-match odds snapshot' },
  { key: 'simulation', label: 'Simulation', detail: 'seeded Monte Carlo' },
  { key: 'policy', label: 'Policy gate', detail: 'versioned risk checks' },
  { key: 'receipt', label: 'Receipt', detail: 'hash-bound dossier' },
  { key: 'proof', label: 'TxLINE proof', detail: 'Merkle + Solana anchor' },
];

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

function relativeClock(agentTime) {
  if (!agentTime) return 'cold start';
  const diffMs = Date.now() - new Date(agentTime).getTime();
  if (!Number.isFinite(diffMs)) return '—';
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

export function MandateControl() {
  const [lab, setLab] = useState({ loading: true, status: null, verification: null, error: null });
  const [fixtures, setFixtures] = useState({});
  const [dossier, setDossier] = useState(null); // { fixtureId } | null

  const load = useCallback(async () => {
    try {
      const labRes = await fetch('/api/agent/historical-lab', { cache: 'no-store' });
      const labData = await labRes.json();
      if (!labRes.ok || !labData.success) throw new Error(labData.error || 'Status unavailable');

      // Eagerly fetch the canonical verification chain for the latest receipt
      // so the hero's proof timeline shows real reconciliation data — not just
      // the heartbeat's self-reported phase. Falls back silently if the
      // fixture has no proof yet (pre-decision / waiting phase).
      const latest = labData.status?.receipts?.find((r) => r?.verdict) || labData.status?.receipts?.[0] || null;
      let verification = null;
      if (latest?.fixtureId) {
        try {
          const proofRes = await fetch(`/api/worldcup/verify?fixtureId=${encodeURIComponent(latest.fixtureId)}`, { cache: 'no-store' });
          if (proofRes.ok) {
            const proofData = await proofRes.json();
            if (proofData.success) verification = proofData;
          }
        } catch {
          /* verification is a strengthening signal, not a hard dependency */
        }
      }

      setLab({ loading: false, status: labData.status, verification, error: null });

      // Fixture names are best-effort enrichment for the headline.
      try {
        const fxRes = await fetch('/api/worldcup/fixtures', { cache: 'no-store' });
        if (fxRes.ok) {
          const fxData = await fxRes.json();
          const map = {};
          for (const fx of fxData.fixtures || []) map[String(fx.id)] = fx;
          setFixtures(map);
        }
      } catch {
        /* fixture names are cosmetic; the receipt carries fixtureId */
      }
    } catch (error) {
      setLab((prev) => ({ ...prev, loading: false, error: error.message }));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [load]);

  const latest = lab.status?.receipts?.find((r) => r?.verdict) || lab.status?.receipts?.[0] || null;
  const fixture = latest ? fixtures[String(latest.fixtureId)] : null;
  const verdictKey = (latest?.verdict || '').toLowerCase();
  const verdict = VERDICT_META[verdictKey] || VERDICT_META.review;
  const timeline = latest?.timeline;
  const policy = lab.status?.policy || lab.verification?.receipt?.policy || null;
  const reconciliationStatus = latest?.reconciliationStatus || lab.verification?.reconciliation?.status;
  const reconciled = Boolean(
    (reconciliationStatus && reconciliationStatus === 'reconciled') ||
    lab.verification?.reconciliation?.status === 'reconciled',
  );
  const verificationVerdict = lab.verification?.verification?.verdict || null;

  const headline = fixture
    ? `${fixture.home?.name || 'Home'} v ${fixture.away?.name || 'Away'}`
    : latest?.fixtureId
      ? `Fixture ${latest.fixtureId}`
      : 'Awaiting first mandate';

  const mandateId = latest?.fixtureId ? `#WC-${latest.fixtureId.slice(-4)}` : '#WC-—';
  const allocationPct = latest?.allocationPct != null ? (latest.allocationPct * 100).toFixed(1) : '0.0';

  // Proof timeline stage resolution — the crossing from "outcome withheld"
  // into "proof available" is the one animated detail. The eager verification
  // fetch feeds real reconciliation + Solana verdict into the proof stage.
  const stages = useMemo(
    () => resolveStages({ latest, timeline, reconciled, verificationVerdict, verification: lab.verification }),
    [latest, timeline, reconciled, verificationVerdict, lab.verification],
  );
  const livePct = stages.length ? (stages.filter((s) => s.state === 'complete').length / stages.length) * 100 : 0;

  return (
    <section className="platform-workbench relative overflow-hidden" aria-labelledby="mandate-control-heading">
      {/* Sparse hairline grid — mission-control graph paper, not decoration. */}
      <div className="pointer-events-none absolute inset-0 mc-grid--sparse opacity-[0.35]" aria-hidden="true" />

      {/* Header row */}
      <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-[var(--mc-rule)] px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="mc-kicker">Mandate Control</span>
          <span
            className={`inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.16em] ${
              lab.status ? 'text-[var(--mc-reconciled)]' : 'text-white/40'
            }`}
          >
            <Radio className={`h-3 w-3 ${lab.status ? 'animate-pulse' : ''}`} />
            {lab.status ? (lab.status.dryRun ? 'Agent live · historical replay' : 'Agent live') : 'Agent offline'}
          </span>
        </div>
        <div className="flex items-center gap-3 font-mono text-[10px] text-white/45">
          <span>replay clock {formatTime(lab.status?.agentTime)}</span>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">{relativeClock(lab.status?.agentTime)}</span>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-7 w-7 items-center justify-center border border-[var(--mc-rule)] text-white/55 transition hover:border-[var(--mc-rule-strong)] hover:text-white"
            aria-label="Refresh mandate control status"
          >
            <RefreshCw className={`h-3 w-3 ${lab.loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Hero composition — one current decision */}
      <div className="relative px-4 py-8 sm:px-6 sm:py-10">
        {lab.error && (
          <p className="mb-5 border border-[var(--mc-breach)]/30 bg-[var(--mc-breach)]/10 p-3 font-mono text-[11px] text-[var(--mc-breach)]">
            {lab.error}
          </p>
        )}

        {!lab.loading && !lab.error && !lab.status && (
          <div className="py-10 text-center">
            <Lock className="mx-auto h-6 w-6 text-white/30" />
            <p className="mt-3 font-mono text-[11px] leading-5 text-white/45">
              Worker has not checked in yet. The lab remains private until its first signed heartbeat.
            </p>
          </div>
        )}

        {lab.status && (
          <>
            {/* Decision headline */}
            <div className="flex flex-col gap-1">
              <span className="mc-kicker">Current mandate · {mandateId}</span>
              <h2
                id="mandate-control-heading"
                className="fc-display mt-2 font-display text-3xl font-semibold leading-[1.05] tracking-tight text-white sm:text-4xl"
              >
                {headline}
              </h2>
            </div>

            {/* Verdict + capital posture */}
            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
              <div className="flex items-center gap-2.5">
                <span className={`mc-lamp mc-lamp--radar`} style={{ color: verdict.lamp }} aria-hidden="true" />
                <span className={`mc-stamp ${verdict.stamp}`}>{verdict.label}</span>
                {verdictKey === 'allocate' && (
                  <span className="font-mono text-sm text-white/75">
                    {allocationPct}% of capital
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-white/55">
                <span>
                  <span className="text-white/35">max </span>
                  <span className="text-white/80">{policy ? `${(policy.maxAllocationPct * 100).toFixed(1)}%` : '2.5%'}</span>
                </span>
                <span>
                  <span className="text-white/35">min edge </span>
                  <span className="text-white/80">{policy ? `${(policy.minAbsoluteEdge * 100).toFixed(0)}%` : '5%'}</span>
                </span>
                <span>
                  <span className="text-white/35">tail ≤ </span>
                  <span className="text-white/80">{policy ? `${(policy.maxLossProbability * 100).toFixed(0)}%` : '75%'}</span>
                </span>
              </div>
            </div>

            {/* Claim of restraint */}
            <p className="mt-5 max-w-2xl text-sm leading-6 text-white/60">
              <Lock className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px text-[var(--mc-sealed)]" />
              Outcome withheld at decision time; proof revealed after settlement.
            </p>

            {/* Proof timeline — the one memorable composition */}
            <div className="mt-8">
              <div className="mc-kicker mb-3">Proof timeline · chain of custody</div>
              <ProofTimeline stages={stages} livePct={livePct} timeline={timeline} reconciled={reconciled} />
            </div>

            {/* Two actions only */}
            {latest && (
              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="mc-action mc-action--primary"
                  onClick={() => setDossier({ fixtureId: latest.fixtureId })}
                >
                  <FileSearch className="h-3.5 w-3.5" />
                  Inspect decision dossier
                </button>
                <a
                  className="mc-action"
                  href={`/api/worldcup/verify?fixtureId=${encodeURIComponent(latest.fixtureId)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Verify independently
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* Operator telemetry strip — dense, mono, document-rule framed.
                The on-chain verdict is the real Solana result from the eager
                verification fetch, not a self-reported heartbeat field. */}
            <hr className="mc-rule mt-8" />
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-[10px] text-white/45 sm:grid-cols-4">
              <Telemetry label="Worker host" value={lab.status.hostname || '—'} />
              <Telemetry label="Last check-in" value={formatTime(lab.status.completedAt)} />
              <Telemetry label="Receipt hash" value={latest?.receiptHash ? `${latest.receiptHash.slice(0, 14)}…` : 'pending'} mono sealed={Boolean(latest?.receiptHash)} />
              <Telemetry
                label="On-chain verdict"
                value={verificationVerdict || 'awaiting proof'}
                accent={verificationVerdict === 'verified' || verificationVerdict === 'proof-present'}
              />
            </div>
          </>
        )}
      </div>

      {dossier && (
        <DecisionDossier
          fixtureId={dossier.fixtureId}
          fixture={fixture}
          onClose={() => setDossier(null)}
        />
      )}
    </section>
  );
}

/* ----------------------------- proof timeline ----------------------------- */

function resolveStages({ latest, timeline, reconciled, verificationVerdict, verification }) {
  if (!latest) return PROOF_STAGES.map((s) => ({ ...s, state: 'pending' }));
  const hasReceipt = Boolean(latest.receiptHash);
  // The proof stage is complete only when the canonical verifier confirms
  // reconciliation AND an on-chain Solana verdict. A heartbeat-only
  // reconciliationStatus is "live" (in flight), not "complete".
  const hasProof = reconciled && (verificationVerdict === 'verified' || verificationVerdict === 'proof-present');
  const proofInFlight = Boolean(latest.reconciliationStatus) || Boolean(verification);
  return PROOF_STAGES.map((stage) => {
    let state = 'pending';
    if (stage.key === 'sealed') state = hasReceipt || timeline?.decisionAvailableAt ? 'complete' : 'pending';
    if (stage.key === 'simulation') state = hasReceipt ? 'complete' : 'pending';
    if (stage.key === 'policy') state = hasReceipt ? (latest.verdict ? 'complete' : 'pending') : 'pending';
    if (stage.key === 'receipt') state = hasReceipt ? 'complete' : 'pending';
    if (stage.key === 'proof') state = hasProof ? 'complete' : (hasReceipt && proofInFlight ? 'live' : (hasReceipt ? 'live' : 'pending'));
    return { ...stage, state };
  });
}

function ProofTimeline({ stages, livePct, timeline, reconciled }) {
  return (
    <div className="evidence-strip p-4 sm:p-5">
      {/* Horizontal stage rail */}
      <ol className="grid grid-cols-5 gap-px">
        {stages.map((stage, i) => (
          <li key={stage.key} className="relative">
            <StageNode stage={stage} index={i} />
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wider text-white/70">{stage.label}</p>
            <p className="mt-0.5 text-[10px] leading-4 text-white/40">{stage.detail}</p>
            {stage.key === 'sealed' && timeline?.decisionAvailableAt && (
              <p className="mt-1 font-mono text-[9px] text-[var(--mc-sealed)]/80">{formatTime(timeline.decisionAvailableAt)}</p>
            )}
            {stage.key === 'proof' && timeline?.outcomeAvailableAt && (
              <p className={`mt-1 font-mono text-[9px] ${reconciled ? 'text-[var(--mc-reconciled)]/80' : 'text-white/40'}`}>
                {formatTime(timeline.outcomeAvailableAt)}
              </p>
            )}
          </li>
        ))}
      </ol>

      {/* The crossing — outcome withheld → proof available */}
      <div className="mt-5">
        <div className="mc-timeline-track">
          <div className="mc-timeline-track__progress" style={{ width: `${livePct}%` }} />
          {reconciled && <div className="mc-proof-flash absolute inset-0" />}
        </div>
        <div className="mt-2 flex items-center justify-between font-mono text-[9px] uppercase tracking-wider">
          <span className="text-[var(--mc-sealed)]/80">
            <Lock className="mr-1 inline h-2.5 w-2.5" />
            outcome withheld
          </span>
          <span className={reconciled ? 'text-[var(--mc-reconciled)]/90' : 'text-white/40'}>
            {reconciled ? (
              <>
                <ShieldCheck className="mr-1 inline h-2.5 w-2.5" />
                proof available · reconciled
              </>
            ) : (
              'proof available pending'
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

function StageNode({ stage, index }) {
  const color =
    stage.state === 'complete' ? 'var(--mc-reconciled)' :
    stage.state === 'live' ? 'var(--mc-evidence)' :
    stage.state === 'breach' ? 'var(--mc-breach)' : 'rgba(243,240,231,0.25)';
  return (
    <div className="flex items-center gap-2">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center border font-mono text-[9px] ${stage.state === 'live' ? 'animate-pulse' : ''}`}
        style={{ borderColor: color, color, background: stage.state === 'complete' ? 'rgba(121,245,183,0.08)' : 'transparent' }}
      >
        {stage.state === 'complete' ? '✓' : index + 1}
      </span>
    </div>
  );
}

function Telemetry({ label, value, mono = false, accent = false, sealed = false }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-[0.14em] text-white/35">{label}</p>
      <p
        className={`mt-1 text-[11px] ${accent ? 'text-[var(--mc-reconciled)]' : 'text-white/75'} ${mono ? 'font-mono' : ''} ${sealed ? 'mc-seal-animate' : ''}`}
      >
        {value}
      </p>
    </div>
  );
}
