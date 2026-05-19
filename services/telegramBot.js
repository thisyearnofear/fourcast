/**
 * Telegram Bot — Edge Detection via Messaging
 *
 * Commands:
 *   /start — Welcome & instructions
 *   /edge <query> — AI analysis of a prediction market
 *
 * Architecture:
 *   Telegram → Webhook POST → /api/bot/telegram → reply via Telegram API
 *
 * Setup:
 *   1. Create bot via @BotFather on Telegram, get token
 *   2. Set TELEGRAM_BOT_TOKEN in .env.local
 *   3. Set webhook: curl "https://api.telegram.org/bot<token>/setWebhook?url=https://fourcast.vercel.app/api/bot/telegram"
 */

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`;

// ============================================================================
// Telegram API helpers
// ============================================================================

async function sendMessage(chatId, text, parseMode = 'Markdown') {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: parseMode,
        disable_web_page_preview: false,
      }),
    });
    return await res.json();
  } catch (err) {
    console.error('Telegram sendMessage failed:', err);
    return { ok: false, error: err.message };
  }
}

async function sendTyping(chatId) {
  try {
    await fetch(`${TELEGRAM_API}/sendChatAction`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
    });
  } catch {}
}

// ============================================================================
// Command handlers
// ============================================================================

async function handleStart(chatId) {
  const msg = `🔮 *Fourcast Bot*

AI-powered prediction market intelligence, now in your pocket.

*Commands:*
• /edge \`<query>\` — Analyze a prediction market
  Examples:
  /edge BTC
  /edge will trump win 2026
  /edge lakers vs celtics
  /edge rain in Miami tomorrow

*Setup:* Connect your wallet at fourcast.vercel.app to publish predictions and track your record.

*Pro:* Unlimited analyses, deep AI mode, cross-platform arbitrage — /subscribe

Built with Circle USDC on Arc.`;
  return sendMessage(chatId, msg);
}

async function handleEdge(chatId, query) {
  if (!query || query.trim().length < 2) {
    return sendMessage(chatId, `⚠️ Please provide a market to analyze.

Examples:
• /edge BTC
• /edge will trump win
• /edge lakers vs celtics`);
  }

  // Show typing indicator while we process
  await sendTyping(chatId);

  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000'}/api/analyze`, {
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
      // If the AI engine fails, give a friendly response
      const fallbackMsg = `🔍 *Analysis: ${query.trim()}*

I couldn't find a direct market match. Try being more specific:
• /edge Bitcoin price June 2026
• /edge will Trump win 2028 election
• /edge Lakers championship 2026

Or browse markets at fourcast.vercel.app/markets`;
      return sendMessage(chatId, fallbackMsg);
    }

    const analysis = data.analysis || data.assessment || {};
    const confidence = analysis.confidence || data.confidence || 'MEDIUM';
    const reasoning = analysis.reasoning || data.reasoning || analysis.summary || '';
    const probability = analysis.probability || data.aiProbability || '';
    const edge = data.edge || analysis.edge || '';

    const confidenceEmoji = confidence === 'HIGH' ? '🟢' : confidence === 'MEDIUM' ? '🟡' : '🔴';

    let msg = `🔮 *AI Analysis: ${query.trim()}*\n\n`;
    msg += `${confidenceEmoji} Confidence: *${confidence}*\n`;
    if (probability) msg += `📊 AI Probability: *${probability}*\n`;
    if (edge) msg += `⚡ Edge: *+${edge}%*\n\n`;
    if (reasoning) msg += `💡 *Reasoning:*\n${reasoning.slice(0, 600)}\n\n`;
    msg += `\n📈 View full analysis: fourcast.vercel.app/markets`;

    return sendMessage(chatId, msg);
  } catch (err) {
    console.error('Edge analysis failed:', err);
    return sendMessage(chatId, `❌ Analysis failed. The market data service is temporarily unavailable. Try again later.`);
  }
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

  console.log(`[Telegram Bot] Message from ${userId}: ${text.slice(0, 100)}`);

  // Parse command and arguments
  const parts = text.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/start':
      return handleStart(chatId);

    case '/edge':
      return handleEdge(chatId, args);

    default:
      // Treat unknown messages as /edge queries
      return handleEdge(chatId, text);
  }
}
