/**
 * Signal sharing utilities
 * Generates social media share URLs for signals
 */

/**
 * Generate a Fourcast signal detail URL (served with OG meta tags for rich link previews)
 */
export function generateSignalUrl(signal, host) {
  const base = host || (typeof window !== 'undefined' ? window.location.origin : 'https://fourcastapp.vercel.app');
  const signalId = signal.id || signal.event_id;
  if (!signalId) return base;
  return `${base}/signal/${encodeURIComponent(signalId)}`;
}

/**
 * Generate a Fourcast signal sharing URL with OG tracking
 */
export function generateShareUrl(signal, host, utmSource) {
  const url = generateSignalUrl(signal, host);
  const params = new URLSearchParams({ utm_source: utmSource || 'social', utm_medium: 'share' });
  return `${url}?${params.toString()}`;
}

export function generateXUrl(signal, userStats, host) {
  const signalUrl = generateShareUrl(signal, host, 'twitter');
  const text = generateXShareText(signal, userStats, signalUrl);
  return `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
}

export function generateFarcasterUrl(signal, userStats, host) {
  const signalUrl = generateShareUrl(signal, host, 'farcaster');
  const text = generateFarcasterShareText(signal, userStats, signalUrl);
  return `https://warpcast.com/compose?text=${encodeURIComponent(text)}`;
}

function generateXShareText(signal, userStats, signalUrl) {
  const tier = userStats?.tier?.emoji || '📊';
  const accuracy = userStats?.accuracyPercent || 0;
  const confidence = signal.confidence || 'moderate';
  const title = signal.market_title || 'market';

  let text = `I'm publishing a ${confidence} confidence signal on "${title}"\n\n`;
  text += `📍 ${signal.venue || 'Location'}\n`;
  text += `${tier} ${userStats?.tier?.name || 'Forecaster'} | ${accuracy}% accuracy\n\n`;
  text += `Full analysis: ${signalUrl}`;

  return text;
}

function generateFarcasterShareText(signal, userStats, signalUrl) {
  const tier = userStats?.tier?.emoji || '📊';
  const accuracy = userStats?.accuracyPercent || 0;
  const title = signal.market_title || 'market';

  let text = `${tier} Signal published: "${title}"\n\n`;
  text += `Why: ${signal.ai_digest?.substring(0, 200) || 'Weather conditions indicate...'}\n\n`;
  text += `Building forecaster reputation on-chain. ${accuracy}% accuracy so far.\n\n`;
  text += `Full analysis: ${signalUrl}`;

  return text;
}

/**
 * Copy signal link to clipboard
 */
export function copySignalLink(signal) {
  const url = generateSignalUrl(signal);
  if (typeof navigator !== 'undefined' && navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    });
  }
}
