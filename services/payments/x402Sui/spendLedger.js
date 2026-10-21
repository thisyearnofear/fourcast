/**
 * The x402 spend ledger (table `x402_payments`, migration 0016).
 *
 * A payment that settled on-chain is money that left the buyer, whether or not
 * we managed to deliver the resource afterwards. So every row in this table
 * counts toward the spend ceilings — a failed delivery still spent the money.
 *
 * Two gates, both opt-in and both fail-closed:
 *
 *   - **per-answer ceiling** (`X402_USDC_CEILING`): how much a single answer
 *     may cost, summed over every payment made for it.
 *   - **per-run cap** (`X402_RUN_CAP_USDC`): how much one run may spend in
 *     total. A run is a caller-supplied id (`runId`); the Telegraph P4 ladder
 *     uses it to bound a whole job.
 *
 * The gates are pure arithmetic over the ledger — they are evaluated BEFORE a
 * payment is accepted, so a refused spend never touches the buyer's money.
 *
 * `tx_digest` is UNIQUE: that single constraint is the replay protection. The
 * same transaction can never settle two requests.
 */

import { query, execute, migrationsReady } from '../../db.js';
import { runCap, spendCeiling, PAYMENT_REASONS } from './types.js';

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

function toInt(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Has this transaction already been used to settle something?
 * @returns {Promise<boolean>}
 */
export async function isTxSettled(txDigest, { env = process.env } = {}) {
  if (!txDigest) return false;
  await migrationsReady;
  const rows = await query('SELECT id FROM x402_payments WHERE tx_digest = ?', [txDigest]);
  return rows.length > 0;
}

/**
 * Claim a transaction digest. The UNIQUE constraint is the race-safe part: a
 * concurrent duplicate insert loses here rather than delivering twice.
 *
 * @returns {Promise<{claimed: boolean, duplicate: boolean, row: object|null}>}
 */
export async function claimPayment({
  txDigest,
  answerKey,
  payer = null,
  seller = null,
  usdc,
  network,
  resource = null,
  runId = null,
  requestHash = null,
  env = process.env,
}) {
  await migrationsReady;
  if (!txDigest) throw new Error('claimPayment requires a txDigest');
  if (!answerKey) throw new Error('claimPayment requires an answerKey');

  const existing = await query('SELECT * FROM x402_payments WHERE tx_digest = ?', [txDigest]);
  if (existing.length > 0) return { claimed: false, duplicate: true, row: existing[0] };

  try {
    await execute(
      `INSERT INTO x402_payments
        (tx_digest, answer_key, payer, seller, usdc, network, resource, run_id,
         request_hash, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'claimed', ?)`,
      [
        txDigest,
        answerKey,
        payer,
        seller,
        toInt(usdc),
        network,
        resource,
        runId,
        requestHash,
        nowEpoch(),
      ]
    );
  } catch (err) {
    // A UNIQUE violation here is a concurrent claim of the same digest.
    const rows = await query('SELECT * FROM x402_payments WHERE tx_digest = ?', [txDigest]);
    if (rows.length > 0) return { claimed: false, duplicate: true, row: rows[0] };
    throw err;
  }

  const rows = await query('SELECT * FROM x402_payments WHERE tx_digest = ?', [txDigest]);
  return { claimed: true, duplicate: false, row: rows[0] || null };
}

/** Mark a claimed payment as delivered (and attach what it bought). */
export async function confirmPayment(txDigest, { signalId = null, blobId = null, status = 'delivered' } = {}) {
  await migrationsReady;
  await execute(
    `UPDATE x402_payments
     SET status = ?, signal_id = ?, blob_id = ?, delivered_at = ?, error = NULL
     WHERE tx_digest = ?`,
    [status, signalId, blobId, status === 'delivered' ? nowEpoch() : null, txDigest]
  );
  return true;
}

/** Mark a claimed payment as failed. The money still moved; the row says so. */
export async function failPayment(txDigest, error) {
  await migrationsReady;
  await execute(
    `UPDATE x402_payments SET status = 'failed', error = ?, delivered_at = ? WHERE tx_digest = ?`,
    [String(error?.message || error || 'unknown').slice(0, 500), nowEpoch(), txDigest]
  );
  return true;
}

/** Total USDC (base units) already spent on one answer key. */
export async function spendForAnswerKey(answerKey, { env = process.env } = {}) {
  if (!answerKey) return 0;
  await migrationsReady;
  const rows = await query(
    'SELECT COALESCE(SUM(usdc), 0) AS total FROM x402_payments WHERE answer_key = ?',
    [answerKey]
  );
  return toInt(rows[0]?.total);
}

/** Total USDC (base units) already spent by one run. */
export async function spendForRun(runId, { env = process.env } = {}) {
  if (!runId) return 0;
  await migrationsReady;
  const rows = await query(
    'SELECT COALESCE(SUM(usdc), 0) AS total FROM x402_payments WHERE run_id = ?',
    [runId]
  );
  return toInt(rows[0]?.total);
}

/**
 * The spend gates. Pure arithmetic over the ledger, evaluated before a
 * payment is accepted.
 *
 * A missing ceiling means "no ceiling configured" — that is NOT a pass. The
 * gates fail closed: with no ceiling set, the leg is disabled by the caller
 * (X402_ENABLED) and this function reports the reason rather than silently
 * allowing unbounded spend.
 *
 * @returns {Promise<{allowed: boolean, reason: string|null, reasonCode: string|null,
 *   ceilingUsdc: number|null, runCapUsdc: number|null, spentUsdc: number,
 *   runSpentUsdc: number, requestedUsdc: number}>}
 */
export async function checkSpendGates({ answerKey, amountUsdc, runId = null, env = process.env } = {}) {
  const requested = toInt(amountUsdc);
  const ceiling = spendCeiling(env);
  const cap = runCap(env);

  const spentUsdc = await spendForAnswerKey(answerKey, { env });
  const runSpentUsdc = runId ? await spendForRun(runId, { env }) : 0;

  const base = {
    allowed: false,
    reason: null,
    reasonCode: null,
    ceilingUsdc: ceiling.baseUnits,
    runCapUsdc: cap.baseUnits,
    spentUsdc,
    runSpentUsdc,
    requestedUsdc: requested,
  };

  if (ceiling.error) return { ...base, reason: ceiling.error, reasonCode: 'SPEND_CEILING_INVALID' };
  if (cap.error) return { ...base, reason: cap.error, reasonCode: 'SPEND_RUN_CAP_INVALID' };
  if (ceiling.baseUnits === null) {
    return {
      ...base,
      reason: 'X402_USDC_CEILING is not set — there is no spend ceiling, so no spend is allowed.',
      reasonCode: 'SPEND_CEILING_UNSET',
    };
  }
  if (spentUsdc + requested > ceiling.baseUnits) {
    return {
      ...base,
      reason: `${PAYMENT_REASONS.SPEND_CEILING_EXCEEDED} (${spentUsdc} + ${requested} > ${ceiling.baseUnits} base units).`,
      reasonCode: 'SPEND_CEILING_EXCEEDED',
    };
  }
  if (cap.baseUnits !== null && runSpentUsdc + requested > cap.baseUnits) {
    return {
      ...base,
      reason: `${PAYMENT_REASONS.SPEND_RUN_CAP_EXCEEDED} (${runSpentUsdc} + ${requested} > ${cap.baseUnits} base units).`,
      reasonCode: 'SPEND_RUN_CAP_EXCEEDED',
    };
  }

  return { ...base, allowed: true };
}

/** Totals for the status endpoint / docs. */
export async function spendSummary({ env = process.env } = {}) {
  await migrationsReady;
  const byNetwork = await query(
    `SELECT network,
            COUNT(*) AS total,
            COALESCE(SUM(usdc), 0) AS usdc
       FROM x402_payments
      GROUP BY network`,
    []
  );
  const byStatus = await query(
    `SELECT status, COUNT(*) AS total FROM x402_payments GROUP BY status`,
    []
  );
  return {
    byNetwork: byNetwork.map((row) => ({
      network: row.network || 'unknown',
      payments: toInt(row.total),
      usdc: toInt(row.usdc),
    })),
    byStatus: byStatus.map((row) => ({ status: row.status, count: toInt(row.total) })),
    totalPayments: byStatus.reduce((sum, row) => sum + toInt(row.total), 0),
  };
}

/**
 * The settlement receipts, newest first.
 *
 * Every row is returned with its status — including `failed`, because the money
 * moved even when the resource did not. A receipt surface that hid failures
 * would be the dishonest kind of receipt.
 *
 * @param {object} [options]
 * @param {number} [options.limit]
 * @returns {Promise<Array<{txDigest, signalId, blobId, usdc, network, status, answerKey, createdAt}>>}
 */
export async function recentSettlements({ limit = 5, env = process.env } = {}) {
  await migrationsReady;
  const capped = Math.min(Math.max(toInt(limit) || 5, 1), 50);
  const rows = await query(
    `SELECT tx_digest, signal_id, blob_id, usdc, network, status, answer_key, created_at, delivered_at
       FROM x402_payments
      ORDER BY created_at DESC, id DESC
      LIMIT ?`,
    [capped]
  );
  return rows.map((row) => ({
    txDigest: row.tx_digest,
    signalId: row.signal_id || null,
    blobId: row.blob_id || null,
    usdc: toInt(row.usdc),
    network: row.network || 'unknown',
    status: row.status || 'unknown',
    answerKey: row.answer_key || null,
    createdAt: toInt(row.created_at) || null,
    deliveredAt: toInt(row.delivered_at) || null,
  }));
}
