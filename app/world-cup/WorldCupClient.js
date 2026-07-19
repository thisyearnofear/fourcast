'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AppShell, SecondaryNav } from '@/app/components/PageNav';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  Clock,
  Database,
  Play,
  Pause,
  RotateCcw,
  Shield,
  Zap,
} from 'lucide-react';
import OnChainSettlementPanel from '@/components/OnChainSettlementPanel';

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
    live: { icon: CircleDot, label: 'LIVE', cls: 'bg-red-500/20 text-red-300 border-red-400/30' },
    final: { icon: CheckCircle2, label: 'FINAL', cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30' },
    scheduled: { icon: Clock, label: 'UPCOMING', cls: 'bg-white/10 text-white/60 border-white/20' },
  };
  const s = map[status] || map.scheduled;
  const Icon = s.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${s.cls}`}>
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

  if (!fixture.odds?.implied) return null;

  const poly = data?.polymarket;
  const edge = data?.edge;

  const verdictColor = !edge
    ? 'border-white/15 bg-white/[0.04] text-white/60'
    : Math.abs(edge.magnitude) >= 5
      ? 'border-emerald-400/40 bg-emerald-500/[0.08] text-emerald-200'
      : 'border-white/15 bg-white/[0.04] text-white/70';

  return (
    <div className={`rounded-xl border ${verdictColor} p-3 space-y-2`}>
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
        <div className="text-[11px] text-red-300">{error}</div>
      )}

      {!data && !loading && !error && (
        <div className="text-[11px] text-white/50">
          Click "Compare vs Polymarket" to check for cross-venue discrepancies on this match.
        </div>
      )}

      {data && !data.found && (
        <div className="space-y-2">
          <div className="text-[11px] text-white/70 leading-snug">
            {data.reason}
          </div>
          {data.outrightContext && (data.outrightContext.homeYesPrice != null || data.outrightContext.awayYesPrice != null) && (
            <div className="rounded-md bg-black/30 border border-white/10 p-2 text-[10px] text-white/60 leading-snug">
              <div className="text-white/80 font-medium mb-1">For context (outright winner YES prices):</div>
              <div className="font-mono">
                {fixture.home.name}: {data.outrightContext.homeYesPrice != null ? `${(data.outrightContext.homeYesPrice * 100).toFixed(2)}%` : '—'}
                <span className="text-white/40 mx-1">·</span>
                {fixture.away.name}: {data.outrightContext.awayYesPrice != null ? `${(data.outrightContext.awayYesPrice * 100).toFixed(2)}%` : '—'}
              </div>
              <div className="text-white/40 mt-1">{data.outrightContext.note}</div>
              {data.outrightContext.homeMarketUrl && (
                <a href={data.outrightContext.homeMarketUrl} target="_blank" rel="noreferrer" className="inline-block mt-1 underline opacity-80 hover:opacity-100">
                  View outright winner market →
                </a>
              )}
            </div>
          )}
          <div className="text-[11px] text-emerald-300/80 leading-snug">
            Per-match consensus pricing is TxLINE-exclusive. Polymarket would need a separate per-match market to compare directly.
          </div>
        </div>
      )}

      {data && data.found && poly && edge && (
        <div className="space-y-2">
          <div className="text-[11px] text-white/70 leading-snug">{edge.summary}</div>
          <div className="grid grid-cols-3 gap-1.5 text-center">
            {[
              { label: fixture.home.name, tx: fixture.odds.implied.home, poly: poly.home },
              { label: 'Draw', tx: fixture.odds.implied.draw, poly: poly.draw },
              { label: fixture.away.name, tx: fixture.odds.implied.away, poly: poly.away },
            ].map((row) => (
              <div key={row.label} className="rounded-md bg-black/30 border border-white/10 p-1.5">
                <div className="text-[9px] text-white/50 truncate">{row.label}</div>
                <div className="text-[10px] font-mono">
                  <span className="text-emerald-300">{(row.tx * 100).toFixed(1)}%</span>
                  <span className="text-white/40 mx-0.5">/</span>
                  <span className="text-white/70">{row.poly != null ? `${(row.poly * 100).toFixed(1)}%` : '—'}</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-[10px] text-white/50 leading-snug">
            TxLINE consensus (left) vs Polymarket YES price (right). Polymarket binary markets don't surface draw probability.
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

function FixtureCard({ fixture, onReplay, onVerify, replaying, verifying, verification }) {
  const implied = fixture.odds?.implied;
  const hasProof = Boolean(fixture.proof?.merkleRoot || fixture.proof?.dailyRootPda);
  const [edgeOpen, setEdgeOpen] = useState(false);
  // Derive score from proof if the live API didn't populate it
  const homeScore = fixture.home.score ?? fixture.proof?.statToProve?.value ?? null;
  const awayScore = fixture.away.score ?? fixture.proof?.statToProve2?.value ?? null;
  return (
    <div className="rounded-2xl border border-white/10 bg-black/25 backdrop-blur-xl p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={fixture.status} />
            <span className="text-[10px] uppercase tracking-wider text-white/40">
              {fixture.stage || 'World Cup'}
            </span>
          </div>
          <div className="mt-2 text-base font-semibold text-white">
            {fixture.home.name} <span className="text-white/40 font-normal">vs</span> {fixture.away.name}
          </div>
          <div className="mt-0.5 text-xs text-white/50">
            {formatKickoff(fixture.kickoff)}
            {fixture.venue ? ` · ${fixture.venue}` : ''}
          </div>
        </div>
        <div className="text-right shrink-0">
          {fixture.status !== 'scheduled' && (
            <div className="text-2xl font-bold tracking-tight">
              {homeScore ?? 0}
              <span className="text-white/40 mx-1">–</span>
              {awayScore ?? 0}
            </div>
          )}
        </div>
      </div>

      {implied && (
        <div className="space-y-1.5">
          <div className="text-[10px] uppercase tracking-wider text-white/40">TxLINE consensus</div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: fixture.home.code || 'HOME', value: implied.home },
              { label: 'DRAW', value: implied.draw },
              { label: fixture.away.code || 'AWAY', value: implied.away },
            ].map((o) => (
              <div key={o.label} className="rounded-lg bg-white/[0.04] border border-white/10 px-2 py-1.5 text-center">
                <div className="text-[10px] text-white/50 truncate">{o.label}</div>
                <div className="text-sm font-semibold text-emerald-300">{pct(o.value)}</div>
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-400/30 px-3 py-1.5 text-xs font-medium text-emerald-200 hover:bg-emerald-500/30 transition disabled:opacity-50"
          >
            {replaying ? <Pause size={12} /> : <Play size={12} />}
            {replaying ? 'Replaying…' : 'Replay match'}
          </button>
        )}
        {hasProof && (
          <button
            onClick={() => onVerify(fixture)}
            disabled={verifying}
            className="inline-flex items-center gap-1.5 rounded-lg bg-white/[0.06] border border-white/15 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/10 transition disabled:opacity-50"
          >
            <Shield size={12} />
            {verifying ? 'Verifying…' : 'Verify on Solana'}
          </button>
        )}
        {hasProof && (
          <a
            href={`https://explorer.solana.com/address/${fixture.proof.dailyRootPda}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11px] text-white/50 hover:text-white/80 transition no-underline"
          >
            <Database size={11} />
            PDA
          </a>
        )}
        {implied && (
          <button
            onClick={() => setEdgeOpen((v) => !v)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
              edgeOpen
                ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                : 'bg-white/[0.06] border-white/15 text-white/80 hover:bg-white/10'
            }`}
          >
            <Activity size={12} />
            {edgeOpen ? 'Hide edge' : 'Edge vs Polymarket'}
          </button>
        )}
      </div>

      {verification && (
        <VerificationPanel verification={verification} />
      )}

      {edgeOpen && implied && (
        <EdgePanel fixture={fixture} onToggle={() => {}} />
      )}

      {hasProof && fixture.status === 'final' && (
        <OnChainSettlementPanel fixture={fixture} proof={fixture.proof} />
      )}
    </div>
  );
}

/* ---------------------------- verification panel --------------------------- */

function VerificationPanel({ verification }) {
  const verdictColors = {
    verified: 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10',
    'proof-present': 'text-emerald-300 border-emerald-400/40 bg-emerald-500/10',
    anchored: 'text-amber-300 border-amber-400/40 bg-amber-500/10',
    failed: 'text-red-300 border-red-400/40 bg-red-500/10',
    incomplete: 'text-white/60 border-white/20 bg-white/5',
    'rpc-error': 'text-red-300 border-red-400/40 bg-red-500/10',
    unknown: 'text-white/60 border-white/20 bg-white/5',
  };
  const cls = verdictColors[verification.verdict] || verdictColors.unknown;
  return (
    <div className={`rounded-xl border p-3 space-y-2 ${cls}`}>
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
        {verification.checks.map((c) => (
          <li key={c.name} className="flex items-start gap-2 text-[11px]">
            <span className={`mt-0.5 inline-block h-2 w-2 rounded-full ${
              c.ok === true ? 'bg-emerald-400' : c.ok === false ? 'bg-red-400' : 'bg-white/30'
            }`} />
            <span className="flex-1">
              <span className="font-mono text-white/80">{c.name}</span>
              {c.detail && <span className="text-white/50"> — {c.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
      {verification.expectedRoot && (
        <div className="pt-1 border-t border-white/10">
          <div className="text-[10px] uppercase tracking-wider text-white/40">Merkle root</div>
          <div className="font-mono text-[10px] break-all text-white/70">{verification.expectedRoot}</div>
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
    <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/[0.06] backdrop-blur-xl p-5 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-wider text-emerald-300/70">TxLINE historical replay</div>
          <div className="text-lg font-semibold text-white">
            {replay.fixture.home.name} vs {replay.fixture.away.name}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setIndex(0); setPlaying(false); }}
            className="rounded-lg border border-white/15 bg-white/[0.06] p-2 hover:bg-white/10 transition"
            title="Reset"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={() => setPlaying((p) => !p)}
            className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 p-2 hover:bg-emerald-500/30 transition"
          >
            {playing ? <Pause size={14} /> : <Play size={14} />}
          </button>
          <button
            onClick={onClose}
            className="rounded-lg border border-white/15 bg-white/[0.06] px-3 py-2 text-xs hover:bg-white/10 transition"
          >
            Close
          </button>
        </div>
      </div>

      {current ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Event {index + 1} of {events.length}</span>
            <span className="font-mono text-xs text-emerald-300">{current.minute ?? '—'}'</span>
          </div>
          <div className="rounded-lg bg-black/30 border border-white/10 p-3 text-sm">
            <div className="font-medium text-white">{current.type || 'update'}</div>
            <div className="text-white/70 mt-0.5">{current.description || current.text || JSON.stringify(current)}</div>
            {current.score && (
              <div className="mt-2 text-xl font-bold">
                {current.score.home} – {current.score.away}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="text-sm text-white/50">No events in this replay.</div>
      )}

      {replay.proof && (
        <div className="pt-2 border-t border-white/10 text-[11px] text-white/50">
          Finalised with TxLINE seq <span className="font-mono text-white/70">{replay.proof.sequence ?? '—'}</span>
          {' · root '}
          <span className="font-mono text-white/70">{replay.proof.merkleRoot?.slice(0, 16) ?? '—'}…</span>
        </div>
      )}
    </div>
  );
}

/* --------------------------------- page --------------------------------- */

export default function WorldCupClient() {
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
      setVerifications((prev) => ({
        ...prev,
        [fixture.id]: res.verification || { verdict: 'unknown', checks: [], error: res.error },
      }));
    } catch (err) {
      setVerifications((prev) => ({
        ...prev,
        [fixture.id]: { verdict: 'rpc-error', checks: [{ name: 'fetch', ok: false, detail: err.message }] },
      }));
    } finally {
      setVerifyingId(null);
    }
  }, []);

  const isReplayMode = status?.mode === 'replay';
  const cutoffPassed = status ? new Date(status.cutoff).getTime() < Date.now() : false;

  const streamBadge = (() => {
    if (streamStatus === 'connecting') {
      return { color: 'border-white/20 bg-white/5 text-white/60', icon: Activity, label: 'Connecting\u2026' };
    }
    if (streamStatus === 'open') {
      return {
        color: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200',
        icon: Zap,
        label: streamBackend === 'txline-sse' ? 'Live SSE' : 'Live polling',
      };
    }
    if (streamStatus === 'error') {
      return { color: 'border-amber-400/30 bg-amber-500/10 text-amber-200', icon: AlertTriangle, label: 'Stream retry' };
    }
    return null;
  })();

  return (
    <AppShell
      wallet={false}
      title="World Cup Intelligence"
      subtitle="TxLINE is the primary source for fixtures, consensus odds, and finalised match receipts. Polymarket and Kalshi are shown only as secondary comparison venues."
      actions={
        <div className="flex items-center gap-2">
          {streamBadge && (
            <div
              data-testid="stream-badge"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${streamBadge.color}`}
            >
              <streamBadge.icon size={12} />
              {streamBadge.label}
            </div>
          )}
          {status && (
            <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs ${
              isReplayMode
                ? 'border-amber-400/30 bg-amber-500/10 text-amber-200'
                : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-200'
            }`}>
              {isReplayMode ? <AlertTriangle size={12} /> : <Zap size={12} />}
              {isReplayMode ? 'Replay mode (cached TxLINE)' : 'Live TxLINE'}
            </div>
          )}
        </div>
      }
      subheader={
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
      }
    >
      <div className="space-y-6">
        {isReplayMode && (
          <div className="rounded-2xl border border-amber-400/30 bg-amber-500/[0.06] p-4 flex items-start gap-3">
            <AlertTriangle size={18} className="text-amber-300 mt-0.5 shrink-0" />
            <div className="text-sm text-amber-100/90">
              <strong className="font-semibold">Replay mode active.</strong>{' '}
              {cutoffPassed
                ? 'TxLINE hackathon access ended on July 19, 2026. The app is serving cached, cryptographically-verified snapshots of completed matches so the product experience remains intact.'
                : 'TxLINE token is not configured, so we are showing cached snapshots until live credentials are provided.'}
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-400/30 bg-red-500/[0.08] p-4 text-sm text-red-200">
            {error}
          </div>
        )}

        {replay && (
          <ReplayViewer replay={replay} onClose={() => setReplay(null)} />
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-2xl border border-white/10 bg-white/[0.04] p-5 h-32" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-12 text-center">
            <Activity size={32} className="mx-auto text-white/20 mb-3" />
            <div className="text-sm text-white/60">
              {fixtures.length === 0
                ? 'No World Cup fixtures available yet. Complete TxLINE onboarding to seed live data, or add cached replays under cache/txline/replays/.'
                : 'No fixtures match the selected filter.'}
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {filtered.map((fixture) => (
              <FixtureCard
                key={fixture.id}
                fixture={fixture}
                onReplay={handleReplay}
                onVerify={handleVerify}
                replaying={replayingId === fixture.id}
                verifying={verifyingId === fixture.id}
                verification={verifications[fixture.id]}
              />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
