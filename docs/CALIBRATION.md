# Calibration

## The Claim

**Sized on calibrated confidence, not vibes.**

Every forecast Fourcast makes gets a Brier score and a confidence bucket (LOW / MEDIUM / HIGH) the moment it resolves. The calibration curve on `/arena` shows whether the agent's stated confidence actually predicts outcomes.

This is not a policy statement. It is a testable hypothesis, visible in real time, auditable by anyone.

---

## What's Live

| Component | Status | Details |
|-----------|--------|---------|
| Brier scoring | **Live** | Computed automatically on market resolution: `(predicted - actual)²` |
| Confidence buckets | **Live** | Every forecast tagged LOW / MEDIUM / HIGH via `deriveConfidenceBucket()` |
| Calibration curve | **Live** | SVG plot on `/arena` — predicted prob (x) vs hit rate (y), with y=x diagonal |
| Bucketed analysis | **Live** | Hit rate, Brier, mean probability per bucket via `/api/agent/calibration` |
| Source-level calibration | **Live** | Per-platform Brier scores (polymarket, kalshi, etc.) |
| Temporal trend | **Live** | Monthly Brier score bars (last 12 months) |
| Resolution wiring | **Live** | Worker saves forecasts + `resolveForecast()` runs when phases complete |
| Backfill script | **Live** | `npm run backfill:calibration` seeds historical receipts into the curve |
| Calibration-aware Kelly | **Live** | `calculateKellySizing(..., bucketCalibration)` shrinks sizing by hit-rate ratio |
| Decision receipt calibration | **Live** | Each receipt carries `calibration.{buckets, bucket, shrinkageFactor, sampleSize}` |
| Per-operator dashboard | **Planned** | Allocator-facing dashboard with calibration deltas per mandate |
| Streaming resolution | **Planned** | Sub-minute resolution via TxLINE proof feed instead of polling |

---

## Why Calibration Matters

An agent that says "70% likely" should be right 70% of the time across all such calls. If it says 70% but wins only 50%, it is overconfident.

**Overconfidence destroys bankrolls under Kelly sizing.**

A model that says 80% but wins 60% of the time tells Kelly to size **larger** than justified. Over repeated trades this compounds to steady losses. The problem grows with more extreme probabilities — 80-95% is where it hurts most.

Fourcast's system is designed to surface this problem **before** it compounds.

---

## How It Works

### Step 1: Tag Confidence

When `saveForecast()` is called, every prediction gets a confidence bucket:

| Bucket | Criteria | Threshold |
|--------|----------|-----------|
| **HIGH** | Clear signal, strong evidence | `confidence ≥ 0.75` or text confidence `'HIGH'` |
| **MEDIUM** | Some ambiguity, mixed signals | `0.50 ≤ confidence < 0.75` |
| **LOW** | Uncertain, sparse evidence | `confidence < 0.50` |

If confidence is null, defaults to LOW.

### Step 2: Score on Resolution

When a market resolves, `resolveForecast()` computes:

```
brier_score = (ai_probability - actual_outcome)²
log_loss    = -(o·ln(p) + (1-o)·ln(1-p))
```

Where `actual_outcome` is 1 (win) or 0 (loss) — and only those two values.
`resolveForecast()` refuses any other outcome, because a resolution is an
observation, not a placeholder.

Brier is scale-stable and easy to read; log-loss is the stricter sibling that
punishes a confident wrong call hard (a literal `p = 1` on a loss costs ~13.8,
against Brier's 1.0). Log-loss clamps `p` into `[1e-6, 1-1e-6]` before taking the
log — the ledger does contain literal 0 and 1 predictions, and `ln(0)` is
`-Infinity`, which would poison every average it appears in.

### Step 3: Aggregate into Buckets

The calibration endpoint groups resolved forecasts by their confidence bucket and reports:

- **Hit rate** — fraction of forecasts in this bucket that won
- **Average Brier** — mean Brier score for this bucket
- **Average log-loss** — mean binary cross-entropy for this bucket
- **Mean probability** — average predicted probability for this bucket
- **Count** — number of resolved forecasts

Response is `schema: "calibration/v2"`: every metric is camelCase **and** the
original snake_case SQL alias, with the two guaranteed identical
(`tests/calibrationShape.test.js` asserts it). The duplication exists because the
curve, the agent loop and the worker read camelCase while the SQL returned
snake_case — and nothing raised an error about it. Read camelCase in new code.

### Step 4: Visualize

The calibration curve plots each bucket as a dot:

- **X-axis**: predicted probability midpoint (HIGH = 0.875, MEDIUM = 0.625, LOW = 0.25)
- **Y-axis**: actual hit rate
- **Diagonal (dashed)**: perfect calibration

---

## Reading the Curve

A dot on the diagonal means the bucket is perfectly calibrated.

- **Above diagonal** → underconfident. The agent is being too conservative. Could size larger.
- **Below diagonal** → overconfident. The agent is overstating its edge. Must shrink probabilities.

**Gaps between bucket dot-heights** show whether confidence levels are discriminating. If HIGH and MEDIUM hit rates are nearly identical, the buckets are noise. A well-calibrated system shows clear separation: HIGH > MEDIUM > LOW.

---

## Brier Score Reference

| Score | Meaning |
|-------|---------|
| 0.000 | Perfect |
| 0.063 | ~95% accuracy |
| 0.125 | ~87% accuracy |
| 0.250 | Random guessing (baseline) |
| >0.250 | Worse than random |

**Target:** Consistently below 0.25, trending downward over time.

---

## The Data

Every resolved forecast lives in `agent_forecasts` with these fields:

| Field | Type | Purpose |
|-------|------|---------|
| `ai_probability` | REAL | The agent's predicted probability |
| `actual_outcome` | REAL | 1 or 0, set on resolution |
| `brier_score` | REAL | `(ai_probability - actual_outcome)²` |
| `log_loss` | REAL | binary cross-entropy, clamped `p` (migration 0014) |
| `confidence` | TEXT | UI confidence level (HIGH/MEDIUM/LOW) |
| `confidence_bucket` | TEXT | Same, normalized for queries |
| `resolved` | BOOLEAN | 1 when the market has settled |
| `resolution_time` | INTEGER | Unix timestamp of resolution |
| `platform` | TEXT | polymarket, kalshi, etc. |
| `operator_id` | TEXT | Optional, for per-operator tracking |

Query:

```sql
SELECT
  confidence_bucket as bucket,
  COUNT(*) as count,
  SUM(CASE WHEN actual_outcome = 1 THEN 1 ELSE 0 END) / CAST(COUNT(*) AS REAL) as hit_rate,
  AVG(brier_score) as avg_brier,
  AVG(ai_probability) as avg_probability
FROM agent_forecasts
WHERE resolved = 1 AND confidence_bucket IS NOT NULL
GROUP BY confidence_bucket
```

---

## Whose word is it? Per-analyst credibility

`getAnalystCalibration(address)` in `services/db.js` answers a different question
from the curve: not "is the agent calibrated" but "was **this voice** right".
It is the source for any credibility figure we publish or write to memory, and it
is deliberately narrow:

- Counts a signal only when its `outcome` is an explicit **`WIN`/`LOSS` verdict**.
- Reports other values — notably the `'YES'`/`'NO'` **market results** that
  `reputationService.determineSignalOutcome()` writes — in `unmappedOutcomes` and
  **excludes them from the hit rate**. A market that settled YES says nothing
  about whether the author's pick won.
- Returns `ok: false, reason: 'insufficient_sample'` under 3 resolved verdicts
  (`minSamples` option). A credibility figure we cannot support is not produced.
- Attaches `latestTrace` (receipt hash, tx hash, resolved-at) so the number can be
  pointed at a row, plus `venueBreakdown` and `buckets` by confidence.
- Joins `agent_forecasts` **by `operator_id`** for Brier/log-loss evidence. That
  table is keyed by an operator UUID, not a wallet address, so the forecast block
  is usually empty for a signal author and is reported empty rather than filled in.

**What it replaces:** `getLeaderboard().win_rate`, which is
`AVG(odds_efficiency = 'EFFICIENT')` — how often the price around a signal was
efficient, not whether the call was right. It stays in the leaderboard UI because
it is a reasonable ranking signal there, and it is a wrong thing to print as
credibility. `tests/analystCalibration.test.js` pins the difference.

---

## Roadmap

### Phase 1: Calibration Tracking (done)
- [x] Brier score on resolution
- [x] Confidence bucket on forecast save
- [x] `/api/agent/calibration` endpoint
- [x] Calibration curve on `/arena`
- [x] Temporal Brier trend
- [x] Source-level calibration (per-platform)

### Phase 2: Calibration-Driven Sizing (shipped)
- [x] Confidence-based Kelly shrinkage: `kelly_adjusted = kelly_base * shrinkage_factor(bucket)`
  - `kellySizing.calculateKellySizing()` accepts `bucketCalibration` and applies shrink capped at [0.25×, 1.5×]
  - `readCalibrationForSizing()` (`services/domain/decision/bucketCalibration.js`) is the single
    translation from analysis to sizing map — the agent loop and the headless worker both call it
- [x] Bucket hit-rates feed into the agent loop as feedback for future confidence tagging
- [ ] Per-source Brier tracking feeds into probability fusion weights (still single-platform)

### Phase 3: Receipt Integration (shipped)
- [x] Calibration block embedded in decision receipts: `buckets`, `bucket`, `shrinkageFactor`, `sampleSize`, `droppedBuckets`
- [x] Sample size surfaced so allocators see whether shrinkage is data-driven or default
- [ ] Per-operator calibration dashboards (visible to allocators)
- [ ] Calibration-based operator ranking in signal marketplace

### Phase 4: Make the numbers true (shipped)
- [x] `calibration/v2`: camelCase canonical, snake_case aliases retained, both asserted identical in tests
- [x] Binary log-loss stored on resolution (migration 0014) + `backfillForecastLogLoss()` for rows predating it
- [x] One shared reader (`readCalibrationForSizing()`) replacing the two copies of the broken reduce
- [x] Per-bucket minimum sample floor, so shrinkage engages on evidence rather than on n=1
- [x] `resolveForecast()` accepts 0/1 only — a resolution is an observation, not a placeholder
- [x] `getAnalystCalibration(address)` — per-voice credibility from verdicts only, the source for on-chain memory
- [x] Memory-derived calibration feeding the same sizing path (`docs/WALRUS_MEMORY.md`, WP3) — `readSizingCalibration()` is the `db → memory` precedence both `aiAgentLoop.js` and the agent worker call, so a stored rung changes `sizePct` through the shared Kelly function; `/api/decision/whatif` is the surface that shows the difference

---

## Operational Runbook

### Seeding the curve from historical receipts

The first time the curve renders with no resolved forecasts, seed it from the
receipts already on disk:

```bash
npm run backfill:calibration:dry   # preview what would be inserted
npm run backfill:calibration       # persist one forecast per receipt
```

The script is idempotent: re-running is safe. Each row is keyed by the receipt
content hash.

Only receipts whose file carries a real reconciliation outcome (`reconciliation.
outcome.winner` from the TxLINE proof) are resolved during the backfill. The rest
are saved **unresolved** and get scored by the worker once their fixture settles —
the curve fills in as evidence arrives, never by inventing a result. The dry run
prints `outcome=pending (no recorded result)` for those rows.

### Closing the loop each cycle

The fourcast worker and the Delphi sweep now call `resolveForecast()` whenever
a market settles:

1. **fourcast-agent** (autonomous, every cycle): the historical-lab phase
   `proof_reconciled` triggers `resolveForecast(fixtureId, outcome)` where
   outcome is read from the replay fixture's `proof.outcome.homeWon`.
2. **delphi-sweep** (per wave): redeemed positions resolve to outcome = 1,
   liquidated (expired) positions resolve to outcome = 0.
3. **Manual**: `resolveForecast('market-id', 1|0)` from the Turso console.

### Tuning shrinkage

The shrinkage factor is applied as:

```
shrinkage = clamp(observedHitRate / nominalHitRate, 0.25, 1.5)
nominalHitRate = { LOW: 0.35, MEDIUM: 0.55, HIGH: 0.75 }
```

A HIGH bucket that hits 60% will have its sizing multiplied by 0.8×. A LOW
bucket that hits 50% will see 1.43× — a confidence boost. The cap at 1.5×
keeps uncalibrated hot streaks from runaway Kelly oversizing.

**Thin buckets are dropped, not trusted.** `services/domain/decision/bucketCalibration.js`
reads the analysis and omits any bucket with fewer than
`FOURCAST_CALIBRATION_MIN_BUCKET` resolved forecasts (default **5**). An absent
bucket means "no evidence", which `calculateKellySizing()` already treats as a
1.0× factor, so sizing does not move on one lucky call. `readCalibrationForSizing()`
returns the omitted buckets in `droppedBuckets` so a receipt can show *why* a
bucket did not shrink.

**A cold deployment reads the same rule off the chain.** `readCalibrationForSizing()`
is the DB path; `readSizingCalibration()` in `services/memory/calibrationMemory.js`
wraps it with `db → memory` precedence and is what `services/aiAgentLoop.js` and
`scripts/fourcast-agent-worker.mjs` call. Our own ledger always wins — a stored
snapshot is a fallback for a deployment whose `agent_forecasts` is empty, never an
override. The fallback reads the newest `fourcast.window` rung that carries enough
evidence, and it applies the **identical** `FOURCAST_CALIBRATION_MIN_BUCKET` floor:
window memories store `buckets=HIGH:0.900/…` *and* `bucket_n=HIGH:20/…`, and a rate
whose count is not visible in the memory is refused outright. So a memory can never
outrank the live ledger on thinner evidence. Whatever moves the size is stamped into
the receipt as `calibration.source` (`'db'` or `'walrus-memory'`) plus the memory's
`blobId`, `textHash`, `version` and `asOf` — the calibration block stays outside the
integrity hash, so historical receipts still verify.

This floor is new: before the camelCase fix the shrinkage never fired at all
(`Number.isFinite(b.hitRate)` was reading a field the query never returned, so
every bucket looked uncalibrated), which means every resolved forecast count in
the ledger is evidence for shrinkage that has not been applied until now. Turning
it on against n=1 buckets would have been the same mistake in the other direction.

**The 25% position cap can hide the shrink.** At a large edge, Kelly saturates
`sizePct` at 0.25 both before and after calibration, so the factor shows up in
`calibrationFactor` on the receipt but not in size. Only below saturation does it
change the allocation.

### Backfilling log-loss

Forecasts resolved before migration 0014 have `brier_score` and a NULL
`log_loss`. Nothing new is scored by the backfill — each value is recomputed from
the `ai_probability` and `actual_outcome` already in the row, so it is the same
number `resolveForecast()` would have written at the time. Rows whose outcome is
not 0/1 (the old synthetic backfill wrote 0.5) are skipped and counted in
`skippedNonBinary`.

```bash
npm run backfill:log-loss:dry   # how many rows would be filled
npm run backfill:log-loss       # persist them
```

---

## Open-Source Pledge

This is not a claim — it is data. Anyone can:

1. Clone `fourcast`
2. Run the agent loop
3. Export `agent_forecasts` where `resolved = 1`
4. Compute Brier scores and bucket analysis
5. Verify the calibration curve matches the raw data

The receipts prove what the agent decided. The Brier scores prove how well it calibrated. The gap between the two tells the full story.
