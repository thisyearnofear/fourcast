/**
 * Delphi Service — wraps @gensyn-ai/gensyn-delphi-sdk for Fourcast agent use.
 *
 * Provides: market discovery, quoting, position tracking, execution, and redemption.
 * Configured for competition-testnet (LMSR markets, winning share pays 1 token).
 *
 * LMSR key difference from Polymarket/Kalshi:
 * - Prices sum to 1 across outcomes (price IS implied probability)
 * - Winning share pays exactly 1 token
 * - Edge = your_probability - market_price (direct EV per share)
 * - Depth is fixed (b parameter); large orders move price hard
 */

if (typeof window !== 'undefined') {
  throw new Error('delphiService is server-only and must not be imported from client components');
}

import { DelphiClient } from '@gensyn-ai/gensyn-delphi-sdk';
import { Wallet as EthersWallet } from 'ethers';

// ─── Configuration ──────────────────────────────────────────────────────────

const DELPHI_NETWORK = process.env.DELPHI_NETWORK || 'competition-testnet';
const DELPHI_API_ACCESS_KEY = process.env.DELPHI_API_ACCESS_KEY;
const DELPHI_COMPETITION_ID = process.env.DELPHI_COMPETITION_ID || undefined;
const SLIPPAGE_PCT = Number(process.env.DELPHI_AGENT_SLIPPAGE_PCT || '2');

// ─── Client Singleton ───────────────────────────────────────────────────────

let _client = null;

function getClient() {
  if (!_client) {
    if (!DELPHI_API_ACCESS_KEY) {
      throw new Error(
        'DELPHI_API_ACCESS_KEY is required. Generate at https://delphi-api-access.gensyn.ai/'
      );
    }
    _client = new DelphiClient({ network: DELPHI_NETWORK });
  }
  return _client;
}

/**
 * Derive the signer wallet address from WALLET_PRIVATE_KEY.
 * Used as the default for API calls that require an explicit wallet param.
 */
let _walletAddress = null;
function getWalletAddress() {
  if (!_walletAddress) {
    const pk = process.env.WALLET_PRIVATE_KEY;
    if (!pk) {
      throw new Error(
        'WALLET_PRIVATE_KEY is required to derive the wallet address (or pass wallet explicitly)'
      );
    }
    _walletAddress = new EthersWallet(pk).address;
  }
  return _walletAddress;
}

// ─── Unit Helpers ───────────────────────────────────────────────────────────

/** Convert human-readable shares to 18-decimal bigint */
export function sharesToBigint(n) {
  return BigInt(Math.round(n * 1e18));
}

/** Convert 18-decimal bigint to human-readable shares */
export function bigintToShares(n) {
  return Number(n) / 1e18;
}

/** Convert human-readable tokens to 6-decimal bigint */
export function tokensToBigint(n) {
  return BigInt(Math.round(n * 1e6));
}

/** Convert 6-decimal bigint to human-readable tokens */
export function bigintToTokens(n) {
  return Number(n) / 1e6;
}

// ─── Market Discovery ───────────────────────────────────────────────────────

/**
 * List open competition markets with prices and implied probabilities.
 * @param {Object} opts
 * @param {string} [opts.status] - 'open' | 'awaiting_settlement' | 'settled' | 'expired'
 * @param {string} [opts.category] - 'crypto' | 'politics' | 'sports' | 'economics' | etc.
 * @param {number} [opts.limit] - Max results (default 50)
 * @param {string} [opts.orderBy] - 'liquidity' | 'created' | 'settles_at'
 * @returns {Promise<Array>} Normalized market objects
 */
export async function listMarkets(opts = {}) {
  const client = getClient();
  const {
    status = 'open',
    category,
    limit = 50,
    orderBy = 'liquidity',
  } = opts;

  const params = {
    status,
    limit,
    orderBy,
    pricesAndImpliedProbabilities: true,
  };
  if (category) params.category = category;
  if (DELPHI_COMPETITION_ID) params.competitionId = DELPHI_COMPETITION_ID;

  const { markets } = await client.listMarkets(params);
  return (markets || []).map(normalizeMarket);
}

/**
 * Get a single market by address with live prices.
 * @param {string} marketAddress
 * @returns {Promise<Object>} Normalized market
 */
export async function getMarket(marketAddress) {
  const client = getClient();
  const params = { id: marketAddress, pricesAndImpliedProbabilities: true };
  if (DELPHI_COMPETITION_ID) params.competitionId = DELPHI_COMPETITION_ID;

  const market = await client.getMarket(params);
  return normalizeMarket(market);
}

/**
 * Normalize raw SDK market into a consistent shape for the agent.
 */
function normalizeMarket(market) {
  const meta = market.metadata || {};
  return {
    id: market.id, // market address — use for all SDK calls
    appMarketId: market.appMarketId,
    url: market.marketUrl,
    question: meta.question || meta.title || 'Unknown',
    description: meta.description || '',
    category: market.category || 'miscellaneous',
    outcomes: meta.outcomes || [],
    status: market.status || 'open',
    resolvesAt: market.resolvesAt,
    settlesAt: market.settlesAt,
    // LMSR: prices ARE implied probabilities (sum to 1)
    prices: market.spotPrices || [],
    impliedProbabilities: market.spotImpliedProbabilities || [],
    tradingFee: market.tradingFee
      ? Number(market.tradingFee) / 1e18
      : 0,
    winningOutcomeIdx: market.winningOutcomeIdx ?? null,
    verifiable: market.verifiable || false,
    raw: market,
  };
}

// ─── Quoting ────────────────────────────────────────────────────────────────

/**
 * Quote a buy — how much it costs to acquire `shares` of outcome `outcomeIdx`.
 * @param {string} marketAddress
 * @param {number} outcomeIdx
 * @param {number} shares - Human-readable number of shares
 * @returns {Promise<{costTokens: number, costBigint: bigint, pricePerShare: number}>}
 */
export async function quoteBuy(marketAddress, outcomeIdx, shares) {
  const client = getClient();
  const sharesOut = sharesToBigint(shares);

  const { tokensIn } = await client.quoteBuy({
    marketAddress,
    outcomeIdx,
    sharesOut,
  });

  const costTokens = bigintToTokens(tokensIn);
  return {
    costTokens,
    costBigint: tokensIn,
    pricePerShare: costTokens / shares,
  };
}

/**
 * Quote a sell — how much you receive for selling `shares` of outcome.
 * @param {string} marketAddress
 * @param {number} outcomeIdx
 * @param {number} shares
 * @returns {Promise<{payoutTokens: number, payoutBigint: bigint}>}
 */
export async function quoteSell(marketAddress, outcomeIdx, shares) {
  const client = getClient();
  const sharesIn = sharesToBigint(shares);

  const { tokensOut } = await client.quoteSell({
    marketAddress,
    outcomeIdx,
    sharesIn,
  });

  return {
    payoutTokens: bigintToTokens(tokensOut),
    payoutBigint: tokensOut,
  };
}

// ─── Execution ──────────────────────────────────────────────────────────────

/**
 * Buy shares in a market outcome.
 * Handles token approval and slippage automatically.
 *
 * @param {string} marketAddress
 * @param {number} outcomeIdx
 * @param {number} shares - Human-readable shares to buy
 * @param {Object} [opts]
 * @param {number} [opts.slippagePct] - Max slippage percent (default from env)
 * @returns {Promise<{txHash: string, costTokens: number, shares: number}>}
 */
export async function buyShares(marketAddress, outcomeIdx, shares, opts = {}) {
  const client = getClient();
  const slippagePct = opts.slippagePct ?? SLIPPAGE_PCT;
  const sharesOut = sharesToBigint(shares);

  // 1. Quote
  const { tokensIn } = await client.quoteBuy({
    marketAddress,
    outcomeIdx,
    sharesOut,
  });

  // 2. Apply slippage cap
  const maxTokensIn = tokensIn * BigInt(100 + slippagePct) / 100n;

  // 3. Ensure approval (approve maxTokensIn so the buy doesn't revert on price move)
  await client.ensureTokenApproval({
    marketAddress,
    minimumAmount: maxTokensIn,
  });

  // 4. Execute buy
  const { transactionHash } = await client.buyShares({
    marketAddress,
    outcomeIdx,
    sharesOut,
    maxTokensIn,
  });

  return {
    txHash: transactionHash,
    costTokens: bigintToTokens(tokensIn),
    shares,
  };
}

/**
 * Sell shares in a market outcome.
 *
 * @param {string} marketAddress
 * @param {number} outcomeIdx
 * @param {number} shares
 * @param {Object} [opts]
 * @param {number} [opts.slippagePct]
 * @returns {Promise<{txHash: string, payoutTokens: number, shares: number}>}
 */
export async function sellShares(marketAddress, outcomeIdx, shares, opts = {}) {
  const client = getClient();
  const slippagePct = opts.slippagePct ?? SLIPPAGE_PCT;
  const sharesIn = sharesToBigint(shares);

  // 1. Quote
  const { tokensOut } = await client.quoteSell({
    marketAddress,
    outcomeIdx,
    sharesIn,
  });

  // 2. Apply slippage floor
  const minTokensOut = tokensOut * BigInt(100 - slippagePct) / 100n;

  // 3. Execute sell
  const { transactionHash } = await client.sellShares({
    marketAddress,
    outcomeIdx,
    sharesIn,
    minTokensOut,
  });

  return {
    txHash: transactionHash,
    payoutTokens: bigintToTokens(tokensOut),
    shares,
  };
}

// ─── Position Tracking ──────────────────────────────────────────────────────

/**
 * List all active positions for the configured wallet.
 * @param {string} [wallet] - Wallet address (defaults to signer)
 * @returns {Promise<Array>} Active positions with non-zero shares
 */
export async function listPositions(wallet) {
  const client = getClient();
  // The /positions API rejects a missing wallet — default to the signer address.
  const params = {
    redeemedOrLiquidated: false,
    limit: 100,
    wallet: wallet || getWalletAddress(),
  };

  const { positions } = await client.listPositions(params);

  return (positions || [])
    .filter((p) => BigInt(p.shares) > 0n)
    .map((p) => ({
      marketAddress: p.marketProxy,
      outcomeIdx: Number(p.outcomeIdx),
      shares: Number(BigInt(p.shares)) / 1e18,
      sharesBigint: BigInt(p.shares),
      raw: p,
    }));
}

/**
 * Get wallet balances (ETH for gas + competition token).
 * @returns {Promise<{ethBalance: number, tokenBalance: number, tokenSymbol: string}>}
 */
export async function getBalances() {
  const client = getClient();

  const ethBalance = await client.getEthBalance();
  const { balance, decimals } = await client.getErc20BalanceWithDecimals();

  return {
    ethBalance: Number(ethBalance) / 1e18,
    tokenBalance: Number(balance) / 10 ** decimals,
    tokenSymbol: DELPHI_NETWORK === 'competition-testnet' ? 'TST' : 'USDC',
  };
}

// ─── Redemption & Liquidation ───────────────────────────────────────────────

/**
 * Redeem winning positions from settled markets.
 * @param {string[]} marketAddresses
 * @returns {Promise<{results: Array, totalTokens: number}>}
 */
export async function redeemPositions(marketAddresses) {
  const client = getClient();

  const { results, totalTokensOut } = await client.redeemPositions({
    marketAddresses,
  });

  return {
    results: results.map((r) => ({
      marketAddress: r.marketAddress,
      success: r.success,
      tokensOut: r.tokensOut ? bigintToTokens(r.tokensOut) : 0,
      error: r.error || null,
    })),
    totalTokens: bigintToTokens(totalTokensOut || 0n),
  };
}

/**
 * Liquidate positions in expired/failed markets.
 * @param {string} marketAddress
 * @param {number[]} outcomeIndices
 * @returns {Promise<{txHash: string, totalTokens: number}>}
 */
export async function liquidatePosition(marketAddress, outcomeIndices) {
  const client = getClient();

  const { transactionHash, totalTokensOut } = await client.liquidate({
    marketAddress,
    outcomeIndices,
  });

  return {
    txHash: transactionHash,
    totalTokens: bigintToTokens(totalTokensOut),
  };
}

// ─── Market Status ──────────────────────────────────────────────────────────

/**
 * Check if a market is in a redeemable/liquidatable state and act accordingly.
 * @param {string} marketAddress
 * @param {number[]} heldOutcomeIndices
 * @returns {Promise<{action: string, result?: Object}>}
 */
export async function sweepSettledPosition(marketAddress, heldOutcomeIndices) {
  const market = await getMarket(marketAddress);

  if (market.status === 'settled') {
    const result = await redeemPositions([marketAddress]);
    return { action: 'redeemed', result };
  }

  if (market.status === 'expired' || market.status === 'failed') {
    const result = await liquidatePosition(marketAddress, heldOutcomeIndices);
    return { action: 'liquidated', result };
  }

  return { action: 'none', reason: `Market status: ${market.status}` };
}

/**
 * Sweep ALL settleable positions: redeem every settled market and liquidate
 * every expired/failed one. Returns aggregate totals plus the still-open
 * positions (those that can't be recovered until they resolve).
 *
 * @returns {Promise<{redeemed: number, liquidated: number, tokensRecovered: number,
 *   open: Array<{marketAddress, outcomeIdx, shares, status}>}>}
 */
export async function sweepAllSettled() {
  const positions = await listPositions();
  const agg = { redeemed: 0, liquidated: 0, tokensRecovered: 0, open: [] };

  for (const p of positions) {
    const held = [p.outcomeIdx];
    try {
      const market = await getMarket(p.marketAddress);
      if (market.status === 'settled') {
        const result = await redeemPositions([p.marketAddress]);
        agg.redeemed++;
        agg.tokensRecovered += result.totalTokens || 0;
        continue;
      }
      if (market.status === 'expired' || market.status === 'failed') {
        const result = await liquidatePosition(p.marketAddress, held);
        agg.liquidated++;
        agg.tokensRecovered += result.totalTokens || 0;
        continue;
      }
    } catch {
      // keep going — a single unreadable market shouldn't block the sweep
    }
    agg.open.push({
      marketAddress: p.marketAddress,
      outcomeIdx: p.outcomeIdx,
      shares: Number(p.shares ?? p.outcomeShares ?? 0),
    });
  }

  return agg;
}

/**
 * Deployable capital snapshot for a wave: cash balance now, plus what's tied
 * up in positions that are still OPEN (not recoverable until they resolve).
 * READ-ONLY — does not send any transaction.
 *
 * @returns {Promise<{cash: number, symbol: string, openShares: number,
 *   openMarkets: number, openPositions: Array<{marketAddress, outcomeIdx, shares}>}>}
 */
export async function getDeployableCapital() {
  const [balances, positions] = await Promise.all([getBalances(), listPositions()]);
  const open = positions.map((p) => ({
    marketAddress: p.marketAddress,
    outcomeIdx: p.outcomeIdx,
    shares: Number(p.shares ?? p.outcomeShares ?? 0),
  }));
  return {
    cash: balances.tokenBalance,
    symbol: balances.tokenSymbol || 'TST',
    openMarkets: open.length,
    openShares: open.reduce((s, p) => s + (p.shares || 0), 0),
    openPositions: open,
  };
}

// ─── Edge Computation ───────────────────────────────────────────────────────

/**
 * Compute edge for each outcome in a market.
 * Edge = yourProbability - marketImpliedProbability
 * In LMSR, edge IS expected profit per share (winning share pays 1).
 *
 * @param {Object} market - Normalized market from listMarkets/getMarket
 * @param {number[]} yourProbabilities - Your probability estimates per outcome (sum to 1)
 * @returns {Array<{outcomeIdx: number, outcome: string, marketProb: number, yourProb: number, edge: number}>}
 */
export function computeEdge(market, yourProbabilities) {
  return market.outcomes.map((outcome, idx) => ({
    outcomeIdx: idx,
    outcome: typeof outcome === 'string' ? outcome : outcome.name || `Outcome ${idx}`,
    marketProb: market.impliedProbabilities[idx] || 0,
    yourProb: yourProbabilities[idx] || 0,
    edge: (yourProbabilities[idx] || 0) - (market.impliedProbabilities[idx] || 0),
  }));
}

// ─── Export Service Object ──────────────────────────────────────────────────

export const delphiService = {
  listMarkets,
  getMarket,
  quoteBuy,
  quoteSell,
  buyShares,
  sellShares,
  listPositions,
  getBalances,
  redeemPositions,
  liquidatePosition,
  sweepSettledPosition,
  sweepAllSettled,
  getDeployableCapital,
  computeEdge,
  // Helpers
  sharesToBigint,
  bigintToShares,
  tokensToBigint,
  bigintToTokens,
  // Config
  get network() { return DELPHI_NETWORK; },
  get competitionId() { return DELPHI_COMPETITION_ID; },
};

export default delphiService;
