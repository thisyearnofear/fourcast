-- Migration: 0004_follows_notifications.sql
-- Description: Follow system and notifications for engagement loops
-- Created: 2026-07-12

-- Follows table — who follows whom (analyst relationships)
CREATE TABLE IF NOT EXISTS follows (
  id TEXT PRIMARY KEY,
  follower_address TEXT NOT NULL,
  following_address TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  UNIQUE(follower_address, following_address)
);

CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_address);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_address);

-- Notifications table — push-style engagement (new signals from followed analysts, etc.)
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  data_json TEXT,
  read INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_address, read, created_at DESC);
