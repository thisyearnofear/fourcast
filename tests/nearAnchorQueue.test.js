import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { verifyDecisionReceipt, buildDecisionReceipt } from '../services/domain/decision/decisionReceipt.js';

vi.mock('../services/near/nearReceiptCommitment.js', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    anchorReceiptCommitment: vi.fn(),
  };
});

const { anchorReceiptCommitment } = await import('../services/near/nearReceiptCommitment.js');
const {
  readAnchorQueue,
  enqueueNearAnchor,
  pendingNearAnchors,
  drainNearAnchors,
  recordAnchorOnReceipt,
} = await import('../services/near/nearAnchorQueue.js');

const HASH = 'c'.repeat(64);
const ENV_KEYS = ['NEAR_ACCOUNT_ID', 'NEAR_PRIVATE_KEY', 'NEAR_ANCHOR_ENABLED'];
let saved;
let stateDir;

function makeReceiptFile(name) {
  const file = path.join(stateDir, `${name}.receipt.json`);
  const receipt = buildDecisionReceipt({
    id: `r-${name}`,
    createdAt: '2026-11-02T00:00:00.000Z',
    policy: { version: 'v1' },
    evidence: { fixture: name },
    decisions: [{ decision: { verdict: 'EXECUTE' } }],
    execution: { dryRun: true },
  });
  fs.writeFileSync(file, JSON.stringify({ receipt }, null, 2) + '\n');
  return file;
}

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  for (const k of ENV_KEYS) delete process.env[k];
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'near-anchors-'));
  anchorReceiptCommitment.mockReset();
});

afterEach(() => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  fs.rmSync(stateDir, { recursive: true, force: true });
});

describe('enqueueNearAnchor', () => {
  it('creates a pending item and dedupes on fixtureId+contentHash', () => {
    const a = enqueueNearAnchor({ stateDir, fixtureId: 'fx', contentHash: HASH });
    expect(a.status).toBe('pending');
    const b = enqueueNearAnchor({ stateDir, fixtureId: 'fx', contentHash: HASH });
    expect(b.enqueuedAt).toBe(a.enqueuedAt);
    expect(readAnchorQueue(stateDir)).toHaveLength(1);
  });

  it('persists to near-anchors.json', () => {
    enqueueNearAnchor({ stateDir, fixtureId: 'fx', contentHash: HASH });
    const onDisk = JSON.parse(fs.readFileSync(path.join(stateDir, 'near-anchors.json'), 'utf8'));
    expect(onDisk[0].fixtureId).toBe('fx');
  });
});

describe('drainNearAnchors', () => {
  it('no-ops when the treasury is not configured', async () => {
    enqueueNearAnchor({ stateDir, fixtureId: 'fx', contentHash: HASH });
    const summary = await drainNearAnchors({ stateDir });
    expect(summary.attempted).toBe(0);
    expect(summary.pending).toBe(1);
    expect(anchorReceiptCommitment).not.toHaveBeenCalled();
  });

  it('anchors pending items when configured and records them on the receipt', async () => {
    process.env.NEAR_ACCOUNT_ID = 'fourcast-agent.testnet';
    process.env.NEAR_PRIVATE_KEY = 'ed25519:test';
    const receiptFile = makeReceiptFile('fx');
    enqueueNearAnchor({ stateDir, fixtureId: 'fx', contentHash: HASH, receiptFile });
    anchorReceiptCommitment.mockResolvedValue({
      txHash: 'TxAbC',
      explorerUrl: 'https://testnet.nearblocks.io/txns/TxAbC',
      socialKey: 'fourcast-agent.testnet/fourcast/receipts/fx',
      network: 'testnet',
    });

    const summary = await drainNearAnchors({ stateDir });
    expect(summary.anchored).toBe(1);
    expect(summary.pending).toBe(0);
    const item = readAnchorQueue(stateDir)[0];
    expect(item.status).toBe('anchored');
    expect(item.txHash).toBe('TxAbC');

    const stored = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    const near = stored.receipt.proof.integrity.onchainCommitments.near;
    expect(near.txHash).toBe('TxAbC');
    // integrity hash untouched → receipt still verifies
    expect(verifyDecisionReceipt(stored.receipt)).toMatchObject({ valid: true });
  });

  it('keeps failures pending with lastError', async () => {
    process.env.NEAR_ACCOUNT_ID = 'fourcast-agent.testnet';
    process.env.NEAR_PRIVATE_KEY = 'ed25519:test';
    enqueueNearAnchor({ stateDir, fixtureId: 'fx', contentHash: HASH });
    anchorReceiptCommitment.mockRejectedValue(new Error('rpc down'));

    const summary = await drainNearAnchors({ stateDir });
    expect(summary.anchored).toBe(0);
    const item = readAnchorQueue(stateDir)[0];
    expect(item.status).toBe('pending');
    expect(item.attempts).toBe(1);
    expect(item.lastError).toBe('rpc down');
  });

  it('respects NEAR_ANCHOR_ENABLED=false unless forced', async () => {
    process.env.NEAR_ACCOUNT_ID = 'fourcast-agent.testnet';
    process.env.NEAR_PRIVATE_KEY = 'ed25519:test';
    process.env.NEAR_ANCHOR_ENABLED = 'false';
    enqueueNearAnchor({ stateDir, fixtureId: 'fx', contentHash: HASH });

    const skip = await drainNearAnchors({ stateDir });
    expect(skip.attempted).toBe(0);
    expect(anchorReceiptCommitment).not.toHaveBeenCalled();

    anchorReceiptCommitment.mockResolvedValue({ txHash: 'T', explorerUrl: 'e', socialKey: 'k', network: 'testnet' });
    const forced = await drainNearAnchors({ stateDir, force: true });
    expect(forced.anchored).toBe(1);
  });
});

describe('recordAnchorOnReceipt', () => {
  it('merges without clobbering other chain commitments', () => {
    const file = makeReceiptFile('fx');
    const stored = JSON.parse(fs.readFileSync(file, 'utf8'));
    stored.receipt.proof.integrity.onchainCommitments = { solana: { signature: 'sig' } };
    fs.writeFileSync(file, JSON.stringify(stored) + '\n');

    recordAnchorOnReceipt(file, { txHash: 'T', explorerUrl: 'e', socialKey: 'k', network: 'testnet' });
    const after = JSON.parse(fs.readFileSync(file, 'utf8'));
    expect(after.receipt.proof.integrity.onchainCommitments.solana.signature).toBe('sig');
    expect(after.receipt.proof.integrity.onchainCommitments.near.txHash).toBe('T');
  });
});
