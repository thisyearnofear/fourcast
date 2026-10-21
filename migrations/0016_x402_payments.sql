-- Migration: 0016_x402_payments.sql
-- Description: Ledger of x402 payments settled on Sui (WP5).
--
-- x402 on Sui is self-facilitated here: the buyer transfers USDC on Sui and
-- sends the transaction digest; we re-read the transaction block through the
-- Tatum Sui RPC and only then deliver the paid resource. This table is the
-- receipt trail for that exchange, and it is what makes the payment
-- non-replayable: `tx_digest` is UNIQUE, so one on-chain transaction can
-- settle exactly one request.
--
-- `usdc` is always an INTEGER count of USDC base units (micro-USDC, 6
-- decimals) — never a float, never a human string. Amounts that are not
-- known are not written as 0; the row simply is not created.
--
-- `status` is one of:
--   claimed    — the digest is reserved and the resource is being produced
--   delivered  — the resource was produced and handed over
--   failed     — the resource could not be produced (the money still moved,
--                and the row says so rather than hiding it)
--
-- `answer_key` identifies the thing that was paid for (the per-answer spend
-- ceiling is summed over it) and `run_id` identifies a run (the per-run cap).
-- Both are part of the spend arithmetic, so both are indexed.

CREATE TABLE IF NOT EXISTS x402_payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tx_digest TEXT UNIQUE NOT NULL,
  answer_key TEXT NOT NULL,
  payer TEXT,
  seller TEXT,
  usdc INTEGER NOT NULL,
  network TEXT NOT NULL,
  resource TEXT,
  run_id TEXT,
  request_hash TEXT,
  status TEXT NOT NULL DEFAULT 'claimed',
  signal_id TEXT,
  blob_id TEXT,
  error TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  delivered_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_x402_payments_answer ON x402_payments(answer_key);
CREATE INDEX IF NOT EXISTS idx_x402_payments_run ON x402_payments(run_id);
CREATE INDEX IF NOT EXISTS idx_x402_payments_status ON x402_payments(status);
CREATE INDEX IF NOT EXISTS idx_x402_payments_created ON x402_payments(created_at);
