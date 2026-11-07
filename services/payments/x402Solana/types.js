/**
 * x402 on Solana — shared constants, env parsing and small pure helpers.
 *
 * Self-facilitated settlement leg, same shape as the Sui rail: we publish the
 * requirement as a 402, the buyer hands us a fully-signed transaction that pays
 * the quoted asset to our payee, and we verify the payment BOTH ways — the
 * instruction must match the requirement before we broadcast, and the
 * post-settlement token-balance delta is re-read from the confirmed
 * transaction before anything is delivered.
 *
 * Two rules shape every decision in here (inherited from x402Sui/types.js):
 *
 *   1. No invented constants. A mint we are not sure about is `null`, not a
 *      plausible-looking address.
 *   2. Dark by default. Every external leg is opt-in through an `*_ENABLED`
 *      flag — never a silent settlement.
 *
 * Amounts are ALWAYS integers in the asset's base units (micro-USDC for the
 * default asset). Human amounts only exist at the edges.
 */

/** x402 protocol version we speak (v1 body shape, v2 `PAYMENT-REQUIRED` header). */
export const X402_VERSION = 1;

/**
 * Settlement networks, keyed by our short name.
 *
 * We quote the x402-canonical network strings (`solana`, `solana-devnet`)
 * because that is what x402 clients match against. The CAIP-2 forms are
 * accepted on the way in so a standards-native client is not rejected.
 */
export const SETTLEMENT_NETWORKS = Object.freeze({
  devnet: 'solana-devnet',
  mainnet: 'solana',
});

/** CAIP-2 aliases some x402 clients send instead of the short network string. */
export const NETWORK_ALIASES = Object.freeze({
  'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp': 'solana',
  'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1': 'solana-devnet',
  solana: 'solana',
  'solana-devnet': 'solana-devnet',
  'solana:devnet': 'solana-devnet',
});

/**
 * Default settlement network.
 *
 * devnet is the default on purpose: this leg must not be able to move real
 * money by accident. Switching to mainnet is an explicit, logged decision.
 */
export const DEFAULT_SETTLEMENT_NETWORK = 'devnet';

/** SPL token program ids we accept payment instructions on. */
export const TOKEN_PROGRAM_IDS = Object.freeze([
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', // Token
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', // Token-2022
]);

/**
 * Canonical SPL mints we know how to price.
 *
 * USDC on Solana mainnet and devnet (Circle-issued), plus wrapped SOL so a
 * demo can settle without a USDC faucet. Anything else must be configured
 * explicitly through `X402_SOLANA_ASSET_MINT` — we never guess a mint.
 */
export const KNOWN_ASSET_MINTS = Object.freeze({
  'solana:usdc': 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  'solana-devnet:usdc': '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZLdAwwG',
  'solana:wsol': 'So11111111111111111111111111111111111111112',
  'solana-devnet:wsol': 'So11111111111111111111111111111111111111112',
});

/** Decimals per known mint — used to sanity-check the transferChecked byte. */
export const KNOWN_ASSET_DECIMALS = Object.freeze({
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6,
  '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZLdAwwG': 6,
  'So11111111111111111111111111111111111111112': 9,
});

/**
 * Machine-readable failure reasons. Every refusal carries one of these plus a
 * human sentence — a refusal that cannot be named cannot be triaged.
 */
export const PAYMENT_REASONS = Object.freeze({
  X402_DISABLED: 'Solana x402 settlement is disabled (set X402_SOLANA_ENABLED=true).',
  SELLER_NOT_CONFIGURED: 'X402_SOLANA_PAY_TO is not set — we cannot name a payee, so we refuse to quote.',
  PAYMENT_HEADER_MISSING: 'No X-PAYMENT / PAYMENT-SIGNATURE header on the request.',
  PAYMENT_HEADER_MALFORMED: 'Payment header is not decodable JSON carrying a transaction.',
  PAYMENT_SCHEME_UNSUPPORTED: 'Payment scheme is not one we accept.',
  PAYMENT_TX_MISSING: 'Payment payload carried no transaction to settle.',
  PAYMENT_TX_UNDECODABLE: 'Payment transaction could not be deserialized.',
  PAYMENT_TX_UNSIGNED: 'Payment transaction has no signatures.',
  PAYMENT_NETWORK_MISMATCH: 'Payment was made on a different network than the one we settle on.',
  PAYMENT_AMOUNT_MISMATCH: 'Transferred amount does not match the quoted amount.',
  PAYMENT_ASSET_MISMATCH: 'Transferred asset is not the quoted mint.',
  PAYMENT_RECIPIENT_MISMATCH: 'Transfer did not pay the quoted payee.',
  PAYMENT_AUTHORITY_MISMATCH: 'Transfer authority is not the transaction fee payer.',
  PAYMENT_INSTRUCTION_MISSING: 'Transaction contains no matching SPL transferChecked payment.',
  PAYMENT_TX_REPLAYED: 'This transaction has already been used to settle a request.',
  PAYMENT_VERIFICATION_UNAVAILABLE: 'Could not reach Solana RPC to verify/settle the payment — we did not deliver.',
  PAYMENT_SETTLEMENT_FAILED: 'The payment transaction failed on-chain (meta.err).',
  PAYMENT_SETTLEMENT_UNCONFIRMED: 'The payment transaction did not confirm within the timeout.',
  PAYMENT_BROADCAST_FAILED: 'The payment transaction could not be broadcast to the cluster.',
  PAYMENT_BALANCE_MISMATCH: 'Post-settlement token-balance delta did not match the quoted payment.',
  SPEND_CEILING_EXCEEDED: 'Per-answer spend ceiling reached.',
  SPEND_RUN_CAP_EXCEEDED: 'Per-run spend cap reached.',
  RESOURCE_FAILED: 'The paid resource could not be produced.',
});

/** Canonical network string → short name (for env/alias resolution). */
const CANONICAL_TO_NAME = Object.freeze({
  'solana-devnet': 'devnet',
  solana: 'mainnet',
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
  const raw = String(env.X402_SOLANA_NETWORK || '').trim().toLowerCase();
  if (!raw) {
    return {
      name: DEFAULT_SETTLEMENT_NETWORK,
      network: SETTLEMENT_NETWORKS[DEFAULT_SETTLEMENT_NETWORK],
      explicit: false,
      error: null,
    };
  }
  // Accept short names, canonical network strings, and CAIP-2 aliases.
  // Exact match first — CAIP-2 genesis hashes are case-sensitive base58.
  const exact = NETWORK_ALIASES[raw.trim()];
  const alias = exact || NETWORK_ALIASES[raw];
  if (alias) {
    const name = CANONICAL_TO_NAME[alias];
    if (name) return { name, network: SETTLEMENT_NETWORKS[name], explicit: true, error: null };
  }
  if (isSettlementNetwork(raw)) {
    return { name: raw, network: SETTLEMENT_NETWORKS[raw], explicit: true, error: null };
  }
  return {
    name: DEFAULT_SETTLEMENT_NETWORK,
    network: SETTLEMENT_NETWORKS[DEFAULT_SETTLEMENT_NETWORK],
    explicit: false,
    error: `X402_SOLANA_NETWORK="${raw}" is not a known network (devnet|mainnet|solana|solana-devnet).`,
  };
}

/** Normalize a client-sent network string to our canonical form, or null. */
export function normalizeNetwork(network) {
  if (!network || typeof network !== 'string') return null;
  // Exact match first — CAIP-2 genesis hashes are case-sensitive base58.
  const exact = NETWORK_ALIASES[network.trim()];
  if (exact) return exact;
  const raw = network.trim().toLowerCase();
  const alias = NETWORK_ALIASES[raw];
  if (alias) return alias;
  if (isSettlementNetwork(raw)) return SETTLEMENT_NETWORKS[raw];
  return null;
}

/** The address that receives payment. Null when unset — we then refuse to quote. */
export function sellerAddress(env = process.env) {
  const raw = String(env.X402_SOLANA_PAY_TO || env.TXLINE_SOLANA_PUBLIC_KEY || '').trim();
  return raw ? raw : null;
}

/** Opt-in switch. The payment leg is dark until someone turns it on. */
export function isEnabled(env = process.env) {
  return String(env.X402_SOLANA_ENABLED || '').trim().toLowerCase() === 'true';
}

/**
 * The asset mint we quote and verify.
 *
 * `X402_SOLANA_ASSET_MINT` wins (any SPL mint — the buyer needs a token
 * account for it). Otherwise the known USDC mint for the settlement network.
 * Returns `{ mint, decimals, symbol }`; `mint` is null when unknown.
 */
export function assetMint(env = process.env) {
  const configured = String(env.X402_SOLANA_ASSET_MINT || '').trim();
  const { network } = settlementNetwork(env);
  const key = `${network}:${configured ? '' : 'usdc'}`;
  const mint = configured || KNOWN_ASSET_MINTS[key] || null;
  if (!mint) return { mint: null, decimals: null, symbol: null };
  const decimals = KNOWN_ASSET_DECIMALS[mint] ?? null;
  const symbol = mint === KNOWN_ASSET_MINTS['solana:wsol'] || mint === KNOWN_ASSET_MINTS['solana-devnet:wsol']
    ? 'wSOL'
    : 'USDC';
  return { mint, decimals, symbol };
}

/** Quoted price of the resource (human units in env, base units in code). */
export function premiumPrice(env = process.env, decimals = 6) {
  const raw = String(env.X402_PREMIUM_PRICE_USDC ?? env.X402_SOLANA_PRICE ?? '0.01').trim();
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value < 0) {
    return { baseUnits: toBaseUnits('0.01', decimals), raw: '0.01', error: null };
  }
  const baseUnits = toBaseUnits(value, decimals);
  if (baseUnits === null) {
    return { baseUnits: toBaseUnits('0.01', decimals), raw: '0.01', error: `"${raw}" is not a valid amount.` };
  }
  return { baseUnits, raw, error: null };
}

/**
 * Convert a human amount to integer base units.
 * @returns {number|null} null when the amount is not a usable number.
 */
export function toBaseUnits(amount, decimals = 6) {
  if (amount === null || amount === undefined || amount === '') return null;
  const value = Number(amount);
  if (!Number.isFinite(value) || value < 0) return null;
  const scaled = Math.round(value * 10 ** decimals);
  if (!Number.isSafeInteger(scaled)) return null;
  return scaled;
}

/** Convert integer base units to a human amount string. */
export function fromBaseUnits(baseUnits, decimals = 6) {
  const value = Number(baseUnits);
  if (!Number.isFinite(value)) return null;
  return (value / 10 ** decimals).toFixed(decimals).replace(/0+$/, '').replace(/\.$/, '');
}
