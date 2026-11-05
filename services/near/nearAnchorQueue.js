/**
 * Durable pending-anchor queue for NEAR receipt commitments.
 *
 * The agent worker enqueues every decision receipt it writes; the queue drains
 * itself once NEAR_ACCOUNT_ID/NEAR_PRIVATE_KEY exist — so receipts produced
 * before the treasury is configured anchor retroactively, and a dropped RPC
 * or a restarted worker never loses a commitment.
 *
 * Queue file: <stateDir>/near-anchors.json
 *   [{ fixtureId, contentHash, receiptFile, enqueuedAt, status,
 *      anchoredAt, txHash, explorerUrl, socialKey, attempts, lastError }]
 *
 * Anchored items are kept (not deleted) — the file doubles as the audit
 * trail for "every receipt Fourcast committed to NEAR".
 *
 * On success the anchor is written back into the receipt file at
 * proof.integrity.onchainCommitments.near. verifyDecisionReceipt() strips the
 * whole integrity object before rehashing, so the receipt stays valid.
 */

import fs from 'node:fs';
import path from 'node:path';
import { isNearConfigured } from './nearConfig.js';
import { anchorReceiptCommitment } from './nearReceiptCommitment.js';

const QUEUE_FILE = 'near-anchors.json';
const MAX_ATTEMPTS = 5;

function queuePath(stateDir) {
  return path.join(stateDir, QUEUE_FILE);
}

export function readAnchorQueue(stateDir) {
  try {
    const parsed = JSON.parse(fs.readFileSync(queuePath(stateDir), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAnchorQueue(stateDir, items) {
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(queuePath(stateDir), JSON.stringify(items, null, 2) + '\n');
}

/** Enqueue a receipt for anchoring. Idempotent on fixtureId + contentHash. */
export function enqueueNearAnchor({ stateDir, fixtureId, contentHash, receiptFile }) {
  if (!stateDir) throw new Error('enqueueNearAnchor: stateDir is required');
  if (!fixtureId || !contentHash) {
    throw new Error('enqueueNearAnchor: fixtureId and contentHash are required');
  }
  const items = readAnchorQueue(stateDir);
  const existing = items.find((i) => i.fixtureId === fixtureId && i.contentHash === contentHash);
  if (existing) return existing;

  const item = {
    fixtureId,
    contentHash,
    receiptFile: receiptFile || null,
    enqueuedAt: new Date().toISOString(),
    status: 'pending',
    attempts: 0,
    lastError: null,
  };
  items.push(item);
  writeAnchorQueue(stateDir, items);
  return item;
}

export function pendingNearAnchors(stateDir) {
  return readAnchorQueue(stateDir).filter((i) => i.status === 'pending');
}

/** Write the anchor record back into the receipt file's integrity block. */
export function recordAnchorOnReceipt(receiptFile, anchor) {
  try {
    const parsed = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
    if (!parsed?.receipt?.proof?.integrity) return false;
    parsed.receipt.proof.integrity.onchainCommitments = {
      ...(parsed.receipt.proof.integrity.onchainCommitments || {}),
      near: {
        txHash: anchor.txHash,
        accountId: anchor.accountId || null,
        explorerUrl: anchor.explorerUrl,
        socialKey: anchor.socialKey,
        network: anchor.network,
        anchoredAt: new Date().toISOString(),
      },
    };
    fs.writeFileSync(receiptFile, JSON.stringify(parsed, null, 2) + '\n');
    return true;
  } catch {
    return false;
  }
}

/**
 * Anchor every pending item whose signing keys now exist.
 *
 * No-op (returns { attempted: 0 }) when the treasury isn't configured or
 * NEAR_ANCHOR_ENABLED=false — callers can invoke it every cycle. A failed
 * item stays pending until MAX_ATTEMPTS, then flips to 'failed' so one bad
 * receipt can't stall the queue.
 *
 * Returns { attempted, anchored, failed, pending, items }.
 */
export async function drainNearAnchors({ stateDir, force = false } = {}) {
  const empty = { attempted: 0, anchored: 0, failed: 0, pending: 0, items: [] };
  if (!stateDir) return empty;
  if (process.env.NEAR_ANCHOR_ENABLED === 'false' && !force) return empty;
  if (!isNearConfigured()) {
    const items = readAnchorQueue(stateDir);
    return { ...empty, pending: items.filter((i) => i.status === 'pending').length, items };
  }

  const items = readAnchorQueue(stateDir);
  const pending = items.filter((i) => i.status === 'pending' && i.attempts < MAX_ATTEMPTS);
  const summary = { attempted: pending.length, anchored: 0, failed: 0, pending: 0, items };

  for (const item of pending) {
    item.attempts += 1;
    try {
      const anchor = await anchorReceiptCommitment({
        fixtureId: item.fixtureId,
        contentHash: item.contentHash,
      });
      item.status = 'anchored';
      item.anchoredAt = new Date().toISOString();
      item.txHash = anchor.txHash;
      item.explorerUrl = anchor.explorerUrl;
      item.socialKey = anchor.socialKey;
      item.network = anchor.network;
      item.lastError = null;
      summary.anchored += 1;
      if (item.receiptFile) recordAnchorOnReceipt(item.receiptFile, anchor);
    } catch (err) {
      item.lastError = err.message;
      if (item.attempts >= MAX_ATTEMPTS) {
        item.status = 'failed';
        summary.failed += 1;
      }
    }
  }

  writeAnchorQueue(stateDir, items);
  summary.pending = items.filter((i) => i.status === 'pending').length;
  return summary;
}

const nearAnchorQueue = {
  readAnchorQueue,
  enqueueNearAnchor,
  pendingNearAnchors,
  drainNearAnchors,
  recordAnchorOnReceipt,
};

export default nearAnchorQueue;
