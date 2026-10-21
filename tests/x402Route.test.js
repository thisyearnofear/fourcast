import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { POST, GET } from '@/app/api/signals/premium/route.js';
import { isTxSettled } from '@/services/payments/x402Sui/spendLedger.js';

/**
 * The premium route, end to end against a mocked Sui RPC: unpaid → 402 with a
 * requirement, paid → the signal is published and the settlement recorded.
 *
 * LOCAL PROOF ONLY — the transfer in the fixture never happened on chain.
 */

const SELLER = '0x1111111111111111111111111111111111111111111111111111111111111111';
const PAYER = '0x2222222222222222222222222222222222222222222222222222222222222222';
const USDC_TYPE = '0x000000000000000000000000000000000000000000000000000000000000000a::usdc::USDC';

const ENV_KEYS = [
  'X402_ENABLED',
  'X402_SELLER_ADDRESS',
  'X402_USDC_CEILING',
  'X402_RUN_CAP_USDC',
  'X402_PREMIUM_PRICE_USDC',
  'SETTLEMENT_NETWORK',
  'TATUM_API_KEY',
  'SUI_NETWORK',
];

const BODY = {
  market: { id: 'market-premium-1', title: 'Will it rain?', currentOdds: 0.55, location: 'London' },
  analysis: { reasoning: 'A considered view.', assessment: { confidence: 0.7, odds_efficiency: 'EFFICIENT' } }
};

function successfulBlock(digest, amount = 10000) {
  return {
    digest,
    effects: { status: { status: 'success' } },
    balanceChanges: [
      { coinType: USDC_TYPE, owner: PAYER, amount: String(-amount) },
      { coinType: USDC_TYPE, owner: SELLER, amount: String(amount) },
    ],
  };
}

function mockRpc(result) {
  global.fetch = vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => ({ jsonrpc: '2.0', id: 1, result }),
    text: async () => '{}',
  }));
}

function paymentHeader(digest) {
  const payload = {
    x402Version: 1,
    scheme: 'exact',
    network: 'sui:testnet',
    payload: { txDigest: digest, payer: PAYER },
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function postRequest(digest) {
  const headers = { 'content-type': 'application/json' };
  if (digest) headers['x-payment'] = paymentHeader(digest);
  return new Request('http://localhost/api/signals/premium', {
    method: 'POST',
    headers,
    body: JSON.stringify(BODY),
  });
}

describe('GET /api/signals/premium', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.X402_ENABLED = 'true';
    process.env.X402_SELLER_ADDRESS = SELLER;
    process.env.X402_PREMIUM_PRICE_USDC = '0.01';
    process.env.SETTLEMENT_NETWORK = 'testnet';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('quotes the requirement without taking payment', async () => {
    const res = await GET(new Request('http://localhost/api/signals/premium'));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.accepts[0].payTo).toBe(SELLER);
    expect(body.accepts[0].maxAmountRequired).toBe('10000');
    expect(body.settlementNetwork).toBe('sui:testnet');
    expect(res.headers.get('Payment-Required')).toBeTruthy();
  });
});

describe('POST /api/signals/premium', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.X402_ENABLED = 'true';
    process.env.X402_SELLER_ADDRESS = SELLER;
    process.env.X402_USDC_CEILING = '1';
    process.env.X402_RUN_CAP_USDC = '1';
    process.env.X402_PREMIUM_PRICE_USDC = '0.01';
    process.env.SETTLEMENT_NETWORK = 'testnet';
    process.env.TATUM_API_KEY = 'test-key-not-a-real-credential';
    process.env.SUI_NETWORK = 'testnet';
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('answers an unpaid request with 402 and a requirement', async () => {
    const res = await POST(postRequest(null));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.accepts[0].payTo).toBe(SELLER);
    expect(body.reasonCode).toBe('PAYMENT_HEADER_MISSING');
    expect(body.settlementNetwork).toBe('sui:testnet');
  });

  it('publishes the signal once the payment settles', async () => {
    const digest = 'RouteDigestAAA111111111111111111111111111111';
    mockRpc(successfulBlock(digest));

    const res = await POST(postRequest(digest));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.id).toContain('market-premium-1');
    expect(body.settlement.txDigest).toBe(digest);
    expect(body.settlement.usdc).toBe(10000);
    expect(body.settlementNetwork).toBe('sui:testnet');
    expect(await isTxSettled(digest)).toBe(true);
  });

  it('does not publish a signal when the transfer did not succeed', async () => {
    const digest = 'RouteDigestBBB111111111111111111111111111111';
    mockRpc({ ...successfulBlock(digest), effects: { status: { status: 'failure' } } });

    const res = await POST(postRequest(digest));
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.reasonCode).toBe('PAYMENT_TX_FAILED');
    expect(await isTxSettled(digest)).toBe(false);
  });

  it('rejects a malformed body before quoting anything', async () => {
    const res = await POST(
      new Request('http://localhost/api/signals/premium', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ market: { id: 'x' } }),
      })
    );
    expect(res.status).toBe(400);
  });
});
