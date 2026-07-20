'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { FlaskConical, Loader2, Lock, ShieldCheck, Save, ExternalLink, Check } from 'lucide-react';

/**
 * MandateBuilder — self-serve mandate config + dry-run preview.
 *
 * This is the in-browser version of the concierge test's "hand-roll a mandate
 * and see what it would have decided" step (docs/GO_TO_MARKET.md §2.2). A
 * prospect adjusts the four real policy knobs from decisionPolicy.js, runs a
 * dry-run against the canonical France–Sweden fixture, and sees the verdict,
 * gate checks, and allocation — without an account, a VPS, or a private key.
 *
 * The four knobs match createDecisionPolicy() exactly:
 *   minAbsoluteEdge, maxAllocationPct, maxLossProbability, simulationRuns
 *
 * Draft state persists to localStorage so a prospect's mandate survives a
 * page refresh. No backend persistence in this slice — that's Slice 4.
 */

const STORAGE_KEY = 'fourcast_mandate_draft';
const OPERATOR_ID_KEY = 'fourcast_operator_id';

const DEFAULT_DRAFT = {
  minAbsoluteEdge: 0.05, // 5%
  maxAllocationPct: 0.03, // 3% — matches the worker default, not the 25% policy default
  maxLossProbability: 0.75, // 75%
  simulationRuns: 10_000,
};

const KNOBS = [
  {
    key: 'minAbsoluteEdge',
    label: 'Minimum edge',
    description: 'The smallest absolute edge (AI fair − market) the agent will act on. Below this, PASS.',
    min: 0,
    max: 0.2,
    step: 0.005,
    format: pct,
  },
  {
    key: 'maxAllocationPct',
    label: 'Max allocation per decision',
    description: 'The Kelly-sized allocation cap. Even if Kelly says 10%, the agent won’t exceed this.',
    min: 0.01,
    max: 0.25,
    step: 0.005,
    format: pct,
  },
  {
    key: 'maxLossProbability',
    label: 'Tail-loss limit',
    description: 'If the simulated loss probability exceeds this, the agent PASSes regardless of edge.',
    min: 0.5,
    max: 0.95,
    step: 0.01,
    format: pct,
  },
  {
    key: 'simulationRuns',
    label: 'Monte Carlo paths',
    description: 'Seeded simulation count. Higher = tighter confidence intervals, slower dry-run.',
    min: 1000,
    max: 50000,
    step: 1000,
    format: (v) => v.toLocaleString(),
  },
];

const DEMO_FIXTURE_ID = '18175981'; // France v Sweden — the canonical receipt

function pct(v) {
  return `${(v * 100).toFixed(1)}%`;
}

export default function MandateBuilder() {
  const [draft, setDraft] = useState(DEFAULT_DRAFT);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [operatorId, setOperatorId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedUrl, setSavedUrl] = useState(null);

  // Load draft + operator_id from localStorage on mount.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setDraft({ ...DEFAULT_DRAFT, ...parsed });
      }
      const storedOperatorId = localStorage.getItem(OPERATOR_ID_KEY);
      if (storedOperatorId) setOperatorId(storedOperatorId);
    } catch {
      /* ignore */
    }
  }, []);

  // Persist draft on change.
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      /* ignore */
    }
  }, [draft]);

  const updateKnob = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    // Clear stale results when the mandate changes.
    setResult(null);
    setError(null);
  };

  const runDryRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/agent/dry-run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fixtureId: DEMO_FIXTURE_ID, ...draft }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Dry-run failed (${res.status})`);
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  const resetDraft = () => {
    setDraft(DEFAULT_DRAFT);
    setResult(null);
    setError(null);
  };

  const saveMandate = async () => {
    setSaving(true);
    setError(null);
    setSavedUrl(null);
    try {
      const res = await fetch('/api/agent/mandate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operatorId, ...draft }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Save failed (${res.status})`);
      }
      setOperatorId(data.operatorId);
      setSavedUrl(data.trackRecordUrl);
      try {
        localStorage.setItem(OPERATOR_ID_KEY, data.operatorId);
      } catch {
        /* ignore */
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="platform-open-section" aria-label="Mandate builder">
      <div className="border-b border-[var(--mc-rule)] px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <FlaskConical className="h-3.5 w-3.5 text-emerald-300/80" />
            <span className="mc-kicker">Mandate builder · dry-run preview</span>
          </div>
          <button
            type="button"
            onClick={resetDraft}
            className="text-[11px] text-white/45 underline-offset-2 hover:text-white/70 hover:underline"
          >
            Reset to defaults
          </button>
        </div>
        <p className="mt-2 max-w-2xl text-xs leading-5 text-white/50">
          Adjust the four policy knobs the VPS worker uses, then run a dry-run against the canonical France–Sweden fixture. No account, no wallet, no execution — this is the self-serve version of the concierge test’s “hand-roll a mandate” step.
        </p>
      </div>

      <div className="grid gap-6 px-4 py-5 sm:px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Knobs */}
        <div className="space-y-5">
          {KNOBS.map((knob) => (
            <div key={knob.key}>
              <div className="flex items-baseline justify-between gap-3">
                <label htmlFor={`knob-${knob.key}`} className="text-sm font-medium text-white/80">
                  {knob.label}
                </label>
                <span className="font-mono text-sm text-emerald-300">{knob.format(draft[knob.key])}</span>
              </div>
              <input
                id={`knob-${knob.key}`}
                type="range"
                min={knob.min}
                max={knob.max}
                step={knob.step}
                value={draft[knob.key]}
                onChange={(e) => updateKnob(knob.key, Number(e.target.value))}
                className="mc-range mt-2 w-full"
              />
              <p className="mt-1.5 text-xs leading-4 text-white/40">{knob.description}</p>
            </div>
          ))}

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={runDryRun}
              disabled={running}
              className="fc-action mc-action--primary inline-flex items-center gap-2 px-5 py-2.5 text-sm disabled:opacity-50"
            >
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
              {running ? 'Running dry-run…' : 'Run dry-run on France–Sweden'}
            </button>
            <button
              type="button"
              onClick={saveMandate}
              disabled={saving}
              className="fc-action inline-flex items-center gap-2 px-4 py-2.5 text-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : 'Save as my mandate'}
            </button>
            <span className="inline-flex items-center gap-1 text-[11px] text-white/40">
              <Lock className="h-3 w-3" />
              No execution · no wallet
            </span>
          </div>

          {savedUrl && (
            <div className="mt-4 border border-emerald-400/30 bg-emerald-400/[0.08] p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  <span className="text-emerald-100">Mandate saved. Your public Track Record URL:</span>
                </div>
                <Link
                  href={savedUrl}
                  className="mc-nav-link no-underline inline-flex items-center gap-1 text-emerald-200/90"
                >
                  Open
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>
              <p className="mt-1.5 break-all font-mono text-[10px] text-white/55">
                {savedUrl}
              </p>
              <p className="mt-1.5 text-[11px] text-white/45">
                Share this URL with an allocator. It shows your mandate and any track record produced under it — no signup required to view.
              </p>
            </div>
          )}
        </div>

        {/* Result */}
        <div className="min-w-0">
          {error && (
            <div className="border border-red-400/30 bg-red-500/[0.08] p-4 text-sm text-red-200">
              {error}
            </div>
          )}

          {!error && !result && !running && (
            <div className="flex h-full min-h-32 items-center justify-center border border-dashed border-white/10 bg-white/[0.02] p-6 text-center">
              <p className="text-xs leading-5 text-white/40">
                Adjust the knobs and run a dry-run. The verdict, gate checks, and allocation will appear here — the same shape the VPS worker produces under your mandate.
              </p>
            </div>
          )}

          {running && (
            <div className="flex h-full min-h-32 items-center justify-center border border-white/10 bg-white/[0.02] p-6">
              <Loader2 className="h-5 w-5 animate-spin text-emerald-300/60" />
            </div>
          )}

          {result && <DryRunResult result={result} />}
        </div>
      </div>
    </section>
  );
}

function DryRunResult({ result }) {
  const { decision, simulation, recommendation, fixture, policy } = result;
  const verdict = (decision.verdict || 'REVIEW').toUpperCase();
  const verdictClass =
    verdict === 'ALLOCATE'
      ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
      : verdict === 'PASS'
        ? 'border-amber-300/30 bg-amber-300/10 text-amber-100'
        : 'border-sky-300/30 bg-sky-300/10 text-sky-100';
  const passedGates = (decision.riskChecks || []).filter((g) => g.passed).length;
  const totalGates = (decision.riskChecks || []).length;

  return (
    <div className="space-y-4">
      {/* Verdict header */}
      <div className={`border p-4 ${verdictClass}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-mono text-xs font-semibold uppercase tracking-[0.16em]">Verdict</span>
          </div>
          <span className="font-display text-lg font-bold">{verdict}</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-white/70">{decision.rationale}</p>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-white/50">
          <span>edge {pct(recommendation.edge)}</span>
          <span>fair {pct(recommendation.aiProbability)}</span>
          <span>market {pct(recommendation.marketOdds)}</span>
          <span>allocation {pct(decision.allocationPct)}</span>
          <span>{passedGates}/{totalGates} gates</span>
        </div>
      </div>

      {/* Gate checks */}
      <div className="border border-white/10 bg-white/[0.02] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Policy gates</p>
        <ul className="mt-2 space-y-1.5">
          {(decision.riskChecks || []).map((gate) => (
            <li key={gate.id} className="flex items-start gap-2 text-xs">
              <span
                className={`mt-0.5 inline-block h-2 w-2 shrink-0 ${
                  gate.passed ? 'bg-emerald-400' : 'bg-red-400'
                }`}
              />
              <span className="flex-1">
                <span className="font-mono text-white/80">{gate.id}</span>
                <span className="text-white/45"> — {gate.description}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Simulation summary */}
      <div className="border border-white/10 bg-white/[0.02] p-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/40">Seeded simulation</p>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center">
          <div>
            <div className="font-mono text-[10px] text-white/40">win prob</div>
            <div className="mt-1 font-display text-sm font-semibold text-emerald-300">
              {simulation.valid ? pct(simulation.winProbability) : '—'}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-white/40">loss prob</div>
            <div className="mt-1 font-display text-sm font-semibold text-white/80">
              {simulation.valid ? pct(simulation.lossProbability) : '—'}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-white/40">expected return</div>
            <div className="mt-1 font-display text-sm font-semibold text-white/80">
              {simulation.valid ? `${(simulation.expectedReturn * 100).toFixed(1)}%` : '—'}
            </div>
          </div>
        </div>
        <p className="mt-2 font-mono text-[9px] text-white/35">
          {simulation.runs.toLocaleString()} paths · seed {simulation.seed}
        </p>
      </div>

      {/* Fixture + receipt hash */}
      <div className="border-t border-white/10 pt-3 font-mono text-[10px] text-white/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            {fixture.home.name} v {fixture.away.name} · {fixture.competition}
          </span>
          <span className="break-all text-white/55">
            {result.receipt.proof.integrity.contentHash.slice(0, 24)}…
          </span>
        </div>
        <p className="mt-1">
          Dry-run · policy {policy.version} · receipt not persisted
        </p>
      </div>
    </div>
  );
}
