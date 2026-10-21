#!/usr/bin/env node
/**
 * Backfill calibration data for the Fourcast calibration curve.
 *
 * Reads historical decision receipts and replay fixtures produced by the
 * fourcast-agent worker, then inserts scored forecasts into the
 * agent_forecasts table with bucket classifications matching the original
 * decision verdicts. This gives the /arena calibration curve immediate
 * data points the first time anyone visits the page.
 *
 * Idempotent — running twice will not duplicate rows. Rows are keyed by
 * the receipt content hash so re-runs are no-ops.
 *
 * Only receipts whose file carries a real reconciliation outcome are resolved.
 * The rest are saved unresolved and scored later by the worker — the curve
 * fills in as evidence arrives, never by inventing a result.
 *
 * Usage:
 *   node scripts/backfill-calibration.mjs
 *   node scripts/backfill-calibration.mjs --dry-run
 *
 * Environment: same as the worker (TURSO env vars, FOURCAST_AGENT_STATE_DIR).
 */

import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { saveForecast, resolveForecast, migrationsReady } from '../services/db.js';

dotenv.config({ path: process.env.FOURCAST_AGENT_ENV_FILE || '.env.agent' });
dotenv.config();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');

const stateDir = path.resolve(process.env.FOURCAST_AGENT_STATE_DIR || '.fourcast-agent');
const receiptDir = path.join(stateDir, 'receipts');

function listReceiptFiles() {
  if (!fs.existsSync(receiptDir)) return [];
  return fs
    .readdirSync(receiptDir)
    .filter((f) => f.endsWith('.receipt.json'))
    .map((f) => path.join(receiptDir, f));
}

function extractForecastFromReceipt(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
  const receipt = parsed?.receipt;
  if (!receipt?.proof) return null;
  const decision = receipt.proof.decisions?.[0];
  if (!decision) return null;
  const market = decision.market || {};
  const forecast = decision.forecast || {};
  return {
    fixtureId: market.fixtureId || market.id || receipt.fixtureId,
    title: market.title || receipt.fixtureId,
    aiProbability: forecast.probability,
    marketOdds: decision.forecast?.marketOdds || receipt.proof.evidence?.snapshot?.consensusOdds?.implied?.home,
    verdict: decision.decision?.verdict,
    contentHash: receipt.proof.integrity?.contentHash,
    createdAt: receipt.proof.createdAt,
    winner: parsed?.reconciliation?.outcome?.winner || null,
  };
}

function verdictToConfidence(verdict) {
  if (verdict === 'EXECUTE') return 'HIGH';
  if (verdict === 'PASS') return 'MEDIUM';
  return 'LOW';
}

/**
 * Real recorded outcome, or null.
 *
 * A receipt is pre-outcome by construction — that is what makes it provable —
 * so the settled result only exists when the reconciliation attached to the
 * same file carries one. Anything else stays unresolved and gets scored by the
 * worker the moment its fixture settles. Inventing a neutral 0.5 outcome to
 * populate the curve was the old behaviour; it wrote facts nobody observed into
 * the ledger that calibration, sizing and memory all read as evidence.
 */
function recordedOutcome(forecast) {
  if (forecast.winner === 'home') return 1;
  if (forecast.winner === 'away' || forecast.winner === 'draw') return 0;
  return null;
}

async function main() {
  await migrationsReady;

  const files = listReceiptFiles();
  console.log(`[backfill-calibration] found ${files.length} receipt file(s) in ${receiptDir}`);

  let saved = 0;
  let resolved = 0;
  let awaitingOutcome = 0;
  let skipped = 0;

  for (const file of files) {
    const parsed = extractForecastFromReceipt(file);
    if (!parsed || !parsed.fixtureId || parsed.aiProbability == null) {
      skipped++;
      continue;
    }
    const confidence = verdictToConfidence(parsed.verdict);
    const outcome = recordedOutcome(parsed);
    const id = `backfill-${parsed.fixtureId}-${parsed.contentHash?.slice(0, 12) || 'unknown'}`;
    const ts = parsed.createdAt
      ? Math.floor(new Date(parsed.createdAt).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${id} fixture=${parsed.fixtureId} p=${parsed.aiProbability.toFixed(3)} conf=${confidence} outcome=${outcome === null ? 'pending (no recorded result)' : outcome}`
      );
      saved++;
      if (outcome !== null) resolved++;
      else awaitingOutcome++;
      continue;
    }

    const saveResult = await saveForecast({
      id,
      marketID: parsed.fixtureId,
      title: parsed.title,
      platform: 'txline',
      aiProbability: parsed.aiProbability,
      marketOdds: parsed.marketOdds,
      edge: (parsed.aiProbability ?? 0) - (parsed.marketOdds ?? 0),
      confidence,
      reasoning: `Backfilled from receipt ${parsed.contentHash?.slice(0, 8)} (verdict=${parsed.verdict})`,
      keyFactors: ['historical-replay'],
      source: 'backfill',
      timestamp: ts,
    });

    if (saveResult.success) {
      saved++;
      if (outcome === null) {
        // Left unresolved on purpose: the worker scores it when the fixture's
        // real result is read. No invented outcome.
        awaitingOutcome++;
        continue;
      }
      const resolveResult = await resolveForecast(parsed.fixtureId, outcome);
      if (resolveResult.success) {
        resolved += resolveResult.resolved || 0;
      } else {
        console.warn(`[backfill-calibration] resolve failed for ${parsed.fixtureId}: ${resolveResult.error}`);
      }
    } else {
      skipped++;
    }
  }

  console.log(
    `[backfill-calibration] saved=${saved} resolved=${resolved} awaiting-outcome=${awaitingOutcome} skipped=${skipped}${DRY_RUN ? ' (dry-run)' : ''}`
  );
}

main().catch((err) => {
  console.error('[backfill-calibration] fatal:', err);
  process.exit(1);
});
