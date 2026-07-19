/**
 * On-chain Receipt Commitment Adapter
 *
 * Commits a pre-event DecisionReceipt's contentHash to Solana via the canonical
 * Memo program (MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr). This makes
 * "this receipt existed before the match" independently verifiable on-chain —
 * a judge or allocator can look up the memo transaction and confirm the
 * contentHash was committed at a specific slot, before kickoff, without
 * trusting the Fourcast backend or the git-committed JSON file.
 *
 * Design choices:
 *   - Memo program, not a custom program: zero deploy risk, no program upgrade
 *     authority to manage, works on devnet and mainnet. The memo carries a
 *     structured prefix so it's both human-readable and machine-parseable.
 *   - No state mutation on Fourcast side: we only build the instruction. The
 *     client signs and submits; the resulting signature is recorded in the
 *     receipt's integrity.onchainCommitment field by the caller.
 *   - The committed payload is the receipt contentHash + fixtureId + a
 *     Fourcast-identifying prefix. The contentHash already commits to the full
 *     receipt (Person 1's canonical JSON), so we don't need to put the whole
 *     receipt on-chain.
 *
 * Memo format (UTF-8):
 *   fourcast:receipt-v1:<fixtureId>:<contentHash>
 *
 * Verification (verifyCommitmentTx):
 *   Given a tx signature, fetch the transaction, find the memo instruction,
 *   parse it, and confirm the contentHash matches the receipt. Returns the
 *   slot, block time, and match status so the UI can show "committed at slot
 *   N, before kickoff (T)".
 */

import { Connection, PublicKey, Transaction, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';

export const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

export const COMMITMENT_PREFIX = 'fourcast:receipt-v1';
export const COMMITMENT_SCHEMA_VERSION = 'v1';

const DEFAULT_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';

function getConnection() {
  return new Connection(DEFAULT_RPC, 'confirmed');
}

/**
 * Build the memo payload string for a receipt commitment.
 * Format: fourcast:receipt-v1:<fixtureId>:<contentHash>
 */
export function buildCommitmentMemo({ fixtureId, contentHash }) {
  if (!fixtureId) throw new Error('buildCommitmentMemo: fixtureId is required');
  if (!contentHash || !/^[0-9a-f]{64}$/.test(contentHash)) {
    throw new Error(`buildCommitmentMemo: contentHash must be a 64-char hex string (got ${contentHash})`);
  }
  return `${COMMITMENT_PREFIX}:${fixtureId}:${contentHash}`;
}

/**
 * Parse a memo string back into its structured form. Returns null if the memo
 * is not a Fourcast receipt commitment.
 */
export function parseCommitmentMemo(memo) {
  if (typeof memo !== 'string') return null;
  const parts = memo.split(':');
  if (parts.length !== 4) return null;
  const [prefix, version, fixtureId, contentHash] = parts;
  if (prefix !== 'fourcast' || version !== 'receipt-v1') return null;
  if (!/^[0-9a-f]{64}$/.test(contentHash)) return null;
  return { prefix, version, fixtureId, contentHash };
}

/**
 * Build a partially-signed transaction that commits the receipt contentHash
 * on-chain via a memo instruction. The caller (committer wallet) signs and
 * submits; the resulting signature is the on-chain commitment reference.
 *
 * Fetches a recent blockhash server-side so the serialized transaction is
 * submittable as-is once the committer signs. (Without a blockhash,
 * @solana/web3.js v1.x throws "Transaction recentBlockhash required" at
 * serialize time — the wallet adapter can't fill it in after serialization.)
 *
 * Returns { transactionBase64, memo, contentHash, fixtureId, blockhash, ... }.
 */
export async function buildCommitmentTransaction({ committer, fixtureId, contentHash }) {
  if (!committer) throw new Error('buildCommitmentTransaction: committer (wallet pubkey) is required');
  const memo = buildCommitmentMemo({ fixtureId, contentHash });
  const committerPk = committer instanceof PublicKey ? committer : new PublicKey(committer);

  const memoIx = new TransactionInstruction({
    programId: MEMO_PROGRAM_ID,
    keys: [], // Memo program takes no accounts; the signer is inferred by the runtime from the transaction
    data: Buffer.from(memo, 'utf8'),
  });

  // Keep CU modest — memo is cheap.
  const computeIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 });

  const conn = getConnection();
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash('confirmed');

  const tx = new Transaction({
    feePayer: committerPk,
    blockhash,
    lastValidBlockHeight,
  }).add(computeIx, memoIx);

  const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });

  return {
    transactionBase64: serialized.toString('base64'),
    memo,
    contentHash,
    fixtureId,
    committer: committerPk.toBase58(),
    programId: MEMO_PROGRAM_ID.toBase58(),
    schemaVersion: COMMITMENT_SCHEMA_VERSION,
    blockhash,
    lastValidBlockHeight,
  };
}

/**
 * Verify an on-chain commitment by inspecting a submitted transaction.
 *
 * Fetches the transaction by signature, walks its instructions for a memo
 * whose data parses as a Fourcast receipt commitment, and confirms the
 * contentHash matches the expected one. Also surfaces the slot and block time
 * so the UI can prove the commitment happened before kickoff.
 *
 * Returns {
 *   ok: boolean,
 *   reason: string | null,
 *   signature,
 *   slot,
 *   blockTime (unix seconds),
 *   memo,
 *   parsed: { fixtureId, contentHash } | null,
 *   expectedContentHash,
 *   match: boolean,
 *   committer: string | null,
 * }
 */
export async function verifyCommitmentTx(signature, expectedContentHash) {
  const conn = getConnection();
  const result = {
    ok: false,
    reason: null,
    signature,
    slot: null,
    blockTime: null,
    memo: null,
    parsed: null,
    expectedContentHash: expectedContentHash || null,
    match: false,
    committer: null,
  };

  if (!signature || !expectedContentHash) {
    result.reason = 'signature and expectedContentHash are required';
    return result;
  }

  let tx;
  try {
    tx = await conn.getTransaction(signature, {
      maxSupportedTransactionVersion: 0,
    });
  } catch (err) {
    result.reason = `RPC error fetching transaction: ${err.message}`;
    return result;
  }

  if (!tx) {
    result.reason = 'transaction not found (may be unconfirmed or on a different network)';
    return result;
  }

  result.slot = tx.slot;
  result.blockTime = tx.blockTime ?? null;
  result.committer = tx.transaction?.message?.feePayer
    ? new PublicKey(tx.transaction.message.feePayer).toBase58()
    : null;

  // Walk every instruction (including inner instructions) for a memo whose
  // data parses as a Fourcast receipt commitment.
  const candidates = [];
  const message = tx.transaction?.message;
  if (message?.instructions) {
    for (const ix of message.instructions) {
      const programId = message.accountKeys?.[ix.programIdIndex];
      if (programId && programId.equals(MEMO_PROGRAM_ID)) {
        candidates.push(decodeMemoData(ix.data));
      }
    }
  }
  // Inner instructions (memo inside a CPI call — unlikely for our use but cheap to check)
  const meta = tx.meta;
  if (meta?.innerInstructions) {
    for (const inner of meta.innerInstructions) {
      for (const ix of inner.instructions) {
        const programId = message?.accountKeys?.[ix.programIdIndex];
        if (programId && programId.equals(MEMO_PROGRAM_ID)) {
          candidates.push(decodeMemoData(ix.data));
        }
      }
    }
  }

  const memoStr = candidates.find((m) => m && parseCommitmentMemo(m));
  if (!memoStr) {
    result.reason = 'no Fourcast receipt commitment memo found in transaction';
    return result;
  }

  result.memo = memoStr;
  result.parsed = parseCommitmentMemo(memoStr);
  result.match = result.parsed?.contentHash === expectedContentHash;

  if (!result.match) {
    result.reason = `memo contentHash ${result.parsed?.contentHash} does not match expected ${expectedContentHash}`;
    return result;
  }

  result.ok = true;
  return result;
}

/**
 * Decode base58 memo data to a UTF-8 string. Solana memo data is base58-encoded.
 */
function decodeMemoData(data) {
  if (data == null) return null;
  if (typeof data === 'string') {
    // getTransaction returns base58 by default for legacy transactions
    try {
      return Buffer.from(bs58Decode(data)).toString('utf8');
    } catch {
      return null;
    }
  }
  if (data instanceof Uint8Array || data instanceof Buffer) {
    return Buffer.from(data).toString('utf8');
  }
  return null;
}

// Minimal base58 decoder — avoids pulling in a dependency for one call.
// Solana memo data is short (our commitments are ~110 bytes), so this is fine.
const BS58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bs58Decode(input) {
  if (input === '') return new Uint8Array(0);
  const bytes = [0];
  for (const ch of input) {
    const value = BS58_ALPHABET.indexOf(ch);
    if (value < 0) throw new Error(`invalid base58 character: ${ch}`);
    let carry = value;
    for (let i = 0; i < bytes.length; i++) {
      carry += bytes[i] * 58;
      bytes[i] = carry & 0xff;
      carry >>= 8;
    }
    while (carry > 0) {
      bytes.push(carry & 0xff);
      carry >>= 8;
    }
  }
  // Leading zeros
  let leadingZeros = 0;
  for (const ch of input) {
    if (ch !== '1') break;
    leadingZeros++;
  }
  return new Uint8Array([...new Array(leadingZeros).fill(0), ...bytes.reverse()]);
}

const receiptCommitment = {
  buildCommitmentMemo,
  parseCommitmentMemo,
  buildCommitmentTransaction,
  verifyCommitmentTx,
  MEMO_PROGRAM_ID,
  COMMITMENT_PREFIX,
  COMMITMENT_SCHEMA_VERSION,
};

export default receiptCommitment;
