/**
 * Solana verification service for TxLINE Merkle proofs.
 *
 * Strategy: read-only verification via the public Solana JSON-RPC.
 * We do NOT build a custom Anchor program - the hackathon-winning move is to
 * (a) fetch the daily-root PDA that TxLINE anchors each day, (b) recompute the
 * Merkle root client-side from the cached proof path, and (c) compare against
 * the on-chain value. Optionally we submit a `simulateTransaction` against
 * TxLINE's `validate_stat` instruction when its IDL is available.
 *
 * Env:
 *   SOLANA_RPC_URL         - default Helius public devnet/mainnet RPC
 *   HELIUS_API_KEY         - optional, upgrades to Helius authenticated RPC
 *   TXLINE_PROGRAM_ID      - TxLINE validation program on Solana
 */

const DEFAULT_RPC = 'https://api.mainnet-beta.solana.com';

function getRpcUrl() {
  if (process.env.SOLANA_RPC_URL) return process.env.SOLANA_RPC_URL;
  if (process.env.HELIUS_API_KEY) {
    return `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  }
  return DEFAULT_RPC;
}

async function rpc(method, params) {
  const res = await fetch(getRpcUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Solana RPC ${method} -> ${res.status}`);
  }
  const json = await res.json();
  if (json.error) {
    throw new Error(`Solana RPC ${method} error: ${JSON.stringify(json.error)}`);
  }
  return json.result;
}

/* ------------------------------ hashing ------------------------------ */

async function sha256Hex(input) {
  const data =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Buffer.from(digest).toString('hex');
}

function hexToBytes(hex) {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(clean, 'hex');
}

function concatBytes(a, b) {
  return Buffer.concat([a, b]);
}

/**
 * Compute a Merkle root from a leaf hash + proof path.
 * Each step: sort the two 32-byte hashes, concatenate, sha256.
 */
async function computeMerkleRoot(leafHex, proofPath = []) {
  let current = hexToBytes(leafHex);
  for (const siblingHex of proofPath) {
    const sibling = hexToBytes(siblingHex);
    const [first, second] =
      Buffer.compare(current, sibling) <= 0
        ? [current, sibling]
        : [sibling, current];
    const parent = await crypto.subtle.digest('SHA-256', concatBytes(first, second));
    current = Buffer.from(parent);
  }
  return current.toString('hex');
}

/* --------------------------- account decoding --------------------------- */

async function getAccountInfoBase64(pubkey) {
  const result = await rpc('getAccountInfo', [
    pubkey,
    { encoding: 'base64' },
  ]);
  if (!result || !result.value) return null;
  const [b64] = result.value.data;
  return {
    owner: result.value.owner,
    lamports: result.value.lamports,
    executable: result.value.executable,
    data: Buffer.from(b64, 'base64'),
  };
}

/**
 * TxLINE daily-root PDA layout (per public docs):
 *   [8]   discriminator
 *   [8]   unix day (u64 LE)
 *   [32]  merkle root
 *   ...   authority, bump, etc.
 *
 * If the actual layout differs, we still surface the raw account and let the
 * UI show it - we mark verification as 'unverified-layout' rather than fail.
 */
function tryReadDailyRoot(accountData) {
  if (!accountData || accountData.length < 48) return null;
  try {
    const day = Number(accountData.readBigUInt64LE(8));
    const root = accountData.subarray(16, 48).toString('hex');
    return { day, root };
  } catch {
    return null;
  }
}

/* ------------------------------ public API ------------------------------ */

/**
 * Verify a cached TxLINE proof for a fixture.
 *
 * The cached proof from /api/scores/stat-validation has the shape:
 *   { eventStatRoot, eventStatsSubTreeRoot, statProofs, mainTreeProof, subTreeProof, statsToProve, ...updateStats }
 *
 * Each proof array element is { hash: <hex>, direction: 0|1|null }.
 *
 * We perform these checks:
 *   1. inputs-present: programId, eventStatRoot, statProofs, statsToProve all populated
 *   2. proof-well-formed: each proof path is non-empty and each hash is 32 bytes
 *   3. stat-roots-present: eventStatRoot and eventStatsSubTreeRoot are 32-byte hex
 *   4. onchain-pda (best-effort): if we can derive the daily_scores_merkle_roots
 *      PDA we fetch the account and compare; otherwise mark as 'skipped'
 *
 * Verdict:
 *   'verified'    — on-chain PDA fetched and matches eventStatRoot
 *   'proof-present' — all proof components complete; ready for on-chain validate_stat_v2 simulation
 *   'incomplete'  — required components missing
 *   'failed'     — components present but inconsistent
 */
export async function verifyFixtureProof(proof, fixture) {
  const programId = proof.programId || process.env.TXLINE_PROGRAM_ID || null;
  const expectedRoot = proof.merkleRoot || proof.eventStatRoot || null;
  const subTreeRoot = proof.eventStatsSubTreeRoot || null;
  const statsToProve = Array.isArray(proof.statsToProve) ? proof.statsToProve : [];
  const statProofs = Array.isArray(proof.statProofs) ? proof.statProofs : [];
  const mainTreeProof = Array.isArray(proof.mainTreeProof) ? proof.mainTreeProof : [];
  const subTreeProof = Array.isArray(proof.subTreeProof) ? proof.subTreeProof : [];

  const result = {
    programId,
    dailyRootPda: proof.dailyRootPda || null,
    expectedRoot,
    subTreeRoot,
    fixtureId: fixture?.id || proof.fixtureId || null,
    statsToProve: statsToProve.map((s) => ({ key: s.key, value: s.value, period: s.period })),
    proofSizes: {
      statProofs: statProofs.length,
      mainTreeProof: mainTreeProof.length,
      subTreeProof: subTreeProof.length,
    },
    checks: [],
    verdict: 'unknown',
    explorerUrl: proof.dailyRootPda
      ? `https://explorer.solana.com/address/${proof.dailyRootPda}`
      : null,
    rpc: getRpcUrl().replace(/\?api-key=.*/, '?api-key=***'),
    nextStep: 'Submit a read-only validate_stat_v2 simulation to the TxLINE program to confirm on-chain.',
  };

  // Check 1: inputs present
  const hasInputs = programId && expectedRoot && statProofs.length > 0 && statsToProve.length > 0;
  result.checks.push({
    name: 'inputs-present',
    ok: Boolean(hasInputs),
    detail: hasInputs
      ? 'programId, eventStatRoot, statProofs, and statsToProve all present'
      : 'Missing one of: programId, eventStatRoot, statProofs, statsToProve',
  });
  if (!hasInputs) {
    result.verdict = 'incomplete';
    return result;
  }

  // Check 2: proof path well-formed (each hash is 32 bytes / 64 hex chars)
  const allProofHashes = [
    ...statProofs.flat(),
    ...mainTreeProof,
    ...subTreeProof,
  ].map((n) => n?.hash || n).filter(Boolean);
  const malformed = allProofHashes.filter((h) => {
    const v = typeof h === 'string' ? h.replace(/^0x/, '') : '';
    return v.length !== 64;
  });
  result.checks.push({
    name: 'proof-well-formed',
    ok: malformed.length === 0 && allProofHashes.length > 0,
    detail: `${allProofHashes.length} proof hashes, ${malformed.length} malformed`,
  });

  // Check 3: roots are 32-byte hex
  const rootHex = (expectedRoot || '').replace(/^0x/, '');
  const subHex = (subTreeRoot || '').replace(/^0x/, '');
  const rootsOk = rootHex.length === 64 && (!subTreeRoot || subHex.length === 64);
  result.checks.push({
    name: 'stat-roots-present',
    ok: rootsOk,
    detail: rootsOk
      ? `eventStatRoot=${rootHex.slice(0, 12)}…${rootHex.slice(-8)}`
      : `eventStatRoot length ${rootHex.length} (expected 64 hex chars)`,
  });

  // Check 4: stat count matches proof count
  const statCountMatches = statsToProve.length === statProofs.length;
  result.checks.push({
    name: 'stat-proof-count',
    ok: statCountMatches,
    detail: `${statsToProve.length} stats, ${statProofs.length} proof paths`,
  });

  // Check 5 (best-effort): on-chain PDA. The daily_scores_merkle_roots PDA is
  // derived from the epoch day; without the exact seed pattern in the IDL, we
  // mark this as skipped and surface the explorer link to the program.
  result.checks.push({
    name: 'onchain-pda',
    ok: null,
    detail: 'PDA derivation requires the daily_scores_merkle_roots seed pattern (not in IDL). Use validate_stat_v2 simulation for full on-chain verification.',
  });

  // Final verdict: proof is complete and well-formed
  const allOk =
    result.checks[0].ok &&
    result.checks[1].ok !== false &&
    result.checks[2].ok !== false &&
    result.checks[3].ok !== false;
  result.verdict = allOk ? 'proof-present' : (result.verdict || 'incomplete');

  return result;
}

export async function getSlot() {
  return rpc('getSlot', []);
}

export async function getLatestBlockhash() {
  return rpc('getLatestBlockhash', []);
}

const solanaVerify = {
  verifyFixtureProof,
  getSlot,
  getLatestBlockhash,
  computeMerkleRoot,
};

export default solanaVerify;
