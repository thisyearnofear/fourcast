/**
 * Fourcast Telegram Bot — Long-polling runner
 *
 * Runs as a persistent process using pm2.
 * Polls Telegram for updates instead of using webhooks.
 * Uses dynamic import to ensure .env loads before module-level code.
 *
 * Resource usage: ~30MB RAM, <50MB disk
 *
 * Start: pm2 start bot/index.js --name fourcast-bot
 * Logs:  pm2 logs fourcast-bot
 * Stop:  pm2 stop fourcast-bot
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ---------------------------------------------------------------------------
// 1. Load .env FIRST — before any imports that depend on process.env
//    (ESM hoists static imports, so we use dynamic import() to control order)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    process.env[key] = val;
  }
  console.log(`[Bot] Loaded env from ${envPath}`);
} catch (err) {
  console.warn(`[Bot] No .env file at ${envPath}, using system env vars`);
}

console.log(`[Bot] TELEGRAM_BOT_TOKEN set: ${!!process.env.TELEGRAM_BOT_TOKEN}`);
console.log(`[Bot] NEXT_PUBLIC_HOST: ${process.env.NEXT_PUBLIC_HOST}`);

// ---------------------------------------------------------------------------
// 2. Dynamic import of the service (runs AFTER env is loaded)
// ---------------------------------------------------------------------------

const { handleTelegramUpdate } = await import('../services/telegramBot.js');

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`;
const POLL_TIMEOUT = 30;

let offset = 0;
let isRunning = true;

// ---------------------------------------------------------------------------
// 3. Polling
// ---------------------------------------------------------------------------

async function getUpdates() {
  try {
    const res = await fetch(`${TELEGRAM_API}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset,
        timeout: POLL_TIMEOUT,
        allowed_updates: ['message', 'edited_message', 'callback_query'],
      }),
      signal: AbortSignal.timeout((POLL_TIMEOUT + 5) * 1000),
    });

    if (res.status === 200) {
      const data = await res.json();
      return data.result || [];
    }

    // Non-200 — try to parse error, but don't crash
    try {
      const errData = await res.json();
      console.error(`[Bot] getUpdates error (${res.status}):`, JSON.stringify(errData).slice(0, 200));
    } catch {
      console.error(`[Bot] getUpdates HTTP ${res.status}`);
    }
    return [];
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return []; // Normal long-poll timeout
    }
    console.error('[Bot] Poll error:', err.message);
    return [];
  }
}

async function pollLoop() {
  console.log('[Bot] Fourcast bot started — polling for updates...');

  while (isRunning) {
    try {
      const updates = await getUpdates();

      for (const update of updates) {
        const updateId = update.update_id;
        console.log(`[Bot] Processing update ${updateId}`);

        try {
          await handleTelegramUpdate(update);
        } catch (err) {
          console.error(`[Bot] Handler error for update ${updateId}:`, err.message);
        }

        offset = updateId + 1;
      }
    } catch (err) {
      console.error('[Bot] Poll loop error:', err.message);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log('[Bot] Shutting down.');
}

// Graceful shutdown
process.on('SIGINT', () => { isRunning = false; process.exit(0); });
process.on('SIGTERM', () => { isRunning = false; process.exit(0); });

pollLoop();
