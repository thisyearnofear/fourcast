-- Migration: 0002_signals_outcome.sql
-- Description: Add outcome tracking columns to signals table
-- Created: 2026-05-22

-- Add outcome column if not exists (for older databases)
ALTER TABLE signals ADD COLUMN outcome TEXT DEFAULT 'PENDING';

-- Add chain origin column if not exists
ALTER TABLE signals ADD COLUMN chain_origin TEXT DEFAULT 'APTOS';

-- Add resolved_at timestamp column
ALTER TABLE signals ADD COLUMN resolved_at INTEGER;