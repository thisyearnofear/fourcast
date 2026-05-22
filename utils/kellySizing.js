/**
 * Kelly Criterion Position Sizing
 *
 * Pure math — no server dependencies, safe for client-side import.
 *
 * Calculates position sizing using the calibrated fractional Kelly Criterion,
 * factoring in AI probability, market odds, confidence level, and risk tolerance.
 * Capped at 25% portfolio size.
 *
 * @param {number} aiProb - The estimated AI probability (0 to 1)
 * @param {number} marketYesOdds - The current market YES price (0 to 1)
 * @param {number} [riskTolerance] - Fractional Kelly scaling parameter (0 to 1, default 0.5)
 * @param {string} [confidence] - AI confidence: 'HIGH', 'MEDIUM', 'LOW' (default 'LOW')
 * @param {string} [source] - Forecast source (default 'llm')
 * @returns {{ sizePct: number, kellyPct: number, edge: number, direction: string, actionable: boolean }}
 */
export function calculateKellySizing(
  aiProb,
  marketYesOdds,
  riskTolerance = 0.5,
  confidence = "LOW",
  source = "llm"
) {
  if (
    aiProb == null ||
    marketYesOdds == null ||
    marketYesOdds <= 0 ||
    marketYesOdds >= 1
  ) {
    return {
      sizePct: 0,
      kellyPct: 0,
      edge: 0,
      direction: "NO TRADE",
      actionable: false,
    };
  }

  const edge = aiProb - marketYesOdds;
  const absEdge = Math.abs(edge);

  // Edge threshold for trade actionability is 5%
  const actionable = absEdge > 0.05;
  const direction = edge > 0 ? "BUY YES" : "BUY NO";

  if (!actionable) {
    return {
      sizePct: 0,
      kellyPct: 0,
      edge,
      direction: "NO TRADE",
      actionable: false,
    };
  }

  // Define probability and odds for the trade direction
  let p, odds;
  if (direction === "BUY YES") {
    p = aiProb;
    odds = marketYesOdds;
  } else {
    p = 1 - aiProb;
    odds = 1 - marketYesOdds;
  }

  // Net odds: b = (1 - price) / price
  const b = (1 - odds) / odds;
  if (b <= 0) {
    return { sizePct: 0, kellyPct: 0, edge, direction, actionable: true };
  }

  const q = 1 - p;
  // Standard Kelly Formula: f* = (p * b - q) / b
  const kellyPct = (p * b - q) / b;

  if (kellyPct <= 0) {
    return { sizePct: 0, kellyPct: 0, edge, direction, actionable: true };
  }

  // Calibrate based on AI Confidence Level
  let confidenceMultiplier = 0.25; // LOW confidence
  if (confidence === "HIGH") {
    confidenceMultiplier = 1.0;
  } else if (confidence === "MEDIUM") {
    confidenceMultiplier = 0.5;
  }

  // SynthData ML models get a slight credibility boost
  if (source && source.includes("synthdata")) {
    confidenceMultiplier = Math.min(1.0, confidenceMultiplier * 1.2);
  }

  // Fractional Kelly factor: scaled by riskTolerance and confidence multiplier
  const fractionalKelly =
    kellyPct * (riskTolerance * 0.25) * confidenceMultiplier;

  // Cap size at 25% (0.25) to prevent over-allocation
  const sizePct = Math.min(0.25, Math.round(fractionalKelly * 100) / 100);

  return {
    sizePct,
    kellyPct: Math.round(kellyPct * 1000) / 1000,
    edge: Math.round(edge * 1000) / 1000,
    direction,
    actionable: sizePct > 0,
  };
}
