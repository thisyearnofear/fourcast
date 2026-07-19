import { createHash } from 'crypto';
import { canonicalize } from './receiptCanonical.js';

export const DECISION_RECEIPT_VERSION = 'decision-receipt/v1';

export { canonicalize } from './receiptCanonical.js';

export function hashCanonical(value) {
  return createHash('sha256').update(canonicalize(value)).digest('hex');
}

/**
 * Adds integrity metadata without contaminating the payload being hashed.
 * `ledger` preserves the existing run-summary shape for current consumers.
 */
export function buildDecisionReceipt({ id, createdAt, policy, evidence, decisions, execution, ledger = {} }) {
  const payload = {
    schemaVersion: DECISION_RECEIPT_VERSION,
    id,
    createdAt,
    policy,
    evidence,
    decisions,
    execution,
  };
  const contentHash = hashCanonical(payload);
  return {
    ...ledger,
    proof: {
      ...payload,
      integrity: {
        algorithm: 'sha256',
        canonicalization: 'fourcast-canonical-json/v1',
        contentHash,
      },
    },
  };
}

export function verifyDecisionReceipt(receipt) {
  const proof = receipt?.proof || receipt;
  if (!proof?.integrity?.contentHash) return { valid: false, reason: 'missing integrity metadata' };
  const { integrity, ...payload } = proof;
  const actualHash = hashCanonical(payload);
  return {
    valid: actualHash === integrity.contentHash,
    expectedHash: integrity.contentHash,
    actualHash,
  };
}
