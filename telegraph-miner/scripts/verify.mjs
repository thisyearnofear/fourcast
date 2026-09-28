#!/usr/bin/env node
/**
 * Check a Fourcast miner answer without trusting the miner.
 *
 *   node scripts/verify.mjs --team "Inter Miami" --intent GAME_RESULT
 *   node scripts/verify.mjs --query "Did the Dodgers win?"
 *   node scripts/verify.mjs --file saved-response.json
 *   node scripts/verify.mjs --url http://localhost:8402 --team Dodgers
 *
 * Three independent checks, each reported on its own line and never merged
 * into one tick:
 *
 *   1. attestation  The Ed25519 signature verifies under the key published at
 *                   /.well-known/fourcast-miner.json — *this miner said it*.
 *   2. consistency  The values shown at the top level of the response are the
 *                   values that were signed — nothing was changed in between.
 *   3. proof        Only for TxLINE answers that carry one: the Merkle proof is
 *                   well-formed and its root matches the daily root on Solana —
 *                   *the data is anchored*. ESPN answers have no proof and are
 *                   reported as "not independently verifiable", not as passing.
 *
 * Exit code: 0 when every check that applies passed, 1 otherwise. A check that
 * could not be performed is reported as such and does not count as a pass.
 *
 * Env: SOLANA_RPC_URL (default mainnet-beta), TXORACLE_PROGRAM_ID.
 */

import { readFile } from 'node:fs/promises';
import { PublicKey } from '@solana/web3.js';
import { verifyAttestation } from '../src/attest.js';

const flag = (name) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : undefined;
};

const BASE = (flag('--url') ?? process.env.MINER_URL ?? 'https://miner.sportwarren.com').replace(/\/$/, '');
const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com';
const DEFAULT_PROGRAM = process.env.TXORACLE_PROGRAM_ID ?? '6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J';

const lines = [];
let failed = false;
function report(name, state, detail) {
  // state: pass | fail | n/a
  if (state === 'fail') failed = true;
  const mark = { pass: 'PASS', fail: 'FAIL', 'n/a': ' -- ' }[state];
  lines.push(`  [${mark}] ${name.padEnd(12)} ${detail}`);
}

async function getJson(url, init) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(60_000) });
  const text = await res.text();
  try {
    return { status: res.status, body: JSON.parse(text) };
  } catch {
    throw new Error(`${url} -> ${res.status}, not JSON: ${text.slice(0, 120)}`);
  }
}

async function obtainResponse() {
  const file = flag('--file');
  if (file) return JSON.parse(await readFile(file, 'utf8'));
  const query = flag('--query');
  const team = flag('--team');
  if (!query && !team) throw new Error('give --file, --query "…" or --team NAME [--intent GAME_RESULT] [--competition MLB]');
  const body = query
    ? { query }
    : {
        intent: flag('--intent') ?? 'GAME_RESULT',
        params: { team, ...(flag('--competition') ? { competition: flag('--competition') } : {}), ...(flag('--date') ? { date: flag('--date') } : {}) },
      };
  const { status, body: out } = await getJson(`${BASE}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (status !== 200) throw new Error(`/query -> ${status}: ${JSON.stringify(out).slice(0, 200)}`);
  return out;
}

// ─── proof ─────────────────────────────────────────────────────────────────

const hex = (h) => {
  if (Array.isArray(h)) return h.map((b) => Number(b).toString(16).padStart(2, '0')).join('');
  return typeof h === 'string' ? h.replace(/^0x/, '').toLowerCase() : '';
};

async function rpc(method, params) {
  const res = await fetch(RPC, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  if (json.error) throw new Error(JSON.stringify(json.error));
  return json.result;
}

async function checkProof(answer) {
  if (!answer) return report('proof', 'n/a', 'no answer to prove');
  if (answer.source !== 'txline') {
    return report('proof', 'n/a', `source "${answer.source}" carries no proof — signed, not independently verifiable`);
  }
  const p = answer.proof;
  if (!p?.verifiable) return report('proof', 'n/a', `TxLINE published no proof for this answer${p?.reason ? ` (${p.reason})` : ''}`);
  if (answer.verified !== true) return report('proof', 'fail', 'proof present but answer.verified is not true');

  const raw = p.source_payload ?? {};
  const root = hex(p.merkle_root ?? raw.eventStatRoot ?? raw.root);
  if (root.length !== 64) return report('proof', 'fail', `merkle root is not 32 bytes (${root.length / 2})`);

  const paths = [
    ...(raw.statProofs ?? (raw.statProof ? [raw.statProof] : [])).flat(),
    ...(raw.mainTreeProof ?? []),
    ...(raw.subTreeProof ?? []),
  ].map((n) => hex(n?.hash ?? n));
  if (!paths.length) {
    report('proof', 'fail', 'no proof path in source_payload — root alone proves nothing');
  } else {
    const bad = paths.filter((h) => h.length !== 64).length;
    report('proof-shape', bad ? 'fail' : 'pass', `${paths.length} proof nodes, ${bad} malformed`);
  }

  const ts = raw.ts ?? raw.summary?.updateStats?.minTimestamp;
  if (!ts) return report('proof-chain', 'n/a', 'proof has no timestamp; cannot derive the daily root account');
  const programId = new PublicKey(p.program_id || raw.programId || DEFAULT_PROGRAM);
  const day = Math.floor(Number(ts) / 86_400_000);
  const dayLe = Buffer.alloc(2);
  dayLe.writeUInt16LE(day & 0xffff);
  const [pda] = PublicKey.findProgramAddressSync([Buffer.from('daily_scores_roots'), dayLe], programId);
  try {
    const acct = await rpc('getAccountInfo', [pda.toBase58(), { encoding: 'base64' }]);
    if (!acct?.value) return report('proof-chain', 'fail', `daily root account ${pda.toBase58()} not found on ${RPC}`);
    const data = Buffer.from(acct.value.data[0], 'base64');
    if (data.length < 48) return report('proof-chain', 'fail', `daily root account too short (${data.length} bytes)`);
    const onChain = data.subarray(16, 48).toString('hex');
    report(
      'proof-chain',
      onChain === root ? 'pass' : 'fail',
      onChain === root
        ? `root matches Solana account ${pda.toBase58()}`
        : `on-chain root ${onChain.slice(0, 12)}… ≠ proof root ${root.slice(0, 12)}… (account ${pda.toBase58()}) — layout or batch may differ; not verified`
    );
  } catch (err) {
    report('proof-chain', 'fail', `could not read Solana (${err.message}) — not verified`);
  }
}

// ─── main ──────────────────────────────────────────────────────────────────

async function main() {
  const response = await obtainResponse();
  const att = response?.metadata?.attestation;

  console.log(`miner   ${BASE}`);
  console.log(`answer  ${response.reason ?? '(no reason)'}  [${response.intent ?? '?'} · source ${response.answer?.source ?? response.metadata?.source ?? 'none'}]`);

  // 1. attestation, against the *published* key — not the one in the response.
  let signed = null;
  try {
    const { body: keys } = await getJson(`${BASE}/.well-known/fourcast-miner.json`);
    const published = keys?.signing?.public_key;
    if (!published) {
      report('attestation', 'fail', 'no public key published at /.well-known/fourcast-miner.json');
    } else {
      const v = verifyAttestation(att, published);
      signed = v.ok ? v.fields : null;
      const note = keys.signing.persistent ? '' : ' (key is ephemeral: valid only until the miner restarts)';
      report('attestation', v.ok ? 'pass' : 'fail', v.ok ? `Ed25519 signature verifies under ${published.slice(0, 16)}…${note}` : v.reason);
    }
  } catch (err) {
    report('attestation', 'fail', `could not read the published key: ${err.message}`);
  }

  // 2. what is shown == what is signed.
  if (signed) {
    const a = response.answer ?? {};
    const pairs = [
      ['score', response.score, signed.score],
      ['label', response.label, signed.label],
      ['winner', a.winner ?? null, signed.winner],
      ['home_score', a.home_score ?? null, signed.home_score],
      ['away_score', a.away_score ?? null, signed.away_score],
      ['fixture_id', a.fixture_id ?? null, signed.fixture_id],
    ];
    const diff = pairs.filter(([, shown, sig]) => (shown ?? null) !== (sig ?? null));
    report('consistency', diff.length ? 'fail' : 'pass', diff.length ? `shown ≠ signed: ${diff.map((d) => d[0]).join(', ')}` : 'displayed values are the signed values');
  } else {
    report('consistency', 'n/a', 'skipped: attestation did not verify');
  }

  // 3. the data itself.
  await checkProof(response.answer);

  console.log(lines.join('\n'));
  console.log(failed ? '\nresult: NOT fully verified' : '\nresult: every applicable check passed');
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(`verify failed: ${err.message}`);
  process.exit(1);
});
