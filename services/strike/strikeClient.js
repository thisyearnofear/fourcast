/**
 * Strike Perpetuals (V2) client
 *
 * The venue adapter's transport seam. Two read shapes share one
 * `fetchWithBudget` primitive (timeout, retries, circuit breaker):
 *
 *   - `strikePublic(path, opts)`  — unsigned GET against the market-data
 *     base (`{host}/price/v2/…`). No auth ever; works unconfigured.
 *   - `strikeSigned(method, path, opts)` — Ed25519 API-wallet request
 *     against the trade host (`{host}/v2/…`). Body is serialized ONCE and
 *     that exact string is both hashed for the signature and sent on the
 *     wire — Strike verifies SHA-256 over the literal bytes.
 *
 * Auth (docs.strikefinance.org/api/getting-started.md, verified 2026-10-23):
 * four headers — public key (64-hex), signature, unix-timestamp seconds,
 * fresh UUID nonce — over the message
 * `{METHOD}:{PATH_WITH_QUERY}:{TIMESTAMP}:{NONCE}:{SHA256_HEX(BODY)}`.
 * Empty-string body hash for GETs. API wallets cannot deposit or withdraw.
 *
 * Failure shape (same contract as services/tatum/tatumSuiClient.js):
 *   - NOT configured → `strikeSigned` resolves `null` and helpers report a
 *     reason string; `strikePublic` keeps working (it needs no key).
 *   - Configured but INCOHERENT (`STRIKE_BASE_URL` on a different network
 *     than `STRIKE_NETWORK`) → throws STRIKE_NETWORK_MISMATCH.
 *   - Configured but failing → rejects `Error & {code, apiError}`.
 *
 * Environment variables:
 *   STRIKE_NETWORK               - 'testnet' | 'mainnet' (default testnet —
 *                                  the hackathon demo is testnet-first;
 *                                  mainnet requires an explicit opt-in)
 *   STRIKE_API_WALLET_PRIVATE_KEY - raw hex, 32-byte seed or 64-byte expanded
 *   STRIKE_API_WALLET_PUBLIC_KEY  - raw hex, 32 bytes
 *   STRIKE_BASE_URL              - override the host (must match network)
 *   STRIKE_TIMEOUT_MS            - per-request deadline (default 10000)
 */

import { createHash, randomUUID } from 'crypto';
import { ed25519 } from '@noble/curves/ed25519.js';
import { fetchWithBudget } from '../infra/http.js';

export const STRIKE_BASES = {
  testnet: 'https://api-v2-testnet.strikefinance.org',
  mainnet: 'https://api.strikefinance.org',
};

const PROVIDER = 'strike';
const DEFAULT_TIMEOUT_MS = 10_000;

// Secrets are read per call, not at module load — same rule as memwalClient:
// an unconfigured server holds no key material, and a test or a rotated
// deploy can change configuration without re-importing the module.
function readConfig() {
  return {
    privateKey: normalizeHex(process.env.STRIKE_API_WALLET_PRIVATE_KEY),
    publicKey: normalizeHex(process.env.STRIKE_API_WALLET_PUBLIC_KEY),
    network: normaliseNetwork(process.env.STRIKE_NETWORK),
    baseUrl: (process.env.STRIKE_BASE_URL || '').replace(/\/+$/, ''),
    timeoutMs: positiveInt(process.env.STRIKE_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
  };
}

function normalizeHex(raw) {
  return String(raw || '').trim().toLowerCase().replace(/^0x/, '');
}

function normaliseNetwork(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'testnet' || value === 'mainnet') return value;
  if (value) throw networkError(`STRIKE_NETWORK must be 'testnet' or 'mainnet', got ${JSON.stringify(raw)}`);
  // Unset means testnet: a venue adapter that defaults to real money is a
  // bug waiting for a demo. Mainnet requires an explicit STRIKE_NETWORK=mainnet.
  return 'testnet';
}

function networkError(message) {
  const err = new Error(message);
  err.code = 'STRIKE_NETWORK_MISMATCH';
  return err;
}

function positiveInt(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function urlNetwork(url) {
  if (/testnet/i.test(url)) return 'testnet';
  return 'mainnet';
}

function resolvedBase(cfg) {
  const base = cfg.baseUrl || STRIKE_BASES[cfg.network];
  const seen = urlNetwork(base);
  if (seen !== cfg.network) {
    throw networkError(
      `Refusing to mix Strike networks: STRIKE_NETWORK=${cfg.network} but STRIKE_BASE_URL points at ${seen} (${base}).`
    );
  }
  return base;
}

export function isConfigured() {
  const cfg = readConfig();
  return Boolean(cfg.privateKey && cfg.publicKey);
}

/** Why the signed path is off, in one sentence a status route can display. */
export function disabledReason() {
  const cfg = readConfig();
  if (!cfg.privateKey && !cfg.publicKey) return 'STRIKE_API_WALLET_{PRIVATE,PUBLIC}_KEY are not set';
  if (!cfg.privateKey) return 'STRIKE_API_WALLET_PRIVATE_KEY is not set';
  if (!cfg.publicKey) return 'STRIKE_API_WALLET_PUBLIC_KEY is not set';
  return null;
}

export function strikeNetwork() {
  return readConfig().network;
}

/** For status surfaces: never echo key material, only a tail for identification. */
export function strikeStatus() {
  const cfg = readConfig();
  let base = null;
  let coherence = null;
  try {
    base = resolvedBase(cfg);
  } catch (err) {
    coherence = err.message;
  }
  return {
    configured: isConfigured(),
    network: cfg.network,
    baseUrl: base,
    publicKeyTail: cfg.publicKey ? `…${cfg.publicKey.slice(-8)}` : null,
    reason: coherence || disabledReason(),
  };
}

function strikeError(code, message, apiError = null, cause = undefined) {
  const err = new Error(message);
  err.code = code;
  err.apiError = apiError;
  if (cause) err.cause = cause;
  return err;
}

/**
 * Sign one request and return the four auth headers.
 * `timestamp`/`nonce` are injectable for deterministic tests; production
 * callers leave them unset.
 */
export function signStrikeRequest({ method, path, bodyStr = '', privateKeyHex, publicKeyHex, timestamp = null, nonce = null }) {
  const ts = timestamp ?? Math.floor(Date.now() / 1000);
  const nc = nonce ?? randomUUID();
  const bodyHash = createHash('sha256').update(bodyStr, 'utf8').digest('hex');
  const message = `${String(method).toUpperCase()}:${path}:${ts}:${nc}:${bodyHash}`;

  let secret = Buffer.from(privateKeyHex, 'hex');
  if (secret.length === 64) secret = secret.subarray(0, 32); // 64-byte expanded key → seed
  if (secret.length !== 32) {
    throw strikeError('STRIKE_BAD_KEY', `private key must be 32-byte seed or 64-byte expanded (got ${secret.length} bytes)`);
  }
  const signature = ed25519.sign(new TextEncoder().encode(message), new Uint8Array(secret));

  return {
    'X-API-Wallet-Public-Key': publicKeyHex,
    'X-API-Wallet-Signature': Buffer.from(signature).toString('hex'),
    'X-API-Wallet-Timestamp': String(ts),
    'X-API-Wallet-Nonce': String(nc),
  };
}

function checkEnvelope(data, label) {
  if (data && typeof data === 'object' && typeof data.error === 'string') {
    throw strikeError('STRIKE_API_ERROR', `strike ${label} rejected: ${data.msg || data.error}`, data);
  }
  return data;
}

/**
 * Unsigned market-data GET. `{base}/price` hosts the public REST surface
 * (exchangeInfo, klines, depth, trades, tickers, mark/index, premiumIndex,
 * openInterest). Always available — no key involved.
 *
 * @returns {Promise<any>} parsed body
 */
export async function strikePublic(path, { params = null, timeoutMs, retries } = {}) {
  const cfg = readConfig();
  const base = resolvedBase(cfg);
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  const res = await fetchWithBudget(`${base}/price${path}${qs}`, {
    provider: PROVIDER,
    method: 'GET',
    timeoutMs: timeoutMs ?? cfg.timeoutMs,
    retries: retries ?? 2,
  });
  return checkEnvelope(res.data, `GET ${path}`);
}

/**
 * Signed API-wallet request against `{base}/v2/…`.
 *
 * @param {string} method  GET | POST | DELETE
 * @param {string} path    path WITHOUT query string; pass params separately
 * @param {object} [opts.params]   query params (folded into the signed path)
 * @param {object} [opts.body]     serialized once; that exact string is both
 *                                 hashed for the signature and sent
 * @returns {Promise<any|null>} parsed body, or null when unconfigured
 *   (fail-closed — a missing key must never break a read path).
 */
export async function strikeSigned(method, path, { params = null, body = null, timeoutMs, retries, now } = {}) {
  const cfg = readConfig();
  if (!isConfigured()) return null;

  const base = resolvedBase(cfg);
  const qs = params ? `?${new URLSearchParams(params).toString()}` : '';
  const signedPath = `${path}${qs}`;
  const bodyStr = body ? JSON.stringify(body) : '';
  const headers = signStrikeRequest({
    method,
    path: signedPath,
    bodyStr,
    privateKeyHex: cfg.privateKey,
    publicKeyHex: cfg.publicKey,
    timestamp: now?.timestamp,
    nonce: now?.nonce,
  });

  let data;
  try {
    const res = await fetchWithBudget(`${base}${signedPath}`, {
      provider: PROVIDER,
      method,
      headers,
      body: bodyStr || undefined,
      timeoutMs: timeoutMs ?? cfg.timeoutMs,
      retries: retries ?? 1,
    });
    data = res.data;
  } catch (err) {
    throw strikeError(
      err.code || 'STRIKE_TRANSPORT',
      `strike ${method} ${path} failed: ${err.message}`,
      null,
      err,
    );
  }
  return checkEnvelope(data, `${method} ${path}`);
}
