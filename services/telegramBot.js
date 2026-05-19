/**
 * Fourcast Bot — Conversational AI Prediction Agent
 *
 * Multi-turn conversation agent with per-user state.
 * Users can drill deeper into analyses with inline buttons.
 *
 * Commands:
 *   /start  — Welcome & introduction
 *   /edge   — Analyze a prediction market
 *   /alerts — Set up edge alerts (coming soon)
 *   /pro    — Upgrade to Pro
 *   (any text) — Treated as /edge query
 *   (callback buttons) — Follow-up actions on previous analysis
 */

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`;
const APP_URL = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';

// ============================================================================
// Session Store — per-user conversation state
// ============================================================================

const sessions = new Map();

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { lastQuery: null, lastAnalysis: null, awaitingFollowUp: null });
  }
  return sessions.get(chatId);
}

// ============================================================================
// Telegram API Helpers
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

async function editMessage(chatId, messageId, text, extra = {}) {
  return callTelegram('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: 'Markdown',
    disable_web_page_preview: false,
    ...extra,
  });
}

async function sendTyping(chatId) {
  return callTelegram('sendChatAction', { chat_id: chatId, action: 'typing' });
}

async function answerCallback(queryId, text) {
  return callTelegram('answerCallbackQuery', {
    callback_query_id: queryId,
    text,
    show_alert: false,
  });
}

// ============================================================================
// Keyboards
// ============================================================================

function mainMenuKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🔮 Analyze Market', switch_inline_query_current_chat: '' },
       { text: '📊 Open App', url: `${APP_URL}/markets` }],
      [{ text: '⭐ Pro Features', url: `${APP_URL}/markets` },
       { text: '💬 Feedback', url: 'https://t.me/papajams' }],
    ],
  };
}

function analysisFollowUpKeyboard(query) {
  return {
    inline_keyboard: [
      [{ text: '1️⃣ Full Reasoning', callback_data: `reason:${query}` },
       { text: '2️⃣ Compare Kalshi', callback_data: `kalshi:${query}` }],
      [{ text: '3️⃣ Set Alert', callback_data: `alert:${query}` },
       { text: '4️⃣ New Analysis', switch_inline_query_current_chat: '' }],
    ],
  };
}

function backToAnalysisKeyboard(query) {
  return {
    inline_keyboard: [
      [{ text: '← Back to Analysis', callback_data: `back:${query}` }],
    ],
  };
}

// ============================================================================
// Commands
// ============================================================================

async function handleStart(chatId, userName) {
  const greeting = userName ? `Hey ${userName}! ` : '';
  const msg = [
    `🔮 *Fourcast* — AI Prediction Intelligence`,
    ``,
    `${greeting}I see edges in prediction markets that others miss. I scan 200+ ML models, live weather data, and market dynamics to find opportunities.`,
    ``,
    `*Try these:*`,
    `• /edge \`Bitcoin $100k June\``,
    `• /edge \`Lakers championship\``,
    `• /edge \`will it rain tomorrow\``,
    `• /alerts — Set up edge notifications`,
    `• /pro — Unlimited analysis`,
    ``,
    `[Open App](${APP_URL}/markets)`,
  ].join('\n');
  return sendMessage(chatId, msg, { reply_markup: mainMenuKeyboard() });
}

async function handleEdge(chatId, query, messageId = null) {
  if (!query || query.trim().length < 2) {
    const msg = [
      `🔮 *I need a market to analyze.*`,
      `Example: /edge \`Bitcoin $100k\``,
      `Or just type what you're curious about.`,
    ].join('\n');
    return messageId
      ? editMessage(chatId, messageId, msg)
      : sendMessage(chatId, msg);
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

    // Save to session for follow-ups
    const session = getSession(chatId);
    session.lastQuery = query.trim();
    session.lastAnalysis = data;
    session.awaitingFollowUp = true;

    if (!data.success) {
      const msg = [
        `🔮 *I couldn't find a direct market match for "${query.trim()}"*`,
        ``,
        `Try being more specific:`,
        `• \`Bitcoin price June 2026\``,
        `• \`Will the Chiefs win Super Bowl\``,
      ].join('\n');
      return messageId
        ? editMessage(chatId, messageId, msg)
        : sendMessage(chatId, msg);
    }

    const analysis = data.analysis || data.assessment || {};
    const confidence = analysis.confidence || data.confidence || 'MEDIUM';
    const reasoning = analysis.reasoning || data.reasoning || analysis.summary || '';
    const probability = analysis.probability || data.aiProbability || analysis.aiProbability || '';
    const edge = data.edge || analysis.edge || '';

    const confEmoji = confidence === 'HIGH' ? '🟢' : confidence === 'MEDIUM' ? '🟡' : '🔴';

    let msg = [
      `🔮 *I see an edge on: ${query.trim()}*`,
      ``,
      `${confEmoji} *Confidence:* ${confidence}`,
    ];

    if (probability) {
      const p = typeof probability === 'number' ? (probability * 100).toFixed(1) + '%' : probability;
      msg.push(`📊 *AI Probability:* ${p}`);
    }
    if (edge) msg.push(`⚡ *Edge:* +${typeof edge === 'number' ? edge.toFixed(1) : edge}%`);

    msg.push('');
    msg.push(`💡 *Signal:* ${reasoning.length > 200 ? reasoning.slice(0, 200) + '...' : reasoning}`);
    msg.push('');

    if (messageId) {
      // If editing, keep it shorter
      return editMessage(chatId, messageId, msg.join('\n'), {
        reply_markup: analysisFollowUpKeyboard(query.trim()),
      });
    }

    return sendMessage(chatId, msg.join('\n'), {
      reply_markup: analysisFollowUpKeyboard(query.trim()),
    });
  } catch (err) {
    console.error('Edge analysis failed:', err);
    const msg = [
      `🔮 *The void is quiet right now.*`,
      `The analysis service is temporarily unavailable. Try again in a moment.`,
    ].join('\n');
    return messageId
      ? editMessage(chatId, messageId, msg)
      : sendMessage(chatId, msg);
  }
}

// ============================================================================
// Follow-up Actions (callback query handlers)
// ============================================================================

async function handleFollowUpReasoning(chatId, messageId, query, data) {
  const analysis = data?.analysis || data?.assessment || {};
  const fullReasoning = analysis.reasoning || data?.reasoning || analysis.summary || 'No detailed reasoning available.';

  await sendTyping(chatId);

  const msg = [
    `🔮 *Full Reasoning: ${query}*`,
    ``,
    fullReasoning.length > 1500 ? fullReasoning.slice(0, 1500) + '...' : fullReasoning,
    ``,
    `← Reply to go back.`,
  ].join('\n');

  return sendMessage(chatId, msg, {
    reply_markup: backToAnalysisKeyboard(query),
  });
}

async function handleFollowUpKalshi(chatId, messageId, query) {
  await sendTyping(chatId);

  try {
    const response = await fetch(`${APP_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        eventType: query.trim(),
        title: query.trim(),
        location: '',
        mode: 'deep',
      }),
    });
    const data = await response.json();

    // Also fetch current Polymarket odds via the arbitrage endpoint
    const arbResponse = await fetch(`${APP_URL}/api/defi/arbitrage?limit=5&minSpread=1&minVolume=10000`);
    const arbData = await arbResponse.json();

    const matches = arbData?.opportunities?.filter(o =>
      o.market_title?.toLowerCase().includes(query.trim().toLowerCase().slice(0, 20))
    ) || [];

    let msg = [
      `🔮 *Cross-Platform Comparison: ${query}*`,
      ``,
    ];

    if (matches.length > 0) {
      matches.slice(0, 2).forEach(m => {
        msg.push(`📊 *${m.market_title}*`);
        msg.push(`   Polymarket: ${(m.polymarket?.odds_yes * 100).toFixed(1)}%`);
        msg.push(`   Kalshi:     ${(m.kalshi?.odds_yes * 100).toFixed(1)}%`);
        msg.push(`   Spread: *${m.arbitrage?.spread_percent?.toFixed(1)}%*`);
        msg.push('');
      });
    } else {
      msg.push(`No cross-platform data available for this query.`);
      msg.push(`The arbitrage scanner checks Polymarket vs Kalshi for matching events.`);
      msg.push('');
    }

    msg.push(`← Reply to go back.`);

    return sendMessage(chatId, msg.join('\n'), {
      reply_markup: backToAnalysisKeyboard(query),
    });
  } catch (err) {
    return sendMessage(chatId, [
      `🔮 Cross-platform comparison unavailable.`,
      `Try the full app: [markets](${APP_URL}/markets)`,
    ].join('\n'));
  }
}

async function handleFollowUpAlert(chatId, query) {
  const msg = [
    `🔮 *Edge Alerts*`,
    ``,
    `I'll notify you when I detect edges above your threshold for "${query}".`,
    ``,
    `*Coming soon:*`,
    `• Set a minimum edge % (e.g., 5%)`,
    `• Get push notifications`,
    `• Filter by category`,
    ``,
    `For now, use /edge to manually check this market.`,
  ].join('\n');
  return sendMessage(chatId, msg, {
    reply_markup: backToAnalysisKeyboard(query),
  });
}

// ============================================================================
// Callback Query Handler — inline button presses
// ============================================================================

async function handleCallbackQuery(callbackQuery) {
  const { id, message, data } = callbackQuery;
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const session = getSession(chatId);

  // Split callback data: action:query
  const colonIdx = data.indexOf(':');
  const action = colonIdx > 0 ? data.slice(0, colonIdx) : data;
  const query = colonIdx > 0 ? data.slice(colonIdx + 1) : '';

  console.log(`[Fourcast Bot] Callback: ${action} for "${query.slice(0, 50)}"`);

  switch (action) {
    case 'reason':
      await answerCallback(id, 'Loading full reasoning...');
      return handleFollowUpReasoning(chatId, messageId, query, session.lastAnalysis);

    case 'kalshi':
      await answerCallback(id, 'Comparing platforms...');
      return handleFollowUpKalshi(chatId, messageId, query);

    case 'alert':
      await answerCallback(id, 'Setting up...');
      return handleFollowUpAlert(chatId, query);

    case 'back':
      await answerCallback(id, 'Going back...');
      return handleEdge(chatId, query, messageId);

    default:
      await answerCallback(id, 'Unknown action');
      return;
  }
}

// ============================================================================
// Webhook Handler
// ============================================================================

export async function handleTelegramUpdate(update) {
  // Handle callback queries (inline button presses)
  if (update.callback_query) {
    return handleCallbackQuery(update.callback_query);
  }

  const message = update.message || update.edited_message;
  if (!message?.text) return { ok: true };

  const chatId = message.chat.id;
  const text = message.text.trim();
  const userName = message.from?.first_name || message.from?.username || '';
  const userId = message.from?.id;

  console.log(`[Fourcast Bot] ${userName} (${userId}): ${text.slice(0, 100)}`);

  const parts = text.split(/\s+/);
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/start':
      return handleStart(chatId, userName);
    case '/edge':
      return handleEdge(chatId, args);
    case '/alerts':
      return handleFollowUpAlert(chatId, args || 'all markets');
    case '/pro':
    case '/subscribe':
      return sendMessage(chatId, [
        `🔮 *Fourcast Pro*`,
        ``,
        `✅ Unlimited analyses — no daily cap`,
        `✅ Deep mode — advanced reasoning models`,
        `✅ Weather data — real-time sports/event conditions`,
        `✅ Web search — up-to-date context`,
        `✅ Arbitrage detection — cross-platform gaps`,
        ``,
        `*Pro:* $9.99/mo · *Premium:* $19.99/mo`,
        `[Upgrade in the app →](${APP_URL}/markets)`,
      ].join('\n'));
    default:
      if (text.startsWith('/')) {
        return sendMessage(chatId, `🔮 I don't know that command. Try /start`);
      }
      return handleEdge(chatId, text);
  }
}
