# API Reference

## Base URL
```
http://localhost:3000/api  # Development
https://yourdomain.com/api # Production
```

---

## Flagship Endpoints — Mandate Control, Proof Theatre, Diligence

These endpoints drive the flagship route: Mandate Control (`/agent`) → Proof Theatre (`/world-cup`) → Diligence (`/positions`).

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

---

## Supporting Endpoints — Markets, Signals, Trading

The following endpoints support the `/markets`, `/signals`, and `/labs` routes. They are secondary to the flagship TxLINE-primary route.

## Analysis Endpoints

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
    "useSynthData": true,
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
    "weatherData": { ... },
    "synthData": { ... }
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

### POST /agent/resolve
Resolve a forecast with actual outcome.

**Request:**
```json
{
  "marketId": "12345",
  "actualOutcome": 1
}
```

---

## Leaderboard & Stats

### GET /leaderboard
Get top analysts leaderboard.

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
