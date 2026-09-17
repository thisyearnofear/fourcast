/**
 * Kelly Criterion Position Sizing
 *
 * Pure math — no server dependencies, safe for client-side import.
 *
 * Calculates position sizing using the calibrated fractional Kelly Criterion,
 * factoring in AI probability, market odds, confidence level, and risk tolerance.
 * Capped at 25% portfolio size.
 *
 * When the optional `bucketCalibration` parameter is supplied (a record like
 * `{ HIGH: 0.82, MEDIUM: 0.55 }`), the confidence multiplier is shrunk by the
 * ratio of observed hit-rate to nominal hit-rate for that bucket. An agent
 * that calls itself HIGH-confidence but only hits 65% of the time will have
 * its HIGH confidence multiplier reduced accordingly:
 *
 *   shrinkFactor = clamp(observedHitRate / nominalHitRate, 0.25, 1.5)
 *
 * Nominal hit-rates: LOW ≈ 0.35, MEDIUM ≈ 0.55, HIGH ≈ 0.75. LOW confidence
 * has the widest allowable band because it carries the smallest base sizing
 * and the fewest expected resolutions.
 *
 * @param {number} aiProb - The estimated AI probability (0 to 1)
 * @param {number} marketYesOdds - The current market YES price (0 to 1)
 * @param {number} [riskTolerance] - Fractional Kelly scaling parameter (0 to 1, default 0.5)
 * @param {string} [confidence] - AI confidence: 'HIGH', 'MEDIUM', 'LOW' (default 'LOW')
 * @param {string} [source] - Forecast source (default 'llm')
 * @param {number} [minEdge] - Minimum edge required for actionability (default 0.05)
 * @param {Object<string, number>} [bucketCalibration] - Optional map of bucket name → observed hit rate
 * @returns {{ sizePct: number, kellyPct: number, edge: number, direction: string, actionable: boolean, calibrationFactor?: number }}
 */
export function calculateKellySizing(
  aiProb,
  marketYesOdds,
  riskTolerance = 0.5,
  confidence = "LOW",
  source = "llm",
  minEdge = 0.05,
  bucketCalibration = null
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

  // Edge threshold for trade actionability (default 5%; callers like the
  // Delphi agent loop pass their own minEdge through)
  const actionable = absEdge > minEdge;
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
  let nominalHitRate = 0.35;
  if (confidence === "HIGH") {
    confidenceMultiplier = 1.0;
    nominalHitRate = 0.75;
  } else if (confidence === "MEDIUM") {
    confidenceMultiplier = 0.5;
    nominalHitRate = 0.55;
  }

  // SynthData ML models get a slight credibility boost
  if (source && source.includes("synthdata")) {
    confidenceMultiplier = Math.min(1.0, confidenceMultiplier * 1.2);
  }

  // Phase 2: calibration-driven shrinkage. If we have observed hit rates for
  // this confidence bucket, scale the multiplier by how (under|over)confident
  // the model actually is. Cap the shrink between 0.25× (worst case: model
  // is performing far below expectation) and 1.5× (model beats its own
  // nominal band — still capped to keep sizing honest).
  let calibrationFactor = null;
  if (bucketCalibration && nominalHitRate > 0) {
    const observed = Number(bucketCalibration[confidence]);
    if (Number.isFinite(observed) && observed >= 0) {
      const raw = observed / nominalHitRate;
      calibrationFactor = Math.max(0.25, Math.min(1.5, raw));
      confidenceMultiplier = Math.max(0, confidenceMultiplier * calibrationFactor);
    }
  }

  // Fractional Kelly factor: scaled by riskTolerance and confidence multiplier.
  // riskTolerance is already a (0,1] fraction; the extra * 0.25 was a double-penalty
  // that caused even HIGH-confidence trades to size at ~3% of full Kelly.
  const fractionalKelly = kellyPct * riskTolerance * confidenceMultiplier;

  // Cap size at 25% (0.25) to prevent over-allocation
  const sizePct = Math.min(0.25, Math.round(fractionalKelly * 100) / 100);

  return {
    sizePct,
    kellyPct: Math.round(kellyPct * 1000) / 1000,
    edge: Math.round(edge * 1000) / 1000,
    direction,
    actionable: sizePct > 0,
    ...(calibrationFactor != null ? { calibrationFactor: Math.round(calibrationFactor * 1000) / 1000 } : {}),
  };
}
