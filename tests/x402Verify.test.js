import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  buildPaymentRequirement,
  encodePaymentRequirement,
  executionStatus,
  parsePaymentHeader,
  parsePaymentRequirement,
  summarizeBalanceChanges,
  verifyPayment,
} from '@/services/payments/x402Sui/verify.js';

/**
 * The x402 verification path, proven against a mocked Sui RPC.
 *
 * Everything here is LOCAL PROOF: the RPC is a mocked `fetch`, so what is
 * being tested is our reading of a transaction block — not the existence of a
 * real transfer. A real settlement needs a funded wallet and is VPS-only.
 */

const SELLER = '0x1111111111111111111111111111111111111111111111111111111111111111';
const PAYER = '0x2222222222222222222222222222222222222222222222222222222222222222';
const USDC_TYPE = '0x000000000000000000000000000000000000000000000000000000000000000a::usdc::USDC';
const SUI_TYPE = '0x2::sui::SUI';
const DIGEST = 'FqTestTransactionDigest11111111111111111111111111111';

function block(overrides = {}) {
  return {
    digest: DIGEST,
    effects: { status: { status: 'success' } },
    balanceChanges: [
      { coinType: USDC_TYPE, owner: PAYER, amount: '-10000', previousBalance: '30000' },
      { coinType: USDC_TYPE, owner: SELLER, amount: '10000', previousBalance: '0' },
      { coinType: SUI_TYPE, owner: PAYER, amount: '-5000' },
    ],
    ...overrides,
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

function mockRpcError(message = 'no such object') {
  global.fetch = vi.fn(async () => jsonResponse({ jsonrpc: '2.0', id: 1, error: { code: -32602, message } }));
}

function paymentHeader(overrides = {}) {
  const payload = {
    x402Version: 1,
    scheme: 'exact',
    network: 'sui:testnet',
    payload: { txDigest: DIGEST, payer: PAYER },
    ...overrides,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
}

const BASE = { expectedUsdc: 10000, seller: SELLER, network: 'sui:testnet' };

describe('x402 payment requirement', () => {
  it('parses a v1 body requirement', async () => {
    const requirement = buildPaymentRequirement({ seller: SELLER, amountUsdc: 10000, network: 'sui:testnet' });
    const parsed = await parsePaymentRequirement(JSON.stringify(requirement));
    expect(parsed.ok).toBe(true);
    expect(parsed.version).toBe(1);
    expect(parsed.accepts[0].payTo).toBe(SELLER);
    expect(parsed.accepts[0].maxAmountRequired).toBe('10000');
    expect(parsed.accepts[0].network).toBe('sui:testnet');
  });

  it('parses a v2 base64 PAYMENT-REQUIRED header', async () => {
    const requirement = buildPaymentRequirement({ seller: SELLER, amountUsdc: 10000, network: 'sui:testnet' });
    const encoded = encodePaymentRequirement(requirement);
    const parsed = await parsePaymentRequirement({ headers: { 'payment-required': encoded } });
    expect(parsed.ok).toBe(true);
    expect(parsed.accepts[0].payTo).toBe(SELLER);
  });

  it('reports an unparsable requirement instead of throwing', async () => {
    const parsed = await parsePaymentRequirement('not-a-requirement');
    expect(parsed.ok).toBe(false);
    expect(parsed.accepts).toEqual([]);
    expect(parsed.reasonCode).toBe('REQUIREMENT_UNPARSED');
  });

  it('never quotes a payee it was not given', () => {
    const requirement = buildPaymentRequirement({ seller: null, amountUsdc: 10000, network: 'sui:testnet' });
    expect(requirement.accepts[0].payTo).toBeNull();
  });
});

describe('x402 payment header', () => {
  it('parses a base64 payload with a transaction digest', () => {
    const parsed = parsePaymentHeader(paymentHeader());
    expect(parsed.ok).toBe(true);
    expect(parsed.payment.txDigest).toBe(DIGEST);
    expect(parsed.payment.payer).toBe(PAYER);
    expect(parsed.payment.network).toBe('sui:testnet');
  });

  it('parses a flat raw-JSON payload', () => {
    const parsed = parsePaymentHeader(JSON.stringify({ txDigest: DIGEST, payer: PAYER }));
    expect(parsed.ok).toBe(true);
    expect(parsed.payment.txDigest).toBe(DIGEST);
  });

  it('refuses a header with no digest', () => {
    const parsed = parsePaymentHeader(Buffer.from(JSON.stringify({ payload: {} }), 'utf8').toString('base64'));
    expect(parsed.ok).toBe(false);
    expect(parsed.reasonCode).toBe('PAYMENT_HEADER_MALFORMED');
  });
});

describe('execution status shapes', () => {
  it('reads both the string and the object form', () => {
    expect(executionStatus({ status: 'success' })).toBe('success');
    expect(executionStatus({ status: { status: 'success' } })).toBe('success');
    expect(executionStatus({ status: { status: 'failure' } })).toBe('failure');
    expect(executionStatus({ status: { error: 'boom' } })).toBe('failure');
    expect(executionStatus(null)).toBeNull();
  });
});

describe('balance change summarisation', () => {
  it('sums the USDC credit to the seller and the debit from the payer', () => {
    const summary = summarizeBalanceChanges(block(), { seller: SELLER, payer: PAYER });
    expect(summary.sellerCredit).toBe(10000);
    expect(summary.payerDebit).toBe(10000);
    expect(summary.totalDebit).toBe(10000);
  });

  it('ignores non-USDC coins', () => {
    const summary = summarizeBalanceChanges(block(), { seller: SELLER, payer: PAYER });
    expect(summary.coinTypes.every((type) => type === USDC_TYPE)).toBe(true);
    expect(summary.coinTypes).not.toContain(SUI_TYPE);
  });
});

describe('verifyPayment', () => {
  beforeEach(() => {
    delete process.env.X402_USDC_COIN_TYPE;
    // The shared Tatum client is fail-closed without a key, and the read
    // network must match the settlement network.
    process.env.TATUM_API_KEY = 'test-key-not-a-real-credential';
    process.env.SUI_NETWORK = 'testnet';
    process.env.SETTLEMENT_NETWORK = 'testnet';
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TATUM_API_KEY;
    delete process.env.SUI_NETWORK;
    delete process.env.SETTLEMENT_NETWORK;
  });

  it('verifies a settled payment', async () => {
    mockRpc(block());
    const { payment } = parsePaymentHeader(paymentHeader());
    const result = await verifyPayment({ ...BASE, payment });
    expect(result.valid).toBe(true);
    expect(result.txDigest).toBe(DIGEST);
    expect(result.usdc).toBe(10000);
    expect(result.payer).toBe(PAYER);
  });

  it('rejects a transaction that did not succeed', async () => {
    mockRpc(block({ effects: { status: { status: 'failure' } } }));
    const { payment } = parsePaymentHeader(paymentHeader());
    const result = await verifyPayment({ ...BASE, payment });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_TX_FAILED');
  });

  it('rejects a payment to someone else', async () => {
    mockRpc(block());
    const { payment } = parsePaymentHeader(paymentHeader());
    const result = await verifyPayment({ ...BASE, payment, seller: '0x9999999999999999999999999999999999999999999999999999999999999999' });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_RECIPIENT_MISMATCH');
  });

  it('rejects an underpayment', async () => {
    mockRpc(block());
    const { payment } = parsePaymentHeader(paymentHeader());
    const result = await verifyPayment({ ...BASE, payment, expectedUsdc: 20000 });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_AMOUNT_MISMATCH');
  });

  it('rejects an overpayment under the exact scheme', async () => {
    mockRpc(block());
    const { payment } = parsePaymentHeader(paymentHeader());
    const result = await verifyPayment({ ...BASE, payment, expectedUsdc: 5000 });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_AMOUNT_MISMATCH');
  });

  it('rejects a payment made on another network', async () => {
    mockRpc(block());
    const { payment } = parsePaymentHeader(paymentHeader({ network: 'sui:mainnet' }));
    const result = await verifyPayment({ ...BASE, payment });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_NETWORK_MISMATCH');
  });

  it('rejects a replayed transaction', async () => {
    mockRpc(block());
    const { payment } = parsePaymentHeader(paymentHeader());
    const result = await verifyPayment({ ...BASE, payment, replayCheck: async () => true });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_TX_REPLAYED');
  });

  it('refuses to deliver when the RPC cannot be reached', async () => {
    global.fetch = vi.fn(async () => {
      throw new Error('network down');
    });
    const { payment } = parsePaymentHeader(paymentHeader());
    const result = await verifyPayment({ ...BASE, payment });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_VERIFICATION_UNAVAILABLE');
  });

  it('refuses a transfer of a coin that is not USDC', async () => {
    mockRpc(
      block({
        balanceChanges: [
          { coinType: SUI_TYPE, owner: PAYER, amount: '-10000' },
          { coinType: SUI_TYPE, owner: SELLER, amount: '10000' },
        ],
      })
    );
    const { payment } = parsePaymentHeader(paymentHeader());
    const result = await verifyPayment({ ...BASE, payment });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_COIN_TYPE_MISMATCH');
  });

  it('requires an exact match once a coin type is configured', async () => {
    process.env.X402_USDC_COIN_TYPE = '0x000000000000000000000000000000000000000000000000000000000000000b::usdc::USDC';
    mockRpc(block());
    const { payment } = parsePaymentHeader(paymentHeader());
    const result = await verifyPayment({ ...BASE, payment });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_COIN_TYPE_MISMATCH');
  });

  it('reports a JSON-RPC error as an unavailable read, not a success', async () => {
    mockRpcError();
    const { payment } = parsePaymentHeader(paymentHeader());
    const result = await verifyPayment({ ...BASE, payment });
    expect(result.valid).toBe(false);
    expect(result.reasonCode).toBe('PAYMENT_VERIFICATION_UNAVAILABLE');
  });
});
