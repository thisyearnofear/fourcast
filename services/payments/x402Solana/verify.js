/**
 * Payment requirement parsing and transaction verification for x402 on Solana.
 *
 * The flow is the canonical x402 shape, self-facilitated:
 *
 *   1. we publish a requirement (price, payee, mint, network) as a 402;
 *   2. the buyer builds a transaction that pays the quoted SPL asset to our
 *      payee, signs it, and sends the serialized transaction in the
 *      `PAYMENT-SIGNATURE` (a.k.a. `X-PAYMENT`) header;
 *   3. we decode it, check every instruction against the requirement BEFORE
 *      broadcasting — right mint, right destination owner, right amount,
 *      fee payer is the signer;
 *   4. we simulate, broadcast, confirm, and then re-read the confirmed
 *      transaction's token-balance delta. Only then may the resource be
 *      produced.
 *
 * The buyer's payload is a claim until it is a transaction we verified twice:
 * once statically (the instruction says what we quoted) and once empirically
 * (the chain says the money moved).
 */

import crypto from 'crypto';
import { Connection, PublicKey, VersionedTransaction, Transaction } from '@solana/web3.js';
import { TOKEN_PROGRAM_IDS, X402_VERSION, normalizeNetwork } from './types.js';

// ─── SPL instruction tags ───────────────────────────────────────────────────
//
// The SPL Token program (and Token-2022) pack instructions as a ONE-BYTE
// instruction index followed by packed args — NOT Anchor-style sha256
// discriminators. Verified against @solana/spl-token's own builders:
//   transfer        = 0x03 + amount(u64 LE)                      → 9 bytes
//   transferChecked = 0x0c + amount(u64 LE) + decimals(u8)       → 10 bytes
export const TRANSFER_TAG = 0x03;
export const TRANSFER_CHECKED_TAG = 0x0c;

const U64_MASK = (1n << 64n) - 1n;

function readU64LE(buf, offset) {
  return buf.readBigUInt64LE(offset) & U64_MASK;
}

// ─── Requirement ────────────────────────────────────────────────────────────

/**
 * Build the requirement we quote to the buyer (x402 v1 body shape).
 *
 * @param {object} options
 * @param {string} options.seller        payee address (base58)
 * @param {number} options.amount        price in asset base units
 * @param {string} options.network       'solana' | 'solana-devnet'
 * @param {string} options.asset         SPL mint being paid
 * @param {number} [options.decimals]    asset decimals (for `extra`)
 * @param {string} [options.symbol]      asset symbol (for `extra`)
 * @param {string} [options.resource]    the resource being paid for
 */
export function buildPaymentRequirement({
  seller,
  amount,
  network,
  asset,
  decimals = null,
  symbol = null,
  resource = null,
  description = null,
  mimeType = 'application/json',
  maxTimeoutSeconds = 90,
}) {
  return {
    x402Version: X402_VERSION,
    error: 'Payment required for this resource.',
    accepts: [
      {
        scheme: 'exact',
        network,
        maxAmountRequired: String(amount),
        resource: resource || undefined,
        description: description || undefined,
        mimeType,
        payTo: seller,
        maxTimeoutSeconds,
        asset: asset || undefined,
        extra:
          asset ? { name: symbol || 'SPL', version: '1', decimals: decimals ?? undefined, mint: asset } : undefined,
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

export function paymentHeaderValue(req) {
  const headers = req?.headers;
  return (
    headerValue(headers, 'payment-signature') ||
    headerValue(headers, 'x-payment-signature') ||
    headerValue(headers, 'x-payment') ||
    null
  );
}

// ─── Payment payload parsing ────────────────────────────────────────────────

/**
 * Parse the payment header into a normalized payment.
 *
 * Accepts the x402 payment-signature shape
 *   `{x402Version, resource, accepted: {...}, payload: {transaction: "<base64>"}}`
 * and flatter variants (`payload.txBase64`, `payload.transactionBase64`,
 * top-level `transaction`).
 *
 * @returns {{ok: boolean, payment: object|null, reason: string|null, reasonCode: string|null}}
 */
export function parsePaymentSignature(value, { PAYMENT_REASONS }) {
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
  const transaction =
    payload.transaction ||
    payload.txBase64 ||
    payload.transactionBase64 ||
    payload.signedTransaction ||
    null;

  if (!transaction || typeof transaction !== 'string') {
    return {
      ok: false,
      payment: null,
      reason: PAYMENT_REASONS.PAYMENT_TX_MISSING,
      reasonCode: 'PAYMENT_TX_MISSING',
    };
  }

  const accepted = decoded.accepted && typeof decoded.accepted === 'object' ? decoded.accepted : {};
  const payment = {
    version: Number(decoded.x402Version) || X402_VERSION,
    scheme: decoded.scheme || accepted.scheme || payload.scheme || 'exact',
    network: decoded.network || accepted.network || payload.network || null,
    transaction,
    payer: payload.payer || accepted.payer || null,
    raw: decoded,
  };

  return { ok: true, payment, reason: null, reasonCode: null };
}

// ─── Transaction decoding ───────────────────────────────────────────────────

/**
 * Deserialize a payment transaction. Accepts both legacy `Transaction` and
 * `VersionedTransaction` wire formats.
 *
 * @returns {{ok: boolean, tx: object|null, signature: string|null, reason: string|null, reasonCode: string|null}}
 */
export function decodePaymentTransaction(transactionBase64, { PAYMENT_REASONS }) {
  let bytes;
  try {
    bytes = Buffer.from(String(transactionBase64).trim(), 'base64');
  } catch {
    bytes = null;
  }
  if (!bytes || bytes.length === 0) {
    return { ok: false, tx: null, signature: null, reason: PAYMENT_REASONS.PAYMENT_TX_UNDECODABLE, reasonCode: 'PAYMENT_TX_UNDECODABLE' };
  }

  // Versioned transactions start with a 0x80 prefix on the signature count.
  const isVersioned = bytes.length > 0 && (bytes[0] & 0x80) !== 0;
  try {
    const tx = isVersioned ? VersionedTransaction.deserialize(bytes) : Transaction.from(bytes);
    // Legacy: signatures are {signature: Buffer|null, publicKey} pairs.
    // Versioned: signatures are raw Uint8Array.
    const first = tx.signatures?.[0];
    const sigBytes = first?.signature ?? first;
    const signature = sigBytes && sigBytes.length ? bs58encode(sigBytes) : null;
    if (!signature) {
      return { ok: false, tx, signature: null, reason: PAYMENT_REASONS.PAYMENT_TX_UNSIGNED, reasonCode: 'PAYMENT_TX_UNSIGNED' };
    }
    return { ok: true, tx, signature, bytes, reason: null, reasonCode: null };
  } catch (err) {
    return {
      ok: false,
      tx: null,
      signature: null,
      reason: PAYMENT_REASONS.PAYMENT_TX_UNDECODABLE,
      reasonCode: 'PAYMENT_TX_UNDECODABLE',
      detail: err?.message || String(err),
    };
  }
}

// Minimal base58 encode — we only need it for the fee-payer signature.
const B58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function bs58encode(buf) {
  if (!buf || buf.length === 0) return '';
  const digits = [0];
  for (const byte of buf) {
    let carry = byte;
    for (let i = 0; i < digits.length; i++) {
      carry += digits[i] << 8;
      digits[i] = carry % 58;
      carry = (carry / 58) | 0;
    }
    while (carry > 0) {
      digits.push(carry % 58);
      carry = (carry / 58) | 0;
    }
  }
  let out = '';
  for (const byte of buf) {
    if (byte === 0) out += '1';
    else break;
  }
  for (let i = digits.length - 1; i >= 0; i--) out += B58_ALPHABET[digits[i]];
  return out;
}

// ─── Instruction normalization ──────────────────────────────────────────────

/**
 * Resolve every account key a transaction touches, including addresses loaded
 * from lookup tables (v0+). Returns null when an ALT cannot be fetched —
 * callers treat that as "cannot verify", never as "verified".
 */
export async function resolveAccountKeys(tx, connection) {
  const message = tx.message;
  if (!message) return null;

  // Legacy Transaction: compiled form already resolves everything.
  if (typeof message.getAccountKeys === 'function' && !message.staticAccountKeys) {
    try {
      return await message.getAccountKeys(connection);
    } catch {
      return null;
    }
  }

  const staticKeys = message.staticAccountKeys || [];
  const lookups = message.addressTableLookups || [];
  if (lookups.length === 0) {
    return { staticAccountKeys: staticKeys, accountKeysFromLookups: [] };
  }

  // Compiled-instruction account indexes resolve as: static keys, then for
  // each lookup table its writable addresses followed by its readonly ones.
  const allLoaded = [];
  for (const lookup of lookups) {
    try {
      const alt = await connection.getAddressLookupTable(lookup.accountKey);
      const addresses = alt.value?.state?.addresses || [];
      const writable = lookup.writableIndexes || [];
      const readonly = lookup.readonlyIndexes || [];
      allLoaded.push(...writable.map((i) => addresses[i]), ...readonly.map((i) => addresses[i]));
    } catch {
      return null;
    }
  }
  return { staticAccountKeys: staticKeys, accountKeysFromLookups: allLoaded };
}

/**
 * Normalize a transaction's instructions into
 * `{ programId, keys: PublicKey[], data: Buffer }[]`.
 *
 * For legacy transactions the instructions are already resolved. For versioned
 * transactions we walk `compiledInstructions` against the resolved account keys.
 */
export function normalizeInstructions(tx, resolvedKeys) {
  const instructions = [];

  if (tx instanceof Transaction || (!tx.message?.compiledInstructions && tx.instructions)) {
    for (const ix of tx.instructions || []) {
      instructions.push({
        programId: ix.programId,
        keys: (ix.keys || []).map((k) => (k.pubkey ? k.pubkey : k)),
        data: Buffer.isBuffer(ix.data) ? ix.data : Buffer.from(ix.data || []),
      });
    }
    return instructions;
  }

  const message = tx.message;
  const compiled = message?.compiledInstructions || [];
  const staticKeys = resolvedKeys?.staticAccountKeys || message?.staticAccountKeys || [];
  const loadedKeys = resolvedKeys?.accountKeysFromLookups || [];
  const allKeys = [...staticKeys, ...loadedKeys];

  for (const cix of compiled) {
    const programId = allKeys[cix.programIdIndex];
    const keys = (cix.accountKeyIndexes || []).map((i) => allKeys[i]).filter(Boolean);
    instructions.push({
      programId,
      keys,
      data: Buffer.from(cix.data || []),
    });
  }
  return instructions;
}

// ─── Static instruction verification ────────────────────────────────────────

/**
 * Find the SPL payment instruction inside a transaction and check it against
 * the quoted requirement.
 *
 * We require `transferChecked` specifically: it carries the mint and decimals
 * in the instruction itself, so the payment is self-describing. A plain
 * `transfer` cannot prove which mint moved and is refused.
 *
 * @param {object} options
 * @param {Array}  options.instructions   normalized instructions
 * @param {string} options.payTo           quoted payee (base58)
 * @param {string} options.assetMint       quoted mint (base58)
 * @param {bigint|number|string} options.expectedAmount  base units
 * @param {number|null} options.expectedDecimals
 * @param {string} options.feePayer        transaction fee payer (base58)
 * @param {Function} [options.ownerCheck]  async (tokenAccount, mint) => owner|null
 * @returns {Promise<{ok: boolean, reason: string|null, reasonCode: string|null, detail?: string, payment?: object}>}
 */
export async function verifyPaymentInstruction({
  instructions,
  payTo,
  assetMint,
  expectedAmount,
  expectedDecimals = null,
  feePayer,
  ownerCheck = null,
  PAYMENT_REASONS,
}) {
  const fail = (reasonCode, detail) => ({
    ok: false,
    reason: PAYMENT_REASONS[reasonCode] || reasonCode,
    reasonCode,
    detail: detail || null,
  });

  const expected = BigInt(expectedAmount);
  const payToKey = new PublicKey(payTo);
  const mintKey = new PublicKey(assetMint);
  let sawTokenProgram = false;

  for (const ix of instructions) {
    const programIdStr = ix.programId?.toBase58?.() || String(ix.programId);
    if (!TOKEN_PROGRAM_IDS.includes(programIdStr)) continue;
    sawTokenProgram = true;

    const data = ix.data;
    if (!data || data.length < 9) continue;
    const tag = data[0];

    if (tag === TRANSFER_CHECKED_TAG) {
      // transferChecked: tag(1) amount(u64) decimals(u8); accounts
      // [source, mint, destination, authority] (+ optional signers for multisig)
      if (data.length < 10 || ix.keys.length < 4) continue;
      const [source, mint, destination, authority] = ix.keys;
      const amount = readU64LE(data, 1);
      const decimals = data[9];

      if (mint.toBase58() !== assetMint) continue; // not our asset — keep looking
      if (amount !== expected) {
        return fail('PAYMENT_AMOUNT_MISMATCH', `transferChecked amount ${amount} != expected ${expected}`);
      }
      if (expectedDecimals !== null && decimals !== expectedDecimals) {
        return fail('PAYMENT_ASSET_MISMATCH', `transferChecked decimals ${decimals} != expected ${expectedDecimals}`);
      }
      if (authority.toBase58() !== feePayer) {
        return fail('PAYMENT_AUTHORITY_MISMATCH', `authority ${authority.toBase58()} != feePayer ${feePayer}`);
      }

      // Destination must be a token account for our mint owned by the payee.
      if (ownerCheck) {
        const owner = await ownerCheck(destination, mintKey);
        if (!owner) {
          return fail('PAYMENT_RECIPIENT_MISMATCH', `destination ${destination.toBase58()} is not a token account for mint ${assetMint}`);
        }
        if (owner.toBase58() !== payTo) {
          return fail('PAYMENT_RECIPIENT_MISMATCH', `destination owner ${owner.toBase58()} != payTo ${payTo}`);
        }
      } else {
        // No owner check available — require the canonical ATA as destination.
        const { getAssociatedTokenAddress } = await import('@solana/spl-token');
        const ata = await getAssociatedTokenAddress(mintKey, payToKey, true);
        if (destination.toBase58() !== ata.toBase58()) {
          return fail('PAYMENT_RECIPIENT_MISMATCH', `destination ${destination.toBase58()} != payTo ATA ${ata.toBase58()}`);
        }
      }

      return {
        ok: true,
        reason: null,
        reasonCode: null,
        payment: {
          mint: assetMint,
          destination: destination.toBase58(),
          source: source.toBase58(),
          amount: amount.toString(),
          decimals,
        },
      };
    }
    // `transfer` (no mint/decimals in-band) is deliberately not accepted.
  }

  if (!sawTokenProgram) return fail('PAYMENT_INSTRUCTION_MISSING', 'no SPL token instruction found');
  return fail('PAYMENT_INSTRUCTION_MISSING', 'no transferChecked matching the quoted mint/amount found');
}

// ─── Post-settlement verification ───────────────────────────────────────────

/**
 * Re-read a confirmed transaction and verify the payee's token account for
 * our mint actually received at least the quoted amount.
 *
 * We key on the exact destination token account the instruction paid — not
 * "any account that gained our mint" — so unrelated balance movement in the
 * same transaction cannot inflate the delta.
 *
 * @param {string} options.destinationAccount  token account paid (base58)
 * @returns {Promise<{ok: boolean, reason: string|null, reasonCode: string|null, delta?: string, detail?: string}>}
 */
export async function verifySettlementOutcome({ connection, signature, assetMint, destinationAccount, expectedAmount, PAYMENT_REASONS }) {
  const fail = (reasonCode, detail) => ({
    ok: false,
    reason: PAYMENT_REASONS[reasonCode] || reasonCode,
    reasonCode,
    detail: detail || null,
  });

  let tx;
  try {
    tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
  } catch (err) {
    return fail('PAYMENT_VERIFICATION_UNAVAILABLE', err?.message || String(err));
  }
  if (!tx) return fail('PAYMENT_VERIFICATION_UNAVAILABLE', 'transaction not found after confirmation');
  if (tx.meta?.err) return fail('PAYMENT_SETTLEMENT_FAILED', JSON.stringify(tx.meta.err));

  const pre = tx.meta?.preTokenBalances || [];
  const post = tx.meta?.postTokenBalances || [];
  const accountKeys = tx.transaction?.message?.accountKeys || tx.transaction?.message?.staticAccountKeys || [];

  // Token balance entries carry `accountIndex` into the message account keys.
  const keyAt = (idx) => {
    const key = accountKeys[idx];
    return key?.pubkey?.toBase58?.() || key?.toBase58?.() || String(key || '');
  };

  const mintStr = String(assetMint);
  const destStr = String(destinationAccount);

  const amountOf = (list, account) => {
    for (const b of list) {
      if (b.mint !== mintStr) continue;
      if (keyAt(b.accountIndex) !== account) continue;
      return BigInt(b.uiTokenAmount?.amount || '0');
    }
    return 0n;
  };

  const delta = amountOf(post, destStr) - amountOf(pre, destStr);
  const expected = BigInt(expectedAmount);
  if (delta < expected) {
    return fail('PAYMENT_BALANCE_MISMATCH', `destination balance delta ${delta} < expected ${expected}`);
  }
  return { ok: true, reason: null, reasonCode: null, delta: delta.toString() };
}

/** Stable hash of the paid request — the ledger's `request_hash` column. */
export function requestHash(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body ?? null)).digest('hex');
}
