/**
 * Autopilot scheduler — non-streaming runner for cron / on-demand execution.
 *
 * This module consumes the async generator from aiAgentLoop and returns a
 * plain JSON summary. It is intentionally separate from the streaming SSE
 * route so that cron jobs can run without holding a response stream open.
 */

import { runAgentLoop } from './aiAgentLoop.js';

/**
 * Default autopilot configuration used by the cron route.
 */
export function getDefaultAutopilotConfig() {
  return {
    categories: ['all'],
    maxMarkets: 5,
    minVolume: 10000,
    maxDaysOut: 30,
    riskTolerance: 0.5,
    autopilot: true,
  };
}

/**
 * Run one autopilot pass and aggregate metrics / trade summaries.
 *
 * @param {Object} config — passed through to runAgentLoop
 * @param {boolean} [config.dryRun=true] — when true, do not place real orders
 * @param {number} [config.dailyCapPct=0.5] — max sum(size_pct) per 24h
 * @returns {Promise<{
 *   success: boolean,
 *   marketsScanned: number,
 *   candidatesFiltered: number,
 *   forecastsMade: number,
 *   executed: number,
 *   failed: number,
 *   dryRun: boolean,
 *   trades: Array,
 *   error?: string
 * }>}
 */
export async function runAutopilotOnce(config = getDefaultAutopilotConfig()) {
  const summary = {
    success: true,
    marketsScanned: 0,
    candidatesFiltered: 0,
    forecastsMade: 0,
    executed: 0,
    failed: 0,
    dryRun: config.dryRun !== false,
    trades: [],
  };

  try {
    const loop = runAgentLoop(config);

    for await (const update of loop) {
      if (update.step === 'discover' && update.status === 'complete') {
        summary.marketsScanned = update.data?.total || 0;
      }

      if (update.step === 'filter' && update.status === 'complete') {
        summary.candidatesFiltered = update.data?.candidates?.length || 0;
      }

      if (update.step === 'forecast' && update.status === 'complete') {
        summary.forecastsMade += 1;
      }

      if (update.step === 'execute' && update.status === 'complete') {
        summary.executed = update.data?.executed || 0;
        summary.failed = update.data?.failed || 0;
        summary.trades = update.data?.trades || [];
      }
    }

    return summary;
  } catch (error) {
    console.error('runAutopilotOnce error:', error.message);
    return {
      ...summary,
      success: false,
      error: error.message,
    };
  }
}
