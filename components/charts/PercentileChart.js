'use client';

import { useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

/**
 * PercentileChart — lightweight insight card for the SynthData ML forecast.
 *
 * Renders the percentile distribution (p0.5 → p99.5) from
 * `analysis.synthData.percentiles.raw` as an area chart, with the current
 * price marked as a reference line. This is the "InsightCards" surface from
 * the /markets plan — built on recharts (already a dependency) instead of
 * the liveline library that was never installed.
 *
 * Props:
 *   synthData — the synthData block from the analysis result
 *   height    — chart height in px (default 120)
 */
export default function PercentileChart({ synthData, height = 120 }) {
  const data = useMemo(() => {
    const raw = synthData?.percentiles?.raw;
    if (!Array.isArray(raw) || raw.length < 3) return null;
    return raw
      .filter((p) => p?.price != null && p?.percentile != null)
      .map((p) => ({
        percentile: Number(p.percentile),
        price: Number(p.price),
      }))
      .sort((a, b) => a.percentile - b.percentile);
  }, [synthData]);

  if (!data) return null;

  const currentPrice = synthData?.currentPrice ?? synthData?.percentiles?.p50;
  const p50 = synthData?.percentiles?.p50;

  const prices = data.map((d) => d.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pad = (max - min) * 0.08 || max * 0.01;

  const fmt = (v) =>
    v >= 1000
      ? `$${(v / 1000).toFixed(1)}k`
      : `$${v.toFixed(v >= 100 ? 0 : 2)}`;

  return (
    <div className="border border-[var(--color-rule)] bg-[var(--color-paper-deep)] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-wider text-[var(--color-ink-faint)]">
          ML forecast distribution
        </span>
        {p50 != null && (
          <span className="font-mono text-[10px] text-[var(--color-review)]">
            p50 {fmt(p50)}
          </span>
        )}
      </div>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="pctFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.25} />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="percentile"
              tick={{ fontSize: 9, fill: 'var(--color-ink-faint)' }}
              tickFormatter={(v) => `p${v}`}
              axisLine={{ stroke: 'var(--color-rule)' }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[min - pad, max + pad]}
              tick={{ fontSize: 9, fill: 'var(--color-ink-faint)' }}
              tickFormatter={fmt}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              contentStyle={{
                background: 'var(--color-paper-raised)',
                border: '1px solid var(--color-rule-strong)',
                borderRadius: 0,
                fontSize: 11,
                padding: '4px 8px',
              }}
              labelStyle={{ color: 'var(--color-ink-faint)', fontSize: 10 }}
              labelFormatter={(v) => `Percentile ${v}`}
              formatter={(v) => [fmt(v), 'Price']}
            />
            {currentPrice != null && (
              <ReferenceLine
                y={currentPrice}
                stroke="var(--color-sealed)"
                strokeDasharray="3 3"
                label={{
                  value: 'now',
                  position: 'insideTopRight',
                  fill: 'var(--color-sealed)',
                  fontSize: 9,
                }}
              />
            )}
            <Area
              type="monotone"
              dataKey="price"
              stroke="var(--color-accent)"
              strokeWidth={1.5}
              fill="url(#pctFill)"
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
