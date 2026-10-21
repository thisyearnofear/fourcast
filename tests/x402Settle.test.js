import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { deliverAfterSettlement } from '@/services/payments/x402Sui/settle.js';
import { parsePaymentHeader } from '@/services/payments/x402Sui/verify.js';
import { isTxSettled, spendSummary } from '@/services/payments/x402Sui/spendLedger.js';

/**
 * The seller-side flow, proven end to end against a mocked Sui RPC:
 * unpaid → 402, paid → settled delivery, and every refusal path in between.
 *
 * LOCAL PROOF ONLY. The transfer in the fixture never happened; what is
 * proven is that the resource is produced after — and only after — the
 * settlement checks pass.
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
  'X402_USDC_COIN_TYPE',
  'TATUM_API_KEY',
  'SUI_NETWORK',
];

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

function jsonResponse(payload) {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => (name.toLowerCase() === 'content-type' ? 'application/json' : null) },
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  };
}

function mockRpc(result) {
  global.fetch = vi.fn(async () => jsonResponse({ jsonrpc: '2.0', id: 1, result }));
}

function paymentHeader(digest, overrides = {}) {
  const payload = {
    x402Version: 1,
    scheme: 'exact',
    network: 'sui:testnet',
    payload: { txDigest: digest, payer: PAYER, ...overrides },
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

function request(digest) {
  return { headers: digest ? { 'x-payment': paymentHeader(digest) } : {} };
}

describe('deliverAfterSettlement', () => {
  let delivered;

  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
    process.env.X402_ENABLED = 'true';
    process.env.X402_SELLER_ADDRESS = SELLER;
    process.env.X402_USDC_CEILING = '1';
    process.env.X402_RUN_CAP_USDC = '1';
    process.env.X402_PREMIUM_PRICE_USDC = '0.01';
    process.env.SETTLEMENT_NETWORK = 'testnet';
    // The shared Tatum client is fail-closed without a key, and the read
    // network must match the settlement network.
    process.env.TATUM_API_KEY = 'test-key-not-a-real-credential';
    process.env.SUI_NETWORK = 'testnet';
    delivered = [];
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const resourceFn = async ({ settlement }) => {
    delivered.push(settlement.txDigest);
    return { id: 'sig-1', signalId: 'sig-1' };
  };

  it('answers an unpaid request with 402 and a machine-readable requirement', async () => {
    const res = await deliverAfterSettlement(request(null), resourceFn, { answerKey: 'a-unpaid' });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.reasonCode).toBe('PAYMENT_HEADER_MISSING');
    expect(body.accepts[0].payTo).toBe(SELLER);
    expect(body.accepts[0].maxAmountRequired).toBe('10000');
    expect(body.accepts[0].network).toBe('sui:testnet');
    expect(body.settlementNetwork).toBe('sui:testnet');
    expect(res.headers.get('Payment-Required')).toBeTruthy();
    expect(delivered).toHaveLength(0);
  });

  it('delivers the resource only after the payment settles', async () => {
    const digest = 'SettleDigestAAA11111111111111111111111111111';
    mockRpc(successfulBlock(digest));

    const res = await deliverAfterSettlement(request(digest), resourceFn, { answerKey: 'a-paid' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.id).toBe('sig-1');
    expect(body.settlement.txDigest).toBe(digest);
    expect(body.settlement.usdc).toBe(10000);
    expect(body.settlementNetwork).toBe('sui:testnet');
    expect(delivered).toEqual([digest]);
  });

  it('records the settlement in the ledger', async () => {
    const digest = 'SettleDigestBBB11111111111111111111111111111';
    mockRpc(successfulBlock(digest));
    await deliverAfterSettlement(request(digest), resourceFn, { answerKey: 'a-ledger' });
    expect(await isTxSettled(digest)).toBe(true);
    const summary = await spendSummary();
    expect(summary.totalPayments).toBeGreaterThan(0);
  });

  it('refuses to deliver when the transfer did not succeed', async () => {
    const digest = 'SettleDigestCCC11111111111111111111111111111';
    mockRpc({ ...successfulBlock(digest), effects: { status: { status: 'failure' } } });

    const res = await deliverAfterSettlement(request(digest), resourceFn, { answerKey: 'a-failed-tx' });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.reasonCode).toBe('PAYMENT_TX_FAILED');
    expect(delivered).toHaveLength(0);
  });

  it('refuses to deliver when the RPC cannot be reached', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    });
    const res = await deliverAfterSettlement(request('SettleDigestDDD111111111111111111111111'), resourceFn, {
      answerKey: 'a-no-rpc',
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.reasonCode).toBe('PAYMENT_VERIFICATION_UNAVAILABLE');
    expect(delivered).toHaveLength(0);
  });

  it('rejects a replayed transaction without delivering twice', async () => {
    const digest = 'SettleDigestEEE11111111111111111111111111111';
    mockRpc(successfulBlock(digest));

    const first = await deliverAfterSettlement(request(digest), resourceFn, { answerKey: 'a-replay' });
    expect(first.status).toBe(200);

    const second = await deliverAfterSettlement(request(digest), resourceFn, { answerKey: 'a-replay' });
    expect(second.status).toBe(409);
    const body = await second.json();
    expect(body.reasonCode).toBe('PAYMENT_TX_REPLAYED');
    expect(delivered).toEqual([digest]);
  });

  it('refuses a spend that would break the per-answer ceiling', async () => {
    process.env.X402_USDC_CEILING = '0.005';
    const digest = 'SettleDigestFFF11111111111111111111111111111';
    mockRpc(successfulBlock(digest));

    const res = await deliverAfterSettlement(request(digest), resourceFn, { answerKey: 'a-ceiling' });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe('SPEND_CEILING_EXCEEDED');
    expect(delivered).toHaveLength(0);
  });

  it('refuses a spend that would break the per-run cap', async () => {
    process.env.X402_RUN_CAP_USDC = '0.005';
    const digest = 'SettleDigestGGG11111111111111111111111111111';
    mockRpc(successfulBlock(digest));

    const res = await deliverAfterSettlement(request(digest), resourceFn, { answerKey: 'a-run', runId: 'run-1' });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe('SPEND_RUN_CAP_EXCEEDED');
    expect(delivered).toHaveLength(0);
  });

  it('fails closed when no spend ceiling is configured', async () => {
    delete process.env.X402_USDC_CEILING;
    const digest = 'SettleDigestHHH11111111111111111111111111111';
    mockRpc(successfulBlock(digest));

    const res = await deliverAfterSettlement(request(digest), resourceFn, { answerKey: 'a-no-ceiling' });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe('SPEND_CEILING_UNSET');
    expect(delivered).toHaveLength(0);
  });

  it('stays dark until it is switched on', async () => {
    delete process.env.X402_ENABLED;
    const res = await deliverAfterSettlement(request('SettleDigestIII1111111111111111111111'), resourceFn, {
      answerKey: 'a-disabled',
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.reason).toBe('X402_DISABLED');
    expect(delivered).toHaveLength(0);
  });

  it('refuses to quote without a payee address', async () => {
    delete process.env.X402_SELLER_ADDRESS;
    const res = await deliverAfterSettlement(request('SettleDigestJJJ1111111111111111111111'), resourceFn, {
      answerKey: 'a-no-seller',
    });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.reason).toBe('SELLER_NOT_CONFIGURED');
    expect(delivered).toHaveLength(0);
  });

  it('never treats a malformed header as a payment', async () => {
    const res = await deliverAfterSettlement({ headers: { 'x-payment': 'not-base64-json' } }, resourceFn, {
      answerKey: 'a-malformed',
    });
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.reasonCode).toBe('PAYMENT_HEADER_MALFORMED');
    expect(delivered).toHaveLength(0);
  });

  it('parses the payment header it accepts', () => {
    const parsed = parsePaymentHeader(paymentHeader('SettleDigestKKK1111111111111111111111'));
    expect(parsed.ok).toBe(true);
    expect(parsed.payment.network).toBe('sui:testnet');
  });
});
