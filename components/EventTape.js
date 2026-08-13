'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

/**
 * EventTape — the live tape of agent activity (genre: time-&-sales).
 *
 * Streams recent arena decisions + executions as a scrolling marquee using
 * the existing .fc-marquee system (pauses on hover; reduced-motion users get
 * a static rail). Every item links to /arena. Renders nothing while empty.
 */

import { VERDICT_COLORS, ago } from '@/utils/arenaUi';

function subject(question) {
  if (!question) return '';
  const q = question.toLowerCase();
  const known = [
    [/sea ice/, 'sea ice'], [/sunspot/, 'sunspots'], [/crs-35/, 'CRS-35'],
    [/mamdani/, 'mamdani eo'], [/typhoon/, 'typhoon'], [/runavík|runavik/, 'runavík'],
    [/jaguars/, 'jaguars'], [/gta vi/, 'gta vi'], [/nominations/, 'sum nominations'],
    [/astra/, 'astra release'], [/wellington/, 'wgtn temp'], [/ilves/, 'ilves v rijeka'],
    [/bushido|dark passage/, 'tcl esports'], [/ittihad|kholood/, 'saudi pro'],
    [/lugano/, 'uefa cl'],
  ];
  for (const [re, name] of known) if (re.test(q)) return name;
  return question.split(/\s+/).slice(0, 4).join(' ');
}

function buildEvents(runs) {
  const events = [];
  for (const r of runs || []) {
    for (const d of r.decisions || []) {
      events.push({
        kind: d.verdict === 'ALLOCATE' ? 'ALLOCATE' : (d.verdict === 'PAPER' ? 'PAPER' : 'PASS'),
        text: `${d.outcome} ${Math.round((d.yourProb ?? 0) * 100)}v${Math.round((d.marketProb ?? 0) * 100)}`,
        subject: subject(d.question),
        ts: r.timestamp,
      });
    }
    for (const e of r.executions || []) {
      if (e.status !== 'executed' && e.status !== 'paper') continue;
      events.push({
        kind: e.status === 'executed' ? 'EXEC' : 'PAPER',
        text: `${e.shares}sh ${e.outcome}${e.cost != null ? ` ${e.cost.toFixed(2)}` : ''}`,
        subject: subject(null) || null,
        ts: r.timestamp,
      });
    }
  }
  events.sort((a, b) => new Date(b.ts) - new Date(a.ts));
  // Dedupe by subject+side: only the LATEST event per market-side survives
  // (hourly cycles otherwise retell the same story 3× on the tape).
  const seen = new Set();
  const out = [];
  for (const e of events) {
    const key = `${e.subject}::${e.text.slice(0, e.text.indexOf(' '))}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(e);
    if (out.length >= 12) break;
  }
  return out;
}

function TapeLane({ events }) {
  return (
    <span className="fc-marquee__track">
      {events.map((e, i) => (
        <span key={i} className="fc-marquee__item">
          <span className="fc-marquee__dot" style={{ background: VERDICT_COLORS[e.kind] || 'var(--color-ink-faint)' }} />
          <span style={{ color: VERDICT_COLORS[e.kind], fontWeight: 700 }}>{e.kind}</span>
          <span>{e.text}{e.subject ? ` · ${e.subject}` : ''}</span>
          <span style={{ color: 'var(--color-ink-faint)' }}>{ago(e.ts)}</span>
        </span>
      ))}
    </span>
  );
}

export default function EventTape() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch('/api/arena/feed?limit=40')
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => { if (alive && d?.success) setEvents(buildEvents(d.runs)); })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (!events.length) return null;

  return (
    <Link href="/arena" className="block no-underline" aria-label="Live agent tape — open the arena ledger">
      <div className="fc-marquee">
        <div className="fc-marquee__track">
          {events.concat(events).map((e, i) => (
            <span key={i} className="fc-marquee__item" aria-hidden={i >= events.length}>
              <span className="fc-marquee__dot" style={{ background: VERDICT_COLORS[e.kind] || 'var(--color-ink-faint)' }} />
              <span style={{ color: VERDICT_COLORS[e.kind], fontWeight: 700 }}>{e.kind}</span>
              <span>{e.text}{e.subject ? ` · ${e.subject}` : ''}</span>
              <span style={{ color: 'var(--color-ink-faint)' }}>{ago(e.ts)}</span>
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
