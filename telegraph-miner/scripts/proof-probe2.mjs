/**
 * Probe #2 — after reviewing the official docs (2026-09-28):
 *  - the public endpoint takes TWO request shapes: statKey=[&statKey2=]
 *    (legacy validateStat) and statKeys= (validateStatV2). Probe #1 only ever
 *    tried statKeys= and concluded too early.
 *  - /scores/stat-multiproof is not a documented endpoint at all.
 *  - the free tier is documented to include NFL, MLS, Premier League and
 *    World Cup scores — our PL/MLS 403s are a doc-vs-API finding to pin down.
 *  - /api/scores/historical/{fixtureId} exists for completed fixtures.
 * Run: set -a && . ../.env.agent && set +a && node /tmp/proof-probe2.mjs
 */
import { txline } from '/home/linuxuser/fourcast/telegraph-miner/src/txline.js';
import { track } from '/home/linuxuser/fourcast/telegraph-miner/src/observe.js';

const raw = (path) => track('txline', () =>
  fetch(`https://txline.txodds.com/api${path}`, {
    headers: {
      Authorization: `Bearer ${process.env.TXLINE_GUEST_JWT}`,
      'X-Api-Token': process.env.TXLINE_API_TOKEN,
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(15_000),
  }).then(async (res) => {
    const text = await res.text();
    return `${res.status} ${text.slice(0, 240)}`;
  }).catch((e) => `ERR ${e.message.slice(0, 120)}`));

const F = Number(process.argv[2] || 0);
let SEQ = Number(process.argv[3] || 0);

let fixtureId = F;
if (!fixtureId) {
  // The fixture snapshot's GameState is its own vocabulary (measured: only
  // 1/3/4/5/6/8 appear; the feed's phase codes F=9/FO=13 do NOT show up),
  // so pick by the documented authoritative signal instead: the score event
  // with Action === 'game_finalised'.
  const fixtures = await txline.getFixtures();
  const now = Date.now();
  const recent = fixtures
    .filter((f) => Number(f.StartTime) < now && now - Number(f.StartTime) < 4 * 86_400_000)
    .sort((a, b) => b.StartTime - a.StartTime);
  const comps = process.argv[4] ? process.argv[4].split('|') : ['NFL'];
  console.log(`recent fixtures (last 4 days): ${recent.length}`);
  for (const g of recent) {
    if (!comps.some((c) => String(g.Competition || '').includes(c))) continue;
    const rows = await txline.getScoreSnapshot(g.FixtureId).catch(() => null);
    const evs = Array.isArray(rows) ? rows : [];
    const finalEv = evs.findLast((e) => e.Action === 'game_finalised');
    console.log(`${g.FixtureId} ${g.Competition} ${g.Participant1} v ${g.Participant2} ${new Date(Number(g.StartTime)).toISOString().slice(0, 16)} -> events=${evs.length} finalSeq=${finalEv?.Seq ?? '-'}`);
    if (finalEv) {
      fixtureId = g.FixtureId;
      SEQ = Number(finalEv.Seq);
      break;
    }
  }
}
if (!fixtureId || !SEQ) { console.log('no finalised fixture found — cannot probe'); process.exit(1); }
console.log(`probing fixture ${fixtureId} seq ${SEQ}`);

console.log('── legacy validateStat shape (never tried before) ──');
for (const q of [`statKey=1`, `statKey=1&statKey2=2`, `statKey=1&statKey2=2&statKeys=1,2`]) {
  console.log(`stat-validation?${q} ->`, await raw(`/scores/stat-validation?fixtureId=${fixtureId}&seq=${SEQ}&${q}`));
}

console.log('── V2 shape, documented statKeys=1,2 (for completeness) ──');
console.log(`stat-validation?statKeys=1,2 ->`, await raw(`/scores/stat-validation?fixtureId=${fixtureId}&seq=${SEQ}&statKeys=1,2`));

console.log('── undocumented multiproof (expect 404) ──');
console.log('stat-multiproof ->', await raw(`/scores/stat-multiproof?fixtureId=${fixtureId}&seq=${SEQ}&statKeys=1,2`));

console.log('── other documented score reads for the same fixture ──');
console.log('sequence ->', await raw(`/scores/sequence/${fixtureId}`));
console.log('historical ->', await raw(`/scores/historical/${fixtureId}`));

console.log('── PL/MLS score access (docs say the free bundle includes them) ──');
const fixtures = await txline.getFixtures();
const now = Date.now();
for (const [label, compId] of [['Premier League', 8], ['MLS', 33]]) {
  const done = fixtures
    .filter((f) => f.CompetitionId === compId && Number(f.StartTime) < now && now - Number(f.StartTime) < 3 * 86_400_000)
    .sort((a, b) => b.StartTime - a.StartTime)
    .slice(0, 2);
  for (const f of done) {
    const res = await raw(`/scores/snapshot/${f.FixtureId}`);
    console.log(`${label}: ${f.Participant1} v ${f.Participant2} (${new Date(f.StartTime).toISOString().slice(0, 10)}) -> ${res}`);
  }
  if (!done.length) console.log(`${label}: no finished fixture in the last 3 days in the snapshot`);
}
