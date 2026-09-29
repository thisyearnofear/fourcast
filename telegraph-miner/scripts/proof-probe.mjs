/**
 * One-shot probe: which stat-validation calls does TxLINE actually accept for
 * a finalised NFL fixture? Run from telegraph-miner/ with the token env loaded:
 *   set -a && . ../.env.agent && set +a && node /tmp/proof-probe.mjs
 * Nothing in the repo depends on it; it exists to answer "do free-tier proofs
 * exist, and with which statKeys".
 */
import { txline } from '/home/linuxuser/fourcast/telegraph-miner/src/txline.js';

const F = Number(process.argv[2] || 18041502);

// Find the game_finalised Seq live rather than hard-coding a stale one.
const events = await txline.getScoreSnapshot(F);
const sorted = [...events].sort((a, b) => (a.Seq || 0) - (b.Seq || 0));
const final = sorted.findLast((e) => e.Action === 'game_finalised');
if (!final) {
  console.log(`fixture ${F}: no game_finalised event (${sorted.length} events)`);
  process.exit(0);
}
const SEQ = final.Seq;
const statKeysSeen = final.Stats ? Object.keys(final.Stats) : [];
console.log(`fixture ${F} final Seq=${SEQ} Stats keys on the event: [${statKeysSeen.join(',')}]`);
console.log(`Score shape: ${JSON.stringify(final.Score)?.slice(0, 220)}`);

const keySets = [
  [1, 2],
  [1],
  [2],
  ...statKeysSeen.map(Number).filter((k) => ![1, 2].includes(k)).map((k) => [k]),
  statKeysSeen.map(Number).filter((k) => [1, 2].includes(k)),
  statKeysSeen.length > 2 ? statKeysSeen.map(Number) : null,
].filter((k) => k && k.length);

for (const keys of keySets) {
  const label = `statKeys=${keys.join(',')}`;
  for (const [ep, fn] of [['proof (V2 statKeys=)', txline.getMerkleProof], ['proof (legacy statKey=)', (f, s) => txline.getStatProofLegacy(f, s, 1, 2)]]) {
    try {
      const r = await fn(F, SEQ, keys);
      console.log(`${ep} ${label} -> OK ${JSON.stringify(r).slice(0, 300)}`);
    } catch (e) {
      console.log(`${ep} ${label} -> ${String(e.message).slice(0, 120)}`);
    }
  }
}
