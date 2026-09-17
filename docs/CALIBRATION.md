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
```

Where `actual_outcome` is 1 (win) or 0 (loss).

### Step 3: Aggregate into Buckets

The calibration endpoint groups resolved forecasts by their confidence bucket and reports:

- **Hit rate** — fraction of forecasts in this bucket that won
- **Average Brier** — mean Brier score for this bucket
- **Mean probability** — average predicted probability for this bucket
- **Count** — number of resolved forecasts

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
  - `aiAgentLoop.runAgentLoop()` pulls live bucket hit-rates each cycle and threads them into sizing
- [x] Bucket hit-rates feed into the agent loop as feedback for future confidence tagging
- [ ] Per-source Brier tracking feeds into probability fusion weights (still single-platform)

### Phase 3: Receipt Integration (shipped)
- [x] Calibration block embedded in decision receipts: `buckets`, `bucket`, `shrinkageFactor`, `sampleSize`
- [x] Sample size surfaced so allocators see whether shrinkage is data-driven or default
- [ ] Per-operator calibration dashboards (visible to allocators)
- [ ] Calibration-based operator ranking in signal marketplace

---

## Operational Runbook

### Seeding the curve from historical receipts

The first time the curve renders with no resolved forecasts, seed it from the
receipts already on disk:

```bash
npm run backfill:calibration:dry   # preview what would be inserted
npm run backfill:calibration       # persist one resolved forecast per receipt
```

The script is idempotent: re-running is safe. Each row is keyed by the receipt
content hash.

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

When `getCalibrationAnalysis()` returns fewer than ~20 resolved forecasts per
bucket, the factor defaults to 1.0× (no shrinkage) via the agent loop's
graceful fallback. This avoids shrinking on insufficient data.

---

## Open-Source Pledge

This is not a claim — it is data. Anyone can:

1. Clone `fourcast`
2. Run the agent loop
3. Export `agent_forecasts` where `resolved = 1`
4. Compute Brier scores and bucket analysis
5. Verify the calibration curve matches the raw data

The receipts prove what the agent decided. The Brier scores prove how well it calibrated. The gap between the two tells the full story.
