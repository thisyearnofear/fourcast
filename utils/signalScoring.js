// Signal Scoring & Quality Metrics
// Calculate signal quality metrics based on odds, confidence, and outcomes

export function calculateOddsImprovement(signal) {
  /**
   * Calculate if the signal identified value vs market consensus
   * This is a placeholder - in production would compare signal's
   * predicted odds vs actual market odds at time of publication
   */
  if (!signal.odds_efficiency) return null;
  
  if (signal.odds_efficiency === 'INEFFICIENT') {
    return { score: 100, label: 'Value Detected', color: 'green' };
  }
  return { score: 50, label: 'Fair Odds', color: 'yellow' };
}

export function calculateSignalQuality(signal) {
  /**
   * Calculate overall signal quality score (0-100)
   * Based on: confidence level, odds efficiency, and outcome
   */
  let score = 50; // Base score

  // Confidence bonus
  if (signal.confidence === 'HIGH') score += 30;
  else if (signal.confidence === 'MEDIUM') score += 15;
  else if (signal.confidence === 'LOW') score += 0;

  // Odds efficiency bonus
  if (signal.odds_efficiency === 'INEFFICIENT') score += 20;

  // Outcome bonus (only if resolved)
  if (signal.outcome === 'YES' || signal.outcome === 'CORRECT') score += 30;
  else if (signal.outcome === 'NO' || signal.outcome === 'INCORRECT') score -= 30;
  // PENDING = no change

  return Math.max(0, Math.min(100, score)); // Clamp to 0-100
}

export function getQualityColor(score, isNight) {
  /**
   * Return color based on quality score
   */
  if (score >= 80) {
    return isNight ? 'text-green-400' : 'text-green-600';
  } else if (score >= 60) {
    return isNight ? 'text-blue-400' : 'text-blue-600';
  } else if (score >= 40) {
    return isNight ? 'text-yellow-400' : 'text-yellow-600';
  } else {
    return isNight ? 'text-red-400' : 'text-red-600';
  }
}

export function getQualityBgColor(score, isNight) {
  /**
   * Return background color based on quality score
   */
  if (score >= 80) {
    return isNight ? 'bg-green-500/20' : 'bg-green-400/20';
  } else if (score >= 60) {
    return isNight ? 'bg-blue-500/20' : 'bg-blue-400/20';
  } else if (score >= 40) {
    return isNight ? 'bg-yellow-500/20' : 'bg-yellow-400/20';
  } else {
    return isNight ? 'bg-red-500/20' : 'bg-red-400/20';
  }
}

export function getQualityLabel(score) {
  /**
   * Return text label for quality score
   */
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

export function getSignalMetrics(signal) {
  /**
   * Return comprehensive signal metrics object
   */
  const quality = calculateSignalQuality(signal);
  const oddsImprovement = calculateOddsImprovement(signal);

  return {
    quality,
    qualityLabel: getQualityLabel(quality),
    oddsImprovement,
    hasOutcome: signal.outcome && signal.outcome !== 'PENDING'
  };
}
