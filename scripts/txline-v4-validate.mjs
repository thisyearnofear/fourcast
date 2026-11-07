#!/usr/bin/env node
/**
 * TxLINE v4 on-chain stat validation — the CURRENT txoracle interface.
 *
 * Flow (all on Solana devnet, program 6pW64…P2J):
 *   1. book_fixture          — one-time per fixture (price 0 under subscription)
 *   2. validate_fixture_for_tree — stages a worker_ticket with the day's root
 *   3. validate_stat_v4      — ed25519-signed API payload + strategy → bool
 *   4. close_worker_ticket   — reclaim rent
 *
 * Usage:
 *   node scripts/txline-v4-validate.mjs [--fixture 18041541] [--seq 1631] [--stat-keys 1,2]
 *
 * Reads wallet from ESCROW_LOCKER_KEYPAIR (default ~/.config/solana/id.json)
 * and API auth from cache/txline/devnet-auth.json (run txline-devnet-onboard.mjs first).
 */
import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { join } from 'path';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  SystemProgram,
  Ed25519Program,
} from '@solana/web3.js';
import { TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from '@solana/spl-token';

// ─── config ────────────────────────────────────────────────────────────────
const RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const API_ORIGIN = process.env.TXLINE_DEVNET_API || 'https://txline-dev.txodds.com';
const PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
const TXL_MINT = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG');
const BACKEND_ADMIN = new PublicKey('Ah5xwzHxRYBBV3BWHDCHdfzQJfBehzGQcc7A9QX1DLUB');
const SYSVAR_IX = new PublicKey('Sysvar1nstructions1111111111111111111111111');

const DISC = {
  book_fixture: Buffer.from([48, 127, 234, 70, 187, 214, 206, 109]),
  validate_fixture_for_tree: Buffer.from([118, 85, 77, 234, 117, 87, 168, 190]),
  validate_stat_v4: Buffer.from([17, 11, 195, 64, 250, 26, 27, 211]),
  close_worker_ticket: Buffer.from([51, 20, 55, 115, 249, 56, 9, 14]),
};

const STAT_DOMAIN = 1;
const WORKER_ID = 1;

// ─── args ──────────────────────────────────────────────────────────────────
const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : dflt;
};
const FIXTURE_ID = Number(arg('fixture', '18041541'));
const SEQ = Number(arg('seq', '1631'));
const STAT_KEYS = arg('stat-keys', '1,2');

// ─── borsh helpers ─────────────────────────────────────────────────────────
const u8 = (n) => Buffer.from([n & 0xff]);
const bool = (b) => u8(b ? 1 : 0);
const u16 = (n) => { const b = Buffer.alloc(2); b.writeUInt16LE(n); return b; };
const u32 = (n) => { const b = Buffer.alloc(4); b.writeUInt32LE(n >>> 0); return b; };
const i32 = (n) => { const b = Buffer.alloc(4); b.writeInt32LE(n); return b; };
const i64 = (n) => { const b = Buffer.alloc(8); b.writeBigInt64LE(BigInt(n)); return b; };
const bytes32 = (a) => Buffer.from(a);
const pubkey = (pk) => pk.toBuffer();
const vec = (items) => Buffer.concat([u32(items.length), ...items]);
const opt = (v, enc) => (v == null ? u8(0) : Buffer.concat([u8(1), enc(v)]));

const proofNode = (n) => Buffer.concat([bytes32(toBytes32(n.hash)), bool(n.isRightSibling ?? n.is_right_sibling)]);
const proofVec = (nodes) => vec((nodes || []).map(proofNode));

function toBytes32(v) {
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

// ─── payload encoders ──────────────────────────────────────────────────────
function encodeBookFixturePayload(p) {
  return Buffer.concat([
    pubkey(new PublicKey(p.user)),
    u32(p.fixtureId),
    u32(p.price),
    i64(p.ts),
    i64(p.validity),
  ]);
}

function encodeBatchSummary(s) {
  return Buffer.concat([
    i64(s.fixtureId),
    i32(s.updateStats.updateCount),
    i64(s.updateStats.minTimestamp),
    i64(s.updateStats.maxTimestamp),
    bytes32(toBytes32(s.subTreeRoot ?? s.eventStatsSubTreeRoot ?? s.sub_tree_root)),
  ]);
}

function encodeFixtureForTreeInput(p) {
  return Buffer.concat([
    i64(p.ts),
    u8(p.domain),
    u16(p.workerId),
    encodeBatchSummary(p.summary),
    proofVec(p.mainTreeProof ?? p.main_tree_proof),
  ]);
}

function encodeScoreStat(s) {
  return Buffer.concat([u32(s.key), i32(s.value), i32(s.period)]);
}

function encodeStatLeafV2(l) {
  return Buffer.concat([encodeScoreStat(l.stat), bool(l.isZero ?? l.is_zero)]);
}

function encodeStatLeafV1(l) {
  return Buffer.concat([encodeScoreStat(l.stat), proofVec(l.statProof ?? l.stat_proof)]);
}

const CMP = { greaterThan: 0, lessThan: 1, equalTo: 2 };
function encodeComparison(c) {
  if (typeof c === 'number') return u8(c);
  const k = Object.keys(c)[0];
  return u8(CMP[k]);
}
const BINOP = { add: 0, subtract: 1 };
function encodeBinaryOp(op) {
  if (typeof op === 'number') return u8(op);
  return u8(BINOP[Object.keys(op)[0]]);
}
function encodeTraderPredicate(p) {
  return Buffer.concat([i32(p.threshold), encodeComparison(p.comparison)]);
}
function encodeGeometricTarget(g) {
  return Buffer.concat([u8(g.statIndex ?? g.stat_index), i32(g.prediction)]);
}
function encodeStatPredicate(sp) {
  if (sp.single) {
    return Buffer.concat([u8(0), u8(sp.single.index), encodeTraderPredicate(sp.single.predicate)]);
  }
  const b = sp.binary;
  return Buffer.concat([
    u8(1),
    u8(b.index_a ?? b.indexA),
    u8(b.index_b ?? b.indexB),
    encodeBinaryOp(b.op),
    encodeTraderPredicate(b.predicate),
  ]);
}
function encodeStrategy(s) {
  return Buffer.concat([
    vec((s.geometricTargets || s.geometric_targets || []).map(encodeGeometricTarget)),
    opt(s.distancePredicate ?? s.distance_predicate ?? null, encodeTraderPredicate),
    vec((s.discretePredicates || s.discrete_predicates || []).map(encodeStatPredicate)),
  ]);
}

// StatValidationPayload — V1=0, V2=1
function encodeStatPayloadV1(p) {
  return Buffer.concat([
    u8(0),
    i64(p.ts),
    bytes32(toBytes32(p.eventStatRoot ?? p.event_stat_root)),
    proofVec(p.fixtureProof ?? p.fixture_proof),
    vec((p.leaves || []).map(encodeStatLeafV1)),
    proofVec(p.multiproofHashes ?? p.multiproof_hashes),
    vec((p.leafIndices ?? p.leaf_indices ?? []).map(u32)),
  ]);
}
function encodeStatPayloadV2(p) {
  const mask = p.rawMask ?? p.raw_mask;
  return Buffer.concat([
    u8(1),
    i64(p.ts),
    bytes32(toBytes32(p.eventStatRoot ?? p.event_stat_root)),
    proofVec(p.fixtureProof ?? p.fixture_proof),
    vec((p.leaves || []).map(encodeStatLeafV2)),
    proofVec(p.multiproofHashes ?? p.multiproof_hashes),
    vec((p.leafIndices ?? p.leaf_indices ?? []).map(u32)),
    opt(mask ? toBytes32(mask) : null, (m) => m),
  ]);
}
function encodeStatPayload(p, isV2) {
  return isV2 ? encodeStatPayloadV2(p) : encodeStatPayloadV1(p);
}

// ─── helpers ───────────────────────────────────────────────────────────────
const sha256 = (b) => createHash('sha256').update(b).digest();
const api = async (path) => {
  const r = await fetch(`${API_ORIGIN}/api${path}`, {
    headers: { Authorization: `Bearer ${auth.jwt}`, 'X-Api-Token': auth.apiToken },
  });
  const t = await r.text();
  if (!r.ok) throw new Error(`${path} -> ${r.status}: ${t.slice(0, 300)}`);
  return JSON.parse(t);
};

function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}
const fixtureTicketPda = (user, fid) =>
  pda([Buffer.from('fixture_ticket'), user.toBuffer(), u32(fid)]);
const workerTicketPda = (user, domain, workerId) =>
  pda([Buffer.from('worker_ticket'), user.toBuffer(), u8(domain), u16(workerId)]);
const dailyScoresPda = (ts) =>
  pda([Buffer.from('daily_scores_roots'), u16(Math.floor(ts / 86400000))]);
const tokenTreasuryPda = () => pda([Buffer.from('token_treasury_v2')]);

async function sendTx(connection, wallet, ixs, label) {
  const tx = new Transaction();
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }));
  tx.add(...ixs);
  tx.feePayer = wallet.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(wallet);
  const sig = await connection.sendRawTransaction(tx.serialize());
  const conf = await connection.confirmTransaction(sig, 'confirmed');
  if (conf.value.err) throw new Error(`${label} failed on-chain: ${JSON.stringify(conf.value.err)}`);
  console.log(`${label}: ${sig}`);
  console.log(`  https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  return sig;
}

async function getReturnData(connection, sig) {
  const tx = await connection.getTransaction(sig, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 0,
  });
  const rd = tx?.meta?.returnData?.data?.[0];
  if (rd) return Buffer.from(rd, 'base64')[0] === 1;
  const prefix = `Program return: ${PROGRAM_ID.toBase58()} `;
  const log = tx?.meta?.logMessages?.find((l) => l.startsWith(prefix));
  if (log) return Buffer.from(log.slice(prefix.length).trim(), 'base64')[0] === 1;
  return null;
}

// ─── main ──────────────────────────────────────────────────────────────────
const keypairPath = process.env.ESCROW_LOCKER_KEYPAIR || join(homedir(), '.config/solana/id.json');
const wallet = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync(keypairPath, 'utf8'))));
const auth = JSON.parse(readFileSync(join(process.cwd(), 'cache', 'txline', 'devnet-auth.json'), 'utf8'));
const connection = new Connection(RPC_URL, 'confirmed');
const user = wallet.publicKey;

console.log('wallet:', user.toBase58());
console.log(`fixture: ${FIXTURE_ID} seq:${SEQ} statKeys:${STAT_KEYS}`);

// ── 1. book_fixture ────────────────────────────────────────────────────────
const fixTicket = fixtureTicketPda(user, FIXTURE_ID);
const existing = await connection.getAccountInfo(fixTicket);
if (!existing) {
  const quote = await api(`/quotes/book-fixture?fixtureId=${FIXTURE_ID}&pubkey=${user.toBase58()}`);
  const qp = quote.payload;
  console.log(`booking fixture (price=${qp.price})…`);
  const payloadEnc = encodeBookFixturePayload({
    user: qp.user, fixtureId: qp.fixtureId, price: qp.price, ts: qp.ts, validity: qp.validity,
  });
  const payloadHash = sha256(payloadEnc);
  const edIx = Ed25519Program.createInstructionWithPublicKey({
    publicKey: BACKEND_ADMIN.toBuffer(),
    message: payloadHash,
    signature: Buffer.from(quote.signature, 'base64'),
  });
  const bookData = Buffer.concat([DISC.book_fixture, payloadEnc]);
  const treasury = tokenTreasuryPda();
  const userAta = getAssociatedTokenAddressSync(TXL_MINT, user, false, TOKEN_2022_PROGRAM_ID);
  const treasuryVault = getAssociatedTokenAddressSync(TXL_MINT, treasury, true, TOKEN_2022_PROGRAM_ID);
  const bookIx = new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: user, isSigner: true, isWritable: true },
      { pubkey: fixTicket, isSigner: false, isWritable: true },
      { pubkey: TXL_MINT, isSigner: false, isWritable: false },
      { pubkey: userAta, isSigner: false, isWritable: true },
      { pubkey: treasuryVault, isSigner: false, isWritable: true },
      { pubkey: treasury, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_IX, isSigner: false, isWritable: false },
      { pubkey: TOKEN_2022_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: bookData,
  });
  await sendTx(connection, wallet, [edIx, bookIx], 'book_fixture');
} else {
  console.log('fixture already booked, reusing fixture_ticket');
}

// ── 2. fetch v4 proof payload ──────────────────────────────────────────────
const v4 = await api(`/scores/stat-validation-v4?fixtureId=${FIXTURE_ID}&seq=${SEQ}&statKeys=${STAT_KEYS}`);
const isV2 = v4.version === 'v2' || v4.version === 2;
console.log(`proof version: ${v4.version}`);
const payload = v4.payload;

// ── 3. validate_fixture_for_tree (stage worker ticket) ─────────────────────
const workerTicket = workerTicketPda(user, STAT_DOMAIN, WORKER_ID);
const dayPda = dailyScoresPda(payload.ts);
const treeInput = {
  ts: payload.ts,
  domain: STAT_DOMAIN,
  workerId: WORKER_ID,
  summary: payload.summary,
  mainTreeProof: payload.mainTreeProof,
};
const treeArgs = encodeFixtureForTreeInput(treeInput);
const treeIx = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: workerTicket, isSigner: false, isWritable: true },
    { pubkey: dayPda, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([DISC.validate_fixture_for_tree, treeArgs]),
});
await sendTx(connection, wallet, [treeIx], 'validate_fixture_for_tree');

// ── 4. validate_stat_v4 ────────────────────────────────────────────────────
const statPayload = isV2 ? encodeStatPayloadV2(payload) : encodeStatPayloadV1(payload);
const payloadHash = sha256(statPayload);
const signatureBytes = Buffer.from(v4.signature, 'base64');
const edIx = Ed25519Program.createInstructionWithPublicKey({
  publicKey: BACKEND_ADMIN.toBuffer(),
  message: payloadHash,
  signature: signatureBytes,
});
// args: worker_id u16 + payload enum + strategy
const strategy = {
  geometricTargets: [],
  distancePredicate: null,
  discretePredicates: [
    {
      binary: {
        index_a: 0,
        index_b: 1,
        op: { subtract: {} },
        predicate: { threshold: 0, comparison: { greaterThan: {} } },
      },
    },
  ],
};
const v4Args = Buffer.concat([u16(WORKER_ID), statPayload, encodeStrategy(strategy)]);
const v4Ix = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: workerTicket, isSigner: false, isWritable: false },
    { pubkey: fixTicket, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_IX, isSigner: false, isWritable: false },
  ],
  data: Buffer.concat([DISC.validate_stat_v4, v4Args]),
});
const v4Sig = await sendTx(connection, wallet, [edIx, v4Ix], 'validate_stat_v4');
const result = await getReturnData(connection, v4Sig);
console.log('validate_stat_v4 result (home_score - away_score > 0):', result);

// ── 5. close_worker_ticket ─────────────────────────────────────────────────
const closeArgs = Buffer.concat([u8(STAT_DOMAIN), u16(WORKER_ID)]);
const closeIx = new TransactionInstruction({
  programId: PROGRAM_ID,
  keys: [
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: workerTicket, isSigner: false, isWritable: true },
  ],
  data: Buffer.concat([DISC.close_worker_ticket, closeArgs]),
});
await sendTx(connection, wallet, [closeIx], 'close_worker_ticket');

console.log('\ndone.');
