#!/usr/bin/env node
/**
 * Derive log_loss for forecasts that were resolved before the column existed.
 *
 * Nothing new is scored here: every value is recomputed from the
 * ai_probability and actual_outcome already stored in the row, so the backfilled
 * number is the same one resolveForecast() would have written at the time.
 * Rows whose recorded outcome is not 0/1 are skipped and reported, not
 * converted into a loss.
 *
 * Usage:
 *   node scripts/backfill-log-loss.mjs --dry-run
 *   node scripts/backfill-log-loss.mjs
 */
import { migrationsReady, backfillForecastLogLoss } from '../services/db.js';

const DRY_RUN = process.argv.slice(2).includes('--dry-run');

async function main() {
  await migrationsReady;
  const result = await backfillForecastLogLoss({ dryRun: DRY_RUN });

  if (!result.success) {
    console.error(`[backfill-log-loss] failed: ${result.error}`);
    process.exit(1);
  }

  console.log(
    `[backfill-log-loss] scanned=${result.scanned} updated=${result.updated}` +
      ` skipped-non-binary=${result.skippedNonBinary}${DRY_RUN ? ' (dry-run, nothing written)' : ''}`
  );

  if (DRY_RUN && result.scanned > 0) {
    console.log('Next step: re-run without --dry-run to persist the derived values.');
  }
}

main().catch((err) => {
  console.error('[backfill-log-loss] fatal:', err);
  process.exit(1);
});
