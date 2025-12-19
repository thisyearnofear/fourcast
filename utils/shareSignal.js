/**
 * Signal sharing utilities
 * Generates social media share URLs for signals
 */

export function generateXUrl(signal, userStats) {
  const text = generateXShareText(signal, userStats);
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function generateFarcasterUrl(signal, userStats) {
  const text = generateFarcasterShareText(signal, userStats);
  return `https://warpcast.com/compose?text=${encodeURIComponent(text)}`;
}

function generateXShareText(signal, userStats) {
  const tier = userStats?.tier?.emoji || '📊';
  const accuracy = userStats?.accuracyPercent || 0;
  const confidence = signal.confidence || 'moderate';

  let text = `I'm publishing a signal on "${signal.market_title}"\n\n`;
  text += `📍 ${signal.venue || 'Location'}\n`;
  text += `💡 ${signal.ai_digest?.substring(0, 120) || 'Weather-based analysis'}\n\n`;
  text += `${tier} ${userStats?.tier?.name || 'Forecaster'} | ${accuracy}% accuracy\n`;
  text += `Using @fourcast to forecast market outcomes 🌤️ #predictions`;

  return text;
}

function generateFarcasterShareText(signal, userStats) {
  const tier = userStats?.tier?.emoji || '📊';
  const accuracy = userStats?.accuracyPercent || 0;

  let text = `${tier} Signal published: "${signal.market_title}"\n\n`;
  text += `Why: ${signal.ai_digest?.substring(0, 200) || 'Weather conditions indicate...'}\n\n`;
  text += `Building forecaster reputation on-chain. ${accuracy}% accuracy so far.\n`;
  text += `Powered by weather science + @fourcast 🌤️`;

  return text;
}
