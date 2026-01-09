import { EdgeAnalyzer } from './EdgeAnalyzer.js';
import { movePublisher } from '../movePublisher.js';

/**
 * On-Chain Network Analyzer
 * Analyzes Movement/Aptos network conditions (Gas, TPS, Congestion)
 * to predict network-related outcomes (e.g., "Will gas > 100 gwei?")
 */
export class OnChainAnalyzer extends EdgeAnalyzer {
  constructor() {
    super({
      name: 'OnChainAnalyzer',
      version: '1.0.0',
      model: 'llama-3.3-70b'
    });
  }

  /**
   * Enrich context with live chain data
   */
  async enrichContext(context) {
    // 1. Fetch Chain Stats (Real data via Aptos SDK)
    const chainStats = await movePublisher.getNetworkStats();

    // Fallback if network is down
    const finalStats = chainStats || await this.fetchSimulatedStats();

    return {
      ...context,
      chainStats: finalStats,
      chainHash: this.generateHash(finalStats)
    };
  }

  /**
   * Construct an on-chain specific prompt
   */
  constructPrompt(context) {
    const { title, chainStats, currentOdds } = context;

    return `
      Analyze this prediction market based on current blockchain network conditions:
      Market: "${title}"
      Current Odds: Yes ${currentOdds?.yes || 0.5} | No ${currentOdds?.no || 0.5}
      
      Network Status (Movement M1):
      - Gas Price: ${chainStats.gasPrice} octas
      - Block Height: ${chainStats.blockHeight}
      - Congestion Level: ${chainStats.congestion}
      - Chain ID: ${chainStats.chainID || 'N/A'}
      
      Do these metrics suggest the outcome is likely?
      (e.g., if market is "Gas > 500", and current is 100 with low congestion -> NO)
      
      Provide:
      1. Confidence (HIGH/MEDIUM/LOW)
      2. Odds Efficiency (INEFFICIENT/EFFICIENT)
      3. Brief Digest (max 200 chars)
    `;
  }

  /**
   * Fallback for simulated data if network call fails
   */
  async fetchSimulatedStats() {
    return {
      gasPrice: 100,
      tps: 120,
      blockHeight: 12000000,
      congestion: "LOW",
      timestamp: Date.now(),
      isSimulated: true
    };
  }
}
