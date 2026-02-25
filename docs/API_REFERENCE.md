# API Reference

## Base URL
```
http://localhost:3000/api  # Development
https://yourdomain.com/api # Production
```

---

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
Stream AI analysis response (SSE).

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
