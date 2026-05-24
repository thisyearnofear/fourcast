/**
 * Chain Utilities - Wallet validation and chain guidance
 * Provides context-aware messaging and state checking
 * 
 * Works with unified chain state from useChainConnections
 */

import { CHAINS } from '@/constants/appConstants';

/**
 * Determine if user can take a specific action on a chain
 * Updated to work with unified chains object
 * 
 * @param {Object} chainState - chains.evm | chains.aptos | chains.movement
 * @param {string} action - 'trade' | 'publish' | 'publish_and_monetize'
 * @param {boolean} isCorrectChain - For EVM: is on correct chain ID
 */
export function canPerformAction(chainState, action, isCorrectChain = true) {
  if (!chainState?.connected) return false;
  
  // EVM requires correct chain (Polygon)
  if (chainState.id === 'evm') {
    return isCorrectChain && action === 'trade';
  }
  
  // Aptos can publish signals
  if (chainState.id === 'aptos') {
    return action === 'publish';
  }
  
  // Movement can publish and monetize
  if (chainState.id === 'movement') {
    return action === 'publish' || action === 'publish_and_monetize';
  }
  
  return false;
}

/**
 * Get action guidance based on chain connection state
 * Returns structured guidance object for UI rendering
 * 
 * @param {Object} chainDef - From CHAINS constants (id, name, display, etc)
 * @param {Object} chainState - From useChainConnections (connected, address, etc)
 * @returns { canAct, message, actionText, state }
 */
export function getChainActionGuidance(chainDef, chainState) {
  if (!chainState?.connected) {
    return {
      canAct: false,
      message: `Connect your ${chainDef.name} wallet to ${chainDef.purpose.toLowerCase()}`,
      actionText: `Connect ${chainDef.name}`,
      state: 'disconnected'
    };
  }

  // Movement is premium - highlight monetization
  if (chainDef.id === 'movement') {
    return {
      canAct: true,
      message: `Ready to publish signals and earn tips on ${chainDef.name}. Build your track record while monetizing your insights.`,
      actionText: `Publish & Monetize`,
      state: 'connected-premium'
    };
  }

  // Aptos is standard signals
  if (chainDef.id === 'aptos') {
    return {
      canAct: true,
      message: `Ready to publish signals on ${chainDef.name}. Create an immutable track record of your predictions.`,
      actionText: `Publish Signal`,
      state: 'connected'
    };
  }

  // EVM for trading
  if (chainDef.id === 'evm') {
    return {
      canAct: true,
      message: `Ready to trade on ${chainDef.name}. Place orders based on market analysis.`,
      actionText: `Place Order`,
      state: 'connected'
    };
  }

  return {
    canAct: false,
    message: `Connect your wallet to interact with ${chainDef.name}`,
    actionText: `Connect Wallet`,
    state: 'error'
  };
}

/**
 * Get recommendation explanation based on chain recommendation
 * Explains WHY a particular action was recommended
 */
export function getRecommendationExplanation(chainRec, confidence, oddsEfficiency) {
  const explanations = {
    PUBLISH: {
      title: 'Build Your Track Record',
      reason: 'Your analysis demonstrates high confidence. Publishing creates an immutable record that establishes credibility.',
      benefit: 'Earn community validation and future monetization opportunities'
    },
    TRADE: {
      title: 'Capture Market Inefficiency',
      reason: `The market shows ${oddsEfficiency === 'UNDERPRICED' ? 'underpriced' : 'overpriced'} odds. This is an opportunity to position accordingly.`,
      benefit: 'Profit from temporary market mispricings'
    },
    BOTH: {
      title: 'Dual Strategy',
      reason: 'Your high-confidence analysis combined with market inefficiency creates both track record AND trading opportunity.',
      benefit: 'Establish credibility while capturing value'
    }
  };

  return explanations[chainRec] || explanations.BOTH;
}

/**
 * Format chain-specific messages based on user context
 */
export function formatChainMessage(chain, context = {}) {
  const { confidence, oddsEfficiency, marketVolume } = context;

  if (chain.id === 'movement') {
    return {
      headline: '💎 Earn While You Predict',
      description: 'Publish your signal on Movement and let the community tip you for your insights. Build wealth through reputation.',
      cta: 'Publish & Monetize'
    };
  }

  if (chain.id === 'aptos') {
    return {
      headline: '📡 Build Your Reputation',
      description: 'Create an immutable on-chain record of your predictions. Your track record is your credential.',
      cta: 'Publish Signal'
    };
  }

  if (chain.id === 'evm') {
    return {
      headline: '📊 Play the Odds',
      description: marketVolume > 100000 
        ? 'Market has strong liquidity. Execute your analysis and capture the opportunity.'
        : 'Participate in the market based on your conviction level.',
      cta: 'Place Order'
    };
  }

  return {
    headline: 'Connect Wallet',
    description: `Connect to ${chain.name} to access ${chain.purpose.toLowerCase()}`,
    cta: `Connect ${chain.name}`
  };
}
