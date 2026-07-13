import { describe, it, expect } from 'vitest';
import { privateKeyToAccount, generatePrivateKey } from 'viem/accounts';
import { authMessage, verifyWalletAuth, requireWalletAuth, AUTH_HEADERS } from '../services/walletAuth.js';

const pk = generatePrivateKey();
const account = privateKeyToAccount(pk);

async function makeToken(address = account.address, issuedAt = Date.now(), signer = account) {
  const signature = await signer.signMessage({ message: authMessage(address, issuedAt) });
  return { address: address.toLowerCase(), issuedAt, signature };
}

function makeRequest(token) {
  return new Request('http://localhost/api/test', {
    headers: {
      [AUTH_HEADERS.address]: token.address ?? '',
      [AUTH_HEADERS.issuedAt]: token.issuedAt != null ? String(token.issuedAt) : '',
      [AUTH_HEADERS.signature]: token.signature ?? '',
    },
  });
}

describe('verifyWalletAuth', () => {
  it('accepts a valid, fresh token', async () => {
    const token = await makeToken();
    const result = await verifyWalletAuth(token);
    expect(result.ok).toBe(true);
  });

  it('accepts checksummed and lowercased addresses alike', async () => {
    const issuedAt = Date.now();
    const signature = await account.signMessage({
      message: authMessage(account.address, issuedAt),
    });
    const result = await verifyWalletAuth({ address: account.address, issuedAt, signature });
    expect(result.ok).toBe(true);
  });

  it('rejects a token signed by a different key (spoofed address)', async () => {
    const attacker = privateKeyToAccount(generatePrivateKey());
    const issuedAt = Date.now();
    // Attacker signs a message claiming the victim's address
    const signature = await attacker.signMessage({
      message: authMessage(account.address, issuedAt),
    });
    const result = await verifyWalletAuth({ address: account.address, issuedAt, signature });
    expect(result.ok).toBe(false);
  });

  it('rejects an expired token', async () => {
    const issuedAt = Date.now() - 8 * 24 * 60 * 60 * 1000; // 8 days old
    const token = await makeToken(account.address, issuedAt);
    const result = await verifyWalletAuth(token);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/expired/i);
  });

  it('rejects a future-dated token', async () => {
    const issuedAt = Date.now() + 60 * 60 * 1000; // 1h in the future
    const token = await makeToken(account.address, issuedAt);
    const result = await verifyWalletAuth(token);
    expect(result.ok).toBe(false);
  });

  it('rejects a tampered signature', async () => {
    const token = await makeToken();
    token.signature = token.signature.slice(0, -4) + '0000';
    const result = await verifyWalletAuth(token);
    expect(result.ok).toBe(false);
  });

  it('rejects missing fields', async () => {
    expect((await verifyWalletAuth({})).ok).toBe(false);
    expect((await verifyWalletAuth({ address: account.address })).ok).toBe(false);
  });
});

describe('requireWalletAuth', () => {
  it('returns null (authorized) when the token matches the acting address', async () => {
    const token = await makeToken();
    const denied = await requireWalletAuth(makeRequest(token), account.address);
    expect(denied).toBeNull();
  });

  it('returns 401 when the token address differs from the acting address', async () => {
    const token = await makeToken();
    const victim = privateKeyToAccount(generatePrivateKey());
    const denied = await requireWalletAuth(makeRequest(token), victim.address);
    expect(denied).not.toBeNull();
    expect(denied.status).toBe(401);
  });

  it('returns 401 when headers are absent', async () => {
    const denied = await requireWalletAuth(
      new Request('http://localhost/api/test'),
      account.address
    );
    expect(denied).not.toBeNull();
    expect(denied.status).toBe(401);
  });

  it('returns 401 for a forged signature even with matching addresses', async () => {
    const attacker = privateKeyToAccount(generatePrivateKey());
    const issuedAt = Date.now();
    const signature = await attacker.signMessage({
      message: authMessage(account.address, issuedAt),
    });
    const denied = await requireWalletAuth(
      makeRequest({ address: account.address.toLowerCase(), issuedAt, signature }),
      account.address
    );
    expect(denied).not.toBeNull();
    expect(denied.status).toBe(401);
  });
});
