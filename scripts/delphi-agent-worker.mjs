#!/usr/bin/env node
/**
 * Delphi Agent Worker — headless autonomous loop for the Delphi Agent Arena.
 *
 * Runs the Delphi agent loop on a configurable interval, logging decisions
 * and executions. Designed to run under PM2 on a VPS.
 *
 * Usage:
 *   node scripts/delphi-agent-worker.mjs              # Run continuously
 *   node scripts/delphi-agent-worker.mjs --once       # Single iteration
 *   node scripts/delphi-agent-worker.mjs --dry-run    # Force dry-run mode
 *   node scripts/delphi-agent-worker.mjs --live       # Force live execution
 *
 * Environment:
 *   DELPHI_NETWORK=competition-testnet
 *   DELPHI_SIGNER_TYPE=private_key
 *   WALLET_PRIVATE_KEY=0x...
 *   DELPHI_API_ACCESS_KEY=...
 *   DELPHI_AGENT_INTERVAL_MS=300000   (5 minutes default)
 *   DELPHI_AGENT_DRY_RUN=true         (safety gate)
 *   VENICE_API_KEY=...                 (for LLM intelligence)
 */

import 'dotenv/config';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync, existsSync, appendFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Ensure .env is loaded from project root
process.chdir(ROOT);

// ─── Args ───────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const ONCE = args.includes('--once');
const FORCE_DRY_RUN = args.includes('--dry-run');
const FORCE_LIVE = args.includes('--live');
const INTERVAL_MS = Number(process.env.DELPHI_AGENT_INTERVAL_MS || '300000'); // 5 min

// ─── State Directory ────────────────────────────────────────────────────────

const STATE_DIR = process.env.DELPHI_AGENT_STATE_DIR || join(ROOT, '.delphi-agent');
if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });

const STATUS_FILE = join(STATE_DIR, 'status.json');
const LOG_FILE = join(STATE_DIR, 'runs.jsonl');

// ─── Logging ────────────────────────────────────────────────────────────────

function log(level, message, data) {
  const entry = {
    ts: new Date().toISOString(),
    level,
    message,
    ...(data ? { data } : {}),
  };
  const line = JSON.stringify(entry);
  console.log(`[${level.toUpperCase()}] ${message}`);
  try { appendFileSync(LOG_FILE, line + '\n'); } catch {}
}

function writeStatus(status) {
  try {
    writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch (err) {
    log('warn', `Failed to write status: ${err.message}`);
  }
}

// ─── Pre-flight Checks ──────────────────────────────────────────────────────

function preflight() {
  const required = ['DELPHI_API_ACCESS_KEY'];
  const signerType = process.env.DELPHI_SIGNER_TYPE || 'cdp_server_wallet';

  if (signerType === 'private_key') {
    required.push('WALLET_PRIVATE_KEY');
  }

  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    log('error', `Missing environment variables: ${missing.join(', ')}`);
    log('error', 'See .env.local.example for Delphi configuration.');
    process.exit(1);
  }

  const network = process.env.DELPHI_NETWORK || 'testnet';
  if (network !== 'competition-testnet') {
    log('warn', `DELPHI_NETWORK is "${network}" — expected "competition-testnet" for the arena.`);
  }

  log('info', `Network: ${network} | Signer: ${signerType} | Interval: ${INTERVAL_MS}ms`);
}

// ─── Run One Iteration ──────────────────────────────────────────────────────

async function runOnce() {
  const { runDelphiAgentLoop } = await import('../services/delphiAgentLoop.js');

  const dryRun = FORCE_DRY_RUN ? true : (FORCE_LIVE ? false : undefined);
  const config = {};
  if (dryRun !== undefined) config.dryRun = dryRun;

  const startTime = Date.now();
  const steps = [];

  try {
    for await (const update of runDelphiAgentLoop(config)) {
      steps.push(update);

      // Log significant events
      if (update.status === 'error') {
        log('error', `[${update.step}] ${update.message}`);
      } else if (update.step === 'forecast' && update.status === 'complete') {
        log('info', `[FORECAST] ${update.message}`);
      } else if (update.step === 'decide' && update.status === 'complete') {
        const d = update.data || {};
        log('info', `[DECIDE] ${d.allocate ?? 0}/${d.total ?? 0} cleared policy`);
        for (const t of (d.topDecisions || [])) {
          log('info', `  → ${t.outcome} | edge ${(t.edge * 100).toFixed(1)}% | ${t.shares} shares | ${t.question}`);
        }
      } else if (update.step === 'execute' && update.data?.txHash) {
        log('info', `[TRADE] ${update.message}`);
      } else if (update.step === 'summary') {
        log('info', `[SUMMARY] Markets: ${update.data.marketsScanned}, Analyzed: ${update.data.marketsAnalyzed}, Trades: ${update.data.tradesExecuted}${update.data.dryRun ? ' (dry-run)' : ''}`);
      }
    }

    const duration = Date.now() - startTime;
    const summary = steps.find((s) => s.step === 'summary');

    writeStatus({
      lastRun: new Date().toISOString(),
      durationMs: duration,
      success: true,
      summary: summary?.data || null,
      dryRun: summary?.data?.dryRun ?? true,
    });

    log('info', `Run complete in ${(duration / 1000).toFixed(1)}s`);
    return true;
  } catch (err) {
    const duration = Date.now() - startTime;
    log('error', `Run failed after ${(duration / 1000).toFixed(1)}s: ${err.message}`);

    writeStatus({
      lastRun: new Date().toISOString(),
      durationMs: duration,
      success: false,
      error: err.message,
    });

    return false;
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  log('info', '=== Delphi Agent Worker ===');
  log('info', ONCE ? 'Mode: single iteration' : `Mode: continuous (${INTERVAL_MS / 1000}s interval)`);
  log('info', FORCE_DRY_RUN ? 'Execution: DRY RUN (forced)' : FORCE_LIVE ? 'Execution: LIVE (forced)' : `Execution: ${process.env.DELPHI_AGENT_DRY_RUN !== 'false' ? 'DRY RUN' : 'LIVE'}`);

  preflight();

  if (ONCE) {
    const success = await runOnce();
    process.exit(success ? 0 : 1);
  }

  // Continuous loop
  let iteration = 0;
  while (true) {
    iteration++;
    log('info', `--- Iteration ${iteration} ---`);

    await runOnce();

    log('info', `Sleeping ${INTERVAL_MS / 1000}s until next iteration...`);
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

main().catch((err) => {
  log('error', `Fatal: ${err.message}`);
  process.exit(1);
});
