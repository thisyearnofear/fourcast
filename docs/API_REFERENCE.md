# API Reference

## Signals API

### Get Recent Signals
```http
GET /api/signals?limit=20&domain=all&minConfidence=HIGH
```

**Query Parameters:**
| Param | Type | Description | Default |
|-------|------|-------------|---------|
| `limit` | number | Number of signals | 20 |
| `domain` | string | Filter: weather, mobility, all | all |
| `minConfidence` | string | Filter: HIGH, MEDIUM | null |

**Response:**
```json
{
  "success": true,
  "signals": [
    {
      "id": "uuid-...",
      "market_title": "Will it rain in London?",
      "domain": "weather",
      "ai_digest": "High probability of precipitation...",
      "confidence": "HIGH",
      "timestamp": 1735468800
    }
  ]
}
```

### Update Signal Transaction Hash
```http
PATCH /api/signals
Content-Type: application/json

{
  "signalId": "uuid-...",
  "txHash": "0x..."
}
```

---

## Analysis API

### Edge Analysis Request
```http
POST /api/analyze
Content-Type: application/json

{
  "marketID": "market-123",
  "title": "Will it rain?",
  "location": "London",
  "useEdgeAnalyzer": true,
  "domain": "weather"
}
```

---

## Markets API

### Get Markets
```http
GET /api/markets?category=sports&maxDaysToResolution=7&platform=all&limit=50
```

**Query Parameters:**
| Param | Type | Description | Default |
|-------|------|-------------|---------|
| `category` | string | Market category | sports |
| `maxDaysToResolution` | number | Days until resolution | 7 |
| `platform` | string | Filter: polymarket, kalshi, all | all |
| `limit` | number | Number of markets | 50 |

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
      "resolutionDate": "2025-12-30"
    }
  ]
}
```

---

## DeFi Arbitrage API

### Get Arbitrage Opportunities
```http
GET /api/defi/arbitrage?minSpread=5&limit=20&minVolume=50000
```

**Query Parameters:**
| Param | Type | Description | Default |
|-------|------|-------------|---------|
| `minSpread` | number | Minimum spread % | 5 |
| `limit` | number | Number of opportunities | 20 |
| `minVolume` | number | Minimum volume ($) | 50000 |

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
      "liquidityScore": 0.85,
      "capitalEfficiency": 0.92
    }
  ]
}
```

---

## Agent API

### Get Track Record
```http
GET /api/agent/track-record
```

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

### Resolve Forecast
```http
POST /api/agent/resolve
Content-Type: application/json

{
  "marketId": "12345",
  "actualOutcome": 1
}
```

---

## Kalshi Trading API

### Login
```http
POST /api/kalshi/login
Content-Type: application/json

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

### Place Order
```http
POST /api/kalshi/orders
Content-Type: application/json

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

### Get Balance
```http
GET /api/kalshi/balance?token=jwt_token
```

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

## Weather API

### Get Weather
```http
GET /api/weather?location=London&days=3
```

**Response:**
```json
{
  "success": true,
  "weather": {
    "location": "London",
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

## Builder Stats API

### Get Builder Stats
```http
GET /api/builder?action=stats
```

**Response:**
```json
{
  "success": true,
  "stats": {
    "configured": true,
    "dailyVolume": 125000,
    "leaderboard": {
      "rank": 5,
      "totalBuilders": 50,
      "timeframe": "7d"
    },
    "performance": {
      "totalVolume": 875000,
      "avgDailyVolume": 125000
    }
  }
}
```

**Actions:**
- `stats` - All builder stats
- `volume&date=2024-12-19` - Daily volume
- `leaderboard&timeframe=7d` - Rank/position
- `config` - Check configuration
- `performance` - Performance metrics

---

## Database Schema

### agent_forecasts
```sql
CREATE TABLE agent_forecasts (
  id TEXT PRIMARY KEY,
  market_id TEXT NOT NULL,
  market_title TEXT,
  platform TEXT,
  ai_probability REAL NOT NULL,
  market_odds REAL NOT NULL,
  edge REAL NOT NULL,
  confidence TEXT,
  reasoning TEXT,
  key_factors TEXT,
  timestamp INTEGER NOT NULL,
  resolved BOOLEAN DEFAULT 0,
  actual_outcome REAL,
  brier_score REAL,
  resolution_time INTEGER
);
```

### agent_runs
```sql
CREATE TABLE agent_runs (
  id TEXT PRIMARY KEY,
  config TEXT,
  markets_scanned INTEGER,
  candidates_filtered INTEGER,
  forecasts_made INTEGER,
  timestamp INTEGER NOT NULL
);
```

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
- 200: Success
- 400: Bad Request
- 401: Unauthorized
- 404: Not Found
- 500: Internal Server Error

---

## Rate Limits

- Weather API: 15 requests/hour per IP (10-min cache)
- Venice AI: 3 agent runs/hour per IP
- Kalshi Trading: Token expires every 30 minutes
- Movement RPC: Standard testnet limits
