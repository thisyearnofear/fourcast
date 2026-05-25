/**
 * Chain recommendation copy for market analysis UI.
 * Connection/publish logic lives in useChainConnections + useSignalPublisher.
 */

export function getRecommendationExplanation(chainRec, confidence, oddsEfficiency) {
  const explanations = {
    PUBLISH: {
      title: 'Build Your Track Record',
      reason: 'Your analysis demonstrates high confidence. Publishing creates an immutable record that establishes credibility.',
      benefit: 'Earn community validation and future monetization opportunities',
    },
    TRADE: {
      title: 'Capture Market Inefficiency',
      reason: `The market shows ${oddsEfficiency === 'UNDERPRICED' ? 'underpriced' : 'overpriced'} odds. This is an opportunity to position accordingly.`,
      benefit: 'Profit from temporary market mispricings',
    },
    BOTH: {
      title: 'Dual Strategy',
      reason: 'Your high-confidence analysis combined with market inefficiency creates both track record AND trading opportunity.',
      benefit: 'Establish credibility while capturing value',
    },
  };

  return explanations[chainRec] || explanations.BOTH;
}
