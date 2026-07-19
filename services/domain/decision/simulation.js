/** Deterministic binary-market Monte Carlo summaries for decision receipts. */

export function deriveSimulationSeed(parts) {
  const value = Array.isArray(parts) ? parts.join('|') : String(parts || 'fourcast');
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function simulateBinaryMarket({ probability, marketOdds, direction, runs = 10_000, seed }) {
  const fairProbability = Number(probability);
  const yesPrice = Number(marketOdds);
  const totalRuns = Math.max(100, Math.min(Math.floor(Number(runs) || 0), 100_000));
  const normalizedSeed = Number.isInteger(seed) ? seed >>> 0 : deriveSimulationSeed(`${probability}|${marketOdds}|${direction}`);

  if (!Number.isFinite(fairProbability) || !Number.isFinite(yesPrice) || fairProbability <= 0 || fairProbability >= 1 || yesPrice <= 0 || yesPrice >= 1) {
    return {
      runs: totalRuns,
      seed: normalizedSeed,
      direction,
      valid: false,
      lossProbability: 1,
      expectedReturn: null,
      interval: null,
    };
  }

  const isYes = direction !== 'BUY NO';
  const winProbability = isYes ? fairProbability : 1 - fairProbability;
  const entryPrice = isYes ? yesPrice : 1 - yesPrice;
  const winReturn = (1 - entryPrice) / entryPrice;
  const random = mulberry32(normalizedSeed);
  let wins = 0;
  let totalReturn = 0;
  const samples = [];

  for (let index = 0; index < totalRuns; index += 1) {
    const result = random() < winProbability ? winReturn : -1;
    if (result > 0) wins += 1;
    totalReturn += result;
    samples.push(result);
  }

  samples.sort((a, b) => a - b);
  return {
    runs: totalRuns,
    seed: normalizedSeed,
    direction,
    valid: true,
    winProbability: round(wins / totalRuns),
    lossProbability: round(1 - wins / totalRuns),
    expectedReturn: round(totalReturn / totalRuns),
    interval: {
      p05: round(percentile(samples, 0.05)),
      p50: round(percentile(samples, 0.5)),
      p95: round(percentile(samples, 0.95)),
    },
  };
}

function mulberry32(seed) {
  let state = seed;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function percentile(values, percentileValue) {
  return values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * percentileValue)))];
}

function round(value) {
  return Math.round(value * 1_000_000) / 1_000_000;
}
