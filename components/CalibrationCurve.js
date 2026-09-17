'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Target, Crosshair2, BarChart3, ChevronRight } from 'lucide-react';
import Reveal from '@/components/motion/Reveal';

const mono = { fontFamily: 'var(--font-mono, monospace)' };

const BUCKET_COLORS = {
  HIGH:  { bg: 'rgba(16,185,129,0.15)', stroke: '#10b981', text: '#10b981', dot: '#10b981' },
  MEDIUM:{ bg: 'rgba(245,158,11,0.15)', stroke: '#f59e0b', text: '#f59e0b', dot: '#f59e0b' },
  LOW:   { bg: 'rgba(99,102,241,0.15)', stroke: '#6366f1', text: '#6366f1', dot: '#6366f1' },
};

const MIDPOINTS = { HIGH: 0.875, MEDIUM: 0.625, LOW: 0.25 };

/**
 * CalibrationCurve — the proof surface for "sized on calibrated confidence, not vibes."
 *
 * Reads from /api/agent/calibration and renders:
 * 1. Summary strip: total resolved, avg Brier, bucket range
 * 2. SVG calibration plot with y=x diagonal reference
 * 3. Bucket table with hit rate, Brier, mean probability, Δ from diagonal
 * 4. Monthly Brier trend bars
 *
 * Designed as a dense data panel matching the arena's Ledger/mandate density.
 */

function SummaryStrip({ summary }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-y border-[var(--color-rule)] py-2.5 px-3">
      <StatBadge label="resolved" value={summary?.total_resolved || '—'} />
      <StatBadge label="avg brier" value={summary?.avg_brier != null ? summary.avg_brier.toFixed(4) : '—'} accent />
      <StatBadge label="buckets" value={`${summary?.min_bucket || '—'} → ${summary?.max_bucket || '—'}`} />
    </div>
  );
}

function StatBadge({ label, value, accent }) {
  return (
    <div className="flex flex-col min-w-[5rem]">
      <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">{label}</span>
      <span
        className="text-sm font-mono font-semibold"
        style={{ color: accent ? 'var(--color-accent)' : 'var(--color-ink)' }}
      >
        {value}
      </span>
    </div>
  );
}

function CalibrationPlot({ buckets, width = 520, height = 280 }) {
  const pad = { top: 24, right: 24, bottom: 44, left: 52 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const dots = buckets.map((b) => ({
    x: pad.left + (b.midpointConfidence || 0) * plotW,
    y: pad.top + plotH - (b.hitRate || 0) * plotH,
    ...b,
  }));

  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      role="img"
      aria-label="Calibration plot"
    >
      {/* Grid lines */}
      {ticks.map((t) => (
        <React.Fragment key={t}>
          <line x1={pad.left} y1={pad.top + plotH - t * plotH}
                x2={pad.left + plotW} y2={pad.top + plotH - t * plotH}
                stroke="var(--color-rule)" strokeWidth="0.5" />
          <line x1={pad.left + t * plotW} y1={pad.top}
                x2={pad.left + t * plotW} y2={pad.top + plotH}
                stroke="var(--color-rule)" strokeWidth="0.5" />
        </React.Fragment>
      ))}

      {/* Perfect calibration diagonal */}
      <line x1={pad.left} y1={pad.top + plotH}
            x2={pad.left + plotW} y2={pad.top}
            stroke="var(--color-ink-faint)" strokeWidth="1" strokeDasharray="6 3" />

      <text x={pad.left + plotW - 4} y={pad.top + 12} textAnchor="end"
            fill="var(--color-ink-faint)" fontSize="8.5" fontFamily="var(--font-mono)">
        perfect calibration
      </text>

      {/* Dots */}
      {dots.map((d, i) => {
        const c = BUCKET_COLORS[d.bucket] || BUCKET_COLORS.LOW;
        const r = Math.max(6, Math.min(14, (d.count || 0) * 0.6));
        return (
          <g key={i}>
            {/* Glow */}
            <circle cx={d.x} cy={d.y} r={r + 3} fill={c.bg} opacity="0.5" />
            {/* Dot */}
            <circle cx={d.x} cy={d.y} r={r} fill={c.bg} stroke={c.stroke} strokeWidth="1.5" />
            {/* Label below */}
            <text x={d.x} y={d.y + r + 14} textAnchor="middle"
                  fill={c.text} fontSize="10" fontFamily="var(--font-mono)" fontWeight="600">
              {d.bucket}
            </text>
            {/* Count above */}
            <text x={d.x} y={d.y - r - 5} textAnchor="middle"
                  fill="var(--color-ink-muted)" fontSize="9" fontFamily="var(--font-mono)">
              {d.count || '—'}
            </text>
          </g>
        );
      })}

      {/* Axis labels */}
      <text x={pad.left + plotW / 2} y={height - 2} textAnchor="middle"
            fill="var(--color-ink-faint)" fontSize="9">
        predicted probability
      </text>
      <text x="10" y={pad.top + plotH / 2} textAnchor="middle"
            fill="var(--color-ink-faint)" fontSize="9"
            transform={`rotate(-90, 10, ${pad.top + plotH / 2})`}>
        actual hit rate
      </text>

      {/* Tick labels */}
      {ticks.map((t) => (
        <React.Fragment key={`tick-${t}`}>
          <text x={pad.left + t * plotW} y={pad.top + plotH + 18} textAnchor="middle"
                fill="var(--color-ink-faint)" fontSize="8" fontFamily="var(--font-mono)">
            {(t * 100).toFixed(0)}%
          </text>
          <text x={pad.left - 8} y={pad.top + plotH - t * plotH + 3} textAnchor="end"
                fill="var(--color-ink-faint)" fontSize="8" fontFamily="var(--font-mono)">
            {(t * 100).toFixed(0)}%
          </text>
        </React.Fragment>
      ))}
    </svg>
  );
}

function BucketRow({ b, index, first }) {
  const c = BUCKET_COLORS[b.bucket] || BUCKET_COLORS.LOW;
  const deviation = b.hitRate != null ? b.hitRate - b.midpointConfidence : null;
  const isCalibrated = deviation != null && Math.abs(deviation) < 0.08;
  const deltaColor = deviation != null
    ? isCalibrated ? 'var(--color-accent)' : 'var(--color-breach)'
    : 'var(--color-ink-faint)';

  return (
    <div
      className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 sm:px-4"
      style={{ borderTop: first ? 'none' : '1px solid var(--color-rule)' }}
    >
      {/* Bucket label + hit rate */}
      <div className="flex items-center gap-2">
        <span className="inline-block h-2 w-2" style={{ background: c.dot, borderRadius: 0 }} />
        <span className="text-[12px] font-semibold" style={{ color: c.text }}>{b.bucket}</span>
        <span className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>
          {b.hitRate != null ? (b.hitRate * 100).toFixed(0) + '%' : '—'}
        </span>
      </div>

      {/* n */}
      <span className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>n={b.count || '—'}</span>

      {/* Brier */}
      <span className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>
        brier={b.avg_brier != null ? b.avg_brier.toFixed(3) : '—'}
      </span>

      {/* Mean prob */}
      <span className="text-[11px] text-[var(--color-ink-faint)]" style={mono}>
        p̄={b.avg_probability != null ? (b.avg_probability * 100).toFixed(0) + '%' : '—'}
      </span>

      {/* Δ from diagonal */}
      <span className="text-[10px] font-mono" style={{ color: deltaColor }}>
        Δ{(deviation != null ? (deviation * 100).toFixed(0) : '—') + '%'}
      </span>

      {/* Calibrated indicator */}
      {isCalibrated && (
        <span className="text-[9px] uppercase tracking-wider"
              style={{ color: 'var(--color-accent)' }}>
          calibrated
        </span>
      )}
    </div>
  );
}

function TrendBars({ trend }) {
  if (trend.length === 0) return null;

  return (
    <div className="mt-4 border-t border-[var(--color-rule)] pt-4 px-3 sm:px-4">
      <div className="flex items-center gap-2 mb-2">
        <BarChart3 className="h-3 w-3 text-[var(--color-ink-faint)]" />
        <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-faint)]">
          brier trend
        </span>
      </div>
      <div className="flex items-end gap-1.5">
        {trend.slice().reverse().map((t, i) => {
          const maxBrier = 0.25;
          const h = Math.max(4, (1 - Math.min(t.avg_brier, maxBrier) / maxBrier) * 40);
          const isGood = t.avg_brier < 0.2;
          return (
            <div key={i} className="flex flex-col items-center gap-0.5 group relative"
                 title={`${t.month}: Brier ${t.avg_brier?.toFixed(3)} (n=${t.count})`}>
              <span className="text-[7px] font-mono text-[var(--color-ink-faint)] opacity-0 group-hover:opacity-100 transition-opacity">
                {t.count}
              </span>
              <div
                className="w-3 transition-opacity"
                style={{
                  height: `${h}px`,
                  background: isGood ? 'var(--color-accent)' : 'var(--color-evidence)',
                  opacity: 0.5 + (1 - Math.min(t.avg_brier, maxBrier) / maxBrier) * 0.5,
                  borderRadius: 0,
                }}
              />
              <span className="text-[7px] text-[var(--color-ink-faint)]">
                {t.month.slice(2)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalibrationCurve() {
  const [data, setData] = useState({ loading: true, error: null, result: null });

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agent/calibration');
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'calibration error');
      setData({ loading: false, error: null, result: json });
    } catch (e) {
      setData((prev) => ({ ...prev, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 120_000);
    return () => clearInterval(id);
  }, [load]);

  const { loading, error, result } = data;

  /* ── Empty state: the curve is building, not built ─────────────── */
  if (!result || result.summary?.total_resolved === 0) {
    return (
      <Reveal>
        <div className="overflow-hidden border border-[var(--color-rule)] bg-[var(--color-paper-deep)]">
          <div className="border-b border-[var(--color-rule)] px-4 py-3">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-[var(--color-evidence)]" />
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-evidence)]">
                calibration
              </span>
              <span className="text-[10px] text-[var(--color-ink-faint)]" style={mono}>
                {result?.summary ? `${result.summary.total_resolved} resolved` : '0 resolved'}
              </span>
            </div>
          </div>
          <div className="px-4 py-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse" style={{ background: 'var(--color-evidence)' }} />
              <span className="text-[12px] text-[var(--color-ink-muted)]">
                Accruing as markets resolve.
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--color-ink-faint)]">
              Each resolved forecast scores a Brier point and lands in a confidence bucket.
              The curve takes shape as more data arrives — typically after a few settled markets.
            </p>
            <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-ink-faint)]" style={mono}>
              <ChevronRight className="inline h-2.5 w-2.5 mr-0.5 -mt-0.5" />
              When the plot appears, dots near the diagonal = calibrated. Deviations = over/under-confident.
            </p>
          </div>
        </div>
      </Reveal>
    );
  }

  const s = result.summary;
  const buckets = result.buckets || [];
  const trend = result.trend || [];

  return (
    <Reveal>
      <div className="overflow-hidden border border-[var(--color-rule)] bg-[var(--color-paper-deep)]">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="border-b border-[var(--color-rule)] px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Target className="h-3.5 w-3.5 text-[var(--color-accent)]" />
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                calibration
              </span>
            </div>
            <button
              onClick={() => load()}
              className="flex items-center gap-1 border px-2 py-0.5 text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)] hover:text-[var(--color-ink)] transition-colors"
              style={{ borderColor: 'var(--color-rule)', borderRadius: 0 }}
              aria-label="Refresh calibration data"
            >
              <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
              refresh
            </button>
          </div>
        </div>

        {/* ── Summary strip ──────────────────────────────────────── */}
        <SummaryStrip summary={s} />

        {/* ── Calibration plot ───────────────────────────────────── */}
        <div className="px-4 pt-4 pb-1">
          <CalibrationPlot buckets={buckets} width={520} height={260} />
        </div>

        {/* ── Bucket table ───────────────────────────────────────── */}
        <div className="border-t border-[var(--color-rule)]">
          {buckets.map((b, i) => (
            <BucketRow key={b.bucket} b={b} index={i} first={i === 0} />
          ))}
        </div>

        {/* ── Trend ──────────────────────────────────────────────── */}
        <TrendBars trend={trend} />

        {/* ── Interpretation ─────────────────────────────────────── */}
        <div className="border-t border-[var(--color-rule)] px-4 py-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-[10px] leading-relaxed">
            <InterpretationItem
              icon={<Crosshair2 className="h-3 w-3" />}
              label="On diagonal"
              desc="Bucket is perfectly calibrated — stated confidence matches hit rate."
            />
            <InterpretationItem
              icon={<ChevronRight className="h-3 w-3 rotate-[-90deg]" />}
              label="Above diagonal"
              desc="Underconfident. The agent is being too conservative — could size larger."
            />
            <InterpretationItem
              icon={<ChevronRight className="h-3 w-3 rotate-[90deg]" />}
              label="Below diagonal"
              desc="Overconfident. Probabilities are too extreme — must shrink toward 50%."
            />
          </div>
        </div>
      </div>
    </Reveal>
  );
}

function InterpretationItem({ icon, label, desc }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 shrink-0 text-[var(--color-ink-faint)]">{icon}</span>
      <div>
        <span className="font-mono font-semibold text-[var(--color-ink-muted)]">{label}.</span>{' '}
        <span className="text-[var(--color-ink-faint)]">{desc}</span>
      </div>
    </div>
  );
}
