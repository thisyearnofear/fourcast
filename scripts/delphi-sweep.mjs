#!/usr/bin/env node
/**
 * Delphi Wave Sweep — the "deployable capital" helper for the aggro push.
 *
 * At the start of each resolution wave, run this to (a) sweep every settleable
 * position back into fresh TST and (b) see exactly how much capital is free to
 * redeploy vs still trapped in OPEN positions.
 *
 * Usage:
 *   node scripts/delphi-sweep.mjs            # report ONLY (read-only, no txs)
 *   node scripts/delphi-sweep.mjs --sweep    # actually redeem/liquidate
 *
 * Environment (same as the worker):
 *   WALLET_PRIVATE_KEY, DELPHI_API_ACCESS_KEY, DELPHI_NETWORK
 */
import 'dotenv/config';
import { delphiService } from '../services/delphiService.js';

const SWEEP = process.argv.includes('--sweep');

function fmt(n) {
  return Number(n || 0).toFixed(3);
}

async function main() {
  // Deployable snapshot first (read-only).
  const deploy = await delphiService.getDeployableCapital();
  console.log('\n=== Deployable capital (pre-sweep) ===');
  console.log(`Symbol      : ${deploy.symbol}`);
  console.log(`Cash        : ${fmt(deploy.cash)} ${deploy.symbol}`);
  console.log(`Open markets: ${deploy.openMarkets} (${deploy.openShares} gross shares locked)`);

  if (!SWEEP) {
    console.log('\n(Read-only. Run with --sweep to actually redeem settled /');
    console.log(' liquidate expired markets back into fresh capital.)\n');
    return;
  }

  console.log('\n=== Sweeping settleable positions ===');
  const agg = await delphiService.sweepAllSettled();
  console.log(`Redeemed     : ${agg.redeemed}`);
  console.log(`Liquidated   : ${agg.liquidated}`);
  console.log(`Tokens back  : ${fmt(agg.tokensRecovered)} ${deploy.symbol}`);
  console.log(`Still open   : ${agg.open.length} (${agg.open.reduce((s, p) => s + (p.shares || 0), 0)} shares)`);

  const after = await delphiService.getDeployableCapital();
  console.log('\n=== After sweep (redeploy capital) ===');
  console.log(`Cash (deployable): ${fmt(after.cash)} ${after.symbol}`);
  console.log(`Locked open      : ${after.openMarkets} markets / ${after.openShares} shares`);
  console.log('Redeploy plan    : next wave → 30–50% of deployable per high-certainty resolve,\n                  sweep at resolvesAt, re-deploy same cycle.\n');
}

main().catch((err) => {
  console.error(`Sweep failed: ${err.message}`);
  process.exit(1);
});