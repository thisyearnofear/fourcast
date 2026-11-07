/**
 * Shared TxLINE v4 Borsh codec + API helpers (devnet txoracle 1.5.17+).
 * Mirrors idl layout — keep in sync with scripts/txline-v4-validate.mjs.
 */
import { createHash } from 'crypto';
import { PublicKey } from '@solana/web3.js';

export const TXORACLE_PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
export const TXL_MINT = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG');
export const BACKEND_ADMIN = new PublicKey('Ah5xwzHxRYBBV3BWHDCHdfzQJfBehzGQcc7A9QX1DLUB');
export const STAT_DOMAIN = 1;
export const WORKER_ID = 1;

export const u8 = (n) => Buffer.from([n & 0xff]);
export const bool = (b) => u8(b ? 1 : 0);
export const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
export const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
export const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
export const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
export const vec = (items) => Buffer.concat([u32(items.length), ...items]);
export const opt = (v, enc) => (v == null ? u8(0) : Buffer.concat([u8(1), enc(v)]));

export function toBytes32(v) {
  if (Buffer.isBuffer(v)) return v;
  if (Array.isArray(v)) return Buffer.from(v);
  if (typeof v === 'string') {
    const s = v.startsWith('0x') ? v.slice(2) : v;
    if (/^[0-9a-fA-F]{64}$/.test(s)) return Buffer.from(s, 'hex');
    return Buffer.from(v, 'base64');
  }
  if (v instanceof Uint8Array) return Buffer.from(v);
  throw new Error('cannot decode 32-byte hash');
}
const bytes32 = (a) => Buffer.from(toBytes32(a));
const pubkey = (pk) => (pk instanceof PublicKey ? pk.toBuffer() : Buffer.from(pk));

export const proofNode = (n) =>
  Buffer.concat([bytes32(n.hash), bool(n.isRightSibling ?? n.is_right_sibling)]);
export const proofVec = (nodes) => vec((nodes || []).map(proofNode));

// ─── encoders ──────────────────────────────────────────────────────────────
export function encodeBookFixturePayload(p) {
  return Buffer.concat([
    pubkey(new PublicKey(p.user)), u32(p.fixtureId), u32(p.price), i64(p.ts), i64(p.validity),
  ]);
}

export function encodeBatchSummary(s) {
  return Buffer.concat([
    i64(s.fixtureId),
    i32(s.updateStats.updateCount),
    i64(s.updateStats.minTimestamp),
    i64(s.updateStats.maxTimestamp),
    bytes32(s.subTreeRoot ?? s.eventStatsSubTreeRoot ?? s.sub_tree_root),
  ]);
}

export function encodeFixtureForTreeInput(p) {
  return Buffer.concat([
    i64(p.ts), u8(p.domain), u16(p.workerId),
    encodeBatchSummary(p.summary),
    proofVec(p.mainTreeProof ?? p.main_tree_proof),
  ]);
}

const encodeScoreStat = (s) => Buffer.concat([u32(s.key), i32(s.value), i32(s.period)]);
const encodeStatLeafV1 = (l) => Buffer.concat([encodeScoreStat(l.stat), proofVec(l.statProof ?? l.stat_proof)]);
const encodeStatLeafV2 = (l) => Buffer.concat([encodeScoreStat(l.stat), bool(l.isZero ?? l.is_zero)]);

const CMP = { greaterThan: 0, lessThan: 1, equalTo: 2 };
const encodeComparison = (c) => u8(typeof c === 'number' ? c : CMP[Object.keys(c)[0]]);
const BINOP = { add: 0, subtract: 1 };
const encodeBinaryOp = (op) => u8(typeof op === 'number' ? op : BINOP[Object.keys(op)[0]]);
const encodeTraderPredicate = (p) => Buffer.concat([i32(p.threshold), encodeComparison(p.comparison)]);
const encodeGeometricTarget = (g) => Buffer.concat([u8(g.statIndex ?? g.stat_index), i32(g.prediction)]);

export function encodeStatPredicate(sp) {
  if (sp.single) {
    return Buffer.concat([u8(0), u8(sp.single.index), encodeTraderPredicate(sp.single.predicate)]);
  }
  const b = sp.binary;
  return Buffer.concat([
    u8(1), u8(b.index_a ?? b.indexA), u8(b.index_b ?? b.indexB),
    encodeBinaryOp(b.op), encodeTraderPredicate(b.predicate),
  ]);
}

export function encodeStrategy(s) {
  return Buffer.concat([
    vec((s.geometricTargets || s.geometric_targets || []).map(encodeGeometricTarget)),
    opt(s.distancePredicate ?? s.distance_predicate ?? null, encodeTraderPredicate),
    vec((s.discretePredicates || s.discrete_predicates || []).map(encodeStatPredicate)),
  ]);
}

export function encodeStatPayloadV1(p) {
  return Buffer.concat([
    u8(0), i64(p.ts), bytes32(p.eventStatRoot ?? p.event_stat_root),
    proofVec(p.fixtureProof ?? p.fixture_proof),
    vec((p.leaves || []).map(encodeStatLeafV1)),
    proofVec(p.multiproofHashes ?? p.multiproof_hashes),
    vec((p.leafIndices ?? p.leaf_indices ?? []).map(u32)),
  ]);
}

function toRawBytes(v) {
  if (Buffer.isBuffer(v)) return v;
  if (v instanceof Uint8Array) return Buffer.from(v);
  if (Array.isArray(v)) return Buffer.from(v);
  if (typeof v === 'string') {
    const s = v.startsWith('0x') ? v.slice(2) : v;
    if (/^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0) return Buffer.from(s, 'hex');
    return Buffer.from(v, 'base64');
  }
  throw new Error('cannot decode raw bytes');
}

export function encodeStatPayloadV2(p) {
  const mask = p.rawMask ?? p.raw_mask;
  return Buffer.concat([
    u8(1), i64(p.ts), bytes32(p.eventStatRoot ?? p.event_stat_root),
    proofVec(p.fixtureProof ?? p.fixture_proof),
    vec((p.leaves || []).map(encodeStatLeafV2)),
    proofVec(p.multiproofHashes ?? p.multiproof_hashes),
    vec((p.leafIndices ?? p.leaf_indices ?? []).map(u32)),
    opt(mask == null ? null : toRawBytes(mask), (m) => m),
  ]);
}

export function encodeStatPayload(p, isV2) {
  return isV2 ? encodeStatPayloadV2(p) : encodeStatPayloadV1(p);
}

// The "home win" strategy: stat[0] - stat[1] > 0 (P1 score minus P2 score).
export function homeWinStrategy() {
  return {
    geometricTargets: [],
    distancePredicate: null,
    discretePredicates: [
      {
        binary: {
          index_a: 0, index_b: 1, op: { subtract: {} },
          predicate: { threshold: 0, comparison: { greaterThan: {} } },
        },
      },
    ],
  };
}

export const sha256 = (b) => createHash('sha256').update(b).digest();

// ─── PDAs ──────────────────────────────────────────────────────────────────
const pda = (programId, seeds) => PublicKey.findProgramAddressSync(seeds, programId)[0];
export const fixtureTicketPda = (programId, user, fid) =>
  pda(programId, [Buffer.from('fixture_ticket'), user.toBuffer(), u32(fid)]);
export const workerTicketPda = (programId, user, domain, workerId) =>
  pda(programId, [Buffer.from('worker_ticket'), user.toBuffer(), u8(domain), u16(workerId)]);
export const dailyScoresPda = (programId, ts) =>
  pda(programId, [Buffer.from('daily_scores_roots'), u16(Math.floor(ts / 86400000))]);

// ─── API ───────────────────────────────────────────────────────────────────
export function makeApi(auth, apiOrigin) {
  return async (path) => {
    const r = await fetch(`${apiOrigin}/api${path}`, {
      headers: { Authorization: `Bearer ${auth.jwt}`, 'X-Api-Token': auth.apiToken },
    });
    const t = await r.text();
    if (!r.ok) throw new Error(`${path} -> ${r.status}: ${t.slice(0, 300)}`);
    return JSON.parse(t);
  };
}
