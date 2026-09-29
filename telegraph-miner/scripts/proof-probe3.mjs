/**
 * Probe #3 — follow-ups from the docs review:
 *  - what does /scores/historical actually contain (Stats? roots?).
 *  - do PL/MLS fixtures answer scores/odds on the free tier, as the tier
 *    page claims ("All subscriptions include Scores and StablePrice Odds",
 *    bundle = NFL, MLS, Premier League, World Cup & Int Friendlies)?
 * Run: set -a && . ../.env.agent && set +a && node /tmp/proof-probe3.mjs
 */
const BASE = 'https://txline.txodds.com/api';
const headers = () => ({
  Authorization: `Bearer ${process.env.TXLINE_GUEST_JWT}`,
  'X-Api-Token': process.env.TXLINE_API_TOKEN,
});
const get = async (p) => {
  const r = await fetch(BASE + p, { headers: headers(), signal: AbortSignal.timeout(20_000) });
  return { s: r.status, t: await r.text() };
};

const hist = await get('/scores/historical/18041502');
console.log('historical status:', hist.s, 'len:', hist.t.length);
const keys = [...new Set([...hist.t.matchAll(/"(\w+)":/g)].map((m) => m[1]))];
console.log('keys seen:', keys.join(','));
console.log('mentions Root:', /root/i.test(hist.t), '| Proof:', /proof/i.test(hist.t), '| "Stats":', /"Stats"/.test(hist.t));

const fs = await (await fetch(`${BASE}/fixtures/snapshot`, { headers: headers(), signal: AbortSignal.timeout(90_000) })).json();
console.log('fixtures:', fs.length);
// The fixtures snapshot is forward-only, but an *upcoming* fixture still
// answers the access question: 200 (empty or not) means we have the bundle,
// 403 "Bundle access denied" means the tier claim is not being honoured.
for (const [label, name] of [['PL', 'Premier League'], ['MLS', 'MLS'], ['WorldCup-ctl', 'NFL']]) {
  const f = fs.find((x) => String(x.Competition || '').includes(name));
  if (!f) { console.log(`${label}: none in snapshot`); continue; }
  const snap = await get(`/scores/snapshot/${f.FixtureId}`);
  const odds = await get(`/odds/snapshot/${f.FixtureId}`);
  console.log(`${label} ${f.FixtureId} ${f.Participant1} v ${f.Participant2} ${new Date(Number(f.StartTime)).toISOString().slice(0, 16)}`);
  console.log(`  scores: ${snap.s} ${snap.t.slice(0, 90)}`);
  console.log(`  odds:   ${odds.s} ${odds.t.slice(0, 90)}`);
}
