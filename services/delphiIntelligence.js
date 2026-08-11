/**
 * Delphi Intelligence Layer — routes market questions to appropriate
 * intelligence sources and returns probability estimates.
 *
 * Intelligence routing:
 * - Sports markets → TxLINE/TxOdds professional odds (primary), Venice AI (secondary)
 * - Politics/economics → Venice AI reasoning
 * - Crypto/technology → Venice AI + SynthData ML (if available)
 * - Current events → Venice AI with web context
 */

if (typeof window !== 'undefined') {
  throw new Error('delphiIntelligence is server-only');
}

import OpenAI from 'openai';

// ─── Market Classification ──────────────────────────────────────────────────

const SPORTS_KEYWORDS = [
  'win', 'beat', 'score', 'goal', 'match', 'game', 'championship', 'league',
  'premier league', 'mls', 'nfl', 'nba', 'mlb', 'la liga', 'champions league',
  'world cup', 'tournament', 'playoff', 'finals', 'team', 'player',
  'liverpool', 'arsenal', 'manchester', 'chelsea', 'barcelona', 'real madrid',
  'inter miami', 'lafc', 'atlanta united',
];

const CRYPTO_KEYWORDS = [
  'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'price', 'crypto',
  'token', 'defi', 'nft', 'blockchain', 'market cap', 'trading', 'halving',
  'altcoin', 'xrp', 'cardano', 'dogecoin', 'doge', 'bnb',
];

const POLITICS_KEYWORDS = [
  'election', 'president', 'vote', 'poll', 'congress', 'senate', 'party',
  'democrat', 'republican', 'biden', 'trump', 'governor', 'legislation',
  'policy', 'government', 'supreme court', 'fed', 'federal',
];

const ECONOMICS_KEYWORDS = [
  'gdp', 'inflation', 'interest rate', 'unemployment', 'recession', 'fed',
  'federal reserve', 'cpi', 'jobs', 'treasury', 'yield', 'bond', 'stock',
  's&p', 'nasdaq', 'dow', 'trade deficit', 'tariff',
];

/**
 * Classify a Delphi market into a category for intelligence routing.
 * @param {Object} market - Normalized market from delphiService
 * @returns {{ category: string, keywords: string[], confidence: string }}
 */
export function classifyMarket(market) {
  const text = `${market.question} ${market.description}`.toLowerCase();

  // Use the Delphi-provided category as a hint
  const delphiCategory = (market.category || '').toLowerCase();

  // Score each category
  const scores = {
    sports: countMatches(text, SPORTS_KEYWORDS) + (delphiCategory === 'sports' ? 5 : 0),
    crypto: countMatches(text, CRYPTO_KEYWORDS) + (delphiCategory === 'crypto' ? 5 : 0),
    politics: countMatches(text, POLITICS_KEYWORDS) + (delphiCategory === 'politics' ? 5 : 0),
    economics: countMatches(text, ECONOMICS_KEYWORDS) + (delphiCategory === 'economics' ? 5 : 0),
  };

  const topCategory = Object.entries(scores)
    .sort(([, a], [, b]) => b - a)[0];

  const category = topCategory[1] > 0 ? topCategory[0] : 'general';
  const confidence = topCategory[1] >= 5 ? 'HIGH' : topCategory[1] >= 2 ? 'MEDIUM' : 'LOW';

  return { category, score: topCategory[1], confidence };
}

function countMatches(text, keywords) {
  return keywords.filter((kw) => text.includes(kw)).length;
}

// ─── Probability Estimation ─────────────────────────────────────────────────

/**
 * Estimate probabilities for each outcome in a market.
 * Routes to the best available intelligence source based on classification.
 *
 * @param {Object} market - Normalized market from delphiService
 * @param {Object} classification - From classifyMarket()
 * @returns {Promise<{probabilities: number[], confidence: string, source: string, reasoning: string}>}
 */
export async function estimateProbabilities(market, classification) {
  // Route based on category
  switch (classification.category) {
    case 'sports':
      return estimateSportsProbabilities(market, classification);
    case 'crypto':
      return estimateCryptoProbabilities(market, classification);
    case 'politics':
    case 'economics':
    case 'general':
    default:
      return estimateWithVeniceAI(market, classification);
  }
}

// ─── Sports Intelligence (TxLINE + Venice AI) ───────────────────────────────

/**
 * For sports markets, attempt to use TxLINE professional odds as fair-value anchor.
 * Falls back to Venice AI if no TxLINE match is found.
 */
async function estimateSportsProbabilities(market, classification) {
  // Try TxLINE match first
  const txlineEstimate = await matchTxLineOdds(market);
  if (txlineEstimate) {
    return txlineEstimate;
  }

  // Fall back to Venice AI for sports markets without TxLINE coverage
  return estimateWithVeniceAI(market, classification);
}

/**
 * Attempt to match a Delphi sports market to TxLINE odds data.
 * TxLINE provides professional bookmaker consensus — the sharpest odds available.
 */
async function matchTxLineOdds(market) {
  try {
    // Dynamic import to avoid breaking if TxLINE is not configured
    const { txlineService } = await import('./txline/txlineService.js');
    if (!txlineService || !txlineService.isConfigured?.()) {
      return null;
    }

    // Try to find matching fixtures based on market question
    const fixtures = await txlineService.getLiveFixtures?.();
    if (!fixtures || fixtures.length === 0) return null;

    // Simple matching: look for team names in the market question
    const questionLower = market.question.toLowerCase();
    const matchedFixture = fixtures.find((f) => {
      const home = (f.home?.name || f.homeName || '').toLowerCase();
      const away = (f.away?.name || f.awayName || '').toLowerCase();
      return home && away && (questionLower.includes(home) || questionLower.includes(away));
    });

    if (!matchedFixture) return null;

    // Get odds for the matched fixture
    const odds = await txlineService.getLiveOdds?.(matchedFixture.fixtureId || matchedFixture.id);
    if (!odds) return null;

    // Extract consensus probabilities from professional odds
    // TxLINE odds are typically in decimal format: probability = 1/decimal_odds
    const homeProb = odds.homeWin ? 1 / odds.homeWin : null;
    const drawProb = odds.draw ? 1 / odds.draw : null;
    const awayProb = odds.awayWin ? 1 / odds.awayWin : null;

    if (!homeProb && !awayProb) return null;

    // Normalize to sum to 1 (remove bookmaker margin)
    const total = (homeProb || 0) + (drawProb || 0) + (awayProb || 0);
    if (total <= 0) return null;

    // Map to Delphi market outcomes
    const probabilities = market.outcomes.map((outcome) => {
      const outcomeLower = (typeof outcome === 'string' ? outcome : outcome.name || '').toLowerCase();
      const home = (matchedFixture.home?.name || matchedFixture.homeName || '').toLowerCase();
      const away = (matchedFixture.away?.name || matchedFixture.awayName || '').toLowerCase();

      if (outcomeLower.includes(home) || outcomeLower.includes('home')) {
        return (homeProb || 0) / total;
      }
      if (outcomeLower.includes(away) || outcomeLower.includes('away')) {
        return (awayProb || 0) / total;
      }
      if (outcomeLower.includes('draw') || outcomeLower.includes('tie')) {
        return (drawProb || 0) / total;
      }
      // Default: equal split of remaining probability
      return 1 / market.outcomes.length;
    });

    return {
      probabilities,
      confidence: 'HIGH',
      source: 'txline',
      reasoning: `Professional bookmaker consensus (TxLINE): ${matchedFixture.home?.name || matchedFixture.homeName} vs ${matchedFixture.away?.name || matchedFixture.awayName}. Consensus odds normalized to true probabilities.`,
    };
  } catch (err) {
    // TxLINE not available — fall through
    return null;
  }
}

// ─── Crypto Intelligence ────────────────────────────────────────────────────

async function estimateCryptoProbabilities(market, classification) {
  // TODO: integrate SynthData ML models for crypto price forecasting
  // For now, use Venice AI with crypto-specific prompting
  return estimateWithVeniceAI(market, classification);
}

// ─── Venice AI (General Intelligence) ───────────────────────────────────────

const CATEGORY_PROMPTS = {
  sports: `You are a sports analyst with access to professional odds data. Assess match/event probabilities based on team form, head-to-head records, injuries, and market conditions.`,

  crypto: `You are a quantitative crypto analyst. Assess probability based on current price action, technical levels, historical volatility, on-chain metrics, and macro conditions. Be calibrated — extreme moves are less likely than markets sometimes imply.`,

  politics: `You are a political analyst specializing in election forecasting. Assess probability based on polling data, demographic trends, historical precedent, and current political dynamics. Be well-calibrated — incumbency advantage, polling errors, and base rates matter.`,

  economics: `You are a macroeconomic analyst. Assess probability based on leading indicators, central bank policy, historical base rates, and current economic conditions. Consider that economic predictions have wide error bars.`,

  general: `You are a forecasting analyst. Assess probability of real-world events using base rates, current evidence, and calibrated reasoning. Avoid overconfidence — consider historical accuracy of similar predictions.`,
};

/**
 * Use Venice AI to estimate outcome probabilities for a Delphi market.
 * Returns calibrated probability distribution across all outcomes.
 */
async function estimateWithVeniceAI(market, classification) {
  const apiKey = process.env.VENICE_API_KEY;
  if (!apiKey) {
    // Fallback: no intelligence available, return null (skip this market)
    return null;
  }

  const client = new OpenAI({
    apiKey,
    baseURL: 'https://api.venice.ai/api/v1',
  });

  const categoryPrompt = CATEGORY_PROMPTS[classification.category] || CATEGORY_PROMPTS.general;

  const outcomesStr = market.outcomes
    .map((o, i) => `[${i}] "${typeof o === 'string' ? o : o.name || `Outcome ${i}`}" (current price: ${(market.prices[i] || 0).toFixed(4)})`)
    .join('\n');

  try {
    const response = await client.chat.completions.create({
      model: 'llama-3.3-70b',
      messages: [
        {
          role: 'system',
          content: `${categoryPrompt}

You MUST respond with ONLY valid JSON. Your probability estimates must sum to 1.0 across all outcomes. Be calibrated — prefer base rates over narrative. If you are uncertain, your probabilities should reflect that uncertainty (closer to uniform distribution).`,
        },
        {
          role: 'user',
          content: `Prediction market question: "${market.question}"

${market.description ? `Description: ${market.description}\n` : ''}Category: ${classification.category}
Resolves: ${market.resolvesAt || 'Unknown'}

Outcomes and current market prices:
${outcomesStr}

Estimate the TRUE probability of each outcome. Consider:
1. Base rates and historical precedent
2. Current evidence and conditions
3. Time until resolution
4. Whether the market price seems well-calibrated or mispriced

Output ONLY valid JSON:
{
  "probabilities": [0.XX, 0.XX, ...],
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "Brief explanation of your probability estimate and any edge vs market prices"
}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    let content = response.choices[0].message.content.trim();

    // Strip thinking tags if present
    if (content.includes('§THINK_OPEN§')) {
      const thinkEnd = content.lastIndexOf('§THINK_CLOSE§');
      if (thinkEnd !== -1) content = content.substring(thinkEnd + 14).trim();
    }
    // Strip markdown code fences
    if (content.startsWith('```')) {
      content = content.replace(/```json\n?|\n?```/g, '').trim();
    }
    // Extract JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) content = jsonMatch[0];

    const parsed = JSON.parse(content);

    // Validate probabilities sum to ~1
    const probs = parsed.probabilities;
    if (!Array.isArray(probs) || probs.length !== market.outcomes.length) {
      return null;
    }

    const sum = probs.reduce((s, p) => s + p, 0);
    // Normalize if not exactly 1
    const normalized = probs.map((p) => Math.max(0, p) / sum);

    return {
      probabilities: normalized,
      confidence: parsed.confidence || 'LOW',
      source: `venice_ai_${classification.category}`,
      reasoning: parsed.reasoning || null,
    };
  } catch (err) {
    console.error('Venice AI forecast failed:', err.message);
    return null;
  }
}

export default { classifyMarket, estimateProbabilities };
