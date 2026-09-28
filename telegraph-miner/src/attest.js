/**
 * Ed25519 attestation over the fields a caller would settle on.
 *
 * What it proves: *this miner* said *these values* at *this time*. Anyone can
 * check it with the public key served at /.well-known/fourcast-miner.json and
 * the snippet there — no trust in the node, no trust in us beyond the key.
 *
 * What it does not prove: that the values are true. That is the job of the
 * TxLINE Merkle proof, which only some answers carry. The two are reported
 * separately so neither is mistaken for the other.
 *
 * Key: MINER_SIGNING_KEY = base64 of a 32-byte Ed25519 seed
 *   (generate: `npm run keygen`). Without it the process signs with an
 *   ephemeral key and says so (`key_persistent: false`) — signatures then stop
 *   verifying after a restart, which is reported rather than hidden.
 */

import nacl from 'tweetnacl';

export const ALGORITHM = 'ed25519';
export const ATTESTATION_VERSION = 1;

/** The settle fields, in the order they are documented. Canonical form sorts keys. */
export const SIGNED_FIELDS = [
  'v', 'miner', 'intent', 'request_id', 'issued_at',
  'fixture_id', 'source', 'competition', 'home_team', 'away_team',
  'home_score', 'away_score', 'status', 'result', 'winner',
  'score', 'label', 'merkle_root',
];

function loadKeyPair() {
  const seedB64 = process.env.MINER_SIGNING_KEY;
  if (seedB64) {
    const seed = Buffer.from(seedB64, 'base64');
    if (seed.length !== 32) {
      throw new Error(`MINER_SIGNING_KEY must be base64 of 32 bytes (got ${seed.length})`);
    }
    return { pair: nacl.sign.keyPair.fromSeed(new Uint8Array(seed)), persistent: true };
  }
  return { pair: nacl.sign.keyPair(), persistent: false };
}

const { pair, persistent } = loadKeyPair();

export const publicKey = Buffer.from(pair.publicKey).toString('base64');
export const keyIsPersistent = persistent;

/** Deterministic JSON: keys sorted, undefined dropped, no whitespace. */
export function canonicalize(obj) {
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return JSON.stringify(Object.fromEntries(keys.map((k) => [k, obj[k]])));
}

/** Pick the signed fields from an answer + its signal scalars. Missing → null. */
export function settleFields({ intent, request_id, answer, signals, issuedAt }) {
  const a = answer || {};
  const s = signals || {};
  const fields = {
    v: ATTESTATION_VERSION,
    miner: 'fourcast-sports-intelligence',
    intent: intent ?? null,
    request_id: request_id ?? null,
    issued_at: issuedAt,
    fixture_id: a.fixture_id ?? null,
    source: a.source ?? null,
    competition: a.competition ?? null,
    home_team: a.home_team ?? null,
    away_team: a.away_team ?? null,
    home_score: a.home_score ?? null,
    away_score: a.away_score ?? null,
    status: a.status ?? null,
    result: a.result ?? null,
    winner: a.winner ?? null,
    score: s.score ?? null,
    label: s.label ?? null,
    merkle_root: a.proof?.merkle_root ?? null,
  };
  return fields;
}

export function attest(fields) {
  const canonical = canonicalize(fields);
  const sig = nacl.sign.detached(new TextEncoder().encode(canonical), pair.secretKey);
  return {
    algorithm: ALGORITHM,
    public_key: publicKey,
    key_persistent: keyIsPersistent,
    signed_fields: SIGNED_FIELDS,
    canonical,
    signature: Buffer.from(sig).toString('base64'),
  };
}

/**
 * Verify an attestation. Returns { ok, reason }.
 *
 * `expectedPublicKey` should come from /.well-known, not from the attestation
 * itself — a signature under a key the response chose is no evidence at all.
 */
export function verifyAttestation(att, expectedPublicKey) {
  if (!att || typeof att !== 'object') return { ok: false, reason: 'no attestation' };
  if (att.algorithm !== ALGORITHM) return { ok: false, reason: `unexpected algorithm ${att.algorithm}` };
  const key = expectedPublicKey ?? att.public_key;
  if (expectedPublicKey && att.public_key !== expectedPublicKey) {
    return { ok: false, reason: 'attestation key does not match the published key' };
  }
  let pub, sig;
  try {
    pub = new Uint8Array(Buffer.from(key, 'base64'));
    sig = new Uint8Array(Buffer.from(att.signature, 'base64'));
  } catch {
    return { ok: false, reason: 'key or signature is not base64' };
  }
  if (pub.length !== 32 || sig.length !== 64) return { ok: false, reason: 'key or signature has the wrong length' };
  // The canonical string must be what the fields canonicalize to, or a caller
  // could be shown one set of values while a different one is signed.
  let parsed;
  try {
    parsed = JSON.parse(att.canonical);
  } catch {
    return { ok: false, reason: 'canonical is not JSON' };
  }
  if (canonicalize(parsed) !== att.canonical) return { ok: false, reason: 'canonical is not in canonical form' };
  const ok = nacl.sign.detached.verify(new TextEncoder().encode(att.canonical), sig, pub);
  return ok ? { ok: true, fields: parsed } : { ok: false, reason: 'signature does not verify' };
}
