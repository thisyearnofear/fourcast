/**
 * Settlement orchestration for x402 on Solana.
 *
 * `deliverAfterSettlementSolana(req, resourceFn)` is the whole seller-side flow:
 *
 *   unpaid request  → 402 with a `Payment-Required` header naming the price,
 *                     the payee, the mint and the network;
 *   paid request    → the signed transaction is decoded and checked against
 *                     the requirement BEFORE broadcast, simulated, settled
 *                     on-chain, re-verified from the confirmed balance delta,
 *                     claimed in the spend ledger, and ONLY THEN is
 *                     `resourceFn` called.
 *
 * The ordering is the product. The resource is produced after settlement, not
 * before — a buyer who cannot settle gets nothing, and a buyer who settles
 * gets exactly one delivery because the signature is claimed with a UNIQUE
 * constraint before the resource is built.
 *
 * Spend gates are shared with the Sui rail (`x402_payments` ledger): a ceiling
 * is a ceiling regardless of which chain the money moved on.
 */

import { Connection } from '@solana/web3.js';
import { getAccount } from '@solana/spl-token';
import {
  buildPaymentRequirement,
  decodePaymentTransaction,
  encodePaymentRequirement,
  normalizeInstructions,
  parsePaymentSignature,
  paymentHeaderValue,
  requestHash,
  resolveAccountKeys,
  verifyPaymentInstruction,
  verifySettlementOutcome,
} from './verify.js';
import { checkSpendGates, claimPayment, confirmPayment, failPayment, isTxSettled } from '../x402Sui/spendLedger.js';
import {
  PAYMENT_REASONS,
  X402_VERSION,
  assetMint,
  fromBaseUnits,
  isEnabled,
  normalizeNetwork,
  premiumPrice,
  sellerAddress,
  settlementNetwork,
} from './types.js';

const DEFAULT_RPC = {
  'solana-devnet': 'https://api.devnet.solana.com',
  solana: 'https://api.mainnet-beta.solana.com',
};

function rpcUrlFor(network, env = process.env) {
  const configured = String(env.X402_SOLANA_RPC_URL || env.SOLANA_RPC_URL || '').trim();
  if (configured) return configured;
  return DEFAULT_RPC[network] || DEFAULT_RPC['solana-devnet'];
}

function getConnection(network, env = process.env) {
  return new Connection(rpcUrlFor(network, env), 'confirmed');
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

/** Fee payer = first signed account key (staticAccountKeys[0] / feePayer). */
function feePayerOf(tx) {
  if (tx.feePayer) return tx.feePayer.toBase58();
  const keys = tx.message?.staticAccountKeys || [];
  return keys[0]?.toBase58?.() || null;
}

/**
 * Confirm a submitted signature, bounded by a timeout.
 * @returns {Promise<{confirmed: boolean, err: string|null}>}
 */
async function confirmWithTimeout(connection, signature, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const status = await connection.getSignatureStatus(signature, { searchTransactionHistory: false });
      const value = status?.value;
      if (value) {
        if (value.err) return { confirmed: false, err: JSON.stringify(value.err) };
        const conf = value.confirmationStatus;
        if (conf === 'confirmed' || conf === 'finalized') return { confirmed: true, err: null };
      }
    } catch {
      /* transient RPC failure — keep polling until deadline */
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return { confirmed: false, err: 'confirmation timeout' };
}

/**
 * The seller-side entry point.
 *
 * @param {object} req                 request-like: `{ headers }`
 * @param {Function} resourceFn        `async ({ payment, settlement }) => payload`
 * @param {object} [options]
 * @param {string} [options.seller]    payee address (default `X402_SOLANA_PAY_TO`/`TXLINE_SOLANA_PUBLIC_KEY`)
 * @param {number} [options.priceBaseUnits] price in asset base units
 * @param {string} [options.assetMint] asset mint override
 * @param {string} [options.answerKey] per-answer spend identity
 * @param {string} [options.runId]     per-run spend identity
 * @param {string} [options.resource]  resource path quoted in the requirement
 * @param {object} [options.env]
 * @returns {Promise<Response>}
 */
export async function deliverAfterSettlementSolana(req, resourceFn, options = {}) {
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

  const asset = assetMint(env);
  const mint = options.assetMint || asset.mint;
  if (!mint) {
    return jsonResponse(
      { success: false, error: 'No asset mint configured for this network.', reason: 'ASSET_UNRESOLVED', settlementNetwork: net.network },
      { status: 500 }
    );
  }
  const decimals = asset.decimals;

  const price = Number.isFinite(Number(options.priceBaseUnits)) && Number(options.priceBaseUnits) > 0
    ? Number(options.priceBaseUnits)
    : premiumPrice(env, decimals ?? 6).baseUnits;
  if (!Number.isFinite(price) || price <= 0) {
    return jsonResponse(
      { success: false, error: 'The quoted price could not be resolved.', reason: 'PRICE_UNRESOLVED', settlementNetwork: net.network },
      { status: 500 }
    );
  }

  const requirement = buildPaymentRequirement({
    seller,
    amount: price,
    network: net.network,
    asset: mint,
    decimals,
    symbol: asset.symbol,
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

  const parsed = parsePaymentSignature(rawPayment, { PAYMENT_REASONS });
  if (!parsed.ok) {
    return paymentRequiredResponse(requirement, {
      reason: parsed.reason,
      reasonCode: parsed.reasonCode,
      network: net.network,
    });
  }
  const payment = parsed.payment;

  // The client may echo the accepted terms; a mismatch is a refusal, not a hint.
  const clientNetwork = payment.network ? normalizeNetwork(payment.network) : null;
  if (payment.network && (!clientNetwork || clientNetwork !== net.network)) {
    return paymentRequiredResponse(requirement, {
      reason: PAYMENT_REASONS.PAYMENT_NETWORK_MISMATCH,
      reasonCode: 'PAYMENT_NETWORK_MISMATCH',
      detail: `client network "${payment.network}" != "${net.network}"`,
      network: net.network,
    });
  }
  if (payment.scheme && String(payment.scheme).toLowerCase() !== 'exact') {
    return paymentRequiredResponse(requirement, {
      reason: PAYMENT_REASONS.PAYMENT_SCHEME_UNSUPPORTED,
      reasonCode: 'PAYMENT_SCHEME_UNSUPPORTED',
      network: net.network,
    });
  }

  const decoded = decodePaymentTransaction(payment.transaction, { PAYMENT_REASONS });
  if (!decoded.ok) {
    return paymentRequiredResponse(requirement, {
      reason: decoded.reason,
      reasonCode: decoded.reasonCode,
      detail: decoded.detail || null,
      network: net.network,
    });
  }
  const { tx, signature } = decoded;
  const payer = feePayerOf(tx);

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

  const connection = getConnection(net.network, env);

  // Resolve account keys (needed for versioned txs with lookup tables), then
  // verify the payment instruction against the quoted requirement.
  let resolvedKeys = null;
  try {
    resolvedKeys = await resolveAccountKeys(tx, connection);
  } catch {
    resolvedKeys = null;
  }
  const instructions = normalizeInstructions(tx, resolvedKeys);

  // Owner check: destination must be a token account for our mint owned by
  // the payee. We fetch it once — a missing account is a refusal, not a pass.
  const ownerCheck = async (destination) => {
    try {
      const acc = await getAccount(connection, destination);
      return acc.owner;
    } catch {
      return null;
    }
  };

  const instructionCheck = await verifyPaymentInstruction({
    instructions,
    payTo: seller,
    assetMint: mint,
    expectedAmount: price,
    expectedDecimals: decimals,
    feePayer: payer,
    ownerCheck,
    PAYMENT_REASONS,
  });
  if (!instructionCheck.ok) {
    return paymentRequiredResponse(requirement, {
      reason: instructionCheck.reason,
      reasonCode: instructionCheck.reasonCode,
      detail: instructionCheck.detail || null,
      network: net.network,
    });
  }

  if (await isTxSettled(signature, { env })) {
    return jsonResponse(
      {
        success: false,
        error: PAYMENT_REASONS.PAYMENT_TX_REPLAYED,
        reason: 'PAYMENT_TX_REPLAYED',
        reasonCode: 'PAYMENT_TX_REPLAYED',
        txDigest: signature,
        settlementNetwork: net.network,
      },
      { status: 409 }
    );
  }

  // Simulate before broadcasting — catches insufficient funds / bad state
  // without spending a slot on a doomed transaction.
  try {
    const sim = await connection.simulateTransaction(tx, { sigVerify: true });
    if (sim.value?.err) {
      return paymentRequiredResponse(requirement, {
        reason: 'The payment transaction would fail on-chain.',
        reasonCode: 'PAYMENT_SETTLEMENT_FAILED',
        detail: JSON.stringify(sim.value.err),
        network: net.network,
      });
    }
  } catch (err) {
    return paymentRequiredResponse(requirement, {
      reason: PAYMENT_REASONS.PAYMENT_VERIFICATION_UNAVAILABLE,
      reasonCode: 'PAYMENT_VERIFICATION_UNAVAILABLE',
      detail: `simulate failed: ${err?.message || err}`,
      network: net.network,
    });
  }

  // Broadcast. The buyer already signed; we are the facilitator.
  let broadcastSignature = signature;
  try {
    broadcastSignature = await connection.sendRawTransaction(decoded.bytes, {
      skipPreflight: true,
      maxRetries: 3,
    });
  } catch (err) {
    const msg = String(err?.message || err);
    if (/already|processed|dedup/i.test(msg)) {
      // The buyer (or a retry) already landed it — the money still moved to us.
      broadcastSignature = signature;
    } else {
      return paymentRequiredResponse(requirement, {
        reason: PAYMENT_REASONS.PAYMENT_BROADCAST_FAILED,
        reasonCode: 'PAYMENT_BROADCAST_FAILED',
        detail: msg,
        network: net.network,
      });
    }
  }

  const settled = await confirmWithTimeout(connection, broadcastSignature);
  if (!settled.confirmed) {
    return jsonResponse(
      {
        success: false,
        error: settled.err === 'confirmation timeout'
          ? PAYMENT_REASONS.PAYMENT_SETTLEMENT_UNCONFIRMED
          : PAYMENT_REASONS.PAYMENT_SETTLEMENT_FAILED,
        reason: settled.err === 'confirmation timeout' ? 'PAYMENT_SETTLEMENT_UNCONFIRMED' : 'PAYMENT_SETTLEMENT_FAILED',
        detail: settled.err,
        txDigest: broadcastSignature,
        settlementNetwork: net.network,
      },
      { status: 502 }
    );
  }

  // Empirical verification: the confirmed transaction's token-balance delta on
  // the exact destination account must cover the quoted amount.
  const outcome = await verifySettlementOutcome({
    connection,
    signature: broadcastSignature,
    assetMint: mint,
    destinationAccount: instructionCheck.payment.destination,
    expectedAmount: price,
    PAYMENT_REASONS,
  });
  if (!outcome.ok) {
    // Money moved but the delta did not match — record nothing as delivered,
    // but DO record the settlement attempt so the digest cannot be replayed
    // into a second delivery.
    await claimPayment({
      txDigest: broadcastSignature,
      answerKey,
      payer,
      seller,
      usdc: price,
      network: net.network,
      resource: options.resource || null,
      runId,
      requestHash: options.requestHash || null,
      env,
    }).catch(() => {});
    await failPayment(broadcastSignature, outcome.reason).catch(() => {});
    return jsonResponse(
      {
        success: false,
        error: outcome.reason,
        reason: outcome.reasonCode,
        detail: outcome.detail || null,
        txDigest: broadcastSignature,
        settlementNetwork: net.network,
      },
      { status: 502 }
    );
  }

  const claim = await claimPayment({
    txDigest: broadcastSignature,
    answerKey,
    payer,
    seller,
    usdc: price,
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
        txDigest: broadcastSignature,
        settlementNetwork: net.network,
      },
      { status: 409 }
    );
  }

  const settlement = {
    txDigest: broadcastSignature,
    txSignature: broadcastSignature,
    explorer: `https://explorer.solana.com/tx/${broadcastSignature}?cluster=${net.network === 'solana' ? 'mainnet-beta' : 'devnet'}`,
    amount: price,
    amountHuman: fromBaseUnits(price, decimals ?? 6),
    asset: mint,
    assetSymbol: asset.symbol || 'SPL',
    payer,
    seller,
    network: net.network,
    rpc: rpcUrlFor(net.network, env),
  };

  try {
    const payload = await resourceFn({ payment, settlement });
    await confirmPayment(broadcastSignature, {
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
    await failPayment(broadcastSignature, err);
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
