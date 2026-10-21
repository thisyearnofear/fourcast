/**
 * Payment requirement parsing and on-chain verification for x402 on Sui.
 *
 * The flow is deliberately server-side and self-facilitated:
 *
 *   1. we publish a requirement (price, payee, network) as a 402;
 *   2. the buyer transfers USDC on Sui and sends the transaction digest back
 *      in the `X-PAYMENT` header;
 *   3. we re-read that transaction through the Tatum Sui RPC and check it
 *      against the requirement — success, amount, payee, coin, network;
 *   4. only then may the resource be produced.
 *
 * Step 3 is the whole point. A digest is a claim; the transaction block is
 * the evidence. Nothing here trusts the buyer's payload for anything that can
 * be checked on chain.
 */

import crypto from 'crypto';
import { getTransactionBlock, networkAlignment, rpcSource } from './tatumRpc.js';
import { isTxSettled } from './spendLedger.js';
import {
  PAYMENT_REASONS,
  SUPPORTED_SCHEMES,
  USDC_SYMBOL,
  X402_VERSION,
  isUsdcCoinType,
  usdcCoinType,
} from './types.js';

// ─── Requirement ────────────────────────────────────────────────────────────

/**
 * Build the requirement we quote to the buyer (x402 v1 body shape).
 *
 * @param {object} options
 * @param {string} options.seller        payee address (0x…)
 * @param {number} options.amountUsdc    price in USDC base units
 * @param {string} options.network       'sui:testnet' | 'sui:mainnet'
 * @param {string} [options.resource]    the resource being paid for
 */
export function buildPaymentRequirement({
  seller,
  amountUsdc,
  network,
  resource = null,
  description = null,
  mimeType = 'application/json',
  maxTimeoutSeconds = 60,
  coinType = null,
}) {
  const asset = coinType || usdcCoinType();
  return {
    x402Version: X402_VERSION,
    error: 'Payment required for this resource.',
    accepts: [
      {
        scheme: 'exact',
        network,
        maxAmountRequired: String(amountUsdc),
        resource: resource || undefined,
        description: description || undefined,
        mimeType,
        payTo: seller,
        maxTimeoutSeconds,
        asset: asset || undefined,
        extra: asset ? { name: USDC_SYMBOL, version: '1', coinType: asset } : undefined,
      },
    ],
  };
}

/** Base64 of the requirement — the v2 `PAYMENT-REQUIRED` header form. */
export function encodePaymentRequirement(requirement) {
  return Buffer.from(JSON.stringify(requirement), 'utf8').toString('base64');
}

function decodeMaybeBase64(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  }
  const candidates = [trimmed, trimmed.replace(/-/g, '+').replace(/_/g, '/')];
  for (const candidate of candidates) {
    try {
      const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
      if (!decoded.startsWith('{') && !decoded.startsWith('[')) continue;
      return JSON.parse(decoded);
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return headers[key];
  }
  return null;
}

/**
 * Parse a payment requirement from a response, a body, or a raw string.
 *
 * Accepts both wire forms we might meet:
 *   - v2: a base64 `PAYMENT-REQUIRED` header
 *   - v1: a JSON body carrying `x402Version`
 *
 * @returns {Promise<{ok: boolean, version: number, accepts: Array, reason: string|null, reasonCode: string|null}>}
 */
export async function parsePaymentRequirement(source) {
  let decoded = null;
  let found = false;

  if (source && typeof source === 'object' && typeof source.text === 'function') {
    // A Response-like object.
    const header = headerValue(source.headers, 'payment-required');
    if (header) {
      decoded = decodeMaybeBase64(header);
      found = Boolean(decoded);
    }
    if (!decoded) {
      try {
        const text = await source.text();
        decoded = decodeMaybeBase64(text);
        found = Boolean(decoded);
      } catch {
        decoded = null;
      }
    }
  } else if (source && typeof source === 'object' && (source.headers || source.body !== undefined)) {
    const header = headerValue(source.headers, 'payment-required');
    if (header) {
      decoded = decodeMaybeBase64(header);
      found = Boolean(decoded);
    }
    if (!decoded && source.body !== undefined) {
      decoded = decodeMaybeBase64(source.body);
      found = Boolean(decoded);
    }
  } else {
    decoded = decodeMaybeBase64(source);
    found = Boolean(decoded);
  }

  if (!found || !decoded || typeof decoded !== 'object') {
    return { ok: false, version: X402_VERSION, accepts: [], reason: 'No payment requirement could be parsed.', reasonCode: 'REQUIREMENT_UNPARSED' };
  }

  const accepts = Array.isArray(decoded.accepts) ? decoded.accepts : [];
  return {
    ok: accepts.length > 0,
    version: Number(decoded.x402Version) || X402_VERSION,
    accepts,
    resource: decoded.resource || null,
    reason: accepts.length > 0 ? null : 'Payment requirement carried no accepts[] options.',
    reasonCode: accepts.length > 0 ? null : 'REQUIREMENT_EMPTY',
    raw: decoded,
  };
}

// ─── Payment payload ────────────────────────────────────────────────────────

/**
 * Parse the `X-PAYMENT` header into a normalized payment.
 *
 * The header may be raw JSON or base64 JSON. The payload may be nested
 * (`payload.txDigest`) or flat (`txDigest`) — both spellings are accepted so
 * a client does not have to guess which one we read.
 *
 * @returns {{ok: boolean, payment: object|null, reason: string|null, reasonCode: string|null}}
 */
export function parsePaymentHeader(value) {
  const decoded = decodeMaybeBase64(value);
  if (!decoded || typeof decoded !== 'object') {
    return {
      ok: false,
      payment: null,
      reason: PAYMENT_REASONS.PAYMENT_HEADER_MALFORMED,
      reasonCode: 'PAYMENT_HEADER_MALFORMED',
    };
  }

  const payload = decoded.payload && typeof decoded.payload === 'object' ? decoded.payload : decoded;
  const txDigest =
    payload.txDigest ||
    payload.transactionDigest ||
    payload.digest ||
    payload.tx_digest ||
    null;

  if (!txDigest || typeof txDigest !== 'string') {
    return {
      ok: false,
      payment: null,
      reason: PAYMENT_REASONS.PAYMENT_HEADER_MALFORMED,
      reasonCode: 'PAYMENT_HEADER_MALFORMED',
    };
  }

  const payment = {
    version: Number(decoded.x402Version) || X402_VERSION,
    scheme: decoded.scheme || payload.scheme || 'exact',
    network: decoded.network || payload.network || null,
    txDigest,
    payer: payload.payer || payload.sender || payload.from || null,
    signature: payload.signature || null,
    coinType: payload.coinType || payload.asset || null,
    declaredAmount: payload.amount ?? payload.maxAmountRequired ?? null,
    raw: decoded,
  };

  return { ok: true, payment, reason: null, reasonCode: null };
}

// ─── On-chain verification ──────────────────────────────────────────────────

/** `effects.status` is a string in some shapes and `{status:'success'}` in others. */
export function executionStatus(effects) {
  if (!effects || typeof effects !== 'object') return null;
  const status = effects.status;
  if (typeof status === 'string') return status;
  if (status && typeof status === 'object') {
    if (typeof status.status === 'string') return status.status;
    if (status.error) return 'failure';
  }
  return null;
}

function normalizeOwner(owner) {
  if (typeof owner === 'string') return owner.toLowerCase();
  if (owner && typeof owner === 'object') {
    const value = owner.AddressOwner || owner.address || owner.ObjectOwner || owner.objectId || null;
    return typeof value === 'string' ? value.toLowerCase() : null;
  }
  return null;
}

function toAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Sum the USDC balance changes that belong to a payer/seller pair.
 *
 * @returns {{usdcChanges: Array, sellerCredit: number, payerDebit: number, totalDebit: number, coinTypes: Array}}
 */
export function summarizeBalanceChanges(block, { seller = null, payer = null, env = process.env } = {}) {
  const changes = Array.isArray(block?.balanceChanges) ? block.balanceChanges : [];
  const sellerAddress = seller ? seller.toLowerCase() : null;
  const payerAddress = payer ? payer.toLowerCase() : null;

  let sellerCredit = 0;
  let payerDebit = 0;
  let totalDebit = 0;
  const coinTypes = [];

  for (const change of changes) {
    if (!change || typeof change !== 'object') continue;
    const coinType = typeof change.coinType === 'string' ? change.coinType : null;
    const owner = normalizeOwner(change.owner);
    const amount = toAmount(change.amount);
    if (!coinType || !owner) continue;
    if (!isUsdcCoinType(coinType, env)) continue;
    coinTypes.push(coinType);
    if (amount < 0) totalDebit += Math.abs(amount);
    if (sellerAddress && owner === sellerAddress && amount > 0) sellerCredit += amount;
    if (payerAddress && owner === payerAddress && amount < 0) payerDebit += Math.abs(amount);
  }

  return { usdcChanges: changes, sellerCredit, payerDebit, totalDebit, coinTypes };
}

/**
 * Verify a payment against the chain.
 *
 * @param {object} options
 * @param {object} options.payment         normalized payment (see parsePaymentHeader)
 * @param {number} options.expectedUsdc    price in USDC base units
 * @param {string} options.seller          the quoted payee address
 * @param {string} options.network         the settlement network we expect
 * @param {object} [options.rpc]           { getTransactionBlock } — injected in tests
 * @param {Function} [options.replayCheck] — injected in tests
 * @returns {Promise<{valid: boolean, reason: string|null, reasonCode: string|null, txDigest: string|null, usdc: number|null, payer: string|null, network: string|null, source: string|null}>}
 */
export async function verifyPayment({
  payment,
  expectedUsdc,
  seller,
  network,
  env = process.env,
  rpc = null,
  replayCheck = null,
  usdcTolerance = 0,
}) {
  const fail = (reasonCode, extra = {}) => ({
    valid: false,
    reason: PAYMENT_REASONS[reasonCode] || reasonCode,
    reasonCode,
    txDigest: payment?.txDigest || null,
    usdc: null,
    payer: payment?.payer || null,
    network: payment?.network || null,
    source: null,
    ...extra,
  });

  if (!payment || !payment.txDigest) return fail('PAYMENT_HEADER_MISSING');
  if (!SUPPORTED_SCHEMES.includes(String(payment.scheme || '').toLowerCase())) {
    return fail('PAYMENT_SCHEME_UNSUPPORTED');
  }
  if (!seller) return fail('SELLER_NOT_CONFIGURED');
  if (payment.network && String(payment.network).toLowerCase() !== String(network).toLowerCase()) {
    return fail('PAYMENT_NETWORK_MISMATCH');
  }

  const expected = Number(expectedUsdc);
  if (!Number.isFinite(expected) || expected <= 0) {
    return fail('PAYMENT_AMOUNT_MISMATCH');
  }

  const settled = replayCheck ? await replayCheck(payment.txDigest) : await isTxSettled(payment.txDigest, { env });
  if (settled) return fail('PAYMENT_TX_REPLAYED');

  const alignment = networkAlignment(env);
  if (!alignment.ok) {
    return fail('PAYMENT_VERIFICATION_UNAVAILABLE', { detail: alignment.reason });
  }

  const read = rpc || { getTransactionBlock };
  let block;
  try {
    block = await read.getTransactionBlock(payment.txDigest);
  } catch (err) {
    return fail('PAYMENT_VERIFICATION_UNAVAILABLE', { detail: err?.message || String(err) });
  }

  // `null` is the shared client's fail-closed answer for "not configured" —
  // it is never an answer about the transaction, so we must not deliver.
  if (block === null || block === undefined) {
    return fail('PAYMENT_VERIFICATION_UNAVAILABLE', {
      detail: 'The Sui read returned no result — the read path is unconfigured or the digest is unknown.',
    });
  }
  if (typeof block !== 'object' || block.error) {
    return fail('PAYMENT_TX_NOT_FOUND', { detail: block?.error?.message || 'No transaction block for that digest.' });
  }

  const status = executionStatus(block.effects);
  if (status !== 'success') return fail('PAYMENT_TX_FAILED', { detail: `effects.status=${status || 'unknown'}` });

  if (!Array.isArray(block.balanceChanges) || block.balanceChanges.length === 0) {
    return fail('PAYMENT_BALANCE_CHANGES_UNAVAILABLE');
  }

  const summary = summarizeBalanceChanges(block, { seller, payer: payment.payer, env });
  if (summary.coinTypes.length === 0) return fail('PAYMENT_COIN_TYPE_MISMATCH');
  if (summary.sellerCredit <= 0) return fail('PAYMENT_RECIPIENT_MISMATCH');

  const tolerance = Number.isFinite(Number(usdcTolerance)) ? Number(usdcTolerance) : 0;
  if (summary.sellerCredit < expected || summary.sellerCredit > expected + tolerance) {
    return fail('PAYMENT_AMOUNT_MISMATCH', { detail: `seller received ${summary.sellerCredit} base units, expected ${expected}` });
  }
  if (summary.totalDebit < expected) {
    return fail('PAYMENT_AMOUNT_MISMATCH', { detail: `total debited ${summary.totalDebit} base units, expected ${expected}` });
  }
  if (payment.payer && summary.payerDebit < expected) {
    return fail('PAYMENT_AMOUNT_MISMATCH', { detail: `payer debited ${summary.payerDebit} base units, expected ${expected}` });
  }

  return {
    valid: true,
    reason: null,
    reasonCode: null,
    txDigest: payment.txDigest,
    usdc: summary.sellerCredit,
    payer: payment.payer || null,
    network: payment.network || network,
    source: rpcSource(),
  };
}

/** Stable hash of the paid request — the ledger's `request_hash` column. */
export function requestHash(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
}
