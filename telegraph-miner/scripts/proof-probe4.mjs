/**
 * Probe #4 — the PL question, properly. Last session's "PL is 403 on our
 * tier" was matched with Competition.includes('Premier League'), which also
 * matches the *Canadian* Premier League (Vancouver FC v HFX Wanderers was
 * the first hit). MLS just measured 200 on an exact MLS fixture. Retest
 * with exact competition names and on finished games where possible.
 * Run: set -a && . ../.env.agent && set +a && node /tmp/proof-probe4.mjs
 */
import { txline } from '/home/linuxuser/fourcast/telegraph-miner/src/txline.js';

const fs = await txline.getFixtures();
const now = Date.now();
for (const name of ['Premier League', 'English Federation Women', 'MLS', 'Major League Soccer']) {
  const exact = fs.filter((f) => String(f.Competition) === name);
  console.log(`Competition === '${name}': ${exact.length} fixtures`);
  for (const f of exact.slice(0, 2)) {
    const snap = await txline.getScoreSnapshot(f.FixtureId).then((r) => `200 (${(r || []).length} events)`).catch((e) => e.message.slice(0, 110));
    console.log(`  ${f.FixtureId} ${f.Participant1} v ${f.Participant2} ${new Date(Number(f.StartTime)).toISOString().slice(0, 16)} scores -> ${snap}`);
  }
}
// Any recent finished MLS/EPL fixture with real events? The snapshot is
// forward-only, so also try the historical endpoint on ids near an MLS
// game-day id range we know exists (Chicago Fire fixture from probe3).
for (const id of [17615111, 18041502]) {
  const r = await fetch(`https://txline.txodds.com/api/scores/historical/${id}`, {
    headers: { Authorization: `Bearer ${process.env.TXLINE_GUEST_JWT}`, 'X-Api-Token': process.env.TXLINE_API_TOKEN },
    signal: AbortSignal.timeout(30_000),
  });
  const t = r.ok ? await r.text() : '';
  console.log(`historical/${id}: ${r.status} len=${t.length} hasGameFinalised=${/"Action":\s*"game_finalised"/.test(t) || /"action":\s*"game_finalised"/.test(t)}`);
}
void now;
