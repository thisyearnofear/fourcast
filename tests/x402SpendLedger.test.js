import { describe, it, expect, beforeEach, afterEach } from 'vitest';

import {
  checkSpendGates,
  claimPayment,
  confirmPayment,
  failPayment,
  isTxSettled,
  spendForAnswerKey,
  spendForRun,
  spendSummary,
} from '@/services/payments/x402Sui/spendLedger.js';

/**
 * The spend ledger: the UNIQUE digest that makes a payment non-replayable,
 * and the two caps that bound what we are willing to sell.
 */

const ENV_KEYS = ['X402_USDC_CEILING', 'X402_RUN_CAP_USDC'];

function baseEnv(overrides = {}) {
  return { X402_USDC_CEILING: '1', X402_RUN_CAP_USDC: '1', ...overrides };
}

describe('spend ledger', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('claims a digest once and refuses the second claim', async () => {
    const digest = 'LedgerDigestAAA111111111111111111111111111';
    const first = await claimPayment({
      txDigest: digest,
      answerKey: 'ledger-a',
      usdc: 10000,
      network: 'sui:testnet',
    });
    expect(first.claimed).toBe(true);
    expect(first.duplicate).toBe(false);

    const second = await claimPayment({
      txDigest: digest,
      answerKey: 'ledger-a',
      usdc: 10000,
      network: 'sui:testnet',
    });
    expect(second.claimed).toBe(false);
    expect(second.duplicate).toBe(true);

    expect(await isTxSettled(digest)).toBe(true);
  });

  it('records a failed delivery instead of hiding it', async () => {
    const digest = 'LedgerDigestBBB111111111111111111111111111';
    await claimPayment({ txDigest: digest, answerKey: 'ledger-b', usdc: 10000, network: 'sui:testnet' });
    await failPayment(digest, new Error('resource blew up'));
    const summary = await spendSummary();
    expect(summary.byStatus.find((row) => row.status === 'failed')?.count).toBeGreaterThan(0);
    // The money moved, so it still counts against the ceiling.
    expect(await spendForAnswerKey('ledger-b')).toBe(10000);
  });

  it('confirms a delivery with the signal it bought', async () => {
    const digest = 'LedgerDigestCCC111111111111111111111111111';
    await claimPayment({ txDigest: digest, answerKey: 'ledger-c', usdc: 10000, network: 'sui:testnet' });
    await confirmPayment(digest, { signalId: 'sig-1', blobId: 'blob-1' });
    const summary = await spendSummary();
    expect(summary.byStatus.find((row) => row.status === 'delivered')?.count).toBeGreaterThan(0);
  });

  it('sums spend per answer key and per run', async () => {
    await claimPayment({ txDigest: 'LedgerDigestDDD111111111111111111111111', answerKey: 'ledger-d', usdc: 4000, network: 'sui:testnet', runId: 'run-1' });
    await claimPayment({ txDigest: 'LedgerDigestEEE111111111111111111111111', answerKey: 'ledger-d', usdc: 6000, network: 'sui:testnet', runId: 'run-1' });
    expect(await spendForAnswerKey('ledger-d')).toBe(10000);
    expect(await spendForRun('run-1')).toBe(10000);
  });
});

describe('spend gates', () => {
  beforeEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  afterEach(() => {
    for (const key of ENV_KEYS) delete process.env[key];
  });

  it('allows a spend under both caps', async () => {
    const gates = await checkSpendGates({ answerKey: 'gate-a', amountUsdc: 10000, env: baseEnv() });
    expect(gates.allowed).toBe(true);
  });

  it('blocks a spend that breaks the per-answer ceiling', async () => {
    const env = baseEnv({ X402_USDC_CEILING: '0.005' });
    const gates = await checkSpendGates({ answerKey: 'gate-b', amountUsdc: 10000, env });
    expect(gates.allowed).toBe(false);
    expect(gates.reasonCode).toBe('SPEND_CEILING_EXCEEDED');
  });

  it('blocks a spend that breaks the per-run cap', async () => {
    const env = baseEnv({ X402_RUN_CAP_USDC: '0.005' });
    const gates = await checkSpendGates({ answerKey: 'gate-c', amountUsdc: 10000, runId: 'run-x', env });
    expect(gates.allowed).toBe(false);
    expect(gates.reasonCode).toBe('SPEND_RUN_CAP_EXCEEDED');
  });

  it('fails closed when no ceiling is configured', async () => {
    const gates = await checkSpendGates({ answerKey: 'gate-d', amountUsdc: 10000, env: baseEnv({ X402_USDC_CEILING: '' }) });
    expect(gates.allowed).toBe(false);
    expect(gates.reasonCode).toBe('SPEND_CEILING_UNSET');
  });

  it('refuses a malformed ceiling instead of treating it as unlimited', async () => {
    const gates = await checkSpendGates({ answerKey: 'gate-e', amountUsdc: 10000, env: baseEnv({ X402_USDC_CEILING: 'free' }) });
    expect(gates.allowed).toBe(false);
    expect(gates.reasonCode).toBe('SPEND_CEILING_INVALID');
  });
});
