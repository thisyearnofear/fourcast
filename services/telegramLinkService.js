/**
 * Telegram link service — binds wallet addresses to Telegram chats so
 * follower notifications can be pushed, not just stored.
 *
 * Flow: the site (wallet-auth gated) generates a one-time code and a
 * t.me deep link → the user opens it → the bot receives `/start <code>`
 * → consumeLinkCode() binds chat_id to the wallet. Codes expire in 15
 * minutes and are single-use, so a chat can only ever be bound by someone
 * who authenticated as that wallet on the site.
 */

import crypto from 'crypto';
import { query, execute } from './db.js';

const CODE_TTL_MS = 15 * 60 * 1000;
const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN || ''}`;

export function telegramDeepLink(code) {
  const username = process.env.TELEGRAM_BOT_USERNAME;
  return username ? `https://t.me/${username}?start=${code}` : null;
}

/**
 * Create a one-time link code for a wallet (caller must have verified
 * wallet-signature auth). Returns { code, deepLink }.
 */
export async function createLinkCode(walletAddress) {
  const addr = walletAddress?.toLowerCase();
  if (!addr) return { success: false, error: 'walletAddress is required' };

  try {
    const code = crypto.randomBytes(8).toString('hex');
    await execute(
      `INSERT INTO telegram_link_codes (code, wallet_address, created_at, used)
       VALUES (?, ?, ?, 0)`,
      [code, addr, Date.now()]
    );
    return { success: true, code, deepLink: telegramDeepLink(code) };
  } catch (error) {
    console.error('createLinkCode error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Consume a link code (called by the bot on `/start <code>`): validates
 * freshness + single-use, then upserts the wallet -> chat binding.
 */
export async function consumeLinkCode(code, chatId) {
  if (!code || !chatId) return { success: false, error: 'code and chatId are required' };

  try {
    const rows = await query(
      `SELECT * FROM telegram_link_codes WHERE code = ? AND used = 0`,
      [code]
    );
    const row = rows[0];
    if (!row) return { success: false, error: 'Invalid or already-used code' };
    if (Date.now() - row.created_at > CODE_TTL_MS) {
      return { success: false, error: 'Code expired — generate a new one on the site' };
    }

    await execute(`UPDATE telegram_link_codes SET used = 1 WHERE code = ?`, [code]);
    await execute(
      `INSERT INTO telegram_links (wallet_address, chat_id, linked_at)
       VALUES (?, ?, ?)
       ON CONFLICT(wallet_address) DO UPDATE SET
         chat_id = excluded.chat_id,
         linked_at = excluded.linked_at`,
      [row.wallet_address, String(chatId), Math.floor(Date.now() / 1000)]
    );
    return { success: true, walletAddress: row.wallet_address };
  } catch (error) {
    console.error('consumeLinkCode error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Link status for a wallet.
 */
export async function getLinkStatus(walletAddress) {
  const addr = walletAddress?.toLowerCase();
  if (!addr) return { success: false, error: 'walletAddress is required' };

  try {
    const rows = await query(
      `SELECT linked_at FROM telegram_links WHERE wallet_address = ?`,
      [addr]
    );
    return { success: true, linked: rows.length > 0, linkedAt: rows[0]?.linked_at || null };
  } catch (error) {
    console.error('getLinkStatus error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove a wallet's Telegram binding.
 */
export async function unlinkTelegram(walletAddress) {
  const addr = walletAddress?.toLowerCase();
  if (!addr) return { success: false, error: 'walletAddress is required' };

  try {
    await execute(`DELETE FROM telegram_links WHERE wallet_address = ?`, [addr]);
    return { success: true };
  } catch (error) {
    console.error('unlinkTelegram error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Resolve chat ids for a set of wallet addresses.
 * Returns [{ wallet_address, chat_id }].
 */
export async function getTelegramChatIds(addresses) {
  if (!addresses?.length) return [];

  try {
    const placeholders = addresses.map(() => '?').join(',');
    const rows = await query(
      `SELECT wallet_address, chat_id FROM telegram_links
       WHERE wallet_address IN (${placeholders})`,
      addresses.map((a) => a.toLowerCase())
    );
    return rows;
  } catch (error) {
    console.error('getTelegramChatIds error:', error);
    return [];
  }
}

/**
 * Minimal standalone Telegram sendMessage — deliberately NOT imported from
 * telegramBot.js so the notification path doesn't pull in the whole bot
 * (sessions, queues, AI handlers). No-ops without a token.
 */
export async function sendTelegramMessage(chatId, text, extra = {}) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };

  try {
    const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: false,
        ...extra,
      }),
    });
    return await res.json();
  } catch (error) {
    return { ok: false, error: error.message };
  }
}
