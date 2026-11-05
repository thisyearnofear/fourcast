/**
 * NEAR Intents client — 1-Click API (defuse settlement layer).
 *
 * The 1-Click API is plain REST, no SDK. It turns a swap request into a
 * single deposit address: the agent sends the origin asset once and the
 * solver network settles the destination asset to the recipient — the rail
 * that moves value across chains for a Fourcast position.
 *
 * Flow:
 *   1. listTokens()            — supported origin/destination assets
 *   2. getQuote()              — returns depositAddress + expected output
 *   3. (agent sends funds to depositAddress — one deposit, any wallet)
 *   4. getExecutionStatus()    — poll until SUCCESS / REFUNDED / FAILED
 *
 * Auth: a partner JWT (NEAR_ONECLICK_JWT, sent as X-API-Key) switches quotes to
 * the partner fee schedule; unauthenticated requests still work but carry a
 * 0.25% platform fee on every non-ANY_INPUT quote. Keep the JWT server-side.
 *
 * Note: NEAR Intents has no testnet — small amounts on mainnet for tests.
 */

import { getNearConfig } from './nearConfig.js';

function headers() {
  const config = getNearConfig();
  const h = { 'Content-Type': 'application/json' };
  if (config.oneClickJwt) h['X-API-Key'] = config.oneClickJwt;
  return h;
}

async function request(path, { method = 'GET', body } = {}) {
  const config = getNearConfig();
  const res = await fetch(`${config.oneClickBaseUrl}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON body — surface as raw text below
  }

  if (!res.ok) {
    const detail = json?.message || text || res.statusText;
    const authHint = res.status === 401 && !config.oneClickJwt
      ? ' (set NEAR_ONECLICK_JWT for the partner fee schedule)'
      : '';
    throw new Error(`1-Click ${method} ${path} → ${res.status}: ${detail}${authHint}`);
  }
  return json;
}

/** List every asset the solver network can settle. */
export async function listTokens() {
  return request('/v0/tokens');
}

/**
 * Request a swap quote.
 *
 * @param {object} p
 * @param {string} p.originAsset      e.g. 'nep141:wrap.near' or 'nep141:usdt.tether-token.near'
 * @param {string} p.destinationAsset e.g. 'nep141:17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1' (USDC on NEAR)
 * @param {string} p.amount           amount in the origin asset's smallest unit
 * @param {string} p.recipient        destination account/address
 * @param {string} p.recipientType    'INTENTS' (Intents balance — the agent default) | 'DESTINATION_CHAIN' | 'FLEX'
 * @param {string} p.refundTo         refund account/address if the intent fails
 * @param {boolean} p.dry             dry=true → quote only, no deposit address commitment
 * @param {string} p.deadline         ISO-8601; defaults to now + 1h
 * @param {number} p.slippageTolerance bps, default 100 (1%)
 */
export async function getQuote({
  originAsset,
  destinationAsset,
  amount,
  recipient,
  recipientType = 'INTENTS',
  refundTo,
  refundType = 'INTENTS',
  dry = true,
  deadline,
  slippageTolerance = 100,
}) {
  if (!originAsset || !destinationAsset || !amount || !recipient || !refundTo) {
    throw new Error('getQuote: originAsset, destinationAsset, amount, recipient and refundTo are required');
  }
  return request('/v0/quote', {
    method: 'POST',
    body: {
      dry,
      swapType: 'EXACT_INPUT',
      slippageTolerance,
      originAsset,
      depositType: 'ORIGIN_CHAIN',
      destinationAsset,
      amount: String(amount),
      refundTo,
      refundType,
      recipient,
      recipientType,
      deadline: deadline || new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      quoteWaitingTimeMs: 0,
    },
  });
}

/** Poll execution status for a deposit address (and memo, for UTXO chains). */
export async function getExecutionStatus({ depositAddress, depositMemo }) {
  if (!depositAddress) throw new Error('getExecutionStatus: depositAddress is required');
  const params = new URLSearchParams({ depositAddress });
  if (depositMemo) params.set('depositMemo', String(depositMemo));
  return request(`/v0/status?${params}`);
}

/**
 * Notify the solver of a submitted deposit so processing starts without
 * waiting for indexer lag. Returns the same shape as getExecutionStatus.
 */
export async function submitDepositTx({ txHash, depositAddress, nearSenderAccount }) {
  if (!txHash || !depositAddress) {
    throw new Error('submitDepositTx: txHash and depositAddress are required');
  }
  const body = { txHash, depositAddress };
  if (nearSenderAccount) body.nearSenderAccount = nearSenderAccount;
  return request('/v0/deposit/submit', { method: 'POST', body });
}

const nearIntents = { listTokens, getQuote, getExecutionStatus, submitDepositTx };
export default nearIntents;
