/**
 * Fourcast Bot — AI Prediction Intelligence via Telegram
 *
 * Personality: Oracle / Seer character. Speaks in confident, data-driven tones.
 * Signature: 🔮 crystal ball — "I see an edge..."
 *
 * Commands:
 *   /start  — Welcome & introduction
 *   /edge   — Analyze a prediction market
 *   /alerts — Set up price edge alerts (coming soon)
 *   /pro    — Upgrade to Pro for unlimited analysis
 *
 * Architecture: Webhook-based. Telegram POSTs → /api/bot/telegram → reply via API.
 */

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`;
const BOT_USERNAME = 'fourcasterbot';
const APP_URL = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';

// ============================================================================
// Telegram API helpers
// ============================================================================

async function callTelegram(method, payload = {}) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (err) {
    console.error(`Telegram ${method} failed:`, err);
    return { ok: false, error: err.message };
  }
}

async function sendMessage(chatId, text, extra = {}) {
  return callTelegram('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
    ...extra,
  });
}

async function sendTyping(chatId) {
  return callTelegram('sendChatAction', { chat_id: chatId, action: 'typing' });
}

// ============================================================================
// Inline Keyboards
// ============================================================================

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: '🔮 Analyze Market', switch_inline_query_current_chat: '' },
        { text: '📊 Open App', url: `${APP_URL}/markets` },
      ],
      [
        { text: '⭐ Pro Features', url: `${APP_URL}/markets` },
        { text: '💬 Feedback', url: 'https://t.me/papajams' },
      ],
    ],
  };
}

function marketResultKeyboard(marketUrl) {
  return {
    inline_keyboard: [
      [
        { text: '📈 Full Analysis', url: marketUrl || `${APP_URL}/markets` },
        { text: '🔍 Another Market', switch_inline_query_current_chat: '' },
      ],
    ],
  };
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleStart(chatId, userName) {
  const greeting = userName ? `Hey ${userName}! ` : '';

  const msg = [
    `🔮 *Fourcast* — AI Prediction Intelligence`,
    ``,
    `${greeting}I see edges in prediction markets that others miss. I scan 200+ ML models, live weather data, and market dynamics to find opportunities.`,
    ``,
    `*What I can do:*`,
    `📊 Analyze any prediction market with AI`,
    `🌤️ Factor in weather for sports & events`,
    `⚡ Detect mispriced odds across platforms`,
    `⛓️ Publish predictions on-chain (Arc/Circle USDC)`,
    ``,
    `*Try these:*`,
    `• /edge \`Bitcoin $100k June\``,
    `• /edge \`Lakers championship\``,
    `• /edge \`Trump 2028\``,
    `• /edge \`rain in Miami tomorrow\``,
    ``,
    `[Open Full App](${APP_URL}/markets) · [Pro Features](${APP_URL}/markets)`,
  ].join('\n');

  return sendMessage(chatId, msg, {
    reply_markup: mainMenuKeyboard(),
  });
}

async function handleEdge(chatId, query) {
  if (!query || query.trim().length < 2) {
    const msg = [
      `🔮 *I need a market to analyze.*`,
      ``,
      `Tell me what you want me to look into. Examples:`,
      `• /edge \`Bitcoin $100k\``,
      `• /edge \`Lakers vs Celtics\``,
      `• /edge \`will it rain in London tomorrow\``,
      `• /edge \`Fed interest rate 2026\``,
      ``,
      `Or just type what you're curious about — I'll figure it out.`,
    ].join('\n');

    return sendMessage(chatId, msg);
  }

  await sendTyping(chatId);

  try {
    const response = await fetch(`${APP_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: query.trim(),
        title: query.trim(),
        location: '',
        mode: 'basic',
      }),
    });

    const data = await response.json();

    if (!data.success) {
      const fallbackMsg = [
        `🔮 *I couldn't find a direct market match for "${query.trim()}"*`,
        ``,
        `Try being more specific:`,
        `• /edge \`Bitcoin price June 2026\``,
        `• /edge \`Will the Chiefs win Super Bowl\``,
        `• /edge \`US unemployment rate\``,
        ``,
        `You can also browse all markets at the app:`,
        `[fourcastapp.vercel.app/markets](${APP_URL}/markets)`,
      ].join('\n');
      return sendMessage(chatId, fallbackMsg);
    }

    const analysis = data.analysis || data.assessment || {};
    const confidence = analysis.confidence || data.confidence || 'MEDIUM';
    const reasoning = analysis.reasoning || data.reasoning || analysis.summary || '';
    const probability = analysis.probability || data.aiProbability || analysis.aiProbability || '';
    const edge = data.edge || analysis.edge || '';
    const marketUrl = data.marketUrl || `${APP_URL}/markets`;

    const confEmoji = confidence === 'HIGH' ? '🟢' : confidence === 'MEDIUM' ? '🟡' : '🔴';

    let msg = [
      `🔮 *I see an edge on: ${query.trim()}*`,
      ``,
      `${confEmoji} *Confidence:* ${confidence}`,
    ];

    if (probability) msg.push(`📊 *AI Probability:* ${typeof probability === 'number' ? (probability * 100).toFixed(1) + '%' : probability}`);
    if (edge) msg.push(`⚡ *Edge:* +${typeof edge === 'number' ? edge.toFixed(1) : edge}%`);

    msg.push('');

    if (reasoning) {
      const shortReasoning = reasoning.length > 500 ? reasoning.slice(0, 500) + '...' : reasoning;
      msg.push(`💡 *Signal:*`);
      msg.push(`${shortReasoning}`);
      msg.push('');
    }

    msg.push(`📈 [View full analysis →](${marketUrl})`);

    return sendMessage(chatId, msg.join('\n'), {
      reply_markup: marketResultKeyboard(marketUrl),
    });
  } catch (err) {
    console.error('Edge analysis failed:', err);
    return sendMessage(chatId, [
      `🔮 *The void is quiet right now.*`,
      ``,
      `I couldn't complete that analysis. The prediction data services may be temporarily unavailable.`,
      `Try again in a few moments, or check the app directly:`,
      `[fourcastapp.vercel.app](${APP_URL})`,
    ].join('\n'));
  }
}

async function handleAlerts(chatId, args) {
  const msg = [
    `🔮 *Edge Alerts — Coming Soon*`,
    ``,
    `I'll notify you when I detect profitable edges above your threshold.`,
    ``,
    `*Planned features:*`,
    `• Set a minimum edge % (e.g., \`/alerts 5\` for >5% edges)`,
    `• Choose categories (crypto, sports, politics)`,
    `• Get push notifications when opportunities arise`,
    ``,
    `For now, use /edge to manually check specific markets.`,
  ].join('\n');

  return sendMessage(chatId, msg);
}

async function handlePro(chatId) {
  const msg = [
    `🔮 *Fourcast Pro*`,
    ``,
    `Unlock unlimited AI-powered prediction analysis:`,
    ``,
    `✅ *Unlimited analyses* — no daily cap`,
    `✅ *Deep mode* — Qwen3-235B model for thorough reasoning`,
    `✅ *Weather data* — real-time conditions for sports/events`,
    `✅ *Web search* — up-to-date context for every prediction`,
    `✅ *Arbitrage detection* — cross-platform price gaps`,
    ``,
    `*Pro:* $9.99/month`,
    `*Premium:* $19.99/month (adds API access, Kelly sizing)`,
    ``,
    `🔗 [Upgrade in the app →](${APP_URL}/markets)`,
    ``,
    `*Already subscribed?* Connect your wallet in the app to activate.`,
  ].join('\n');

  return sendMessage(chatId, msg);
}

// ============================================================================
// Webhook handler
// ============================================================================

export async function handleTelegramUpdate(update) {
  const message = update.message || update.edited_message;
  if (!message?.text) return { ok: true };

  const chatId = message.chat.id;
  const text = message.text.trim();
  const userId = message.from?.id;
  const userName = message.from?.first_name || message.from?.username || '';

  console.log(`[Fourcast Bot] ${userName} (${userId}): ${text.slice(0, 100)}`);

  // Parse command and arguments
  const parts = text.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/start':
      return handleStart(chatId, userName);

    case '/edge':
      return handleEdge(chatId, args);

    case '/alerts':
      return handleAlerts(chatId, args);

    case '/pro':
    case '/subscribe':
      return handlePro(chatId);

    default:
      // Treat unknown messages as casual edge queries
      if (text.startsWith('/')) {
        return sendMessage(chatId, `🔮 I don't recognize that command. Try /start to see what I can do.`);
      }
      return handleEdge(chatId, text);
  }
}
