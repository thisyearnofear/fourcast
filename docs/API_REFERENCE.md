# API Reference

## Base URL
```
http://localhost:3000/api  # Development
https://yourdomain.com/api # Production
```

---

## Operator intake

### POST /talk
Operator **Talk to us** capture (under Privacy check). Body: `{ email, sizes?, note?, source? }`. Stores in `operator_leads`; optional Telegram notify to `TELEGRAM_ADMIN_CHAT_ID`. Honeypot field `website` must be empty.

---

## Decision-receipt endpoints (supporting — Mandate / world-cup / positions)

HackCanton wedge APIs are under `/api/canton/*` (see Canton section below). The routes here power Mandate (`/agent`), decision receipts (`/world-cup`), and public track record (`/positions`).

### GET /worldcup/fixtures
Fetch World Cup fixtures (live TxLINE or cached replay).

**Response:**
```json
{
  "success": true,
  "fixtures": [
    {
      "id": "18175981",
      "home": { "name": "France", "code": "FRA", "score": 3 },
      "away": { "name": "Sweden", "code": "SWE", "score": 0 },
      "status": "final",
      "kickoff": "2026-06-30T18:00:00Z",
      "odds": { "implied": { "home": 0.61, "draw": 0.22, "away": 0.17 } },
      "proof": { "merkleRoot": "...", "dailyRootPda": "..." }
    }
  ]
}
```

### GET /worldcup/verify?fixtureId=X
The canonical verification chain — walks the full proof path in one call. Used by Mandate Control (eagerly), Decision Dossier, and Proof Theatre.

**Response:**
```json
{
  "success": true,
  "receipt": {
    "id": "...",
    "createdAt": "2026-06-30T17:55:00Z",
    "policy": { "version": "decision-policy/v1", "maxAllocationPct": 0.025, "minAbsoluteEdge": 0.05, "maxLossProbability": 0.75 },
    "evidence": { "sources": ["txline"], "snapshot": { "capturedAt": "...", "consensusOdds": { "implied": { "home": 0.61, "draw": 0.22, "away": 0.17 } } } },
    "decisions": [{ "forecast": { "probability": 0.64, "marketOdds": 0.61, "edge": 0.03 }, "decision": { "verdict": "ALLOCATE", "allocationPct": 0.025, "riskChecks": [...] } }],
    "simulation": { "runs": 10000, "seed": 42, "winProbability": 0.64, "lossProbability": 0.36, "interval": { "p05": -0.5, "p50": 0.12, "p95": 1.8 } },
    "integrity": { "contentHash": "sha256...", "algorithm": "sha256" }
  },
  "proof": { "merkleRoot": "...", "sequence": 991 },
  "verification": { "verdict": "verified", "checks": [...], "explorerUrl": "https://explorer.solana.com/address/..." },
  "reconciliation": { "status": "reconciled", "outcome": { "homeScore": 3, "awayScore": 0, "winner": "home" }, "adherence": { "policyAdhered": true, "calibrationError": 0.03 }, "integrity": { "receiptIntact": true, "receiptHash": "sha256..." } }
}
```

### GET /worldcup/edge?fixtureId=X
Cross-venue edge detection — TxLINE demargined consensus vs Polymarket binary YES prices.

### GET /worldcup/replay?fixtureId=X
Cached TxLINE event timeline for the replay viewer.

### GET /worldcup/status
Adapter mode (live vs replay), cutoff timestamp, replay count.

### GET /agent/historical-lab
Latest VPS historical lab heartbeat. Drives the Mandate Control hero.

**Response:**
```json
{
  "success": true,
  "status": {
    "ok": true,
    "mode": "replay",
    "dataMode": "historical-lab",
    "agentTime": "2026-06-30T18:30:00Z",
    "hostname": "vps-1",
    "dryRun": true,
    "policy": { "maxAllocationPct": 0.025, "minAbsoluteEdge": 0.05, "maxLossProbability": 0.75, "simulationRuns": 10000 },
    "receipts": [{ "fixtureId": "18175981", "verdict": "ALLOCATE", "receiptHash": "sha256...", "phase": "proof_reconciled", "reconciliationStatus": "reconciled", "timeline": { "decisionAvailableAt": "...", "outcomeAvailableAt": "..." } }]
  }
}
```

### POST /agent/historical-lab
Authenticated worker heartbeat receiver (bearer token required).

### GET /agent/runs
Persisted decision ledger — every agent run with receipts, verdicts, and execution status.

### GET /agent/track-record
Agent forecasting performance: win rate, Brier score, calibration, verdict mix.

### GET /agent/track-record/[operatorId]
Per-operator Track Record URL — the public surface a concierge DM points a prospect at (GTM §2.2 step 4). Returns the same shape as the global `/agent/track-record`, scoped to forecasts the operator wrote with their `operator_id`, plus their persisted mandate so the `/agent/[operatorId]` page can show the policy the track record was produced under.

**Response:**
```json
{
  "success": true,
  "operatorId": "uuid-here",
  "stats": { "total_forecasts": 42, "resolved_forecasts": 28, "avg_brier_score": 0.187, "high_conf_brier": 0.142, "high_conf_count": 12 },
  "recentForecasts": [/* resolved forecasts scoped to this operator */],
  "mandate": {
    "operatorId": "uuid-here",
    "minAbsoluteEdge": 0.05,
    "maxAllocationPct": 0.03,
    "maxLossProbability": 0.75,
    "simulationRuns": 10000,
    "policyVersion": "decision-policy/v1",
    "displayName": "Operator Name",
    "createdAt": 1721712000,
    "updatedAt": 1721712000
  }
}
```

### POST /agent/dry-run
Self-serve dry-run preview — the in-browser version of the concierge test's "hand-roll a mandate and see what it would have decided" step (GTM §2.2). Reuses the canonical decision domain modules (`createDecisionPolicy`, `simulateBinaryMarket`, `evaluateDecision`, `buildDecisionReceipt`) to produce a real verdict + gate checks + simulation **without writing to disk, posting a heartbeat, or executing anything**.

**Request:**
```json
{
  "fixtureId": "18175981",
  "minAbsoluteEdge": 0.05,
  "maxAllocationPct": 0.03,
  "maxLossProbability": 0.75,
  "simulationRuns": 10000
}
```

All fields optional; defaults to the canonical France–Sweden fixture with worker-default policy knobs. Invalid values are clamped to safe bounds.

**Response:**
```json
{
  "success": true,
  "fixture": { "id": "18175981", "home": { "name": "France" }, "away": { "name": "Sweden" }, "competition": "World Cup" },
  "policy": { "version": "decision-policy/v1", "minAbsoluteEdge": 0.05, "maxAllocationPct": 0.03, "maxLossProbability": 0.75, "simulationRuns": 10000 },
  "recommendation": { "aiProbability": 0.666, "marketOdds": 0.61, "edge": 0.056, "sizePct": 0.021 },
  "simulation": { "runs": 10000, "seed": 12345, "valid": true, "winProbability": 0.666, "lossProbability": 0.334, "expectedReturn": 0.094, "interval": { "p05": -1, "p50": 0.094, "p95": 0.639 } },
  "decision": { "verdict": "ALLOCATE", "allocationPct": 0.021, "executionEligible": true, "rationale": "Policy cleared: 2.1% allocation within risk limits.", "riskChecks": [/* 5 gate checks */] },
  "receipt": { "proof": { "schemaVersion": "decision-receipt/v1", "policy": {}, "evidence": {}, "decisions": [], "execution": { "attempted": 0, "completed": 0, "failed": 0, "dryRun": true }, "integrity": { "algorithm": "sha256", "contentHash": "abc123..." } }
}
```

### POST /agent/mandate
Persist a mandate draft (Slice 4 of the self-serve concierge path). The client sends the four policy knobs; the server assigns (or reuses) an `operator_id` and returns it. The client stores the `operator_id` in localStorage so subsequent saves update the same mandate.

**Request:**
```json
{
  "operatorId": "uuid-here",
  "minAbsoluteEdge": 0.05,
  "maxAllocationPct": 0.03,
  "maxLossProbability": 0.75,
  "simulationRuns": 10000,
  "displayName": "Optional display name"
}
```

`operatorId` is optional on first save (server mints a UUID); reuse it on subsequent saves to update in place.

**Response:**
```json
{
  "success": true,
  "operatorId": "uuid-here",
  "updatedAt": 1721712000,
  "trackRecordUrl": "/agent/uuid-here"
}
```

### GET /agent/mandate?operatorId=<uuid>
Read a persisted mandate draft. Used by the `/agent/[operatorId]` page to pre-populate the MandateBuilder with the operator's saved policy.

**Response:**
```json
{
  "success": true,
  "mandate": {
    "operatorId": "uuid-here",
    "minAbsoluteEdge": 0.05,
    "maxAllocationPct": 0.03,
    "maxLossProbability": 0.75,
    "simulationRuns": 10000,
    "policyVersion": "decision-policy/v1",
    "displayName": "Operator Name",
    "createdAt": 1721712000,
    "updatedAt": 1721712000
  }
}
```

Returns `{ "success": true, "mandate": null }` for an unknown `operatorId`.

### GET /cron/daily-summary
Generates the GTM §2.2 step 2 daily summary — the 4-line Telegram DM template the concierge forwards to each operator. Triggered by Vercel Cron once per day. Verifies `CRON_SECRET`, reads the latest agent run ledger, formats the summary, and sends it to `TELEGRAM_ADMIN_CHAT_ID`. Scoped to an operator when `FOURCAST_AGENT_OPERATOR_ID` is set.

**Response:**
```json
{
  "success": true,
  "sent": true,
  "chatId": "123456",
  "operatorId": "uuid-here",
  "summary": "Yesterday your agent scanned 8 markets.\nSpotted 3 edges ≥5%.\nSized at 2.1% Kelly per your mandate (min edge 5%, max alloc 3.0%, loss limit 75%).\nDry-run P&L if live: +$6.32 (notional).\n\nTrack record: 42 forecasts, 28 resolved, 0.187 avg Brier.\n\nTrack Record URL: https://fourcastapp.vercel.app/agent/uuid-here"
}
```

### GET /og?type=operator
Per-operator OG share card (1200×630 PNG) — the viral distribution surface per GTM §1. Renders the operator's display name, mandate knobs, and track record stats so a prospect seeing the card on Warpcast/X immediately knows what they'd get by clicking.

**Query params:** `type=operator`, `name`, `total`, `resolved`, `brier`, `minEdge`, `maxAlloc`, `maxLoss`, `simRuns`. Populated automatically by `generateMetadata` on `/agent/[operatorId]`.

### GET /og?type=calibration
Calibration OG card (1200×630 PNG) — the shareable form of "our confidence is
measured, not asserted", and Telegraph P5's social surface.

**Query params:** `type=calibration`, `resolved`, `brier`, `logloss`, `buckets`,
`source`, `schema`. `buckets` takes the same field grammar the memory layer
writes — `LOW:0.410/MED:0.580/HIGH:0.790` — so the card, the curve and the
`window` memory are three renderings of one shape rather than three dialects.

The numbers are passed in by the caller, which reads `/api/agent/calibration`.
A missing metric renders `NA`, never `0`: an absent sample size read as zero is
the bug that once plotted every calibration bucket at hit rate 0.

```
/api/og?type=calibration&resolved=142&brier=0.1871&logloss=0.5123&buckets=LOW:0.410/MED:0.580/HIGH:0.790
```

---

## Memory Endpoints (Total Recall)

### GET /memory/status
What the memory layer is, and whether the memories it claims are actually on
chain. Reports the **local `memory_writes` ledger** (what we intended to append)
and the **chain read** (what exists) side by side and never blends them — if
they disagree, the disagreement is the answer.

Default response is local-only: config plus ledger counts, with **zero** network
calls, so a page load cannot silently spend relayer requests.

**Query params (all opt-in):**

| Param | Effect |
|---|---|
| `kind`, `key` | Scope the ledger rows to one memory kind / key |
| `ladder=1` | Recall the version rungs from the relayer (needs credentials) |
| `reconcile=1` | Diff our ledger against the relayer's memory inventory |
| `proof=1` | Assert each ledger row's `owner` object exists on chain, via Tatum `sui_getObject` |

```
{
  "success": true,
  "schema": "memory-status/v1",
  "memory": { "enabled": false, "configured": false, "writable": false,
              "network": "mainnet", "relayerUrl": "https://relayer.memory.walrus.xyz",
              "minSamples": 20, "accountIdTail": null,
              "reason": "FOURCAST_MEMORY_ENABLED is not \"true\"" },
  "ledger": { "confirmed": 0, "mainnetConfirmed": 0, "byNetwork": [], "byKind": [] },
  "rows": [],
  "chains": { "memory": "mainnet", "settlement": "sui:testnet", "rpc": "mainnet",
              "aligned": false },
  "notes": ["Memory reads are unavailable: FOURCAST_MEMORY_ENABLED is not \"true\"."]
}
```

`chains` names the two chains this layer can span, because they are configured
separately: `memory` is where append-only rungs are written (`SUI_NETWORK`),
`settlement` is where a paid answer settles (`SETTLEMENT_NETWORK`, read through
`services/payments/x402Sui`). `aligned: false` is printed rather than smoothed
over — the x402 verifier refuses a cross-chain read, so the paid rail is dark
until the two name the same chain. Every ledger row and every `ladder=1` rung
carries `blobUrl`, the public aggregator read (`/v1/blobs/<id>`) for that blob.

`proofs[].onchain` is **tri-state**: `exists: true` with
`render: "object=<id>@<version> · digest=… · checkpoint=…"` when Tatum confirms
it, `exists: false` when the chain contradicts us, and `exists: null` with a
reason when the gateway is unreachable or the write was never confirmed. The
last is not a failure — reporting an unproven write as `false` would claim the
chain contradicts us when all we know is that we cannot look.

Memories are **SEAL-encrypted and owner-scoped**: a `blob_id` proves an object
exists, not that anyone can read its text. The route says so in `notes` rather
than letting a blob id imply a public ledger.

### GET /decision/whatif
The question that makes the memory layer worth anything: **would this decision
have been sized differently?** Recomputes one real decision through the same
`calculateKellySizing` the agent uses, once per calibration source, side by
side. No math lives in this route — if it and the worker ever disagreed, the
demo would be a simulation of a simulation.

**Query params (all optional):**

| Param | Effect |
|---|---|
| *(none)* | Sizes the newest **settled** forecast on this host, score included |
| `probability`, `odds`, `bucket` | Size an ad-hoc what-if instead; all three together or nothing is guessed (`bucket` accepts `MED`) |
| `buckets`, `counts` | Rates to size on, in the memory field grammar (`HIGH:0.450/MED:0.580`), with the sample sizes that must clear the floor |
| `blob`, `version`, `asOf` | Provenance to echo on the memory scenario when rates are supplied |
| `memory=1` | The route reads the newest usable `window` rung from the relayer itself — costs one `recall()` |
| `riskTolerance`, `minEdge` | Override the mandate inputs (defaults 0.5 / 0.05) |

```
{
  "success": true, "schema": "whatif/v1", "minBucketCount": 5,
  "input": { "origin": "forecast", "forecastId": "…", "probability": 0.72,
             "odds": 0.6, "bucket": "HIGH",
             "settled": { "outcome": 1, "brierScore": 0.0784, "logLoss": 0.3285,
                          "sizedAs": 0.15 } },
  "scenarios": [ { "key": "uncalibrated|ledger|memory", "label": "…",
                   "calibrationSource": "none|db|walrus-memory",
                   "buckets": {}, "bucketField": "HIGH:0.450", "sampleSize": 34,
                   "droppedBuckets": [], "blobId": "…", "provenance": {},
                   "sizePct": 0.09, "kellyPct": 0.3, "calibrationFactor": 0.6,
                   "deltaVsUncalibrated": -0.06, "actionable": true } ],
  "applied": { "key": "memory", "reason": "…cold-deployment path." },
  "notes": []
}
```

`applied.key` is what the agent would actually size on today, under the
`db → memory` precedence: the scored ledger outranks any stored snapshot of
itself, and memory is the fallback that lets a cold deployment size on evidence
instead of an uncalibrated 1.0x.

Two refusals are the answer, not an error: with no settled forecast and no query
inputs, `input` is `null` and `scenarios` is empty (HTTP 200 — the surface has
nothing to show, not a broken route); and a supplied rate whose `counts` fall
under `minBucketCount()` is dropped into `droppedBuckets` and sizes at 1.0x,
because a rate with no visible `n` is a claim rather than evidence.

`provenance.how` distinguishes `supplied-by-caller` from `relayer-recall`. The
`/arena` Memory lane uses the second: rates this page typed into a query string
cannot prove anything about the blob they name.

---

## Supporting Endpoints — Markets, Signals, Trading

The following endpoints support the `/markets`, `/signals`, and `/labs` routes. They are secondary to the flagship TxLINE-primary route.

## Analysis Endpoints

**Auth:** When `BOT_API_SECRET` is set, Telegram/external callers must send
`x-fourcast-auth: <secret>`. Same-origin browser requests from the Markets UI
are allowed without that header. `/api/analyze/stream` authenticates the
*inbound* request (reconstructed inner Requests drop `Sec-Fetch-*` headers).

### POST /analyze
Generate AI analysis for a market.

**Request:**
```json
{
  "market": {
    "id": "market-123",
    "title": "Will it rain during the Super Bowl?",
    "platform": "polymarket",
    "currentOdds": { "yes": 0.65, "no": 0.35 },
    "endDate": "2025-02-09T23:00:00Z"
  },
  "options": {
    "useWeather": true,
    "analysisMode": "basic"
  }
}
```

**Response:**
```json
{
  "success": true,
  "analysis": {
    "prediction": "YES",
    "aiProbability": 0.72,
    "confidence": "HIGH",
    "reasoning": "Weather conditions favor...",
    "keyFactors": ["Heavy rain expected", "Team A struggles in wet conditions"],
    "weatherData": { ... }
  }
}
```

### POST /analyze/stream
Stream AI analysis progress and final result as newline-delimited JSON.

This endpoint runs the canonical `/api/analyze` execution path once and emits truthful lifecycle events from that request. It is the default analysis endpoint for `/markets`.

**Response stream events:**
```json
{"type":"stage","stage":"accepted","label":"Analysis accepted"}
{"type":"stage","stage":"context","label":"Request validated"}
{"type":"stage","stage":"market","label":"Market resolved"}
{"type":"stage","stage":"sources","label":"Collecting evidence"}
{"type":"stage","stage":"forecast","label":"Running forecast"}
{"type":"stage","stage":"complete","label":"Analysis complete"}
{"type":"complete","status":200,"result":{"success":true,"analysis":{}}}
```

Errors are emitted as `{ "type": "error", "status": number, "error": string }`.

### GET /operator/pulse
Fetch the compact operator liveness snapshot used by the app chrome.

The endpoint only reports persisted agent/autopilot state. It does not fabricate live activity.

**Response:**
```json
{
  "success": true,
  "pulse": {
    "mode": "LIVE",
    "lastRunAt": 1760000000,
    "marketsScanned": 42,
    "candidates": 7,
    "forecastsMade": 5,
    "freshEdges": 2,
    "totalForecasts": 128,
    "latestExecutionAt": 1760000100,
    "latestExecutionStatus": "filled"
  }
}
```

---

## Markets Endpoints

### GET /markets
Fetch prediction markets from Polymarket/Kalshi.

**Query Parameters:**
| Param | Type | Description | Default |
|-------|------|-------------|---------|
| `platform` | string | `polymarket`, `kalshi`, `all` | `all` |
| `category` | string | Market category | `all` |
| `eventType` | string | Sport/event type | `all` |
| `minVolume` | number | Minimum volume (USD) | `0` |
| `maxDaysToResolution` | number | Days until resolution | `30` |
| `limit` | number | Number of markets | `50` |

**Response:**
```json
{
  "success": true,
  "markets": [
    {
      "marketID": "0x...",
      "title": "Will it rain in London?",
      "platform": "polymarket",
      "currentOdds": { "yes": 0.65, "no": 0.35 },
      "volume": 125000,
      "resolutionDate": "2025-12-30",
      "category": "Sports",
      "eventType": "Soccer"
    }
  ]
}
```

### GET /markets/counts
Get market counts by category/sport.

---

## Signals Endpoints

### GET /signals
Fetch published signals.

**Query Parameters:**
| Param | Type | Description | Default |
|-------|------|-------------|---------|
| `limit` | number | Number of signals | `20` |
| `domain` | string | Filter by domain | `all` |
| `minConfidence` | string | `HIGH`, `MEDIUM`, `LOW` | `null` |
| `author` | string | Filter by author address | `null` |

**Response:**
```json
{
  "success": true,
  "signals": [
    {
      "id": "uuid-...",
      "event_id": "market-123",
      "market_title": "Will it rain in London?",
      "venue": "London Stadium",
      "ai_digest": "High probability of precipitation...",
      "confidence": "HIGH",
      "odds_efficiency": "EFFICIENT",
      "author_address": "0x...",
      "timestamp": 1735468800,
      "tx_hash": "0x..."
    }
  ]
}
```

### POST /signals
Publish a new signal.

**Request:**
```json
{
  "event_id": "market-123",
  "market_title": "Will it rain?",
  "venue": "London",
  "ai_digest": "Analysis summary...",
  "confidence": "HIGH",
  "odds_efficiency": "INEFFICIENT",
  "publishToChain": true
}
```

### PATCH /signals
Update signal transaction hash.

**Request:**
```json
{
  "signalId": "uuid-...",
  "txHash": "0x..."
}
```

### POST /signals/resolve
Resolve a signal with outcome.

---

## Paid rail — x402 settled on Sui

### GET /signals/premium
Quote the premium signal. **This is the unpaid answer**: it costs nothing and
returns `402 Payment Required` with a `Payment-Required` header naming the
price, the payee, the settlement network and the accepted scheme (`exact`).

```
{
  "success": false,
  "error": "payment required",
  "x402Version": 1,
  "accepts": [ { "scheme": "exact", "network": "sui:testnet", "maxAmountRequired": "10000", ... } ],
  "price": { "baseUnits": 10000, "usdc": 0.01 },
  "settlementNetwork": "sui:testnet"
}
```

`503` (not `402`) when the leg is deliberately dark or incomplete — the answer
is different depending on why:
`X402_DISABLED` when `X402_ENABLED` is not the literal `"true"`, and
`SELLER_NOT_CONFIGURED` when `X402_SELLER_ADDRESS` is unset (we refuse to quote
a price nobody can pay rather than quote a bogus payee).

### POST /signals/premium
Buy the premium signal. Send the market + analysis in the body and the buyer's
payment in the `X-PAYMENT` header (base64/JSON `x402Version 1` envelope
carrying the Sui transaction digest).

Ordering is the guarantee, and it is the opposite of a metered API:

1. **Spend gates** (`checkSpendGates`) — per-answer ceiling `X402_USDC_CEILING`
   and per-run cap `X402_RUN_CAP_USDC`, pure arithmetic over `x402_payments`,
   evaluated *before* the payment is accepted. A missing ceiling is a refusal
   (`SPEND_CEILING_UNSET`), never "unlimited".
2. **On-chain re-read** through the Tatum Sui RPC: the digest must exist,
   `effects.status` must be `success`, the transfer must reach
   `X402_SELLER_ADDRESS`, in the expected USDC coin, at least the quoted
   amount, **on the settlement network**.
3. **Claim** the digest (`tx_digest` is `UNIQUE`) — replay can never settle a
   second request.
4. **Then** the resource is produced: the signal is published and returned with
   `txHash`, the `memoryStatus` of its `signal:{id}` memory and its `blobId`
   when the memory layer has already written one (memories are written on
   resolution, so a fresh signal usually reports `null` — reported, not
   guessed).

Body: `market`, `analysis` (required); `answerKey` (defaults to
`signal:{eventId}:{snapshotHash}`, the scope of the per-answer ceiling);
`runId` (optional, scopes the per-run cap — a Telegraph job passes one so a
ladder of paid calls has a total, not just a per-step, cost).

`settlementNetwork` is in every response, including errors, because the value
is a property of the money, not of the request. Note the unresolved conflict
documented in `.env.local.example` and `docs/EXECUTION_PLAN.md`: verification
refuses to read a payment on a network other than `SUI_NETWORK`, while the
memory legs require `SUI_NETWORK=mainnet` — so with the default
`SETTLEMENT_NETWORK=testnet` this rail refuses every payment, by design, until
the network question is decided.

---

## DeFi Arbitrage

### GET /defi/arbitrage
Find cross-platform arbitrage opportunities.

**Query Parameters:**
| Param | Type | Description | Default |
|-------|------|-------------|---------|
| `minSpread` | number | Minimum spread % | `5` |
| `limit` | number | Number of opportunities | `20` |
| `minVolume` | number | Minimum volume (USD) | `50000` |

**Response:**
```json
{
  "success": true,
  "opportunities": [
    {
      "id": "arb-...",
      "title": "Will it rain in London?",
      "polymarket": { "yes": 0.60, "no": 0.40 },
      "kalshi": { "yes": 0.70, "no": 0.30 },
      "spread": 10.0,
      "profitPer1k": 100,
      "liquidityScore": 0.85
    }
  ]
}
```

---

## Agent Endpoints

### GET /agent/track-record
Get agent forecasting performance.

**Response:**
```json
{
  "success": true,
  "trackRecord": {
    "totalForecasts": 150,
    "winRate": 0.68,
    "brierScore": 0.18,
    "avgEdge": 0.07,
    "confidenceCalibration": {
      "HIGH": { "predicted": 0.75, "actual": 0.72 },
      "MEDIUM": { "predicted": 0.55, "actual": 0.58 },
      "LOW": { "predicted": 0.35, "actual": 0.33 }
    }
  }
}
```

### GET /agent
Get agent run history.

### GET /agent/calibration
Bucketed calibration over **resolved** forecasts — the evidence the calibration
curve plots and the Kelly shrinkage consumes.

**Query Parameters:**
| Param | Type | Description | Default |
|-------|------|-------------|---------|
| `operatorId` | uuid | Scope to one operator's track record | global |

**Response** (`schema: "calibration/v2"`):
```json
{
  "success": true,
  "schema": "calibration/v2",
  "operatorId": null,
  "summary": {
    "totalResolved": 142, "avgBrier": 0.1871, "avgLogLoss": 0.5123,
    "minBucket": "LOW", "maxBucket": "HIGH",
    "total_resolved": 142, "avg_brier": 0.1871, "avg_log_loss": 0.5123,
    "min_bucket": "LOW", "max_bucket": "HIGH"
  },
  "buckets": [
    {
      "bucket": "HIGH", "count": 61, "hitRate": 0.7869, "avgBrier": 0.1428,
      "avgLogLoss": 0.4351, "avgProbability": 0.83, "midpointConfidence": 0.875,
      "hit_rate": 0.7869, "avg_brier": 0.1428, "avg_log_loss": 0.4351,
      "avg_probability": 0.83
    }
  ],
  "trend": [{ "month": "2026-10", "count": 38, "avgBrier": 0.1702, "avgLogLoss": 0.4881 }],
  "sourceCal": [{ "source": "polymarket", "count": 142, "hitRate": 0.7394, "avgBrier": 0.1871, "avgLogLoss": 0.5123 }]
}
```

Every metric is returned **twice** — camelCase (canonical, what consumers read)
and the original snake_case SQL alias. That duplication is deliberate: the curve
and the sizing loop read camelCase while older callers still read snake_case, and
the mismatch between the two is what made the shrinkage silently do nothing for
its first months. New code reads camelCase.

### POST /agent/resolve
Resolve a forecast with actual outcome.

**Request:**
```json
{
  "marketId": "12345",
  "actualOutcome": 1
}
```

`actualOutcome` must be exactly `1` (won) or `0` (lost). Anything else — a
fraction, a null, a market string — is refused with 400 rather than stored: a
resolution is an observation, and Brier, log-loss, calibration buckets and the
memories derived from them all treat the row as evidence.

---

## Leaderboard & Stats

### GET /leaderboard
Get top analysts leaderboard.

> **`winRate` here is not a hit rate.** `getLeaderboard()` computes it as
> `AVG(odds_efficiency = 'EFFICIENT')` — how often the *market price* was
> efficient around a signal, not whether the author's pick won. It is a fine
> ranking signal for a UI and a wrong thing to publish as credibility. For
> "was this voice right", use `getAnalystCalibration(address)` in
> `services/db.js`, which counts only explicit `WIN`/`LOSS` verdicts and refuses
> samples below 3 (see `docs/CALIBRATION.md`).

**Query Parameters:**
| Param | Type | Description | Default |
|-------|------|-------------|---------|
| `limit` | number | Number of analysts | `20` |
| `timeframe` | string | `7d`, `30d`, `all` | `all` |

**Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "address": "0x...",
      "rank": 1,
      "winRate": 0.75,
      "brierScore": 0.15,
      "totalSignals": 45,
      "tipsEarned": "125.5",
      "tier": "Sage 👑"
    }
  ]
}
```

### GET /stats
Get user statistics.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `address` | string | Wallet address (required) |

**Response:**
```json
{
  "success": true,
  "stats": {
    "totalSignals": 45,
    "winRate": 0.75,
    "brierScore": 0.15,
    "tipsEarned": "125.5",
    "accuracyStreak": 5,
    "tier": "Elite 🌟"
  }
}
```

### GET /profile
Get user profile with signals and stats.

---

## Trading Endpoints

### POST /orders
Place order on Polymarket.

**Request:**
```json
{
  "marketId": "0x...",
  "side": "yes",
  "amount": 100,
  "price": 0.65,
  "orderType": "limit"
}
```

### Kalshi Trading

#### POST /kalshi/login
Authenticate with Kalshi.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "jwt_token",
    "memberId": "member_id",
    "expiry": 1735468800000
  }
}
```

#### POST /kalshi/orders
Place order on Kalshi.

**Request:**
```json
{
  "token": "jwt_token",
  "order": {
    "ticker": "KXBTC-24DEC-100K",
    "action": "buy",
    "side": "yes",
    "count": 10,
    "type": "limit",
    "yes_price": 65
  }
}
```

#### GET /kalshi/balance
Get Kalshi account balance.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `token` | string | JWT token from login |

**Response:**
```json
{
  "success": true,
  "data": {
    "balance": 50000,
    "payout": 0
  }
}
```

---

## Data Endpoints

### GET /weather
Get weather data for location.

**Query Parameters:**
| Param | Type | Description | Default |
|-------|------|-------------|---------|
| `location` | string | City name or coordinates | Auto-detect |
| `days` | number | Forecast days | `3` |

**Response:**
```json
{
  "success": true,
  "weather": {
    "location": {
      "name": "London",
      "country": "UK",
      "lat": 51.5074,
      "lon": -0.1278,
      "localtime": "2025-02-25 14:30"
    },
    "current": {
      "temperature": 15,
      "condition": "Rain",
      "humidity": 85,
      "windSpeed": 20
    },
    "forecast": [
      {
        "date": "2025-12-30",
        "high": 16,
        "low": 12,
        "condition": "Cloudy",
        "precipitationChance": 0.3
      }
    ]
  }
}
```

---

## Validation Endpoints

### GET /validate/location
Validate location for event type.

### GET /validate/weather
Validate weather data availability.

### GET /validate/market-compatibility
Check if market is compatible with analysis.

### GET /validate/order
Validate order parameters.

---

## Utility Endpoints

### GET /predictions
Get prediction health status.

### GET /predictions/health
Health check endpoint.

### GET /wallet
Get wallet status and balance.

### GET /builder
Get Polymarket builder stats.

### POST /farcaster/webhook
Farcaster webhook handler (optional integration).

### GET /og
Generate OpenGraph image for sharing.

---

## Canton Ledger Endpoints (HackCanton DevNet)

Private prediction markets on Canton: Daml-enforced stakeholder privacy, holder-consent
positions, CIP-56 escrow, attestation-bound resolution, atomic settlement.
See `docs/CANTON_ATOMIC_SETTLEMENT.md` for the full model.

### GET /api/canton/health
Ledger connectivity + configuration status.

### GET /api/canton/parties
Known demo parties (operator, Alice, Bob) for the "view as" selector.

### GET /api/canton/balance
Operator balances: `unlocked` vs `lockedInEscrow` (conservation invariant).

### GET /api/canton/markets · POST /api/canton/markets
List markets as a party (`?partyId=`); create a market (`{ question, settlementAsset, deadline }`).

### POST /api/canton/markets/resolve
Issues an evidence attestation and resolves the market (`{ marketContractId, outcome }` in `ResolvedYes|ResolvedNo|Voided`).

### GET /api/canton/positions?partyId=<id>&type=<open|offers|allocations|resolutions|settled|expired>
Position views per party; POST actions: `create-offer` / `accept` / `reject` / `allocate` (holder-consent flow).

### POST /api/canton/settle
Atomic settlement, server-signed. `{ positionContractId, resolutionContractId?, lane?: 'operator'|'holder', holderPartyId? }`.
Resolution + escrow allocation cids auto-discovered. Both CIP-56 legs execute/cancel in the same transaction that archives the position.

### POST /api/canton/settle/prepare
**Holder sovereignty lane.** Builds the exact same settlement payload but returns it UNSIGNED
(`{ actAs, commands, disclosedContracts }`) for the holder's Console Wallet to sign via
`prepareExecuteAndWait`. The server never signs — the holder's key authorizes the payout.
`{ positionContractId, resolutionContractId?, holderPartyId }`.

### GET /api/canton/settle-transfer
Escrow surface report: per-position leg allocation state + settle-readiness (v1 SettlementObligation contracts no longer exist).

---

## Error Responses

All endpoints return consistent error format:

```json
{
  "success": false,
  "error": "Error message"
}
```

**HTTP Status Codes:**
- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `404`: Not Found
- `500`: Internal Server Error

---

## Rate Limits

| Endpoint | Limit |
|----------|-------|
| `/api/analyze` | 3 requests/hour per IP |
| `/api/weather` | 15 requests/hour per IP |
| `/api/signals` | Standard API limits |
| `/api/kalshi/*` | Token expires every 30 minutes |
| `/api/defi/arbitrage` | 10 requests/minute |

---

## Authentication

Most endpoints are public. Authentication required for:
- `/api/signals` (POST) - Wallet signature
- `/api/orders` - Wallet connection
- `/api/kalshi/*` - JWT token from login

### Wallet Authentication (Aptos/Movement)
```javascript
// Sign message with wallet
const message = "Sign to authenticate with Fourcast";
const signature = await wallet.signMessage(message);

// Include in request headers
headers: {
  "X-Wallet-Address": address,
  "X-Signature": signature
}
```
