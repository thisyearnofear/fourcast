/**
 * On-chain Receipt Commitment — NEAR anchor.
 *
 * Commits a pre-event DecisionReceipt's contentHash to NEAR via the NEAR
 * Social `set` contract (v1.social08.testnet / social.near). Same role as
 * services/txline/receiptCommitment.js on Solana: it makes "this receipt
 * existed before the outcome" independently verifiable — anyone can query the
 * social contract or replay the transaction args without trusting the
 * Fourcast backend.
 *
 * Design choices:
 *   - NEAR Social `set`, not a custom contract: zero deploy risk, works on
 *     testnet and mainnet, and the stored value is readable by any explorer
 *     or `near social get` call. NEAR has no memo program; a FunctionCall's
 *     args are the canonical public place to put data.
 *   - Same memo format as the Solana adapter so cross-chain receipts parse
 *     identically: fourcast:receipt-v1:<fixtureId>:<contentHash>
 *   - The memo is stored at <agentAccount>/fourcast/receipts/<fixtureId> and
 *     also lives verbatim in the transaction args — verification checks both.
 *
 * Verification (verifyCommitmentTx):
 *   Fetches the transaction, decodes the FunctionCall args, finds the memo,
 *   confirms the contentHash, and returns block height + timestamp so the UI
 *   can show "anchored at block N, before kickoff".
 *   readAnchoredCommitment() additionally reads current contract state — a
 *   cheap judge-facing check that needs no tx hash.
 */

import { teraToGas, nearToYocto } from 'near-api-js';
import { getNearConfig, explorerTxUrl } from './nearConfig.js';
import { getProvider, getSignerAccount } from './nearClient.js';

export const COMMITMENT_PREFIX = 'fourcast:receipt-v1';
export const COMMITMENT_SCHEMA_VERSION = 'v1';
export const SOCIAL_METHOD = 'set';
export const SOCIAL_VIEW_METHOD = 'get';

/**
 * Build the memo payload string for a receipt commitment.
 * Format: fourcast:receipt-v1:<fixtureId>:<contentHash>
 * Identical to the Solana commitment so verifiers share one parser.
 */
export function buildCommitmentMemo({ fixtureId, contentHash }) {
  if (!fixtureId) throw new Error('buildCommitmentMemo: fixtureId is required');
  if (!/^[0-9a-f]{64}$/.test(contentHash || '')) {
    throw new Error(`buildCommitmentMemo: contentHash must be a 64-char hex string (got ${contentHash})`);
  }
  return `${COMMITMENT_PREFIX}:${fixtureId}:${contentHash}`;
}

/** Parse a memo string back into its structured form, or null. */
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
 * Build the `set` args for the NEAR Social contract. The memo lands at
 * <accountId>/fourcast/receipts/<fixtureId>.
 */
export function buildCommitmentSetArgs({ accountId, fixtureId, contentHash }) {
  if (!accountId) throw new Error('buildCommitmentSetArgs: accountId is required');
  const memo = buildCommitmentMemo({ fixtureId, contentHash });
  return {
    args: {
      data: {
        [accountId]: {
          fourcast: {
            receipts: {
              [fixtureId]: memo,
            },
          },
        },
      },
    },
    memo,
    socialKey: `${accountId}/fourcast/receipts/${fixtureId}`,
  };
}

/**
 * Anchor a receipt commitment on NEAR. Signs with the agent treasury account
 * (NEAR_ACCOUNT_ID/NEAR_PRIVATE_KEY) and attaches a storage deposit for the
 * social contract.
 *
 * Returns { txHash, memo, socialKey, explorerUrl, schemaVersion, network }.
 */
export async function anchorReceiptCommitment({ fixtureId, contentHash }) {
  const config = getNearConfig();
  const account = getSignerAccount();
  const { args, memo, socialKey } = buildCommitmentSetArgs({
    accountId: config.accountId,
    fixtureId,
    contentHash,
  });

  const outcome = await account.callFunction({
    contractId: config.socialContract,
    methodName: SOCIAL_METHOD,
    args,
    gas: teraToGas(config.anchorGasTgas),
    deposit: nearToYocto(config.anchorDepositNear),
  });

  const txHash = outcome?.transaction?.hash || outcome?.transaction_outcome?.id || outcome?.hash;
  if (!txHash) {
    throw new Error('anchorReceiptCommitment: transaction sent but no tx hash in outcome');
  }

  return {
    txHash,
    memo,
    socialKey,
    accountId: config.accountId,
    socialContract: config.socialContract,
    schemaVersion: COMMITMENT_SCHEMA_VERSION,
    network: config.network,
    explorerUrl: explorerTxUrl(txHash, config.network),
  };
}

/**
 * Verify an on-chain commitment by inspecting a submitted transaction.
 *
 * Returns { ok, reason, txHash, blockHash, blockTime (unix s), memo, parsed,
 * expectedContentHash, match, committer, explorerUrl }.
 */
export async function verifyCommitmentTx(txHash, expectedContentHash, { senderId } = {}) {
  const config = getNearConfig();
  const provider = getProvider();
  const result = {
    ok: false,
    reason: null,
    txHash,
    blockHash: null,
    blockTime: null,
    memo: null,
    parsed: null,
    expectedContentHash: expectedContentHash || null,
    match: false,
    committer: null,
    explorerUrl: explorerTxUrl(txHash, config.network),
  };

  if (!txHash || !expectedContentHash) {
    result.reason = 'txHash and expectedContentHash are required';
    return result;
  }

  const sender = senderId || config.accountId;
  if (!sender) {
    result.reason = 'sender account id unknown — pass senderId or set NEAR_ACCOUNT_ID';
    return result;
  }

  let tx;
  try {
    tx = await provider.viewTransactionStatus({
      txHash,
      accountId: sender,
      waitUntil: 'EXECUTED',
    });
  } catch (err) {
    result.reason = `RPC error fetching transaction: ${err.message}`;
    return result;
  }

  if (!tx?.transaction) {
    result.reason = 'transaction not found (may be unconfirmed or on a different network)';
    return result;
  }

  result.committer = tx.transaction.signer_id || null;
  const blockHash = tx.transaction_outcome?.block_hash || null;
  result.blockHash = blockHash;
  if (blockHash) {
    try {
      const block = await provider.viewBlock({ blockId: blockHash });
      const nanos = block?.header?.timestamp;
      if (nanos != null) result.blockTime = Math.floor(Number(nanos) / 1e9);
    } catch {
      // timestamp is nice-to-have; verification still holds without it
    }
  }

  // Decode every FunctionCall arg blob looking for our commitment memo.
  const memos = extractCommitmentMemos(tx);
  const memoStr = memos.find((m) => {
    const parsed = parseCommitmentMemo(m);
    return parsed && parsed.contentHash === expectedContentHash;
  });

  if (!memoStr) {
    result.reason = memos.length
      ? 'no commitment memo in transaction matches expected contentHash'
      : 'no Fourcast receipt commitment memo found in transaction';
    result.memo = memos[0] || null;
    result.parsed = memos[0] ? parseCommitmentMemo(memos[0]) : null;
    return result;
  }

  result.memo = memoStr;
  result.parsed = parseCommitmentMemo(memoStr);
  result.match = true;
  result.ok = true;
  return result;
}

/**
 * Read the currently anchored commitment straight from the social contract —
 * the judge-facing check: no tx hash needed, just the account + fixtureId.
 *
 * Returns { found, memo, parsed, socialKey }.
 */
export async function readAnchoredCommitment({ accountId, fixtureId }) {
  const config = getNearConfig();
  const account = accountId || config.accountId;
  const socialKey = `${account}/fourcast/receipts/${fixtureId}`;
  const empty = { found: false, memo: null, parsed: null, socialKey };

  if (!account) return { ...empty, socialKey: null };

  let data;
  try {
    data = await getProvider().callFunction({
      contractId: config.socialContract,
      method: SOCIAL_VIEW_METHOD,
      args: { keys: [socialKey] },
    });
  } catch {
    return empty;
  }

  const memo = data?.[account]?.fourcast?.receipts?.[fixtureId];
  if (!memo) return empty;
  return { found: true, memo, parsed: parseCommitmentMemo(memo), socialKey };
}

/** Pull every fourcast memo out of a tx-status response's FunctionCall args. */
export function extractCommitmentMemos(tx) {
  const found = [];
  const push = (json) => {
    for (const acc of Object.values(json?.data || {})) {
      const receipts = acc?.fourcast?.receipts;
      if (!receipts) continue;
      for (const memo of Object.values(receipts)) {
        if (typeof memo === 'string' && parseCommitmentMemo(memo)) found.push(memo);
      }
    }
  };

  for (const action of tx?.transaction?.actions || []) {
    const fc = action?.FunctionCall || action?.functionCall;
    if (!fc?.args) continue;
    try {
      push(JSON.parse(Buffer.from(fc.args, 'base64').toString('utf8')));
    } catch {
      // not our payload — ignore
    }
  }
  return found;
}

const nearReceiptCommitment = {
  buildCommitmentMemo,
  parseCommitmentMemo,
  buildCommitmentSetArgs,
  anchorReceiptCommitment,
  verifyCommitmentTx,
  readAnchoredCommitment,
  extractCommitmentMemos,
  COMMITMENT_PREFIX,
  COMMITMENT_SCHEMA_VERSION,
};

export default nearReceiptCommitment;
