/**
 * x402 on Sui — shared constants, env parsing and small pure helpers.
 *
 * The official agent-payments rail is invite-only on Sui testnet, so this
 * module is a SELF-FACILITATED settlement leg: we publish the requirement, the
 * buyer transfers USDC on Sui, and we verify that transfer by re-reading the
 * transaction block through the Tatum Sui RPC before anything is delivered.
 *
 * Two rules shape every decision in here:
 *
 *   1. No invented constants. A coin type we are not sure about is `null`, not
 *      a plausible-looking address. When something is unknown we refuse and
 *      print why (`NA` beats `0`).
 *   2. Dark by default. Every external leg is opt-in through an `*_ENABLED`
 *      flag and a missing-credentials reason string — never a silent zero.
 *
 * Amounts are ALWAYS integers in USDC base units (micro-USDC, 6 decimals).
 * Human amounts only exist at the edges (env parsing, API rendering), and the
 * conversion is explicit so "0.01" and "10000" can never be confused.
 */

/** x402 protocol version we speak (v1 body shape, v2 `PAYMENT-REQUIRED` header). */
export const X402_VERSION = 1;

/** Sui settlement networks, keyed by our short name. */
export const SETTLEMENT_NETWORKS = Object.freeze({
  testnet: 'sui:testnet',
  mainnet: 'sui:mainnet',
});

/**
 * Default settlement network.
 *
 * testnet is the default on purpose: the ≥10-mainnet-memories deliverable is
 * carried by WP2/WP3, so this leg must not be able to push real money by
 * accident. Switching to mainnet is an explicit, logged decision.
 */
export const DEFAULT_SETTLEMENT_NETWORK = 'testnet';

export const USDC_SYMBOL = 'USDC';
export const USDC_DECIMALS = 6;

/** Payment scheme we accept. `exact` — the buyer transfers a fixed amount. */
export const SUPPORTED_SCHEMES = Object.freeze(['exact']);

/**
 * Canonical Sui mainnet native USDC coin type.
 *
 * The testnet USDC coin type is deliberately absent: we are not certain of it,
 * and a wrong coin type is a lost payment, not a typo. Set
 * `X402_USDC_COIN_TYPE` for testnet, or rely on the structural check in
 * `isUsdcCoinType()` (the `::usdc::USDC` package suffix), which is what the
 * on-chain read is checked against when no type is configured.
 */
export const KNOWN_USDC_COIN_TYPES = Object.freeze({
  'sui:mainnet': '0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e::usdc::USDC',
});

/**
 * Machine-readable failure reasons. Every refusal carries one of these plus a
 * human sentence — a refusal that cannot be named cannot be triaged.
 */
export const PAYMENT_REASONS = Object.freeze({
  X402_DISABLED: 'X402 settlement is disabled (set X402_ENABLED=true).',
  SELLER_NOT_CONFIGURED: 'X402_SELLER_ADDRESS is not set — we cannot name a payee, so we refuse to quote.',
  PAYMENT_HEADER_MISSING: 'No X-PAYMENT header on the request.',
  PAYMENT_HEADER_MALFORMED: 'X-PAYMENT header is not decodable JSON with a transaction digest.',
  PAYMENT_SCHEME_UNSUPPORTED: 'Payment scheme is not one we accept.',
  PAYMENT_NETWORK_MISMATCH: 'Payment was made on a different network than the one we settle on.',
  PAYMENT_TX_NOT_FOUND: 'Transaction digest was not found on the settlement network.',
  PAYMENT_TX_FAILED: 'Transaction did not succeed (effects.status !== success).',
  PAYMENT_BALANCE_CHANGES_UNAVAILABLE: 'Transaction block carried no balance changes to verify against.',
  PAYMENT_COIN_TYPE_MISMATCH: 'Transferred coin is not USDC.',
  PAYMENT_AMOUNT_MISMATCH: 'Transferred amount does not match the quoted amount.',
  PAYMENT_RECIPIENT_MISMATCH: 'Transfer did not pay the quoted seller address.',
  PAYMENT_TX_REPLAYED: 'This transaction has already been used to settle a request.',
  PAYMENT_VERIFICATION_UNAVAILABLE: 'Could not reach the Sui RPC to verify the payment — we did not deliver.',
  SPEND_CEILING_EXCEEDED: 'Per-answer spend ceiling reached.',
  SPEND_RUN_CAP_EXCEEDED: 'Per-run spend cap reached.',
  RESOURCE_FAILED: 'The paid resource could not be produced.',
});

/** Valid short network names. */
export function isSettlementNetwork(name) {
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(SETTLEMENT_NETWORKS, name);
}

/**
 * Resolve the settlement network from the environment.
 * @returns {{name: string, network: string, explicit: boolean, error: string|null}}
 */
export function settlementNetwork(env = process.env) {
  const raw = String(env.SETTLEMENT_NETWORK || '').trim().toLowerCase();
  if (!raw) {
    return {
      name: DEFAULT_SETTLEMENT_NETWORK,
      network: SETTLEMENT_NETWORKS[DEFAULT_SETTLEMENT_NETWORK],
      explicit: false,
      error: null,
    };
  }
  if (raw === 'sui:testnet' || raw === 'sui:mainnet') {
    const name = raw === 'sui:testnet' ? 'testnet' : 'mainnet';
    return { name, network: raw, explicit: true, error: null };
  }
  if (!isSettlementNetwork(raw)) {
    return {
      name: DEFAULT_SETTLEMENT_NETWORK,
      network: SETTLEMENT_NETWORKS[DEFAULT_SETTLEMENT_NETWORK],
      explicit: false,
      error: `SETTLEMENT_NETWORK="${raw}" is not a known network (testnet|mainnet|sui:testnet|sui:mainnet).`,
    };
  }
  return { name: raw, network: SETTLEMENT_NETWORKS[raw], explicit: true, error: null };
}

/** The address that receives USDC. Null when unset — we then refuse to quote. */
export function sellerAddress(env = process.env) {
  const raw = String(env.X402_SELLER_ADDRESS || '').trim();
  return raw ? raw : null;
}

/** Opt-in switch. The payment leg is dark until someone turns it on. */
export function isEnabled(env = process.env) {
  return String(env.X402_ENABLED || '').trim().toLowerCase() === 'true';
}

/**
 * The USDC coin type we expect, or null when we do not know it.
 * `X402_USDC_COIN_TYPE` wins; otherwise the known mainnet type.
 */
export function usdcCoinType(env = process.env) {
  const configured = String(env.X402_USDC_COIN_TYPE || '').trim();
  if (configured) return configured;
  const { network } = settlementNetwork(env);
  return KNOWN_USDC_COIN_TYPES[network] || null;
}

/**
 * Structural USDC check used against the on-chain coin type.
 *
 * Sui's native USDC lives in the `usdc` package on every network, so the
 * `::usdc::USDC` suffix is the check we can make without inventing an address.
 * When a coin type IS configured, an exact match is required.
 */
export function isUsdcCoinType(coinType, env = process.env) {
  if (!coinType || typeof coinType !== 'string') return false;
  const configured = usdcCoinType(env);
  if (configured) return coinType.toLowerCase() === configured.toLowerCase();
  return coinType.toLowerCase().endsWith('::usdc::usdc');
}

/**
 * Convert a human USDC amount to integer base units.
 * @returns {number|null} null when the amount is not a usable number.
 */
export function toBaseUnits(amount, decimals = USDC_DECIMALS) {
  if (amount === null || amount === undefined || amount === '') return null;
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return null;
  const scaled = Math.round(value * 10 ** decimals);
  if (!Number.isSafeInteger(scaled)) return null;
  return scaled;
}

/** Convert integer base units to a human USDC string. */
export function fromBaseUnits(baseUnits, decimals = USDC_DECIMALS) {
  const value = Number(baseUnits);
  if (!Number.isFinite(value)) return null;
  return (value / 10 ** decimals).toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}

/**
 * Read a human USDC amount out of the environment.
 * @returns {{baseUnits: number|null, raw: string|null, error: string|null}}
 */
export function usdcAmountFromEnv(rawValue) {
  const raw = String(rawValue ?? '').trim();
  if (!raw) return { baseUnits: null, raw: null, error: null };
  const baseUnits = toBaseUnits(raw);
  if (baseUnits === null) {
    return { baseUnits: null, raw, error: `"${raw}" is not a valid USDC amount.` };
  }
  return { baseUnits, raw, error: null };
}

/** Per-answer spend ceiling (human USDC in env, base units in code). */
export function spendCeiling(env = process.env) {
  return usdcAmountFromEnv(env.X402_USDC_CEILING);
}

/** Per-run spend cap (human USDC in env, base units in code). */
export function runCap(env = process.env) {
  return usdcAmountFromEnv(env.X402_RUN_CAP_USDC);
}

/** Quoted price of the premium resource (human USDC in env, base units in code). */
export function premiumPrice(env = process.env) {
  const parsed = usdcAmountFromEnv(env.X402_PREMIUM_PRICE_USDC ?? '0.01');
  if (parsed.baseUnits === null) {
    return { baseUnits: toBaseUnits('0.01'), raw: '0.01', error: parsed.error };
  }
  return parsed;
}
