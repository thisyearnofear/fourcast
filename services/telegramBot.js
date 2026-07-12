/**
 * Fourcast Bot — Conversational AI Prediction Agent
 *
 * Multi-turn conversation agent with per-user state.
 * Features: immediate feedback, per-user request queue, timeout handling.
 */

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`;
const APP_URL = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';
const ANALYSIS_TIMEOUT = 45000; // 45s max per analysis
const PROGRESS_INTERVAL = 12000; // Update "still working..." every 12s

// ============================================================================
// Session & Queue
// ============================================================================

const sessions = new Map();
const pendingRequests = new Map(); // chatId → true (currently processing)
const requestQueue = []; // [{chatId, query, userName, timestamp}]

function getSession(chatId) {
  if (!sessions.has(chatId)) {
    sessions.set(chatId, { lastQuery: null, lastAnalysis: null, awaitingFollowUp: null });
  }
  return sessions.get(chatId);
}

// ============================================================================
// Helpers
// ============================================================================

async function callTelegram(method, payload = {}) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };
  try {
    const res = await fetch(`${TELEGRAM_API}/${method}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Fourcast-Auth': process.env.BOT_API_SECRET || '',
      },
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
    chat_id: chatId, text, parse_mode: 'Markdown', disable_web_page_preview: false, ...extra,
  });
}

async function editMessage(chatId, messageId, text, extra = {}) {
  return callTelegram('editMessageText', {
    chat_id: chatId, message_id: messageId, text, parse_mode: 'Markdown',
    disable_web_page_preview: false, ...extra,
  });
}

async function sendTyping(chatId) {
  return callTelegram('sendChatAction', { chat_id: chatId, action: 'typing' });
}

async function answerCallback(queryId, text) {
  return callTelegram('answerCallbackQuery', { callback_query_id: queryId, text, show_alert: false });
}

function queuePosition(chatId) {
  return requestQueue.findIndex(r => r.chatId === chatId);
}

// ============================================================================
// Thinking message — immediate feedback, edited with result
// ============================================================================

async function sendThinkingMessage(chatId, query) {
  const loadingMessages = [
    '🔮 *Gazing into the crystal ball...*',
    '🔮 *Scanning prediction markets...*',
    '🔮 *Consulting the ML models...*',
    '🔮 *Cross-referencing odds...*',
    '🔮 *Analyzing market data...*',
  ];
  const msg = loadingMessages[Math.floor(Math.random() * loadingMessages.length)];
  return sendMessage(chatId, msg);
}

async function updateProgress(chatId, messageId, attempt = 1) {
  const messages = [
    '🔮 *Still analyzing... checking multiple data sources.*',
    '🔮 *Crunching the numbers... almost there.*',
    '🔮 *This one\'s taking a moment — good markets are worth the wait.*',
  ];
  const msg = messages[Math.min(attempt - 1, messages.length - 1)];
  await editMessage(chatId, messageId, msg).catch(() => {});
}

// ============================================================================
// Queue processor — processes one request at a time per user
// ============================================================================

async function processQueue() {
  if (requestQueue.length === 0) return;

  const entry = requestQueue[0];
  if (pendingRequests.get(entry.chatId)) return; // Still processing

  requestQueue.shift();
  pendingRequests.set(entry.chatId, true);

  try {
    // Update queue positions for remaining entries
    for (const q of requestQueue) {
      const pos = queuePosition(q.chatId);
      if (pos >= 0) {
        await sendMessage(q.chatId,
          `⏳ *Your request is #${pos + 1} in queue.*\nProcessing previous analysis...`
        ).catch(() => {});
      }
    }

    await executeAnalysis(entry.chatId, entry.query, entry.userName);
  } finally {
    pendingRequests.delete(entry.chatId);
    // Process next in queue
    setImmediate(processQueue);
  }
}

function enqueueRequest(chatId, query, userName) {
  const existing = requestQueue.find(r => r.chatId === chatId);
  if (existing) {
    // Update existing entry instead of duplicating
    existing.query = query;
    existing.timestamp = Date.now();
    return queuePosition(chatId) + 1;
  }
  requestQueue.push({ chatId, query, userName, timestamp: Date.now() });
  return requestQueue.length; // New position
}

// ============================================================================
// Core analysis execution
// ============================================================================

async function executeAnalysis(chatId, query, userName) {
  // Check for greeting
  const greetings = ['hi','hello','hey','gm','gn','good morning','good evening','sup','yo',"g'day",'howdy'];
  if (greetings.includes(query.trim().toLowerCase()) || query.trim().length < 2) {
    pendingRequests.delete(chatId);
    return handleCasualQuery(chatId, query);
  }

  // Send immediate feedback
  const thinkingMsg = await sendThinkingMessage(chatId, query);
  const thinkingMsgId = thinkingMsg?.result?.message_id;
  if (!thinkingMsgId) {
    pendingRequests.delete(chatId);
    return; // Could not send message
  }

  await sendTyping(chatId);

  // Progress update timer
  let progressAttempt = 0;
  const progressTimer = setInterval(async () => {
    progressAttempt++;
    if (progressAttempt <= 3) {
      await updateProgress(chatId, thinkingMsgId, progressAttempt);
    }
  }, PROGRESS_INTERVAL);

  // Timeout
  const timeout = setTimeout(() => {
    clearInterval(progressTimer);
    editMessage(chatId, thinkingMsgId, [
      `🔮 *Analysis timed out.*`,
      `The prediction data services are taking longer than expected.`,
      `Try again in a moment, or check the app directly:`,
      `[fourcastapp.vercel.app](${APP_URL})`,
    ].join('\n')).catch(() => {});
  }, ANALYSIS_TIMEOUT);

  try {
    const response = await fetch(`${APP_URL}/api/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Fourcast-Auth': process.env.BOT_API_SECRET || '',
      },
      body: JSON.stringify({
        eventType: query.trim(),
        title: query.trim(),
        location: '',
        mode: 'basic',
      }),
    });

    clearTimeout(timeout);
    clearInterval(progressTimer);

    const data = await response.json();

    const session = getSession(chatId);
    session.lastQuery = query.trim();
    session.lastAnalysis = data;
    session.awaitingFollowUp = true;

    if (!data.success) {
      const msg = [
        `🔮 *I couldn't find prediction market data for that.*`,
        ``,
        `Fourcast scans Polymarket and Kalshi for active markets. Try:`,
        `• \`/edge Bitcoin June 2026\``,
        `• \`/edge Chiefs Super Bowl\``,
        `• \`/edge Fed rate cut\``,
        `• \`/edge rain Miami tomorrow\``,
        ``,
        `[Browse all markets →](${APP_URL}/markets)`,
      ].join('\n');
      return editMessage(chatId, thinkingMsgId, msg);
    }

    const analysis = data.analysis || data.assessment || {};
    const confidence = analysis.confidence || data.confidence || 'MEDIUM';
    const reasoning = data.reasoning || analysis.reasoning || analysis.summary || data.assessment?.summary || '';
    const probability = data.probability || data.aiProbability || analysis.probability || analysis.aiProbability || '';
    const edge = data.edge || analysis.edge || '';

    const confEmoji = confidence === 'HIGH' ? '🟢' : confidence === 'MEDIUM' ? '🟡' : '🔴';

    let msg = [
      `🔮 *Analysis for: ${query.trim()}*`,
      ``,
      `${confEmoji} *Confidence:* ${confidence}`,
    ];
    if (probability) {
      const p = typeof probability === 'number' ? (probability * 100).toFixed(1) + '%' : probability;
      msg.push(`📊 *AI Probability:* ${p}`);
    } else {
      msg.push(`📊 *Market odds:* Not available — Fourcast AI analyzed fundamentals instead`);
    }
    if (edge) {
      msg.push(`⚡ *Price discrepancy:* +${typeof edge === 'number' ? edge.toFixed(1) : edge}% vs market odds`);
    }
    msg.push('');

    const signalText = reasoning.length > 200 ? reasoning.slice(0, 200) + '...' : reasoning;
    if (signalText) {
      msg.push(`💡 *Signal:* ${signalText}`);
    } else {
      msg.push(`💡 *Analysis:* ${confidence === 'HIGH' ? 'Strong indicators across ML models.' : 'Mixed signals — review the full reasoning for details.'}`);
    }

    return editMessage(chatId, thinkingMsgId, msg.join('\n'), {
      reply_markup: analysisFollowUpKeyboard(query.trim()),
    });
  } catch (err) {
    clearTimeout(timeout);
    clearInterval(progressTimer);
    console.error('Edge analysis failed:', err);
    return editMessage(chatId, thinkingMsgId, [
      `🔮 *The void is quiet right now.*`,
      `The analysis service is temporarily unavailable. Try again in a moment.`,
    ].join('\n'));
  }
}

// ============================================================================
// Keyboards
// ============================================================================

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
  return { inline_keyboard: [
    [{ text: '← Back to Analysis', callback_data: `back:${query}` }],
  ]};
}

function mainMenuKeyboard() {
  return { inline_keyboard: [
    [{ text: '🔮 Analyze Market', switch_inline_query_current_chat: '' },
     { text: '📊 Open App', url: `${APP_URL}/markets` }],
    [{ text: '⭐ Pro Features', url: `${APP_URL}/markets` },
     { text: '💬 Feedback', url: 'https://t.me/papajams' }],
  ]};
}

// ============================================================================
// Command Handlers
// ============================================================================

async function handleStart(chatId, userName) {
  const greeting = userName ? `Hey ${userName}! ` : '';
  const msg = [
    `🔮 *Fourcast* — AI Prediction Intelligence`,
    ``,
    `${greeting}Fourcast connects you with prediction market analysts. Try:`,
    `• \`/edge Bitcoin $100k June\` — AI-assisted market analysis`,
    `• \`/top\` — Today's top signals from leading analysts`,
    `• \`/alerts\` — Get notified when analysts publish`,
    `• \`/pro\` — Unlimited analysis`,
    ``,
    `[Open App](${APP_URL}/markets)`,
  ].join('\n');
  return sendMessage(chatId, msg, { reply_markup: mainMenuKeyboard() });
}

async function handleCasualQuery(chatId, query) {
  await sendTyping(chatId);

  const systemPrompt = `You are Fourcast, a prediction market insights curator.
Your voice: data-driven, analytical, neutral. Keep responses under 3 sentences.
You help users discover analysis published by prediction market analysts.
End by inviting them to try a market query. Never claim you found an edge.`;

  const userMessage = (query && query.trim().length > 0) ? query : 'introduce yourself';
  const featherlessKey = process.env.FEATHERLESS_API_KEY;

  if (featherlessKey) {
    try {
      const response = await fetch('https://api.featherless.ai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${featherlessKey}` },
        body: JSON.stringify({
          model: '0xA50C1A1/Phi-4-mini-instruct-heretic',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userMessage }],
          max_tokens: 250, temperature: 0.7,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        const reply = data?.choices?.[0]?.message?.content?.trim();
        if (reply) return sendMessage(chatId, `🔮 ${reply}`);
      }
    } catch (err) { console.error('[Bot] Featherless AI failed:', err.message); }
  }

  return sendMessage(chatId, `🔮 I'm Fourcast. I surface prediction market analysis from AI and community analysts. Try /edge to analyze a market, or /top to see today's best signals.`);
}

async function handleTop(chatId) {
  await sendTyping(chatId);
  try {
    const resp = await fetch(`${APP_URL}/api/signals?limit=5`);
    const data = await resp.json();
    const signals = data?.signals || data?.results || [];
    if (signals.length > 0) {
      let msg = [`📊 *Top Signals Today*`, ``];
      signals.slice(0, 5).forEach((s, i) => {
        const author = s.author || s.analyst || s.publisher || 'Analyst';
        const conf = s.confidence || s.probability || '';
        msg.push(`${i + 1}. *${s.title || s.market || 'Market'}*`);
        msg.push(`   👤 ${author} · ${conf ? `🎯 ${conf}%` : ''} · ${s.winRate || s.accuracy || ''}`);
        msg.push('');
      });
      msg.push(`[View all signals →](${APP_URL}/signals)`);
      msg.push(`📈 [Publish your own →](${APP_URL}/signals)`);
      return sendMessage(chatId, msg.join('\n'));
    }
  } catch { /* ignore */ }
  return sendMessage(chatId, [
    `📊 *Top Signals*`,
    ``,
    `No analyst signals available right now. Be the first to publish!`,
    `[Open the app →](${APP_URL}/signals)`,
  ].join('\n'));
}

async function handleEdge(chatId, query, userName) {
  // Greetings go to casual handler immediately
  const greetings = ['hi','hello','hey','gm','gn','good morning','good evening','sup','yo',"g'day",'howdy'];
  if (greetings.includes(query.trim().toLowerCase()) || query.trim().length < 2) {
    return handleCasualQuery(chatId, query);
  }

  // Check if user already has a request in progress
  if (pendingRequests.get(chatId)) {
    const pos = enqueueRequest(chatId, query, userName);
    return sendMessage(chatId,
      `⏳ *Analysis in progress.* Your request for "${query.slice(0, 40)}" is #${pos} in queue.\n` +
      `I'll notify you when it's ready.`
    );
  }

  // Process directly
  pendingRequests.set(chatId, true);
  try {
    await executeAnalysis(chatId, query, userName);
  } finally {
    pendingRequests.delete(chatId);
    // Kick the queue
    setImmediate(processQueue);
  }
}

// ============================================================================
// Follow-up Actions
// ============================================================================

async function handleFollowUpReasoning(chatId, messageId, query, data) {
  await sendTyping(chatId);
  // Check multiple paths for reasoning text
  const reasoning = data?.reasoning || data?.analysis?.reasoning || data?.assessment?.reasoning ||
    data?.assessment?.summary || data?.analysis?.summary || 'No detailed reasoning available for this market.';
  const msg = [
    `🔮 *Full Reasoning: ${query}*`, ``,
    reasoning.length > 1500 ? reasoning.slice(0, 1500) + '...' : reasoning, ``,
    `← Reply to go back.`,
  ].join('\n');
  return sendMessage(chatId, msg, { reply_markup: backToAnalysisKeyboard(query) });
}

async function handleFollowUpKalshi(chatId, messageId, query) {
  await sendTyping(chatId);
  try {
    const response = await fetch(`${APP_URL}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Fourcast-Auth': process.env.BOT_API_SECRET || '' },
      body: JSON.stringify({ eventType: query.trim(), title: query.trim(), location: '', mode: 'deep' }),
    });
    const data = await response.json();
    const arbResponse = await fetch(`${APP_URL}/api/defi/arbitrage?limit=5&minSpread=1&minVolume=10000`);
    const arbData = await arbResponse.json();
    const matches = arbData?.opportunities?.filter(o =>
      o.market_title?.toLowerCase().includes(query.trim().toLowerCase().slice(0, 20))
    ) || [];
    let msg = [`🔮 *Cross-Platform Comparison: ${query}*`, ``];
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
      msg.push('');
    }
    msg.push(`← Reply to go back.`);
    return sendMessage(chatId, msg.join('\n'), { reply_markup: backToAnalysisKeyboard(query) });
  } catch (err) {
    return sendMessage(chatId, `🔮 Cross-platform comparison unavailable.\n[Markets](${APP_URL}/markets)`);
  }
}

async function handleFollowUpAlert(chatId, query) {
  return sendMessage(chatId, [
    `🔮 *Alerts & Follow*`, ``,
    `Follow analysts on Fourcast to get notified when they publish new signals.`,
    `Connect your wallet at ${APP_URL}/signals → click Follow on any analyst.`,
    ``,
    `*Edge alerts:* Use /edge to check markets manually — automated edge alerts coming soon.`,
  ].join('\n'), { reply_markup: backToAnalysisKeyboard(query) });
}

// ============================================================================
// Callback Query Handler
// ============================================================================

async function handleCallbackQuery(callbackQuery) {
  const { id, message, data } = callbackQuery;
  const chatId = message.chat.id;
  const messageId = message.message_id;
  const session = getSession(chatId);
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
      return handleEdge(chatId, query, '');
    default:
      await answerCallback(id, 'Unknown action');
  }
}

// ============================================================================
// Webhook Handler
// ============================================================================

export async function handleTelegramUpdate(update) {
  if (update.callback_query) return handleCallbackQuery(update.callback_query);

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
      return handleEdge(chatId, args, userName);
    case '/top':
      return handleTop(chatId);
    case '/alerts':
      return handleFollowUpAlert(chatId, args || 'all markets');
    case '/pro':
    case '/subscribe':
      return sendMessage(chatId, [
        `🔮 *Fourcast Pro*`,
        `✅ Unlimited analyses · ✅ Deep mode · ✅ Weather data`,
        `✅ Web search · ✅ Arbitrage detection`,
        `*Pro:* $9.99/mo · *Premium:* $19.99/mo`,
        `[Upgrade →](${APP_URL}/markets)`,
      ].join('\n'));
    default:
      if (text.startsWith('/')) {
        return sendMessage(chatId, `🔮 I don't know that command. Try /start`);
      }
      return handleEdge(chatId, text, userName);
  }
}
