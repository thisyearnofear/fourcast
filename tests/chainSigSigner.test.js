import { describe, it, expect, vi, beforeEach } from 'vitest';

// The mandate client hits NEAR RPC — mock the boundary so the test exercises
// only the signer's interface surface and MPC-response assembly.
vi.mock('../services/near/nearMandateClient.js', () => ({
  derivedEvmAddress: vi.fn(async () => '0x6940B97505567816A75B1A952f234630af81c61F'),
  requestTradeSignature: vi.fn(async () => ({
    big_r: '02' + 'ab'.repeat(32), // 33B compressed point
    s: 'cd'.repeat(32),
    recovery_id: 1,
  })),
}));

import { createChainSignatureSigner } from '../services/near/chainSigSigner.js';
import { requestTradeSignature } from '../services/near/nearMandateClient.js';
import { TypedDataEncoder, hashMessage } from 'ethers';

const ADDRESS = '0x6940B97505567816A75B1A952f234630af81c61F';

const domain = { name: 'ClobAuthDomain', version: '1', chainId: 137 };
const types = {
  ClobAuth: [
    { name: 'address', type: 'address' },
    { name: 'timestamp', type: 'string' },
    { name: 'nonce', type: 'uint256' },
    { name: 'message', type: 'string' },
  ],
};
const value = { address: ADDRESS, timestamp: '1', nonce: 0, message: 'test' };

describe('ChainSignatureSigner', () => {
  beforeEach(() => vi.clearAllMocks());

  it('exposes the address with no private key involved', async () => {
    const signer = await createChainSignatureSigner({ venue: 'polymarket' });
    expect(await signer.getAddress()).toBe(ADDRESS);
    expect(signer.address).toBe(ADDRESS);
    expect(signer.isChainSignature).toBe(true);
  });

  it('implements _signTypedData — the ethers v5 name @polymarket/clob-client calls', async () => {
    const signer = await createChainSignatureSigner({ venue: 'polymarket', liquidity: '600000000' });
    expect(typeof signer._signTypedData).toBe('function');
    const sig = await signer._signTypedData(domain, types, value);
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/);
  });

  it('signTypedData (v6 name) reaches the contract with the digest and envelope', async () => {
    const signer = await createChainSignatureSigner({
      venue: 'polymarket',
      notional: '1950000',
      liquidity: '50000000000',
      slippageBps: 100,
      marketId: 'mkt-1',
      outcome: 'BUY YES',
    });
    await signer.signTypedData(domain, types, value);

    expect(requestTradeSignature).toHaveBeenCalledTimes(1);
    const req = requestTradeSignature.mock.calls[0][0];
    expect(req.venue).toBe('polymarket');
    expect(req.notional).toBe('1950000');
    expect(req.liquidity).toBe('50000000000');
    expect(req.slippage_bps).toBe(100);
    expect(req.market_id).toBe('mkt-1');
    // The payload must be the 32-byte EIP-712 digest of the SAME typed data.
    const expected = TypedDataEncoder.hash(domain, types, value);
    expect(Buffer.from(req.payload).toString('hex')).toBe(expected.replace(/^0x/, ''));
  });

  it('assembles r‖s‖v from the MPC response (r = x-coord of compressed big_r)', async () => {
    const signer = await createChainSignatureSigner({ venue: 'polymarket' });
    const sig = await signer.signMessage('hello');
    // v = 27 + recovery_id (1) = 28 → 0x1c
    expect(sig.endsWith('1c')).toBe(true);
    // digest of "hello" must be what was sent to the contract
    const req = requestTradeSignature.mock.calls[0][0];
    const expected = hashMessage('hello');
    expect(Buffer.from(req.payload).toString('hex')).toBe(expected.replace(/^0x/, ''));
  });

  it('handles an uncompressed (65B, 04-prefixed) big_r — r is x, not y', async () => {
    requestTradeSignature.mockResolvedValueOnce({
      // 04 ‖ x(aa*32) ‖ y(bb*32) — x ≠ y so a wrong slice is caught
      big_r: { affine_point: '04' + 'aa'.repeat(32) + 'bb'.repeat(32) },
      s: { scalar: 'ef'.repeat(32) },
      recovery_id: 0,
    });
    const signer = await createChainSignatureSigner({ venue: 'polymarket' });
    const sig = await signer.signTypedData(domain, types, value);
    expect(sig).toMatch(/^0x[0-9a-f]{130}$/);
    expect(sig.slice(2, 66)).toBe('aa'.repeat(32));
    expect(sig.endsWith('1b')).toBe(true); // v = 27
  });
});
