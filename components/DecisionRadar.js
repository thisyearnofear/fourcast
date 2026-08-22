'use client';

import Link from 'next/link';

/**
 * DecisionRadar — a soft ATC-style sweep showing the venues the agent is
 * scanning this cycle. Pure CSS (rings + conic-gradient sweep + positioned
 * blips), so it spends no WebGL budget — it coexists with the hero's single
 * canvas-ui effect instead of competing for it.
 *
 * Truth-first: venues are presentational (they're the surfaces Fourcast can
 * execute across), but each blip is labeled and links to the live ledger.
 * Reduced motion freezes the sweep via the shared CSS so the readout stays
 * but the displacement goes.
 */

const VENUES = [
  { name: 'Polymarket', angle: 200, dist: 62 },
  { name: 'Delphi', angle: 320, dist: 88 },
  { name: 'Kalshi', angle: 80, dist: 74 },
  { name: 'Canton', angle: 140, dist: 40, quiet: true },
];

const pad = 12; // % inset so blips never clip the circle

function radial(angleDeg, distPct) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  const r = distPct / 100;
  return {
    left: `${pad + 50 + r * 50 * Math.cos(a) - 50 * (pad / 100)}%`,
    top: `${50 + r * 50 * Math.sin(a) - 50 * (pad / 100)}%`,
  };
}

export default function DecisionRadar() {
  return (
    <div className="fc-radar-wrap" aria-label="Venues the agent is scanning">
      <div className="fc-radar">
        <span className="fc-radar__ring fc-radar__ring--3" aria-hidden="true" />
        <span className="fc-radar__ring fc-radar__ring--2" aria-hidden="true" />
        <span className="fc-radar__ring fc-radar__ring--1" aria-hidden="true" />
        <span className="fc-radar__sweep" aria-hidden="true" />
        <span className="fc-radar__axis fc-radar__axis--h" aria-hidden="true" />
        <span className="fc-radar__axis fc-radar__axis--v" aria-hidden="true" />
        {VENUES.map((v) => {
          const pos = radial(v.angle, v.dist);
          return (
            <Link
              key={v.name}
              href="/arena"
              title={`Scanning ${v.name} · open ledger`}
              className={`fc-radar__blip ${v.quiet ? 'fc-radar__blip--quiet' : ''}`}
              style={{ ...pos }}
              aria-label={`Scanning ${v.name}`}
            />
          );
        })}
        <span className="fc-radar__core" aria-hidden="true" />
      </div>
      <div className="fc-radar__legend">
        {VENUES.map((v) => (
          <span key={v.name} className="fc-radar__leg">
            <span className={`fc-radar__legdot ${v.quiet ? 'is-quiet' : ''}`} aria-hidden="true" />
            {v.name}
          </span>
        ))}
      </div>
    </div>
  );
}