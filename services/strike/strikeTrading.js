/**
 * Strike order path — build, validate, execute.
 *
 * Mirrors `services/polymarketTrading.js` so the autonomous loop needs no
 * fork: same function names, same validate-then-send shape. Orders are
 * always built locally and validated against exchangeInfo filters before a
 * byte leaves the process; `executeServerOrder` is fail-closed — without an
 * API wallet it returns null and nothing is attempted.
 *
 * Bracket orders go through POST /v2/order/strategy: the TP/SL legs are
 * placed by the venue in the same call as the entry, so a mandate's
 * tail-loss gate is enforced by Strike's engine, not by our agent deciding
 * to place a stop later.
 */

import { isConfigured, disabledReason, strikeSigned } from './strikeClient.js';
import { getUniverse, getSymbolSnapshot } from './strikeDiscovery.js';

/** Decimals implied by an increment string like "0.001" or "10". */
function incrementDecimals(inc) {
  const s = String(inc);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : s.length - dot - 1;
}

/**
 * Quantize `value` DOWN to a multiple of `inc` and render with the
 * increment's own precision. Flooring is the safe direction for both
 * sizes (never oversize) and prices (never chase) on entry orders;
 * callers that need round-up semantics do the increment themselves.
 * Returns null when the inputs aren't parseable — never a guessed number.
 */
export function quantizeDown(value, inc) {
  const v = Number(value);
  const i = Number(inc);
  if (!Number.isFinite(v) || !Number.isFinite(i) || i <= 0) return null;
  const q = Math.floor(v / i + 1e-9) * i;
  return q.toFixed(incrementDecimals(inc));
}

/**
 * Validate an order object against the symbol's trading rules.
 * Returns { ok, errors[] } — the caller refuses on any error, so a
 * malformed order can never reach the venue.
 */
export function validateOrder(order, symbolInfo) {
  const errors = [];
  if (!symbolInfo) return { ok: false, errors: [`unknown symbol ${order?.symbol}`] };
  if (symbolInfo.status !== 'trading') errors.push(`symbol ${symbolInfo.symbol} status is ${symbolInfo.status}`);

  const f = symbolInfo.filters || {};
  const size = Number(order.size);
  if (!Number.isFinite(size) || size <= 0) {
    errors.push(`size ${JSON.stringify(order.size)} is not a positive number`);
  } else {
    if (f.minQty && size < Number(f.minQty)) errors.push(`size ${size} below minQty ${f.minQty}`);
    if (f.maxQty && size > Number(f.maxQty)) errors.push(`size ${size} above maxQty ${f.maxQty}`);
    if (f.stepSize && Math.abs(size / Number(f.stepSize) - Math.round(size / Number(f.stepSize))) > 1e-6) {
      errors.push(`size ${size} not a multiple of stepSize ${f.stepSize}`);
    }
  }

  if (order.type === 'limit') {
    const price = Number(order.price);
    if (!Number.isFinite(price) || price <= 0) {
      errors.push(`limit order needs a positive price, got ${JSON.stringify(order.price)}`);
    } else {
      if (f.minPrice && price < Number(f.minPrice)) errors.push(`price ${price} below minPrice ${f.minPrice}`);
      if (f.maxPrice && price > Number(f.maxPrice)) errors.push(`price ${price} above maxPrice ${f.maxPrice}`);
      if (f.tickSize && Math.abs(price / Number(f.tickSize) - Math.round(price / Number(f.tickSize))) > 1e-6) {
        errors.push(`price ${price} not a multiple of tickSize ${f.tickSize}`);
      }
      if (f.minNotional && Number.isFinite(size) && price * size < Number(f.minNotional)) {
        errors.push(`notional ${price * size} below minNotional ${f.minNotional}`);
      }
    }
  } else if (order.type === 'market') {
    const slip = Number(order.slippage);
    if (!Number.isFinite(slip) || slip <= 0 || slip > 0.5) {
      errors.push('market orders need a slippage fraction in (0, 0.5]');
    }
  } else {
    errors.push(`unsupported primary order type ${JSON.stringify(order.type)} (limit|market)`);
  }

  if (!['buy', 'sell'].includes(order.side)) errors.push(`side must be buy|sell, got ${JSON.stringify(order.side)}`);
  return { ok: errors.length === 0, errors };
}

/**
 * Build the POST /v2/order body. Prices/sizes are quantized to the symbol's
 * filters here so what's signed is what's valid.
 */
export function buildOrderObject({ symbol, side, type, size, price, clientOrderId, timeInForce = 'GTC', postOnly, reduceOnly, closePosition, priceProtect, slippage, stopPrice, workingType, subAccountId }, symbolInfo) {
  const f = symbolInfo?.filters || {};
  const body = { symbol, side, type };
  body.size = f.stepSize ? (quantizeDown(size, f.stepSize) ?? String(size)) : String(size);
  if (type === 'limit') {
    body.price = f.tickSize ? (quantizeDown(price, f.tickSize) ?? String(price)) : String(price);
    body.time_in_force = timeInForce;
  }
  if (type === 'market' && slippage != null) body.slippage = String(slippage);
  if (stopPrice != null) body.stop_price = String(stopPrice);
  if (workingType) body.working_type = workingType;
  if (clientOrderId) body.client_order_id = String(clientOrderId);
  if (postOnly) body.post_only = true;
  if (reduceOnly) body.reduce_only = true;
  if (closePosition) body.close_position = true;
  if (priceProtect) body.price_protect = true;
  if (subAccountId) body.sub_account_id = String(subAccountId);
  return body;
}

/**
 * Build the POST /v2/order/strategy bracket body: primary order + optional
 * tp_order/sl_order legs. Each leg carries its own client_order_id — the
 * mandate receipt ID goes on the primary leg, derived IDs on the brackets,
 * so Strike's fills record cites the receipt that authorised the position.
 */
export function buildStrategyOrder({ strategyId, entry, tp, sl }, symbolInfo) {
  const f = symbolInfo?.filters || {};
  const leg = (o, legClientId) => {
    if (!o) return undefined;
    const out = {
      type: o.type,
      size: f.stepSize ? (quantizeDown(o.size, f.stepSize) ?? String(o.size)) : String(o.size),
      stop_price: String(o.stopPrice),
    };
    if (o.price != null) out.price = f.tickSize ? (quantizeDown(o.price, f.tickSize) ?? String(o.price)) : String(o.price);
    if (o.timeInForce) out.time_in_force = o.timeInForce;
    if (o.workingType) out.working_type = o.workingType;
    if (o.postOnly) out.post_only = true;
    if (o.priceProtect) out.price_protect = true;
    out.client_order_id = String(legClientId);
    return out;
  };

  const body = {
    strategy_id: String(strategyId),
    symbol: entry.symbol,
    side: entry.side,
    type: entry.type,
    size: f.stepSize ? (quantizeDown(entry.size, f.stepSize) ?? String(entry.size)) : String(entry.size),
  };
  if (entry.type === 'limit') {
    body.price = f.tickSize ? (quantizeDown(entry.price, f.tickSize) ?? String(entry.price)) : String(entry.price);
    if (entry.timeInForce) body.time_in_force = entry.timeInForce;
  }
  if (entry.slippage != null) body.slippage = String(entry.slippage);
  if (entry.clientOrderId) body.client_order_id = String(entry.clientOrderId);
  if (entry.postOnly) body.post_only = true;
  if (entry.priceProtect) body.price_protect = true;

  const tpLeg = leg(tp, tp?.clientOrderId || `${strategyId}-tp`);
  const slLeg = leg(sl, sl?.clientOrderId || `${strategyId}-sl`);
  if (tpLeg) body.tp_order = tpLeg;
  if (slLeg) body.sl_order = slLeg;
  return body;
}

/** Symbol must exist and be tradable before anything else is attempted. */
export async function validateSymbolForTrading(symbol, opts = {}) {
  const { symbols } = await getUniverse(opts);
  const info = symbols.find((s) => s.symbol === symbol) || null;
  return {
    valid: Boolean(info),
    reason: info ? null : `symbol ${symbol} not found or not trading`,
    symbolInfo: info,
  };
}

/** Rules + live stats for one symbol — what a validator/receipt needs. */
export async function getEnrichedMarketDetails(symbol, opts = {}) {
  const { valid, reason, symbolInfo } = await validateSymbolForTrading(symbol, opts);
  if (!valid) return { valid, reason, symbolInfo: null, snapshot: null };
  const snapshot = await getSymbolSnapshot(symbol, opts).catch(() => null);
  return { valid, reason, symbolInfo, snapshot };
}

/**
 * Validate + submit. A bracket order (tp/sl present) goes to
 * /v2/order/strategy; anything else to /v2/order.
 * Returns { ok, order?, reason?, errors? } — `ok:false` without a request
 * when unconfigured or invalid; never throws on the unconfigured path.
 */
export async function executeServerOrder(orderData, opts = {}) {
  if (!isConfigured()) {
    return { ok: false, reason: disabledReason() || 'not configured' };
  }
  const { symbolInfo } = orderData.symbolInfo
    ? { symbolInfo: orderData.symbolInfo }
    : await validateSymbolForTrading(orderData.symbol || orderData.entry?.symbol, opts);
  if (!symbolInfo) {
    return { ok: false, reason: `unknown or non-trading symbol ${orderData.symbol || orderData.entry?.symbol}` };
  }

  if (orderData.strategyId || orderData.entry) {
    const body = buildStrategyOrder(orderData, symbolInfo);
    const check = validateOrder({ ...body, type: body.type, price: body.price, size: body.size, slippage: body.slippage }, symbolInfo);
    if (!check.ok) return { ok: false, errors: check.errors };
    const res = await strikeSigned('POST', '/v2/order/strategy', { body, ...opts });
    return res ? { ok: true, order: res } : { ok: false, reason: 'signed request returned null' };
  }

  const body = buildOrderObject(orderData, symbolInfo);
  const check = validateOrder(body, symbolInfo);
  if (!check.ok) return { ok: false, errors: check.errors };
  const res = await strikeSigned('POST', '/v2/order', { body, ...opts });
  return res ? { ok: true, order: res } : { ok: false, reason: 'signed request returned null' };
}
