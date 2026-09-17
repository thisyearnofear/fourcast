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
 *
 * `calibration` (optional) embeds live bucket hit-rates and a per-decision
 * shrinkage factor so allocators can audit whether sizing was sized on
 * calibrated confidence, not vibes. It is excluded from the integrity hash
 * to avoid breaking existing verification of historical receipts that predate
 * the calibration block.
 */
export function buildDecisionReceipt({ id, createdAt, policy, evidence, decisions, execution, calibration = null, ledger = {} }) {
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
  const receipt = {
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
  if (calibration) {
    receipt.calibration = calibration;
  }
  return receipt;
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
