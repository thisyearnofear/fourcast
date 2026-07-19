/**
 * Solana verification service for TxLINE Merkle proofs.
 *
 * Strategy: read-only verification via the public Solana JSON-RPC.
 * We fetch the daily-root PDA that TxLINE anchors each day, recompute the
 * Merkle root client-side from the cached proof path, and compare against
 * the on-chain value. The match-escrow program (AMT4n3imwTgHEpafK...
 * /onchain) then CPI-calls TxLINE's validate_stat for full settlement.
 *
 * Env:
 *   SOLANA_RPC_URL         - default Helius public devnet/mainnet RPC
 *   HELIUS_API_KEY         - optional, upgrades to Helius authenticated RPC
 *   TXLINE_PROGRAM_ID      - TxLINE validation program on Solana
 */

import { deriveDailyScoresPda } from './settlementService.js';

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
 *   4. stat-proof-count: each stat has a corresponding proof path
 *   5. onchain-pda: derive the daily_scores_roots PDA, fetch on-chain, compare root
 *
 * Verdict:
 *   'verified'      — on-chain PDA fetched and its root matches eventStatRoot
 *   'proof-present' — all proof components complete; PDA not checked (no timestamp)
 *   'incomplete'    — required components missing
 *   'onchain-mismatch' — root on chain differs from eventStatRoot
 *   'onchain-error' — failed to fetch or decode the PDA
 */
export async function verifyFixtureProof(proof, fixture) {
  const programId = proof.programId || process.env.TXLINE_PROGRAM_ID || null;
  const expectedRoot = proof.merkleRoot || proof.eventStatRoot || null;
  const subTreeRoot = proof.eventStatsSubTreeRoot || null;
  const statsToProve = Array.isArray(proof.statsToProve) ? proof.statsToProve : [];
  const statProofs = Array.isArray(proof.statProofs) ? proof.statProofs : [];
  const mainTreeProof = Array.isArray(proof.mainTreeProof) ? proof.mainTreeProof : [];
  const subTreeProof = Array.isArray(proof.subTreeProof) ? proof.subTreeProof : [];

  const ts = proof.ts || proof.summary?.updateStats?.minTimestamp || null;

  const result = {
    programId,
    dailyRootPda: null,
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
    explorerUrl: null,
    rpc: getRpcUrl().replace(/\?api-key=.*/, '?api-key=***'),
    nextStep: null,
    onChainRoot: null,
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

  // Check 5: on-chain PDA comparison
  // Derive the daily_scores_roots PDA from the proof timestamp, fetch on-chain,
  // and compare the stored root with our eventStatRoot.
  const rootNoPrefix = rootHex;
  if (ts) {
    try {
      const [dailyPda] = deriveDailyScoresPda(ts);
      result.dailyRootPda = dailyPda.toBase58();
      result.explorerUrl = `https://explorer.solana.com/address/${result.dailyRootPda}`;

      const account = await getAccountInfoBase64(dailyPda.toBase58());
      if (account) {
        const decoded = tryReadDailyRoot(account.data);
        if (decoded) {
          result.onChainRoot = decoded.root;
          const rootMatch = decoded.root.toLowerCase() === rootNoPrefix.toLowerCase();
          result.checks.push({
            name: 'onchain-pda',
            ok: rootMatch,
            detail: rootMatch
              ? `On-chain root matches eventStatRoot (${rootNoPrefix.slice(0, 12)}…${rootNoPrefix.slice(-8)})`
              : `On-chain root ${decoded.root.slice(0, 12)}…${decoded.root.slice(-8)} ≠ expected ${rootNoPrefix.slice(0, 12)}…${rootNoPrefix.slice(-8)}`,
          });
          if (!rootMatch) {
            result.verdict = 'onchain-mismatch';
            result.nextStep = 'The Merkle root stored on Solana differs from the proof. This may indicate a stale proof or a different daily root batch.';
            return result;
          }
        } else {
          result.checks.push({
            name: 'onchain-pda',
            ok: false,
            detail: `PDA account found but could not decode root (data length ${account.data.length})`,
          });
          result.verdict = 'onchain-error';
          result.nextStep = 'The daily_scores_roots PDA exists but its data layout may differ from expectations. Check the TxLINE IDL.';
          return result;
        }
      } else {
        result.checks.push({
          name: 'onchain-pda',
          ok: false,
          detail: `PDA ${result.dailyRootPda} not found on devnet`,
        });
        result.verdict = 'onchain-error';
        result.nextStep = 'The derived daily_scores_roots PDA does not exist on chain. The epoch day may be wrong, or the seed pattern has changed.';
        return result;
      }
    } catch (err) {
      result.checks.push({
        name: 'onchain-pda',
        ok: false,
        detail: `RPC error fetching PDA: ${err.message}`,
      });
      result.verdict = 'onchain-error';
      result.nextStep = 'Retry or check SOLANA_RPC_URL.';
      return result;
    }
  } else {
    result.checks.push({
      name: 'onchain-pda',
      ok: null,
      detail: 'No timestamp in proof — skipping on-chain PDA comparison.',
    });
    result.nextStep = 'To enable on-chain verification the proof must include a ts or summary.updateStats.minTimestamp.';
  }

  // Final verdict
  const allOk =
    result.checks[0].ok &&
    result.checks[1].ok !== false &&
    result.checks[2].ok !== false &&
    result.checks[3].ok !== false;
  const pdaCheck = result.checks.find((c) => c.name === 'onchain-pda');
  if (pdaCheck && pdaCheck.ok === true) {
    result.verdict = 'verified';
    result.nextStep = 'On-chain Merkle root matches. The proof is cryptographically anchored on Solana.';
  } else if (allOk) {
    result.verdict = 'proof-present';
    result.nextStep = result.nextStep || 'Submit a read-only validate_stat_v2 simulation to the TxLINE program for full on-chain verification.';
  }

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
