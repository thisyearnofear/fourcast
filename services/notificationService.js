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
import crypto from 'crypto';

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
    const followers = await getFollowerAddresses(author);
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

    let notified = 0;
    for (const follower of followers) {
      const result = await createNotification(
        follower,
        'new_signal',
        title,
        body,
        data
      );
      if (result.success) notified++;
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
 * Mark a single notification as read.
 */
export async function markAsRead(notificationId) {
  if (!notificationId) return { success: false, error: 'notificationId is required' };

  try {
    await execute(
      `UPDATE notifications SET read = 1 WHERE id = ?`,
      [notificationId]
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
