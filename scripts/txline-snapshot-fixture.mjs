/**
 * Snapshot a TxLINE fixture's full data (scores snapshot + stat-validation
 * proof) into the cached replay directory so the /world-cup page can serve a
 * deterministic "replay + verify" demo even after TxLINE access ends.
 *
 * Usage: node scripts/txline-snapshot-fixture.mjs <fixtureId> [seq]
 *
 * Defaults to fixtureId=18175981 seq=991 (the documented World Cup demo fixture
 * with real Merkle proofs on devnet).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPLAY_DIR = path.join(__dirname, '..', 'cache', 'txline', 'replays');

const fixtureId = Number(process.argv[2] || 18175981);
const seq = Number(process.argv[3] || 991);

const API_ORIGIN = process.env.TXLINE_API_ORIGIN || 'https://txline-dev.txodds.com';
const JWT = process.env.TXLINE_GUEST_JWT;
const TOKEN = process.env.TXLINE_API_TOKEN;

if (!JWT || !TOKEN) {
  console.error('TXLINE_GUEST_JWT and TXLINE_API_TOKEN must be set in env.');
  console.error('Run scripts/txline-subscribe-and-activate.mjs first.');
  process.exit(1);
}

async function apiGet(p) {
  const res = await fetch(`${API_ORIGIN}/api${p}`, {
    headers: { Authorization: `Bearer ${JWT}`, 'X-Api-Token': TOKEN },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${p} -> ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text);
}

function bytesToHex(arr) {
  if (!Array.isArray(arr)) return null;
  return Buffer.from(arr).toString('hex');
}

/**
 * Extract final score from a TxLINE scores snapshot. The Score block lives on
 * the latest action_amend record (or game_finalised if present) and is shaped
 * like { Participant1: { Total: { Goals: 3, Corners: 11 } }, Participant2: {...} }.
 */
function extractFinalScore(scoresRows) {
  if (!Array.isArray(scoresRows) || scoresRows.length === 0) return null;
  const finalised = scoresRows.find((r) => r.Action === 'game_finalised');
  const latest = scoresRows[scoresRows.length - 1];
  const record = finalised || latest;
  if (!record?.Score) return null;
  const p1 = record.Score.Participant1 || {};
  const p2 = record.Score.Participant2 || {};
  return {
    homeGoals: p1.Total?.Goals ?? p1.H2?.Goals ?? null,
    awayGoals: p2.Total?.Goals ?? p2.H2?.Goals ?? null,
    homeCorners: p1.Total?.Corners ?? null,
    awayCorners: p2.Total?.Corners ?? null,
    statusId: record.StatusId ?? null,
    period: record.Period ?? null,
    seq: record.Seq ?? null,
    ts: record.Ts ? new Date(Number(record.Ts)).toISOString() : null,
  };
}

async function main() {
  console.log(`Snapshotting fixture ${fixtureId} (seq ${seq})...`);
  console.log(`API host: ${API_ORIGIN}`);

  const [fixtures, scoresRows, validation] = await Promise.all([
    apiGet(`/fixtures/snapshot?competitionId=72`).then((rows) =>
      (Array.isArray(rows) ? rows : []).find((r) => r.FixtureId === fixtureId)
    ).catch((e) => { console.warn('fixtures fetch failed:', e.message); return null; }),
    apiGet(`/scores/snapshot/${fixtureId}`).catch((e) => {
      console.warn('scores fetch failed:', e.message); return [];
    }),
    apiGet(`/scores/stat-validation?fixtureId=${fixtureId}&seq=${seq}&statKeys=1,2`).catch((e) => {
      console.warn('stat-validation fetch failed:', e.message); return null;
    }),
  ]);

  if (!fixtures && !scoresRows.length) {
    console.error('Could not find fixture in fixtures list or scores snapshot.');
    process.exit(1);
  }

  const score = extractFinalScore(scoresRows);

  // Build the cached replay payload
  const replay = {
    fixture: {
      FixtureId: fixtureId,
      Competition: fixtures?.Competition || 'World Cup',
      CompetitionId: fixtures?.CompetitionId || 72,
      FixtureGroupId: fixtures?.FixtureGroupId || null,
      Participant1: fixtures?.Participant1 || null,
      Participant2: fixtures?.Participant2 || null,
      Participant1Id: fixtures?.Participant1Id || null,
      Participant2Id: fixtures?.Participant2Id || null,
      Participant1IsHome: fixtures?.Participant1IsHome ?? true,
      StartTime: fixtures?.StartTime || null,
      Ts: fixtures?.Ts || null,
      GameState: fixtures?.GameState || (score?.statusId === 100 ? 'final' : 'scheduled'),
    },
    finalScore: score,
    events: (Array.isArray(scoresRows) ? scoresRows : []).map((r) => ({
      seq: r.Seq,
      action: r.Action,
      ts: r.Ts ? new Date(Number(r.Ts)).toISOString() : null,
      statusId: r.StatusId ?? null,
      period: r.Period ?? null,
      clock: r.Clock ?? null,
      score: r.Score || null,
    })),
    proof: validation
      ? {
          sequence: seq,
          fixtureId,
          statKeys: (validation.statsToProve || []).map((s) => s.key),
          statsToProve: validation.statsToProve || [],
          eventStatRoot: bytesToHex(validation.eventStatRoot),
          eventStatsSubTreeRoot: bytesToHex(validation.summary?.eventStatsSubTreeRoot),
          updateCount: validation.summary?.updateStats?.updateCount ?? null,
          minTimestamp: validation.summary?.updateStats?.minTimestamp ?? null,
          maxTimestamp: validation.summary?.updateStats?.maxTimestamp ?? null,
          statProofs: (validation.statProofs || []).map((path) =>
            (Array.isArray(path) ? path : []).map((node) => ({
              hash: bytesToHex(node?.hash) || bytesToHex(node),
              direction: node?.direction || null,
            }))
          ),
          mainTreeProof: (validation.mainTreeProof || []).map((node) => ({
            hash: bytesToHex(node?.hash) || bytesToHex(node),
            direction: node?.direction || null,
          })),
          subTreeProof: (validation.subTreeProof || []).map((node) => ({
            hash: bytesToHex(node?.hash) || bytesToHex(node),
            direction: node?.direction || null,
          })),
          // The on-chain program ID and PDA - populated by /api/worldcup/verify
          // by reading the TxLINE program ID from the active network config.
          programId: null,
          dailyRootPda: null,
        }
      : null,
    snapshot: {
      takenAt: new Date().toISOString(),
      apiOrigin: API_ORIGIN,
    },
  };

  fs.mkdirSync(REPLAY_DIR, { recursive: true });
  const outPath = path.join(REPLAY_DIR, `${fixtureId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(replay, null, 2));
  console.log('Wrote snapshot:', outPath);
  console.log('Final score:', JSON.stringify(score, null, 2));
  console.log('Events:', replay.events.length);
  console.log('Proof:', replay.proof ? {
    statKeys: replay.proof.statKeys,
    eventStatRoot: replay.proof.eventStatRoot,
    subTreeProofLen: replay.proof.subTreeProof?.length || 0,
    mainTreeProofLen: replay.proof.mainTreeProof?.length || 0,
    statProofsLen: replay.proof.statProofs?.length || 0,
  } : 'none');
}

main().catch((e) => {
  console.error('FATAL:', e.message);
  console.error(e.stack);
  process.exit(1);
});
