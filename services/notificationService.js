/**
 * Notification Service — push-style engagement for the follow + publish loop.
 *
 * When an analyst publishes a signal, notifyFollowers() creates a notification
 * row for each follower.  The notifications are retrieved via the /api/notifications
 * route and surfaced in the UI.
 *
 * Uses the db.js query/execute helpers for Turso/SQLite abstraction.
 */

import { query, execute } from './db.js';
import { getFollowerAddresses } from './followService.js';
import { getTelegramChatIds, sendTelegramMessage } from './telegramLinkService.js';
import crypto from 'crypto';

const FANOUT_LIMIT = 500;       // max followers notified per publish
const INSERT_CHUNK = 50;        // rows per batched INSERT
const TELEGRAM_CHUNK = 10;      // concurrent Telegram sends
const APP_URL = process.env.NEXT_PUBLIC_HOST || 'https://fourcastapp.vercel.app';

function genId() {
  return crypto.randomUUID();
}

/**
 * Create a single notification for a user.
 */
export async function createNotification(userAddress, type, title, body, data = {}) {
  const addr = userAddress?.toLowerCase();
  if (!addr) return { success: false, error: 'userAddress is required' };

  try {
    const id = genId();
    await execute(
      `INSERT INTO notifications (id, user_address, type, title, body, data_json)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, addr, type, title, body || null, JSON.stringify(data)]
    );
    return { success: true, id };
  } catch (error) {
    console.error('createNotification error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Notify all followers of an analyst that a new signal was published.
 *
 * @param {string} authorAddress - The analyst who published.
 * @param {object} signal - The signal object (id, market_title, confidence, venue, etc.)
 */
export async function notifyFollowers(authorAddress, signal) {
  const author = authorAddress?.toLowerCase();
  if (!author || !signal) return { success: true, notified: 0 };

  try {
    const followers = await getFollowerAddresses(author, FANOUT_LIMIT);
    if (followers.length === 0) return { success: true, notified: 0 };

    const title = signal.market_title
      ? `New signal: ${signal.market_title.substring(0, 80)}`
      : 'New signal from an analyst you follow';

    const body = signal.ai_digest
      ? signal.ai_digest.substring(0, 200)
      : null;

    const data = {
      signalId: signal.id,
      marketTitle: signal.market_title,
      confidence: signal.confidence,
      venue: signal.venue,
      authorAddress: author,
    };
    const dataJson = JSON.stringify(data);

    // Batched inserts — one round-trip per chunk instead of per follower
    let notified = 0;
    for (let i = 0; i < followers.length; i += INSERT_CHUNK) {
      const chunk = followers.slice(i, i + INSERT_CHUNK);
      const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const params = chunk.flatMap((follower) => [
        genId(), follower.toLowerCase(), 'new_signal', title, body, dataJson,
      ]);
      try {
        await execute(
          `INSERT INTO notifications (id, user_address, type, title, body, data_json)
           VALUES ${placeholders}`,
          params
        );
        notified += chunk.length;
      } catch (chunkErr) {
        console.error('notifyFollowers: chunk insert failed:', chunkErr.message);
      }
    }

    // Telegram push for followers who linked a chat — best-effort, chunked
    try {
      const links = await getTelegramChatIds(followers);
      if (links.length > 0) {
        const shortAuthor = `${author.slice(0, 6)}…${author.slice(-4)}`;
        const text = [
          `📊 *${shortAuthor}* published a new signal`,
          ``,
          `*${signal.market_title || 'View signal'}*`,
          signal.confidence ? `Confidence: ${signal.confidence}` : null,
          ``,
          `[View signal →](${APP_URL}/signal/${signal.id})`,
        ].filter((l) => l !== null).join('\n');

        for (let i = 0; i < links.length; i += TELEGRAM_CHUNK) {
          const chunk = links.slice(i, i + TELEGRAM_CHUNK);
          await Promise.allSettled(
            chunk.map((link) => sendTelegramMessage(link.chat_id, text))
          );
        }
        console.log(`[Notifications] Telegram push sent to ${links.length} linked followers`);
      }
    } catch (tgErr) {
      console.error('notifyFollowers: telegram push failed:', tgErr.message);
    }

    console.log(`[Notifications] Notified ${notified}/${followers.length} followers of ${author}`);
    return { success: true, notified };
  } catch (error) {
    console.error('notifyFollowers error:', error);
    return { success: false, error: error.message, notified: 0 };
  }
}

/**
 * Get notifications for a user (newest first).
 */
export async function getNotifications(userAddress, limit = 20, offset = 0) {
  const addr = userAddress?.toLowerCase();
  if (!addr) return { success: false, error: 'userAddress is required' };

  try {
    const rows = await query(
      `SELECT * FROM notifications
       WHERE user_address = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [addr, limit, offset]
    );
    return { success: true, notifications: rows };
  } catch (error) {
    console.error('getNotifications error:', error);
    return { success: false, error: error.message, notifications: [] };
  }
}

/**
 * Get unread notification count for a user.
 */
export async function getUnreadCount(userAddress) {
  const addr = userAddress?.toLowerCase();
  if (!addr) return { success: true, count: 0 };

  try {
    const rows = await query(
      `SELECT COUNT(*) as count FROM notifications
       WHERE user_address = ? AND read = 0`,
      [addr]
    );
    return { success: true, count: rows[0]?.count || 0 };
  } catch (error) {
    console.error('getUnreadCount error:', error);
    return { success: false, error: error.message, count: 0 };
  }
}

/**
 * Mark a single notification as read — scoped to its owner so one user
 * can never mutate another user's rows.
 */
export async function markAsRead(notificationId, userAddress) {
  if (!notificationId) return { success: false, error: 'notificationId is required' };
  const addr = userAddress?.toLowerCase();
  if (!addr) return { success: false, error: 'userAddress is required' };

  try {
    await execute(
      `UPDATE notifications SET read = 1 WHERE id = ? AND user_address = ?`,
      [notificationId, addr]
    );
    return { success: true };
  } catch (error) {
    console.error('markAsRead error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Mark all notifications as read for a user.
 */
export async function markAllAsRead(userAddress) {
  const addr = userAddress?.toLowerCase();
  if (!addr) return { success: false, error: 'userAddress is required' };

  try {
    await execute(
      `UPDATE notifications SET read = 1 WHERE user_address = ? AND read = 0`,
      [addr]
    );
    return { success: true };
  } catch (error) {
    console.error('markAllAsRead error:', error);
    return { success: false, error: error.message };
  }
}
