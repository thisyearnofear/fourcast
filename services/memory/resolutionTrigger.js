/**
 * Resolution-triggered memory writes.
 *
 * The plan's rule: memories are written when evidence ARRIVES, not on a timer.
 * A timer produces a heartbeat; a resolution produces a belief revision, and
 * only the second one is worth an append-only slot on a public ledger.
 *
 * This function is deliberately incapable of breaking a resolution. Every
 * caller (the API route, the worker, the sweep, the backfill) has already done
 * the important part — scoring the forecast — so the whole body is wrapped and
 * the failure mode is a logged `{ ok: false }`, never a throw.
 */

import { listResolvedForecasts } from '../db.js';
import { memoryStatus } from './memwalClient.js';
import { memoriesForResolution } from './ledgerMemory.js';
import { writeMemory } from './memoryStore.js';

/**
 * @param marketId  the market that just resolved
 * @param triggerReceipt  sha256 of the decision receipt / reconciliation proof
 *        that authorised the resolution — the pointer from memory back to the
 *        pre-outcome evidence.
 */
export async function rememberResolution(
  { marketId, triggerReceipt = null },
  { dryRun = false, refreshWindow = true } = {}
) {
  const status = memoryStatus();
  if (!status.writable && !dryRun) {
    return { ok: true, skipped: true, reason: status.reason || 'memory not writable', written: [] };
  }
  if (!marketId) {
    return { ok: false, skipped: true, reason: 'rememberResolution needs a marketId' };
  }

  try {
    const { forecasts } = await listResolvedForecasts({ marketId, limit: 20 });
    if (!forecasts.length) {
      return { ok: true, skipped: true, reason: `no resolved rows for market ${marketId}`, written: [], refused: [] };
    }

    const written = [];
    const refused = [];
    for (const forecast of forecasts) {
      const { candidates, skipped } = await memoriesForResolution(forecast, { triggerReceipt, refreshWindow });
      refused.push(...skipped.map((s) => s.skip));
      for (const candidate of candidates) {
        const result = await writeMemory(candidate, { dryRun });
        if (result.skipped) refused.push(result.reason);
        else written.push({ kind: result.kind, key: result.key, version: result.version, blobId: result.blobId || null, ok: result.ok, error: result.error });
      }
    }
    return { ok: true, dryRun, marketId, written, refused };
  } catch (error) {
    console.error('[memory] resolution trigger failed:', error.message);
    return { ok: false, error: error.message, written: [], refused: [] };
  }
}
