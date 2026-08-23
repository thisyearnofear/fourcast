'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell, SecondaryNav } from '@/app/components/PageNav';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Clock,
  Database,
  Fingerprint,
  Play,
  Pause,
  RotateCcw,
  Shield,
  Zap,
} from 'lucide-react';
import OnChainSettlementPanel from '@/components/OnChainSettlementPanel';
import { ProofTheatre } from '@/components/ProofTheatre';
import RouteGuide from '@/components/RouteGuide';
import Reveal from '@/components/motion/Reveal';
import { useCountUp } from '@/hooks/useCountUp';
import GlowList from '@/components/ui/GlowList';

/* ------------------------------- helpers -------------------------------- */

function formatKickoff(iso) {
  if (!iso) return 'TBD';
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function pct(p) {
  if (p == null || !Number.isFinite(p)) return '—';
  return `${(p * 100).toFixed(1)}%`;
}

function StatusBadge({ status }) {
  const map = {
    live: { icon: CircleDot, label: 'LIVE', cls: 'mc-badge mc-badge--breach mc-lamp--radar' },
    final: { icon: CheckCircle2, label: 'FINAL', cls: 'mc-badge mc-badge--live' },
    scheduled: { icon: Clock, label: 'UPCOMING', cls: 'mc-badge' },
  };
  const s = map[status] || map.scheduled;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 ${s.cls}`}>
      <Icon size={11} />
      {s.label}
    </span>
  );
}

/* ---------------------------- cross-venue edge --------------------------- */

function EdgePanel({ fixture, onToggle }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/worldcup/edge?fixtureId=${encodeURIComponent(fixture.id)}`).then((r) => r.json());
      if (res.success) {
        setData(res.edge);
      } else {
        setError(res.error || 'Failed to load edge');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [fixture.id]);

  const poly = data?.polymarket;
  const edge = data?.edge;

  // Count-up the edge magnitude once the panel scrolls into view. The value
  // is a percentage (e.g. 5.2 means 5.2%); we animate from 0 and format the
  // eased value to one decimal place. Hook runs unconditionally (before the
  // early return) to respect the Rules of Hooks.
  const [edgeRef, edgeMagnitude] = useCountUp(edge?.magnitude ?? 0, { duration: 900 });

  if (!fixture.odds?.implied) return null;

  const verdictColor = !edge
    ? 'border-[var(--color-rule)] bg-white/[0.04] text-[var(--color-ink-muted)]'
    : Math.abs(edge.magnitude) >= 5
      ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/[0.08] text-[var(--color-accent)]'
      : 'border-[var(--color-rule)] bg-white/[0.04] text-[var(--color-ink-muted)]';

  return (
    <div className={`border ${verdictColor} p-3 space-y-2`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider font-semibold">
          <Activity size={12} />
          Cross-venue edge
        </div>
        <button
          onClick={loading ? undefined : () => { load(); onToggle?.(); }}
          disabled={loading}
          className="text-[10px] underline opacity-80 hover:opacity-100 disabled:opacity-50"
        >
          {loading ? 'Fetching…' : data ? 'Refresh' : 'Compare vs Polymarket'}
        </button>
      </div>

      {error && (
        <div className="text-[11px] text-[var(--color-breach)]">{error}</div>
      )}

      {!data && !loading && !error && (
        <div className="text-[11px] text-[var(--color-ink-faint)]">
          Click "Compare vs Polymarket" to check cross-venue pricing.
        </div>
      )}

      {data && !data.found && (
        <div className="space-y-2">
          <div className="text-[11px] text-[var(--color-ink-muted)] leading-snug">
            {data.reason}
          </div>
          {data.outrightContext && (data.outrightContext.homeYesPrice != null || data.outrightContext.awayYesPrice != null) && (
            <div className="bg-[var(--color-paper-deep)] border border-[var(--color-rule)] p-2 text-[10px] text-[var(--color-ink-muted)] leading-snug">
              <div className="text-[var(--color-ink)] font-medium mb-1">For context (outright winner YES prices):</div>
              <div className="font-mono">
                {fixture.home.name}: {data.outrightContext.homeYesPrice != null ? `${(data.outrightContext.homeYesPrice * 100).toFixed(2)}%` : '—'}
                <span className="text-[var(--color-ink-faint)] mx-1">·</span>
                {fixture.away.name}: {data.outrightContext.awayYesPrice != null ? `${(data.outrightContext.awayYesPrice * 100).toFixed(2)}%` : '—'}
              </div>
              <div className="text-[var(--color-ink-faint)] mt-1">{data.outrightContext.note}</div>
              {data.outrightContext.homeMarketUrl && (
                <a href={data.outrightContext.homeMarketUrl} target="_blank" rel="noreferrer" className="inline-block mt-1 underline opacity-80 hover:opacity-100">
                  View outright winner market →
                </a>
              )}
            </div>
          )}
          <div className="text-[11px] text-[var(--color-accent)]/80 leading-snug">
            Per-match consensus is TxLINE-exclusive — Polymarket needs a separate market to compare.
          </div>
        </div>
      )}

      {data && data.found && poly && edge && (
        <div className="space-y-2">
          <div className="text-[11px] text-[var(--color-ink-muted)] leading-snug">{edge.summary}</div>
          <div ref={edgeRef} className="flex items-baseline gap-1.5">
            <span className="font-mono text-lg font-semibold text-[var(--color-accent)]">
              {edgeMagnitude >= 0 ? '+' : ''}{edgeMagnitude.toFixed(1)}%
            </span>
            <span className="text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">cross-venue edge</span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {[
              { label: fixture.home.name, tx: fixture.odds.implied.home, poly: poly.home },
              { label: 'Draw', tx: fixture.odds.implied.draw, poly: poly.draw },
              { label: fixture.away.name, tx: fixture.odds.implied.away, poly: poly.away },
            ].map((row) => (
              <div key={row.label} className="bg-[var(--color-paper-deep)] border border-[var(--color-rule)] p-1.5">
                <div className="text-[9px] text-[var(--color-ink-faint)] truncate">{row.label}</div>
                <div className="text-[10px] font-mono">
                  <span className="text-[var(--color-accent)]">{(row.tx * 100).toFixed(1)}%</span>
                  <span className="text-[var(--color-ink-faint)] mx-0.5">/</span>
                  <span className="text-[var(--color-ink-muted)]">{row.poly != null ? `${(row.poly * 100).toFixed(1)}%` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-[var(--color-ink-faint)] leading-snug">
            TxLINE consensus (left) vs Polymarket YES (right). Draw probability not surfaced on Polymarket.
          </div>
          {poly.marketUrl && (
            <a href={poly.marketUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] underline opacity-80 hover:opacity-100 no-underline">
              View on Polymarket →
            </a>
          )}
        </div>
      )}
    </div>
  );
}

/* ------------------------------- fixture card ---------------------------- */

function FixtureCard({ fixture, onReplay, onVerify, onOpenTheatre, replaying, verifying, proofResult }) {
  const implied = fixture.odds?.implied;
  const hasProof = Boolean(fixture.proof?.merkleRoot || fixture.proof?.dailyRootPda);
  const [edgeOpen, setEdgeOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // Derive score from proof if the live API didn't populate it
  const homeScore = fixture.home.score ?? fixture.proof?.statToProve?.value ?? null;
  const awayScore = fixture.away.score ?? fixture.proof?.statToProve2?.value ?? null;
  const verification = proofResult?.verification || (proofResult?.verdict ? proofResult : null);
  const verdictLabel = verification?.verdict || (hasProof ? 'proof' : implied ? 'priced' : 'pending');

  // Summary row — teams, score, status, verdict indicator. Click to expand.
  return (
    <article className="fixture-record border-b border-[var(--mc-rule)]">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-4 px-1 py-4 text-left sm:px-3"
        aria-expanded={expanded}
      >
        <StatusBadge status={fixture.status} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-[var(--color-ink)]">
          {fixture.home.name} <span className="text-[var(--color-ink-faint)] font-normal">v</span> {fixture.away.name}
        </span>
        {fixture.status !== 'scheduled' && (
          <span className="font-mono text-sm tabular-nums text-[var(--color-ink)] shrink-0">
            {homeScore ?? 0}–{awayScore ?? 0}
          </span>
        )}
        {hasProof && (
          <span className="hidden sm:inline font-mono text-[10px] uppercase tracking-wider text-[var(--color-accent)]/70 shrink-0">
            {verdictLabel}
          </span>
        )}
        <ChevronDown
          size={14}
          className={`shrink-0 text-[var(--color-ink-faint)] transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {expanded && (
        <div className="space-y-4 px-1 pb-6 sm:px-3">
          <div className="text-xs text-[var(--color-ink-faint)]">
            {formatKickoff(fixture.kickoff)}
            {fixture.venue ? ` · ${fixture.venue}` : ''}
          </div>

          {implied && (
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">TxLINE consensus</div>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { label: fixture.home.code || 'HOME', value: implied.home },
                  { label: 'DRAW', value: implied.draw },
                  { label: fixture.away.code || 'AWAY', value: implied.away },
                ].map((o) => (
                  <div key={o.label} className="bg-white/[0.04] border border-[var(--color-rule)] px-2 py-1.5 text-center">
                    <div className="text-[10px] text-[var(--color-ink-faint)] truncate">{o.label}</div>
                    <div className="text-sm font-semibold text-[var(--color-accent)]">{pct(o.value)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1 flex-wrap">
            {fixture.status === 'final' && (
              <button
                onClick={() => onReplay(fixture)}
                disabled={replaying}
                className="mc-action mc-action--primary"
              >
                {replaying ? <Pause size={12} /> : <Play size={12} />}
                {replaying ? 'Replaying…' : 'Replay match'}
              </button>
            )}
            {hasProof && (
              <button
                onClick={() => onVerify(fixture)}
                disabled={verifying}
                className="mc-action"
              >
                <Shield size={12} />
                {verifying ? 'Verifying…' : 'Verify proof'}
              </button>
            )}
            {hasProof && onOpenTheatre && (
              <button
                onClick={() => onOpenTheatre(fixture)}
                className="mc-action mc-action--primary"
              >
                <Fingerprint size={12} />
                Open receipt
              </button>
            )}
            {hasProof && (
              <a
                href={`https://explorer.solana.com/address/${fixture.proof.dailyRootPda}`}
                target="_blank"
                rel="noreferrer"
                className="mc-nav-link no-underline"
              >
                <Database size={11} />
                PDA
              </a>
            )}
            {implied && (
              <button
                onClick={() => setEdgeOpen((v) => !v)}
                className={`mc-action ${edgeOpen ? 'mc-action--primary' : ''}`}
              >
                <Activity size={12} />
                {edgeOpen ? 'Hide edge' : 'Edge vs Polymarket'}
              </button>
            )}
          </div>

          {verification && (
            <VerificationPanel verification={verification} />
          )}

          {proofResult?.receipt && <ProofDecisionPanel result={proofResult} />}

          {edgeOpen && implied && (
            <EdgePanel fixture={fixture} onToggle={() => {}} />
          )}

          {hasProof && fixture.status === 'final' && (
            <OnChainSettlementPanel fixture={fixture} proof={fixture.proof} />
          )}
        </div>
      )}
    </article>
  );
}

function ProofDecisionPanel({ result }) {
  const receipt = result.receipt || {};
  const decision = receipt.decision || {};
  const simulation = receipt.simulation || {};
  const reconciliation = result.reconciliation || {};
  const outcome = reconciliation.outcome || {};
  const comparison = reconciliation.decisionVsOutcome || {};
  const integrity = reconciliation.integrity || {};
  const verdict = (decision.verdict || 'REVIEW').toUpperCase();
  const verdictClass = verdict === 'ALLOCATE'
    ? 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
    : verdict === 'PASS'
      ? 'border-[var(--color-sealed)]/30 bg-[var(--color-sealed)]/10 text-[var(--color-sealed)]'
      : 'border-[var(--color-evidence)]/30 bg-[var(--color-evidence)]/10 text-[var(--color-evidence)]';
  const reconciliationClass = reconciliation.status === 'reconciled'
    ? 'text-[var(--color-accent)]'
    : reconciliation.status?.includes('mismatch')
      ? 'text-[var(--color-breach)]'
      : 'text-[var(--color-sealed)]';
  const passedGates = (decision.riskChecks || []).filter((gate) => gate.passed).length;

  return (
    <section className="overflow-hidden mc-panel border-[var(--color-accent)]/20" aria-label="Proof of decision">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Fingerprint size={13} className="text-[var(--color-accent)]" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--color-accent)]">Proof of decision</span>
          <span className={`border px-1.5 py-0.5 font-mono text-[9px] tracking-wider ${verdictClass}`}>{verdict}</span>
        </div>
        <span className={`font-mono text-[10px] uppercase tracking-wider ${reconciliationClass}`}>
          {reconciliation.status?.replace(/_/g, ' ') || 'pending'}
        </span>
      </div>

      <div className="grid gap-px bg-white/[0.08] sm:grid-cols-2">
        <div className="bg-[var(--color-paper-deep)] p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Before kickoff</p>
          <p className="mt-1 text-xs text-[var(--color-ink)]">{decision.rationale || 'Decision receipt available.'}</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--color-ink-faint)]">
            <span>fair {pct(simulation.winProbability)}</span>
            <span>loss {pct(simulation.lossProbability)}</span>
            <span>allocation {pct(decision.allocationPct)}</span>
            <span>{passedGates}/{decision.riskChecks?.length || 0} gates</span>
          </div>
          <p className="mt-2 font-mono text-[9px] text-[var(--color-ink-faint)]">seed {simulation.seed ?? '—'} · {simulation.runs?.toLocaleString() || '—'} paths</p>
        </div>
        <div className="bg-[var(--color-paper-deep)] p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">Independently resolved</p>
          <p className="mt-1 text-xs text-[var(--color-ink)]">
            {outcome.homeScore ?? '—'}–{outcome.awayScore ?? '—'} · {outcome.winner || 'outcome pending'}
          </p>
          <p className="mt-2 text-[11px] leading-4 text-[var(--color-ink-faint)]">{comparison.notes || 'Waiting for a proof-backed outcome.'}</p>
          {reconciliation.adherence && <p className="mt-2 font-mono text-[9px] text-[var(--color-ink-faint)]">policy {reconciliation.adherence.policyAdhered ? 'adhered' : 'exception'} · calibration {reconciliation.adherence.calibrationError != null ? reconciliation.adherence.calibrationError.toFixed(3) : '—'}</p>}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/[0.08] px-3 py-2 font-mono text-[9px] text-[var(--color-ink-faint)]">
        <span>{integrity.receiptIntact ? 'SHA-256 RECEIPT INTACT' : 'RECEIPT UNVERIFIED'}</span>
        <span className="break-all text-[var(--color-ink-faint)]">{integrity.receiptHash || receipt.integrity?.contentHash || 'hash unavailable'}</span>
      </div>
    </section>
  );
}

/* ---------------------------- verification panel --------------------------- */

function VerificationPanel({ verification }) {
  const verdictColors = {
    verified: 'text-[var(--color-accent)] border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10',
    'proof-present': 'text-[var(--color-accent)] border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10',
    anchored: 'text-[var(--color-sealed)] border-[var(--color-sealed)]/40 bg-[var(--color-sealed)]/10',
    failed: 'text-[var(--color-breach)] border-[var(--color-breach)]/40 bg-[var(--color-breach)]/10',
    incomplete: 'text-[var(--color-ink-muted)] border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)]',
    'rpc-error': 'text-[var(--color-breach)] border-[var(--color-breach)]/40 bg-[var(--color-breach)]/10',
    unknown: 'text-[var(--color-ink-muted)] border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)]',
  };
  const cls = verdictColors[verification.verdict] || verdictColors.unknown;
  return (
    <div className={`border p-3 space-y-2 ${cls}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
          <Shield size={13} />
          Solana verification: {verification.verdict}
        </div>
        {verification.explorerUrl && (
          <a
            href={verification.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-[10px] underline opacity-80 hover:opacity-100"
          >
            View PDA
          </a>
        )}
      </div>
      <ul className="space-y-1">
        {(verification.checks || []).map((c) => (
          <li key={c.name} className="flex items-start gap-2 text-[11px]">
            <span className={`mt-0.5 inline-block h-2 w-2 ${
              c.ok === true ? 'bg-[var(--color-accent)]' : c.ok === false ? 'bg-[var(--color-breach)]' : 'bg-white/30'
            }`} />
            <span className="flex-1">
              <span className="font-mono text-[var(--color-ink)]">{c.name}</span>
              {c.detail && <span className="text-[var(--color-ink-faint)]"> — {c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      {verification.expectedRoot && (
        <div className="pt-1 border-t border-[var(--color-rule)]">
          <div className="text-[10px] uppercase tracking-wider text-[var(--color-ink-faint)]">Merkle root</div>
          <div className="font-mono text-[10px] break-all text-[var(--color-ink-muted)]">{verification.expectedRoot}</div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------ replay viewer ---------------------------- */

function ReplayViewer({ replay, onClose }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const events = replay?.events || [];
  const current = events[index];

  useEffect(() => {
    if (!playing || events.length === 0) return;
    const id = setInterval(() => {
      setIndex((i) => {
        if (i + 1 >= events.length) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 900);
    return () => clearInterval(id);
  }, [playing, events.length]);

  if (!replay) return null;
  return (
    <div className="mc-card border-[var(--color-accent)]/30 bg-[var(--color-accent)]/[0.06] p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--color-accent)]/70">TxLINE historical replay</div>
          <div className="text-lg font-semibold text-[var(--color-ink)]">
            {replay.fixture.home.name} vs {replay.fixture.away.name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIndex(0); setPlaying(false); }}
            className="mc-action"
            title="Reset"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="mc-action mc-action--primary"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={onClose}
            className="mc-action"
          >
            Close
          </button>
        </div>
      </div>

      {current ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[var(--color-ink-muted)]">Event {index + 1} of {events.length}</span>
            <span className="font-mono text-xs text-[var(--color-accent)]">{current.minute ?? '—'}'</span>
          </div>
          <div className="bg-[var(--color-paper-deep)] border border-[var(--color-rule)] p-3 text-sm">
            <div className="font-medium text-[var(--color-ink)]">{current.type || 'update'}</div>
            <div className="text-[var(--color-ink-muted)] mt-0.5">{current.description || current.text || JSON.stringify(current)}</div>
            {current.score && (
              <div className="mt-2 text-xl font-bold">
                {current.score.home} – {current.score.away}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-[var(--color-ink-faint)]">No events in this replay.</div>
      )}

      {replay.proof && (
        <div className="pt-2 border-t border-[var(--color-rule)] text-[11px] text-[var(--color-ink-faint)]">
          Finalised with TxLINE seq <span className="font-mono text-[var(--color-ink-muted)]">{replay.proof.sequence ?? '—'}</span>
          {' · root '}
          <span className="font-mono text-[var(--color-ink-muted)]">{replay.proof.merkleRoot?.slice(0, 16) ?? '—'}…</span>
        </div>
      )}
    </div>
  );
}

/* --------------------------- proof-loop narrative ------------------------ */

const PROOF_LOOP_STAGES = [
  { key: 'evidence', label: 'Evidence', detail: 'TxLINE consensus + cross-venue prices recorded pre-match' },
  { key: 'decision', label: 'Policy-bound decision', detail: 'agent allocates or passes under a versioned risk policy' },
  { key: 'receipt', label: 'Receipt', detail: 'evidence + policy + simulation bound into one hash' },
  { key: 'proof', label: 'Proof', detail: 'TxLINE finalises the stat; Merkle root anchors the outcome' },
  { key: 'reconcile', label: 'Reconciliation', detail: 'Solana PDA check confirms the outcome the receipt predicted' },
];

function ProofLoopStrip({ fixtures }) {
  const proven = fixtures.filter((f) => f.proof?.merkleRoot || f.proof?.dailyRootPda).length;
  const finals = fixtures.filter((f) => f.status === 'final').length;
  return (
    <section className="proof-loop platform-open-section px-1 py-5 sm:px-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="mc-kicker">Verified decision → reconciled outcome</div>
        <div className="font-mono text-[10px] text-[var(--color-ink-faint)]">
          {proven} proof-backed · {finals} final · {fixtures.length} tracked
        </div>
      </div>
      <ol className="proof-loop__stages mt-4 grid gap-0 sm:grid-cols-5">
        {PROOF_LOOP_STAGES.map((stage, index) => (
          <li
            key={stage.key}
            className="proof-loop__stage relative border-t border-white/[0.12] px-1 py-3 sm:px-3"
            style={{ '--stage-index': index }}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[9px] text-[var(--color-accent)]/80">{index + 1}</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">{stage.label}</span>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-[var(--color-ink-faint)]">{stage.detail}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* --------------------------------- page --------------------------------- */

export default function WorldCupClient({ bare = false }) {
  const [fixtures, setFixtures] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState('all');
  const [replay, setReplay] = useState(null);
  const [replayingId, setReplayingId] = useState(null);
  const [verifyingId, setVerifyingId] = useState(null);
  const [verifications, setVerifications] = useState({});
  const [streamStatus, setStreamStatus] = useState('connecting'); // connecting | open | error | closed
  const [streamBackend, setStreamBackend] = useState(null); // 'txline-sse' | 'polling'
  const [selectedFixture, setSelectedFixture] = useState(null); // fixture object for Proof Theatre

  // Deep-link support: ?fixture=<id> opens Proof Theatre on that fixture.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fixtureId = params.get('fixture');
    if (!fixtureId) return;
    fetch('/api/worldcup/fixtures', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data) => {
        const fx = (data.fixtures || []).find((f) => String(f.id) === String(fixtureId));
        if (fx) setSelectedFixture(fx);
      })
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [fxRes, stRes] = await Promise.all([
        fetch('/api/worldcup/fixtures').then((r) => r.json()),
        fetch('/api/worldcup/status').then((r) => r.json()),
      ]);
      if (fxRes.success) {
        setFixtures(fxRes.fixtures || []);
      } else {
        setError(fxRes.error || 'Failed to load fixtures');
      }
      if (stRes.success) setStatus(stRes.status);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ── SSE stream subscription ────────────────────────────────────────────
  // The /api/worldcup/stream route proxies the TxLINE live feed (or falls back
  // to a polling loop) and emits deltas. We merge each delta into the fixtures
  // state so the UI updates without a refresh.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return undefined;
    const es = new EventSource('/api/worldcup/stream');
    setStreamStatus('connecting');

    const onMeta = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data?.kind === 'stream-open') {
          setStreamStatus('open');
          setStreamBackend(data.backend || null);
        } else if (data?.kind === 'stream-error') {
          setStreamStatus('error');
        } else if (data?.kind === 'stream-fallback') {
          setStreamBackend('polling');
        }
      } catch {
        /* ignore malformed meta */
      }
    };
    const onUpdate = (e) => {
      try {
        const delta = JSON.parse(e.data);
        if (!delta || !delta.fixtureId || !delta.patch) return;
        // Skip meta-style deltas (no fixtureId) and unknown fixture ids
        setFixtures((prev) => {
          if (!prev.some((f) => f.id === String(delta.fixtureId))) return prev;
          return prev.map((f) =>
            f.id === String(delta.fixtureId) ? { ...f, ...delta.patch } : f
          );
        });
      } catch {
        /* ignore malformed update */
      }
    };
    const onError = () => setStreamStatus('error');
    const onOpen = () => setStreamStatus('open');

    es.addEventListener('meta', onMeta);
    es.addEventListener('update', onUpdate);
    es.addEventListener('odds', onUpdate);
    es.addEventListener('score', onUpdate);
    es.addEventListener('error', onError);
    es.addEventListener('open', onOpen);

    return () => {
      es.close();
      setStreamStatus('closed');
    };
  }, []);

  const filtered = useMemo(() => {
    if (tab === 'all') return fixtures;
    return fixtures.filter((f) => f.status === tab);
  }, [fixtures, tab]);

  const handleReplay = useCallback(async (fixture) => {
    setReplayingId(fixture.id);
    try {
      const res = await fetch(`/api/worldcup/replay?fixtureId=${encodeURIComponent(fixture.id)}`).then((r) => r.json());
      if (res.success) {
        setReplay(res);
      } else {
        setReplay({ fixture, events: [], proof: fixture.proof, error: res.error });
      }
    } catch (err) {
      setReplay({ fixture, events: [], proof: fixture.proof, error: err.message });
    } finally {
      setReplayingId(null);
    }
  }, []);

  const handleVerify = useCallback(async (fixture) => {
    setVerifyingId(fixture.id);
    try {
      const res = await fetch(`/api/worldcup/verify?fixtureId=${encodeURIComponent(fixture.id)}`).then((r) => r.json());
      setVerifications((prev) => ({ ...prev, [fixture.id]: res }));
    } catch (err) {
      setVerifications((prev) => ({
        ...prev,
        [fixture.id]: { verification: { verdict: 'rpc-error', checks: [{ name: 'fetch', ok: false, detail: err.message }] } },
      }));
    } finally {
      setVerifyingId(null);
    }
  }, []);

  const isReplayMode = status?.mode === 'replay';
  const cutoffPassed = status ? new Date(status.wcCutoff || status.cutoff || 0).getTime() < Date.now() : false;

  const streamBadge = (() => {
    if (streamStatus === 'connecting') {
      return { color: 'border-[var(--color-rule-strong)] bg-[var(--color-paper-raised)] text-[var(--color-ink-muted)]', icon: Activity, label: 'Connecting\u2026' };
    }
    if (streamStatus === 'open') {
      return {
        color: 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]',
        icon: Zap,
        label: streamBackend === 'txline-sse' ? 'Live SSE' : 'Live polling',
      };
    }
    if (streamStatus === 'error') {
      return { color: 'border-[var(--color-sealed)]/30 bg-[var(--color-sealed)]/10 text-[var(--color-sealed)]', icon: AlertTriangle, label: 'Stream retry' };
    }
    return null;
  })();

  const subnav = (
    <SecondaryNav
      items={[
        { id: 'all', label: 'All fixtures' },
        { id: 'live', label: 'Live' },
        { id: 'scheduled', label: 'Upcoming' },
        { id: 'final', label: 'Final' },
      ]}
      activeItem={tab}
      onChange={setTab}
    />
  );

  const statusRow = (
    <div className="flex items-center gap-2">
      {streamBadge && (
        <div
          data-testid="stream-badge"
          className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs ${streamBadge.color}`}
        >
          <streamBadge.icon size={12} />
          {streamBadge.label}
        </div>
      )}
      {status && (
        <div className={`inline-flex items-center gap-2 border px-3 py-1.5 text-xs ${
          isReplayMode
            ? 'border-[var(--color-sealed)]/30 bg-[var(--color-sealed)]/10 text-[var(--color-sealed)]'
            : 'border-[var(--color-accent)]/30 bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
        }`}>
          {isReplayMode ? <AlertTriangle size={12} /> : <Zap size={12} />}
          {isReplayMode ? 'Replay mode (cached TxLINE)' : 'Live TxLINE'}
        </div>
      )}
    </div>
  );

  const content = (
    <div className="space-y-10">
      {selectedFixture && (
        <ProofTheatre fixture={selectedFixture} onClose={() => setSelectedFixture(null)} />
      )}

      <RouteGuide route="world-cup" />

      <ProofLoopStrip fixtures={fixtures} />

      {isReplayMode && (
        <div className="border border-[var(--color-sealed)]/30 bg-[var(--color-sealed)]/[0.06] p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-[var(--color-sealed)] mt-0.5 shrink-0" />
          <div className="text-sm text-[var(--color-sealed)]/90">
            <strong className="font-semibold">Replay mode active.</strong>{' '}
            {cutoffPassed
              ? 'TxLINE hackathon access ended on July 19, 2026. The app is serving cached, cryptographically-verified snapshots of completed matches so the product experience remains intact.'
              : 'TxLINE token is not configured, so we are showing cached snapshots until live credentials are provided.'}
          </div>
        </div>
      )}

      {error && (
        <div className="border border-[var(--color-breach)]/30 bg-[var(--color-breach)]/[0.08] p-4 text-sm text-[var(--color-breach)]">
          {error}
        </div>
      )}

      {replay && (
        <ReplayViewer replay={replay} onClose={() => setReplay(null)} />
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse border border-[var(--color-rule)] bg-white/[0.04] p-5 h-32" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="border border-[var(--color-rule)] bg-white/[0.03] p-12 text-center">
          <Activity size={32} className="mx-auto text-[var(--color-ink-faint)] mb-3" />
          <div className="text-sm text-[var(--color-ink-muted)]">
            {fixtures.length === 0
              ? 'No World Cup fixtures available yet. Complete TxLINE onboarding to seed live data, or add cached replays under cache/txline/replays/.'
              : 'No fixtures match the selected filter.'}
          </div>
        </div>
      ) : (
        <GlowList
          count={filtered.length}
          label="receipt"
          defaultOpen={true}
          renderSummary={() => (
            tab !== 'all' && (
              <span className="inline-flex items-center rounded-full bg-field px-2 py-0.5 text-[10px] font-medium text-ink-faint shadow-hairline">
                {tab}
              </span>
            )
          )}
          emptyLabel="No fixtures match the selected filter."
        >
          <div className="fixture-ledger border-t border-[var(--mc-rule-strong)] mt-2">
            {filtered.map((fixture, index) => (
              <Reveal key={fixture.id} delay={Math.min(index * 40, 240)} className="fixture-ledger__item">
                <FixtureCard
                  fixture={fixture}
                  onReplay={handleReplay}
                  onVerify={handleVerify}
                  onOpenTheatre={setSelectedFixture}
                  replaying={replayingId === fixture.id}
                  verifying={verifyingId === fixture.id}
                  proofResult={verifications[fixture.id]}
                />
              </Reveal>
            ))}
          </div>
        </GlowList>
      )}
    </div>
  );

  if (bare) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">{subnav}</div>
          {statusRow}
        </div>
        {content}
      </div>
    );
  }

  return (
    <AppShell
      wallet={true}
      title="Decision receipts"
      subtitle="Sealed decisions anchored on Solana"
      actions={statusRow}
      subheader={subnav}
    >
      {content}
    </AppShell>
  );
}
