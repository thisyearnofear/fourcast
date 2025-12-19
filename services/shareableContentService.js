/**
 * Shareable Content Service
 * 
 * Generates embeddable cards for X and Farcaster from signals
 * 
 * Movement M1 Hackathon alignment:
 * - On-chain reputation signals can be shared
 * - Social proof builds network effects
 * - Drives virality through "takes" culture
 */

/**
 * Generate shareable card data for a signal
 * Returns structured data suitable for OG cards
 */
export function generateShareCard(signal, userStats) {
  const confidence = signal.confidence || 'moderate';
  const confidenceLevel = getConfidenceLevel(confidence);

  return {
    title: `${signal.side === 'YES' ? '✓' : '✗'} ${signal.marketTitle}`,
    description: signal.aiDigest || signal.reasoning || 'Weather-based prediction',
    confidence: confidence,
    confidenceEmoji: confidenceLevel.emoji,
    author: signal.authorAddress,
    timestamp: signal.timestamp,
    outcome: signal.outcome,
    venue: signal.venue,
    accuracy: userStats?.accuracyPercent || 0,
    tier: userStats?.tier,
    shareText: generateShareText(signal, userStats),
    urls: {
      x: generateXUrl(signal, userStats),
      farcaster: generateFarcasterUrl(signal, userStats),
    },
  };
}

/**
 * Generate X/Twitter share URL
 */
export function generateXUrl(signal, userStats) {
  const text = generateXShareText(signal, userStats);
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

/**
 * Generate X/Twitter share text
 */
export function generateXShareText(signal, userStats) {
  const tier = userStats?.tier?.emoji || '📊';
  const accuracy = userStats?.accuracyPercent || 0;
  const confidence = signal.confidence || 'moderate';

  let text = `I'm predicting ${signal.side.toUpperCase()} on "${signal.marketTitle}"\n\n`;
  text += `📍 ${signal.venue || 'Location'}\n`;
  text += `💡 ${signal.aiDigest?.substring(0, 120) || 'Weather-based analysis'}\n\n`;
  text += `${tier} ${userStats?.tier?.name || 'Forecaster'} | ${accuracy}% accuracy\n`;
  text += `Using @fourcast to forecast market outcomes 🌤️ #predictions`;

  return text;
}

/**
 * Generate Farcaster share URL + text
 * Uses embed protocol if available
 */
export function generateFarcasterUrl(signal, userStats) {
  const text = generateFarcasterShareText(signal, userStats);
  return `https://warpcast.com/compose?text=${encodeURIComponent(text)}`;
}

/**
 * Generate Farcaster share text
 * Emphasizes "takes" and reputation building
 */
export function generateFarcasterShareText(signal, userStats) {
  const tier = userStats?.tier?.emoji || '📊';
  const accuracy = userStats?.accuracyPercent || 0;

  let text = `${tier} Hot take: ${signal.side.toUpperCase()} on "${signal.marketTitle}"\n\n`;
  text += `Why: ${signal.aiDigest?.substring(0, 200) || 'Weather conditions indicate...'}\n\n`;
  text += `Building my forecaster rep on-chain. ${accuracy}% accuracy so far.\n`;
  text += `Powered by weather science + @fourcast 🌤️`;

  return text;
}

/**
 * Generate OG meta tags for embedding
 * Used for link previews
 */
export function generateOGMeta(signal, userStats) {
  const shareCard = generateShareCard(signal, userStats);
  const tier = userStats?.tier?.name || 'Forecaster';
  const accuracy = userStats?.accuracyPercent || 0;

  return {
    'og:title': `${shareCard.confidenceEmoji} ${tier} predicts: ${signal.marketTitle}`,
    'og:description': `${signal.side.toUpperCase()} on ${signal.marketTitle}. ${accuracy}% accuracy. Weather-based analysis.`,
    'og:image': generateOGImageUrl(signal, userStats),
    'og:url': `https://fourcast.app/signals/${signal.id}`,
    'twitter:card': 'summary_large_image',
    'twitter:title': shareCard.title,
    'twitter:description': shareCard.description,
  };
}

/**
 * Generate image URL for OG card (can be dynamic or template-based)
 */
export function generateOGImageUrl(signal, userStats) {
  const tier = userStats?.tier?.emoji || '📊';
  const accuracy = Math.round(userStats?.accuracyPercent || 0);
  const side = signal.side === 'YES' ? 'Bullish' : 'Bearish';

  // Could be replaced with dynamic OG image generation
  // For now, returns a template URL
  const params = new URLSearchParams({
    title: signal.marketTitle.substring(0, 50),
    side,
    venue: signal.venue || 'Location',
    confidence: signal.confidence || 'moderate',
    tier,
    accuracy,
  });

  return `/api/og?${params.toString()}`;
}

/**
 * Generate embed code for embedding signals on other sites
 */
export function generateEmbedCode(signalId, userAddress) {
  return `<iframe src="https://fourcast.app/embed/signal/${signalId}" width="500" height="300" frameborder="0"></iframe>`;
}

/**
 * Generate shareable link
 */
export function generateShareLink(signalId) {
  return `https://fourcast.app/signals/${signalId}`;
}

/**
 * Get confidence level info
 */
function getConfidenceLevel(confidence) {
  const levels = {
    'very-high': { emoji: '🔥', label: 'Very High', color: '#EF4444' },
    'high': { emoji: '✨', label: 'High', color: '#F59E0B' },
    'medium': { emoji: '📊', label: 'Medium', color: '#3B82F6' },
    'low': { emoji: '❓', label: 'Low', color: '#6B7280' },
    'very-low': { emoji: '🤔', label: 'Very Low', color: '#9CA3AF' },
  };

  return levels[confidence] || levels['medium'];
}

/**
 * Generate share text for generic use
 */
function generateShareText(signal, userStats) {
  const tier = userStats?.tier?.emoji || '📊';
  const accuracy = userStats?.accuracyPercent || 0;

  return `I'm predicting ${signal.side} on "${signal.marketTitle}"\n\n${tier} ${accuracy}% accuracy\n\nUsing weather science on @fourcast`;
}

/**
 * Analytics: Track share events
 */
export async function trackShare(signalId, platform, userAddress) {
  try {
    await fetch('/api/analytics/share', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signalId,
        platform,
        userAddress,
        timestamp: Date.now(),
      }),
    });
  } catch (e) {
    console.error('Failed to track share:', e);
  }
}

export default {
  generateShareCard,
  generateXUrl,
  generateFarcasterUrl,
  generateOGMeta,
  generateShareLink,
  generateEmbedCode,
  trackShare,
};
