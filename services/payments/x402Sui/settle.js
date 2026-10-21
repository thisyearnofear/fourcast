/**
 * Settlement orchestration for x402 on Sui.
 *
 * `deliverAfterSettlement(req, resourceFn)` is the whole seller-side flow:
 *
 *   unpaid request  → 402 with a `Payment-Required` header naming the price,
 *                     the payee and the network;
 *   paid request    → the transaction is re-read on chain, the spend gates are
 *                     applied, the digest is claimed, and ONLY THEN is
 *                     `resourceFn` called.
 *
 * The ordering is the product. The resource is produced after settlement, not
 * before — a buyer who cannot settle gets nothing, and a buyer who settles
 * gets exactly one delivery because the digest is claimed with a UNIQUE
 * constraint before the resource is built.
 *
 * Every response carries `settlementNetwork`, so nobody has to guess which
 * network we settled on. The default is testnet.
 */

import { buildPaymentRequirement, encodePaymentRequirement, parsePaymentHeader, requestHash, verifyPayment } from './verify.js';
import { checkSpendGates, claimPayment, confirmPayment, failPayment } from './spendLedger.js';
import {
  PAYMENT_REASONS,
  X402_VERSION,
  isEnabled,
  premiumPrice,
  sellerAddress,
  settlementNetwork,
} from './types.js';

function headerValue(headers, name) {
  if (!headers) return null;
  if (typeof headers.get === 'function') return headers.get(name);
  const lower = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lower) return headers[key];
  }
  return null;
}

function paymentHeaderValue(req) {
  const headers = req?.headers;
  return (
    headerValue(headers, 'x-payment') ||
    headerValue(headers, 'payment-signature') ||
    headerValue(headers, 'x-payment-signature') ||
    null
  );
}

function jsonResponse(body, { status = 200, headers = {} } = {}) {
  return Response.json(body, { status, headers });
}

/** The 402 answer: a machine-readable requirement plus a human reason. */
function paymentRequiredResponse(requirement, { reason, reasonCode, detail = null, network }) {
  return Response.json(
    {
      success: false,
      error: 'payment required',
      reason: reason || null,
      reasonCode: reasonCode || null,
      detail,
      x402Version: X402_VERSION,
      accepts: requirement.accepts,
      settlementNetwork: network,
    },
    {
      status: 402,
      headers: {
        'Payment-Required': encodePaymentRequirement(requirement),
      },
    }
  );
}

/**
 * The seller-side entry point.
 *
 * @param {object} req                 request-like: `{ headers }`
 * @param {Function} resourceFn        `async ({ payment, settlement }) => payload`
 * @param {object} [options]
 * @param {string} [options.seller]    payee address (default `X402_SELLER_ADDRESS`)
 * @param {number} [options.priceUsdc] price in base units (default `X402_PREMIUM_PRICE_USDC`)
 * @param {string} [options.answerKey] per-answer spend identity
 * @param {string} [options.runId]     per-run spend identity
 * @param {string} [options.resource]  resource path quoted in the requirement
 * @param {object} [options.env]
 * @returns {Promise<Response>}
 */
export async function deliverAfterSettlement(req, resourceFn, options = {}) {
  const env = options.env || process.env;

  if (!isEnabled(env)) {
    return jsonResponse(
      {
        success: false,
        error: PAYMENT_REASONS.X402_DISABLED,
        reason: 'X402_DISABLED',
        settlementNetwork: settlementNetwork(env).network,
      },
      { status: 503 }
    );
  }

  const seller = options.seller || sellerAddress(env);
  if (!seller) {
    return jsonResponse(
      {
        success: false,
        error: PAYMENT_REASONS.SELLER_NOT_CONFIGURED,
        reason: 'SELLER_NOT_CONFIGURED',
        settlementNetwork: settlementNetwork(env).network,
      },
      { status: 503 }
    );
  }

  const net = settlementNetwork(env);
  if (net.error) {
    return jsonResponse({ success: false, error: net.error, reason: 'SETTLEMENT_NETWORK_INVALID' }, { status: 500 });
  }

  const price = Number.isFinite(Number(options.priceUsdc)) && Number(options.priceUsdc) > 0
    ? Number(options.priceUsdc)
    : premiumPrice(env).baseUnits;
  if (!Number.isFinite(price) || price <= 0) {
    return jsonResponse(
      { success: false, error: 'The quoted price could not be resolved.', reason: 'PRICE_UNRESOLVED', settlementNetwork: net.network },
      { status: 500 }
    );
  }

  const requirement = buildPaymentRequirement({
    seller,
    amountUsdc: price,
    network: net.network,
    resource: options.resource || null,
    description: options.description || null,
  });

  const rawPayment = paymentHeaderValue(req);
  if (!rawPayment) {
    return paymentRequiredResponse(requirement, {
      reason: PAYMENT_REASONS.PAYMENT_HEADER_MISSING,
      reasonCode: 'PAYMENT_HEADER_MISSING',
      network: net.network,
    });
  }

  const parsed = parsePaymentHeader(rawPayment);
  if (!parsed.ok) {
    return paymentRequiredResponse(requirement, {
      reason: parsed.reason,
      reasonCode: parsed.reasonCode,
      network: net.network,
    });
  }

  const answerKey = options.answerKey || 'default';
  const runId = options.runId || null;

  // Spend gates run BEFORE we accept money: a refused spend never touches the
  // buyer's wallet.
  const gates = await checkSpendGates({ answerKey, amountUsdc: price, runId, env });
  if (!gates.allowed) {
    return jsonResponse(
      {
        success: false,
        error: gates.reason,
        reason: gates.reasonCode,
        gates,
        settlementNetwork: net.network,
      },
      { status: 403 }
    );
  }

  const verification = await verifyPayment({
    payment: parsed.payment,
    expectedUsdc: price,
    seller,
    network: net.network,
    env,
  });

  if (!verification.valid) {
    // A replay is not a payment problem, it is a conflict: the digest already
    // settled something else.
    if (verification.reasonCode === 'PAYMENT_TX_REPLAYED') {
      return jsonResponse(
        {
          success: false,
          error: PAYMENT_REASONS.PAYMENT_TX_REPLAYED,
          reason: 'PAYMENT_TX_REPLAYED',
          reasonCode: 'PAYMENT_TX_REPLAYED',
          txDigest: verification.txDigest,
          settlementNetwork: net.network,
        },
        { status: 409 }
      );
    }
    return paymentRequiredResponse(requirement, {
      reason: verification.reason,
      reasonCode: verification.reasonCode,
      detail: verification.detail || null,
      network: net.network,
    });
  }

  const claim = await claimPayment({
    txDigest: verification.txDigest,
    answerKey,
    payer: verification.payer,
    seller,
    usdc: verification.usdc,
    network: net.network,
    resource: options.resource || null,
    runId,
    requestHash: options.requestHash || null,
    env,
  });

  if (claim.duplicate) {
    return jsonResponse(
      {
        success: false,
        error: PAYMENT_REASONS.PAYMENT_TX_REPLAYED,
        reason: 'PAYMENT_TX_REPLAYED',
        reasonCode: 'PAYMENT_TX_REPLAYED',
        txDigest: verification.txDigest,
        settlementNetwork: net.network,
      },
      { status: 409 }
    );
  }

  const settlement = {
    txDigest: verification.txDigest,
    usdc: verification.usdc,
    payer: verification.payer,
    seller,
    network: net.network,
    verifiedVia: verification.source,
  };

  try {
    const payload = await resourceFn({ payment: parsed.payment, settlement });
    await confirmPayment(verification.txDigest, {
      signalId: payload?.signalId || null,
      blobId: payload?.blobId || null,
    });
    return jsonResponse(
      {
        success: true,
        ...(payload || {}),
        settlement,
        settlementNetwork: net.network,
      },
      { status: 200 }
    );
  } catch (err) {
    await failPayment(verification.txDigest, err);
    return jsonResponse(
      {
        success: false,
        error: PAYMENT_REASONS.RESOURCE_FAILED,
        reason: 'RESOURCE_FAILED',
        detail: err?.message || String(err),
        settlement,
        settlementNetwork: net.network,
      },
      { status: 500 }
    );
  }
}

export { requestHash };
