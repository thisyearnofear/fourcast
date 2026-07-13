/**
 * Wallet-signature auth for user-scoped API routes (follow, notifications).
 *
 * Sign-once model: the client signs a canonical message with their wallet a
 * single time; the resulting {address, issuedAt, signature} token is cached
 * client-side and sent as headers on every request. The server verifies the
 * signature statelessly with viem — no session store.
 *
 * Limitations (acceptable for this surface): tokens are bearer credentials
 * until expiry (7 days) and only EOA signatures are supported (no ERC-1271
 * smart-wallet verification).
 */

import { verifyMessage } from 'viem';

export const AUTH_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CLOCK_SKEW_MS = 5 * 60 * 1000;

export const AUTH_HEADERS = {
  address: 'x-fourcast-address',
  issuedAt: 'x-fourcast-issued-at',
  signature: 'x-fourcast-signature',
};

/**
 * The exact message the client must sign. Client and server must agree
 * byte-for-byte — change it in both places or nowhere.
 */
export function authMessage(address, issuedAt) {
  return `Fourcast: authenticate ${String(address).toLowerCase()} at ${issuedAt}`;
}

/**
 * Verify an auth token. Returns { ok: true } or { ok: false, error }.
 */
export async function verifyWalletAuth(
  { address, issuedAt, signature },
  { maxAgeMs = AUTH_MAX_AGE_MS, now = Date.now() } = {}
) {
  if (!address || !issuedAt || !signature) {
    return { ok: false, error: 'Missing auth fields' };
  }

  const ts = Number(issuedAt);
  if (!Number.isFinite(ts)) return { ok: false, error: 'Invalid issuedAt' };
  if (ts > now + CLOCK_SKEW_MS) return { ok: false, error: 'issuedAt is in the future' };
  if (now - ts > maxAgeMs) return { ok: false, error: 'Auth token expired — sign again' };

  try {
    const valid = await verifyMessage({
      address,
      message: authMessage(address, ts),
      signature,
    });
    return valid ? { ok: true } : { ok: false, error: 'Invalid signature' };
  } catch {
    return { ok: false, error: 'Signature verification failed' };
  }
}

/**
 * Route guard: reads the auth headers from a Request and verifies that the
 * signer is `expectedAddress`. Returns null when authorized, or a 401
 * Response to return directly from the route handler.
 */
export async function requireWalletAuth(request, expectedAddress) {
  const token = {
    address: request.headers.get(AUTH_HEADERS.address),
    issuedAt: request.headers.get(AUTH_HEADERS.issuedAt),
    signature: request.headers.get(AUTH_HEADERS.signature),
  };

  if (
    !expectedAddress ||
    !token.address ||
    token.address.toLowerCase() !== String(expectedAddress).toLowerCase()
  ) {
    return Response.json(
      { success: false, error: 'Auth token does not match the acting address' },
      { status: 401 }
    );
  }

  const result = await verifyWalletAuth(token);
  if (!result.ok) {
    return Response.json({ success: false, error: result.error }, { status: 401 });
  }
  return null;
}
