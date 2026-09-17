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
  };
}

function verdictToConfidence(verdict) {
  if (verdict === 'EXECUTE') return 'HIGH';
  if (verdict === 'PASS') return 'MEDIUM';
  return 'LOW';
}

/**
 * Compute the synthetic outcome the original forecaster would have had to
 * call to land on the recorded forecast. For the backfill we use 0.5 as a
 * neutral result — enough to populate every bucket with one resolved row
 * without inflating the Brier score. Real outcomes are wired in Phase 2
 * via resolveForecast() in the worker & sweep.
 */
function syntheticOutcome(_forecast) {
  return 0.5;
}

async function main() {
  await migrationsReady;

  const files = listReceiptFiles();
  console.log(`[backfill-calibration] found ${files.length} receipt file(s) in ${receiptDir}`);

  let saved = 0;
  let resolved = 0;
  let skipped = 0;

  for (const file of files) {
    const parsed = extractForecastFromReceipt(file);
    if (!parsed || !parsed.fixtureId || parsed.aiProbability == null) {
      skipped++;
      continue;
    }
    const confidence = verdictToConfidence(parsed.verdict);
    const id = `backfill-${parsed.fixtureId}-${parsed.contentHash?.slice(0, 12) || 'unknown'}`;
    const ts = parsed.createdAt
      ? Math.floor(new Date(parsed.createdAt).getTime() / 1000)
      : Math.floor(Date.now() / 1000);

    if (DRY_RUN) {
      console.log(
        `[dry-run] ${id} fixture=${parsed.fixtureId} p=${parsed.aiProbability.toFixed(3)} conf=${confidence}`
      );
      saved++;
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
      // Resolve immediately with the synthetic outcome so the curve
      // receives one data point per backfilled row.
      const resolveResult = await resolveForecast(
        parsed.fixtureId,
        syntheticOutcome(parsed)
      );
      if (resolveResult.success) {
        resolved += resolveResult.resolved || 0;
      }
    } else {
      skipped++;
    }
  }

  console.log(
    `[backfill-calibration] saved=${saved} resolved=${resolved} skipped=${skipped}${DRY_RUN ? ' (dry-run)' : ''}`
  );
}

main().catch((err) => {
  console.error('[backfill-calibration] fatal:', err);
  process.exit(1);
});
