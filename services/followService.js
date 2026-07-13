/**
 * Follow Service — analyst follow/unfollow relationships.
 *
 * Uses the db.js query/execute helpers for Turso/SQLite abstraction.
 * Addresses are normalised to lowercase everywhere.
 */

import { query, execute } from './db.js';
import crypto from 'crypto';

function genId() {
  return crypto.randomUUID();
}

/**
 * Follow an analyst.
 * @param {string} followerAddress - The user who is following.
 * @param {string} followingAddress - The analyst being followed.
 */
export async function followUser(followerAddress, followingAddress) {
  const follower = followerAddress?.toLowerCase();
  const following = followingAddress?.toLowerCase();

  if (!follower || !following) {
    return { success: false, error: 'followerAddress and followingAddress are required' };
  }
  if (follower === following) {
    return { success: false, error: 'Cannot follow yourself' };
  }

  try {
    await execute(
      `INSERT OR IGNORE INTO follows (id, follower_address, following_address)
       VALUES (?, ?, ?)`,
      [genId(), follower, following]
    );
    return { success: true };
  } catch (error) {
    console.error('followUser error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Unfollow an analyst.
 */
export async function unfollowUser(followerAddress, followingAddress) {
  const follower = followerAddress?.toLowerCase();
  const following = followingAddress?.toLowerCase();

  if (!follower || !following) {
    return { success: false, error: 'followerAddress and followingAddress are required' };
  }

  try {
    await execute(
      `DELETE FROM follows WHERE follower_address = ? AND following_address = ?`,
      [follower, following]
    );
    return { success: true };
  } catch (error) {
    console.error('unfollowUser error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check if one user follows another.
 */
export async function isFollowing(followerAddress, followingAddress) {
  const follower = followerAddress?.toLowerCase();
  const following = followingAddress?.toLowerCase();

  if (!follower || !following) return { success: true, isFollowing: false };

  try {
    const rows = await query(
      `SELECT 1 FROM follows WHERE follower_address = ? AND following_address = ? LIMIT 1`,
      [follower, following]
    );
    return { success: true, isFollowing: rows.length > 0 };
  } catch (error) {
    console.error('isFollowing error:', error);
    return { success: false, error: error.message, isFollowing: false };
  }
}

/**
 * Get list of followers for an analyst.
 */
export async function getFollowers(address, limit = 100) {
  const addr = address?.toLowerCase();
  if (!addr) return { success: false, error: 'address is required' };

  try {
    const rows = await query(
      `SELECT follower_address, created_at FROM follows
       WHERE following_address = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [addr, limit]
    );
    return { success: true, followers: rows };
  } catch (error) {
    console.error('getFollowers error:', error);
    return { success: false, error: error.message, followers: [] };
  }
}

/**
 * Get list of users that an address is following.
 */
export async function getFollowing(address, limit = 100) {
  const addr = address?.toLowerCase();
  if (!addr) return { success: false, error: 'address is required' };

  try {
    const rows = await query(
      `SELECT following_address, created_at FROM follows
       WHERE follower_address = ?
       ORDER BY created_at DESC
       LIMIT ?`,
      [addr, limit]
    );
    return { success: true, following: rows };
  } catch (error) {
    console.error('getFollowing error:', error);
    return { success: false, error: error.message, following: [] };
  }
}

/**
 * Get follower count for an analyst.
 */
export async function getFollowerCount(address) {
  const addr = address?.toLowerCase();
  if (!addr) return { success: true, count: 0 };

  try {
    const rows = await query(
      `SELECT COUNT(*) as count FROM follows WHERE following_address = ?`,
      [addr]
    );
    return { success: true, count: rows[0]?.count || 0 };
  } catch (error) {
    console.error('getFollowerCount error:', error);
    return { success: false, error: error.message, count: 0 };
  }
}

/**
 * Get the list of addresses that an analyst's followers should be notified.
 * Returns array of follower addresses (lowercase).
 */
export async function getFollowerAddresses(address, limit = 500) {
  const addr = address?.toLowerCase();
  if (!addr) return [];

  try {
    const rows = await query(
      `SELECT follower_address FROM follows WHERE following_address = ?
       ORDER BY created_at ASC LIMIT ?`,
      [addr, limit]
    );
    return rows.map(r => r.follower_address);
  } catch (error) {
    console.error('getFollowerAddresses error:', error);
    return [];
  }
}
