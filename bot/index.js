/**
 * Fourcast Telegram Bot — Long-polling runner
 *
 * Runs as a persistent process using pm2.
 * Polls Telegram for updates instead of using webhooks.
 * Uses the same command handlers from services/telegramBot.js.
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

// Load .env file manually (pm2 doesn't auto-load .env)
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
    if (!process.env[key]) process.env[key] = val;
  }
  console.log(`[Bot] Loaded env from ${envPath}`);
} catch (err) {
  console.warn(`[Bot] No .env file at ${envPath}, using system env vars`);
}

import { handleTelegramUpdate } from '../services/telegramBot.js';

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`;
const POLL_TIMEOUT = 30; // seconds — Telegram will hold the connection

let offset = 0;
let isRunning = true;

async function getUpdates() {
  try {
    const res = await fetch(`${TELEGRAM_API}/getUpdates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        offset,
        timeout: POLL_TIMEOUT,
        allowed_updates: ['message', 'edited_message'],
      }),
      signal: AbortSignal.timeout((POLL_TIMEOUT + 5) * 1000),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('[Bot] Telegram API error:', data);
      return [];
    }
    return data.result || [];
  } catch (err) {
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      return []; // Normal timeout — no updates
    }
    console.error('[Bot] Poll error:', err.message);
    return [];
  }
}

async function pollLoop() {
  console.log('[Bot] Fourcast bot started — polling for updates...');
  console.log(`[Bot] Server: ${process.env.NEXT_PUBLIC_HOST || 'http://localhost:3000'}`);

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

        // Mark as processed
        offset = updateId + 1;
      }
    } catch (err) {
      console.error('[Bot] Poll loop error:', err.message);
      // Wait before retrying on unexpected errors
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  console.log('[Bot] Shutting down.');
}

// Graceful shutdown
process.on('SIGINT', () => { isRunning = false; process.exit(0); });
process.on('SIGTERM', () => { isRunning = false; process.exit(0); });

pollLoop();
