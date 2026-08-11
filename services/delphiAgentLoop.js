/**
 * Delphi Agent Loop — focused competition agent for the Delphi Agent Arena.
 *
 * Discovers competition markets, classifies by category, routes to appropriate
 * intelligence (TxLINE for sports, Venice AI for others), applies the same
 * decision policy + Kelly sizing, and executes via Delphi SDK.
 *
 * LMSR key facts:
 * - Winning share pays exactly 1 token
 * - Price IS implied probability (prices sum to 1)
 * - Edge = yourProb - marketPrice = EV per share
 * - Depth (b) is fixed and can be shallow — always quote before trading
 */

if (typeof window !== 'undefined') {
  throw new Error('delphiAgentLoop is server-only');
}

import { delphiService } from './delphiService.js';
import { createDecisionPolicy, evaluateDecision } from './domain/decision/decisionPolicy.js';
import { deriveSimulationSeed, simulateBinaryMarket } from './domain/decision/simulation.js';
import { calculateKellySizing } from '../utils/kellySizing.js';
import { classifyMarket, estimateProbabilities } from './delphiIntelligence.js';

// ─── Configuration ──────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  maxMarkets: 10,
  minEdge: Number(process.env.DELPHI_AGENT_MIN_EDGE || '0.05'),
  maxAllocationPct: Number(process.env.DELPHI_AGENT_MAX_ALLOCATION_PCT || '0.10'),
  maxSharesPerTrade: Number(process.env.DELPHI_AGENT_MAX_SHARES_PER_TRADE || '5'),
  slippagePct: Number(process.env.DELPHI_AGENT_SLIPPAGE_PCT || '2'),
  dryRun: process.env.DELPHI_AGENT_DRY_RUN !== 'false',
  riskTolerance: 0.5,
};

// ─── Main Loop ──────────────────────────────────────────────────────────────

/**
 * Run one iteration of the Delphi competition agent.
 * Yields step-by-step updates for logging/streaming.
 *
 * @param {Object} config - Override defaults
 * @yields {{ step: string, status: string, data?: any, message?: string }}
 */
export async function* runDelphiAgentLoop(config = {}) {
  const opts = { ...DEFAULT_CONFIG, ...config };
  const runId = `delphi-${Date.now()}`;
  const timestamp = new Date().toISOString();

  const decisionPolicy = createDecisionPolicy({
    minAbsoluteEdge: opts.minEdge,
    maxAllocationPct: opts.maxAllocationPct,
  });

  yield { step: 'init', status: 'complete', data: { runId, timestamp, dryRun: opts.dryRun, network: delphiService.network } };

  // ── Step 1: Check balances ────────────────────────────────────────────

  yield { step: 'balance', status: 'running', message: 'Checking wallet balances...' };

  let balances;
  try {
    balances = await delphiService.getBalances();
    yield {
      step: 'balance',
      status: 'complete',
      data: balances,
      message: `${balances.tokenBalance.toFixed(2)} ${balances.tokenSymbol} | ${balances.ethBalance.toFixed(6)} ETH (gas)`,
    };
  } catch (err) {
    yield { step: 'balance', status: 'error', message: err.message };
    return;
  }

  if (balances.tokenBalance <= 0) {
    yield { step: 'balance', status: 'error', message: 'No competition tokens. Register wallet on DoraHacks and wait for funding.' };
    return;
  }

  // ── Step 2: Discover markets ──────────────────────────────────────────

  yield { step: 'discover', status: 'running', message: 'Listing competition markets...' };

  let markets;
  try {
    markets = await delphiService.listMarkets({ status: 'open', limit: 50 });
    yield {
      step: 'discover',
      status: 'complete',
      data: { total: markets.length, categories: [...new Set(markets.map((m) => m.category))] },
      message: `Found ${markets.length} open competition markets`,
    };
  } catch (err) {
    yield { step: 'discover', status: 'error', message: `Market discovery failed: ${err.message}` };
    return;
  }

  if (markets.length === 0) {
    yield { step: 'discover', status: 'complete', message: 'No open markets found. Competition may not have started.' };
    return;
  }

  // ── Step 3: Sweep settled positions (redeem/liquidate) ────────────────

  yield { step: 'sweep', status: 'running', message: 'Checking for settled positions to redeem...' };

  let swept = { redeemed: 0, liquidated: 0, tokensRecovered: 0 };
  try {
    const positions = await delphiService.listPositions();
    for (const pos of positions) {
      try {
        const result = await delphiService.sweepSettledPosition(
          pos.marketAddress,
          [pos.outcomeIdx]
        );
        if (result.action === 'redeemed') {
          swept.redeemed++;
          swept.tokensRecovered += result.result?.totalTokens || 0;
        } else if (result.action === 'liquidated') {
          swept.liquidated++;
          swept.tokensRecovered += result.result?.totalTokens || 0;
        }
      } catch (err) {
        // Position not yet settled — normal, skip
      }
    }
    yield {
      step: 'sweep',
      status: 'complete',
      data: swept,
      message: swept.redeemed + swept.liquidated > 0
        ? `Recovered ${swept.tokensRecovered.toFixed(2)} tokens from ${swept.redeemed + swept.liquidated} positions`
        : 'No settled positions to sweep',
    };
  } catch (err) {
    yield { step: 'sweep', status: 'error', message: err.message };
  }

  // Refresh balance after sweep
  if (swept.tokensRecovered > 0) {
    balances = await delphiService.getBalances();
  }

  // ── Step 4: Classify and forecast ─────────────────────────────────────

  yield { step: 'forecast', status: 'running', message: `Analyzing ${Math.min(markets.length, opts.maxMarkets)} markets...` };

  const candidates = markets.slice(0, opts.maxMarkets);
  const forecasts = [];

  for (let i = 0; i < candidates.length; i++) {
    const market = candidates[i];

    yield {
      step: 'forecast',
      status: 'running',
      message: `[${i + 1}/${candidates.length}] ${market.question.slice(0, 60)}...`,
      data: { marketId: market.id, category: market.category },
    };

    try {
      // Classify market type and estimate probabilities using intelligence layer
      const classification = classifyMarket(market);
      const probEstimate = await estimateProbabilities(market, classification);

      if (!probEstimate || !probEstimate.probabilities) {
        yield {
          step: 'forecast',
          status: 'skipped',
          message: `No probability estimate for: ${market.question.slice(0, 50)}`,
          data: { marketId: market.id, reason: 'no_estimate' },
        };
        continue;
      }

      // Compute edge per outcome
      const edges = delphiService.computeEdge(market, probEstimate.probabilities);
      const bestEdge = edges.reduce((best, e) => Math.abs(e.edge) > Math.abs(best.edge) ? e : best, edges[0]);

      forecasts.push({
        market,
        classification,
        probEstimate,
        edges,
        bestEdge,
      });
    } catch (err) {
      yield {
        step: 'forecast',
        status: 'error',
        message: `Forecast failed for ${market.question.slice(0, 40)}: ${err.message}`,
        data: { marketId: market.id },
      };
    }
  }

  yield {
    step: 'forecast',
    status: 'complete',
    data: { analyzed: forecasts.length, skipped: candidates.length - forecasts.length },
    message: `Analyzed ${forecasts.length} markets, ${forecasts.filter((f) => Math.abs(f.bestEdge.edge) >= opts.minEdge).length} with actionable edge`,
  };

  // ── Step 5: Size and decide ───────────────────────────────────────────

  yield { step: 'decide', status: 'running', message: 'Applying decision policy...' };

  const decisions = [];

  for (const forecast of forecasts) {
    const { market, bestEdge, probEstimate } = forecast;

    // Only consider outcomes with positive edge (buy signal)
    if (bestEdge.edge < opts.minEdge) continue;

    // Kelly sizing: for LMSR, market odds = price = implied probability
    const kelly = calculateKellySizing(
      bestEdge.yourProb,
      bestEdge.marketProb,
      opts.riskTolerance,
      probEstimate.confidence || 'MEDIUM',
      probEstimate.source || 'llm'
    );

    if (!kelly.actionable) continue;

    // Convert allocation % to share count based on bankroll
    const allocationTokens = balances.tokenBalance * kelly.sizePct;
    const sharesToBuy = Math.min(
      allocationTokens / bestEdge.marketProb, // shares affordable at current price
      opts.maxSharesPerTrade
    );

    if (sharesToBuy < 0.1) continue; // Too small to bother

    // Simulation for the policy gate
    const seed = deriveSimulationSeed([market.id, bestEdge.outcomeIdx, timestamp]);
    const simulation = simulateBinaryMarket({
      probability: bestEdge.yourProb,
      marketOdds: bestEdge.marketProb,
      direction: 'BUY YES', // In LMSR, buying the underpriced outcome
      runs: decisionPolicy.simulationRuns,
      seed,
    });

    // Policy evaluation
    const recommendation = {
      edge: bestEdge.edge,
      sizePct: kelly.sizePct,
      marketOdds: bestEdge.marketProb,
      aiProbability: bestEdge.yourProb,
    };

    const decision = evaluateDecision({
      recommendation,
      simulation,
      policy: decisionPolicy,
    });

    decisions.push({
      market,
      outcomeIdx: bestEdge.outcomeIdx,
      outcomeName: bestEdge.outcome,
      edge: bestEdge.edge,
      yourProb: bestEdge.yourProb,
      marketProb: bestEdge.marketProb,
      kelly,
      sharesToBuy: Math.round(sharesToBuy * 100) / 100,
      simulation,
      decision,
      source: probEstimate.source,
      reasoning: probEstimate.reasoning,
    });
  }

  // Sort by edge descending
  decisions.sort((a, b) => b.edge - a.edge);

  const allocatable = decisions.filter((d) => d.decision.verdict === 'ALLOCATE');
  const passed = decisions.filter((d) => d.decision.verdict !== 'ALLOCATE');

  yield {
    step: 'decide',
    status: 'complete',
    data: {
      total: decisions.length,
      allocate: allocatable.length,
      pass: passed.length,
      topDecisions: allocatable.slice(0, 5).map((d) => ({
        question: d.market.question.slice(0, 60),
        outcome: d.outcomeName,
        edge: d.edge,
        shares: d.sharesToBuy,
        verdict: d.decision.verdict,
      })),
    },
    message: allocatable.length > 0
      ? `${allocatable.length} trades cleared policy (${passed.length} passed)`
      : `All ${decisions.length} candidates passed by policy — no trades this cycle`,
  };

  // ── Step 6: Execute ───────────────────────────────────────────────────

  if (allocatable.length === 0) {
    yield { step: 'execute', status: 'complete', message: 'No trades to execute this cycle.', data: { trades: 0 } };
    // Still emit a summary so the worker status file reflects zero-trade cycles.
    yield {
      step: 'summary',
      status: 'complete',
      data: {
        runId,
        timestamp,
        marketsScanned: markets.length,
        marketsAnalyzed: forecasts.length,
        decisionsEvaluated: decisions.length,
        tradesExecuted: 0,
        tradesFailed: 0,
        tradesDryRun: 0,
        tokensSwept: swept.tokensRecovered,
        totalCost: 0,
        dryRun: opts.dryRun,
      },
    };
    return;
  }

  yield { step: 'execute', status: 'running', message: `Executing ${allocatable.length} trade${allocatable.length > 1 ? 's' : ''}...` };

  const executions = [];

  for (const trade of allocatable) {
    const tradeDesc = `${trade.sharesToBuy} shares of "${trade.outcomeName}" on "${trade.market.question.slice(0, 40)}"`;

    if (opts.dryRun) {
      executions.push({
        market: trade.market.id,
        outcome: trade.outcomeName,
        outcomeIdx: trade.outcomeIdx,
        shares: trade.sharesToBuy,
        edge: trade.edge,
        status: 'dry_run',
        message: `[DRY RUN] Would buy ${tradeDesc}`,
      });
      yield {
        step: 'execute',
        status: 'running',
        message: `[DRY RUN] ${tradeDesc} (edge: ${(trade.edge * 100).toFixed(1)}%)`,
        data: { dryRun: true, market: trade.market.id },
      };
      continue;
    }

    try {
      // Quote first to verify the trade is viable at current prices
      const quote = await delphiService.quoteBuy(
        trade.market.id,
        trade.outcomeIdx,
        trade.sharesToBuy
      );

      // Sanity check: if cost per share moved significantly from expected, skip
      if (quote.pricePerShare > trade.marketProb * 1.5) {
        executions.push({
          market: trade.market.id,
          outcome: trade.outcomeName,
          shares: trade.sharesToBuy,
          status: 'skipped_slippage',
          message: `Price moved too far: ${quote.pricePerShare.toFixed(4)} vs expected ${trade.marketProb.toFixed(4)}`,
        });
        continue;
      }

      // Execute
      const result = await delphiService.buyShares(
        trade.market.id,
        trade.outcomeIdx,
        trade.sharesToBuy,
        { slippagePct: opts.slippagePct }
      );

      executions.push({
        market: trade.market.id,
        question: trade.market.question,
        outcome: trade.outcomeName,
        outcomeIdx: trade.outcomeIdx,
        shares: result.shares,
        cost: result.costTokens,
        edge: trade.edge,
        txHash: result.txHash,
        status: 'executed',
      });

      yield {
        step: 'execute',
        status: 'running',
        message: `Bought ${tradeDesc} for ${result.costTokens.toFixed(4)} TST | tx: ${result.txHash.slice(0, 10)}...`,
        data: { txHash: result.txHash, cost: result.costTokens },
      };
    } catch (err) {
      executions.push({
        market: trade.market.id,
        outcome: trade.outcomeName,
        shares: trade.sharesToBuy,
        status: 'failed',
        error: err.message,
      });

      yield {
        step: 'execute',
        status: 'error',
        message: `Failed: ${tradeDesc} — ${err.message}`,
        data: { market: trade.market.id, error: err.message },
      };
    }
  }

  const executed = executions.filter((e) => e.status === 'executed');
  const failed = executions.filter((e) => e.status === 'failed');
  const dryRuns = executions.filter((e) => e.status === 'dry_run');

  yield {
    step: 'execute',
    status: 'complete',
    data: {
      executed: executed.length,
      failed: failed.length,
      dryRun: dryRuns.length,
      totalCost: executed.reduce((sum, e) => sum + (e.cost || 0), 0),
      executions,
    },
    message: opts.dryRun
      ? `[DRY RUN] ${dryRuns.length} trades simulated`
      : `${executed.length} executed, ${failed.length} failed`,
  };

  // ── Step 7: Summary ───────────────────────────────────────────────────

  yield {
    step: 'summary',
    status: 'complete',
    data: {
      runId,
      timestamp,
      marketsScanned: markets.length,
      marketsAnalyzed: forecasts.length,
      decisionsEvaluated: decisions.length,
      tradesExecuted: executed.length,
      tradesFailed: failed.length,
      tradesDryRun: dryRuns.length,
      tokensSwept: swept.tokensRecovered,
      totalCost: executed.reduce((sum, e) => sum + (e.cost || 0), 0),
      dryRun: opts.dryRun,
    },
  };
}

export default runDelphiAgentLoop;
