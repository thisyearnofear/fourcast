#!/usr/bin/env node
/**
 * Survey the live Telegraph network before spending anything on it.
 *
 *   node scripts/survey.mjs                     our standing + intents that matter
 *   node scripts/survey.mjs --all               every scored intent
 *   node scripts/survey.mjs --intent GAME_RESULT one intent in full
 *   node scripts/survey.mjs --json              machine-readable, for a schedule
 *
 * Why this exists: Season I we registered into intents without reading how
 * they were scored, and the miner came back 0. Two public reads answer that:
 *
 *   /api/miners   every miner's latest per-intent score and rank
 *   /api/wasm     every scoring-module registration per intent
 *
 * Two numbers are printed for each scorer, because they are not the same:
 *   displayed  champion.eval_score — the margin it achieved on the day it won,
 *              frozen. This is what the explorer shows.
 *   bar        champion_margin on the most recent registration — the same
 *              incumbent re-measured on the current corpus. This is what a new
 *              scorer registration actually has to beat. It can drift a long
 *              way from `displayed`, and it can move between the read and the
 *              evaluation, so treat it as a direction, not a guarantee.
 *
 * Costs nothing: both endpoints are public reads. No wallet, no key.
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const NODE = process.env.TELEGRAPH_NODE ?? 'https://devnode.telegraphprotocol.com';
const SLUG = flag('--slug') ?? process.env.TELEGRAPH_MINER_SLUG ?? 'fourcast-sports-intelligence';
/** Below this best score, an intent is treated as not being measured at all. */
const DEAD_BELOW = Number(flag('--dead-below') ?? 0.05);
/** Intents worth watching for this miner's data, whether or not we serve them. */
const WATCH = (flag('--watch') ??
  'GAME_RESULT,SPORTS_SCORE,EVENT_OUTCOME_RESOLUTION,WEATHER_FORECAST,WEATHER_FORECAST_VERIFY')
  .split(',').map((s) => s.trim()).filter(Boolean);

function flag(name) {
  const i = process.argv.indexOf(name);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : undefined;
}
const has = (name) => process.argv.includes(name);

async function getJson(path) {
  const res = await fetch(`${NODE}${path}`, {
    headers: { 'User-Agent': 'fourcast-survey/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

/** Per-intent landscape from the miner catalogue. */
export function landscape(miners) {
  const byIntent = new Map();
  for (const m of miners) {
    if (m.activation_status && m.activation_status !== 'active') continue;
    for (const s of m.scores ?? []) {
      if (!byIntent.has(s.intent_id)) byIntent.set(s.intent_id, []);
      byIntent.get(s.intent_id).push({
        slug: m.slug,
        score: Number(s.score) || 0,
        rank: s.rank ?? null,
        epoch: s.epoch_id ?? null,
        requests: m.total_requests_served ?? null,
      });
    }
  }
  const rows = [];
  for (const [intent, list] of byIntent) {
    list.sort((a, b) => b.score - a.score);
    rows.push({
      intent,
      miners: list.length,
      best: list[0],
      alive: list[0].score >= DEAD_BELOW,
      scoring_above_zero: list.filter((x) => x.score > 0).length,
      top: list.slice(0, 5),
    });
  }
  return rows.sort((a, b) => b.best.score - a.best.score);
}

/** Displayed vs measured bar per intent, from the scorer registry. */
export function scorerBars(wasm) {
  const out = {};
  for (const [intent, e] of Object.entries(wasm?.intents ?? {})) {
    const entries = [...(e.entries ?? [])].sort((a, b) => String(a.registered_at).localeCompare(String(b.registered_at)));
    const latest = entries.at(-1);
    const authors = new Set(entries.map((x) => x.author_address));
    out[intent] = {
      champion_registration: e.champion?.registration_id ?? null,
      champion_author: e.champion?.author_address ?? null,
      displayed: e.champion?.eval_score ?? null,
      bar: latest?.eval?.champion_margin ?? null,
      bar_read_from: latest ? { registration: latest.registration_id, at: latest.registered_at } : null,
      registrations: entries.length,
      authors: authors.size,
    };
  }
  return out;
}

const fmt = (n) => (n == null ? '—' : n === 0 ? '0' : n < 0.001 ? n.toExponential(1) : n.toFixed(4));

async function main() {
  const [miners, wasm] = await Promise.all([getJson('/api/miners'), getJson('/api/wasm')]);
  const rows = landscape(Array.isArray(miners) ? miners : miners.miners ?? []);
  const bars = scorerBars(wasm);
  const me = (Array.isArray(miners) ? miners : []).find((m) => m.slug === SLUG) ?? null;

  const ours = (me?.scores ?? []).map((s) => {
    const row = rows.find((r) => r.intent === s.intent_id);
    return {
      intent: s.intent_id,
      score: Number(s.score) || 0,
      rank: s.rank,
      of: row?.miners ?? null,
      best: row?.best ?? null,
      alive: row?.alive ?? false,
      epoch: s.epoch_id,
    };
  });

  const report = {
    read_at: new Date().toISOString(),
    node: NODE,
    dead_below: DEAD_BELOW,
    miner: me
      ? {
          slug: me.slug,
          id: me.id,
          status: me.activation_status,
          requests_served: me.total_requests_served ?? null,
          last_scored_epoch: me.last_scored_epoch ?? null,
          last_scored_at: me.last_scored_at ?? null,
          intents: ours,
        }
      : { slug: SLUG, found: false },
    network: {
      intents_scored: rows.length,
      alive: rows.filter((r) => r.alive).length,
      dead: rows.filter((r) => !r.alive).length,
    },
    watch: WATCH.map((intent) => ({
      ...(rows.find((r) => r.intent === intent) ?? { intent, miners: 0, best: null, alive: false }),
      scorer: bars[intent] ?? null,
    })),
    intents: rows.map((r) => ({ ...r, scorer: bars[r.intent] ?? null })),
  };

  if (has('--json')) {
    const one = flag('--intent');
    process.stdout.write(JSON.stringify(one ? report.intents.find((r) => r.intent === one) ?? null : report, null, 2) + '\n');
    return;
  }

  const one = flag('--intent');
  if (one) {
    const r = report.intents.find((x) => x.intent === one);
    if (!r) return console.log(`${one}: no live scores on ${NODE}`);
    console.log(`${one} — ${r.miners} miners, best ${fmt(r.best.score)} (${r.best.slug}), ${r.alive ? 'measured' : 'NOT measured (dead)'}`);
    for (const t of r.top) console.log(`  #${t.rank ?? '?'}  ${fmt(t.score).padStart(8)}  ${t.slug}  (${t.requests ?? '?'} served)`);
    if (r.scorer) console.log(`  scorer: displayed ${fmt(r.scorer.displayed)} · bar ${fmt(r.scorer.bar)} · ${r.scorer.registrations} registrations by ${r.scorer.authors} author(s)`);
    return;
  }

  console.log(`node ${NODE}  ·  read ${report.read_at}`);
  if (me) {
    console.log(`\nminer ${me.slug} (id ${me.id}, ${me.activation_status}) — ${me.total_requests_served ?? '?'} requests served, last scored epoch ${me.last_scored_epoch ?? '?'}`);
    for (const o of ours) {
      const verdict = !o.alive
        ? 'intent is not measured — a score here means nothing, do not optimise for it'
        : o.score === 0
          ? `others score up to ${fmt(o.best.score)}; ours is 0 — fixable on our side`
          : `ranked ${o.rank}/${o.of}`;
      console.log(`  ${o.intent.padEnd(26)} ${fmt(o.score).padStart(8)}  rank ${o.rank}/${o.of}  best ${fmt(o.best?.score)} (${o.best?.slug})  → ${verdict}`);
    }
  } else {
    console.log(`\nminer ${SLUG}: not found in the catalogue`);
  }

  console.log(`\nnetwork: ${report.network.intents_scored} intents scored, ${report.network.alive} measured (best ≥ ${DEAD_BELOW}), ${report.network.dead} effectively unmeasured`);

  const list = has('--all') ? report.intents : report.watch;
  console.log(`\n${has('--all') ? 'all intents' : 'watched intents'} (miners · best · scorer displayed → bar):`);
  for (const r of list) {
    const s = r.scorer;
    const drift = s?.displayed != null && s?.bar != null ? ` (${s.bar >= s.displayed ? '+' : ''}${(s.bar - s.displayed).toFixed(3)})` : '';
    console.log(
      `  ${r.intent.padEnd(30)} ${String(r.miners).padStart(3)}  ${fmt(r.best?.score).padStart(8)} ${(r.best?.slug ?? '').padEnd(28)} ` +
        `${r.alive ? '  ' : '✗ '}${s ? `${fmt(s.displayed)} → ${fmt(s.bar)}${drift}` : 'no scorer registry entry'}`
    );
  }
  if (!has('--all')) console.log('\n(--all for every intent, --intent NAME for one, --json for the raw report)');
}

const isDirect = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isDirect) {
  main().catch((err) => {
    console.error(`survey failed: ${err.message}`);
    process.exit(1);
  });
}
