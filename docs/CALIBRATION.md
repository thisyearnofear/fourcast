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
| Calibration factor adjustment | **Planned** | Shrink raw LLM probabilities toward 50% based on historical bucket hit-rates |
| Per-source weight adjustment | **Planned** | Dynamically adjust fusion weights as each source's Brier score changes |
| Reconciliation Brier integration | **Planned** | Link calibration scores to decision receipts |

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

### Phase 2: Calibration-Driven Sizing (planned)
- [ ] Confidence-based Kelly shrinkage: `kelly_adjusted = kelly_base * calibration_factor(bucket)`
- [ ] Bucket hit-rates feed into the agent loop as feedback for future confidence tagging
- [ ] Per-source Brier tracking feeds into probability fusion weights

### Phase 3: Receipt Integration (planned)
- [ ] Calibration score embedded in decision receipts
- [ ] Per-operator calibration dashboards (visible to allocators)
- [ ] Calibration-based operator ranking in signal marketplace

---

## Open-Source Pledge

This is not a claim — it is data. Anyone can:

1. Clone `fourcast`
2. Run the agent loop
3. Export `agent_forecasts` where `resolved = 1`
4. Compute Brier scores and bucket analysis
5. Verify the calibration curve matches the raw data

The receipts prove what the agent decided. The Brier scores prove how well it calibrated. The gap between the two tells the full story.
