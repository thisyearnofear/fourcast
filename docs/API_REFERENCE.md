# API Reference

## Signals API

The unified endpoint for retrieving intelligence signals from all domains.

### Get Recent Signals

```http
GET /api/signals
```

**Query Parameters:**

| Param | Type | Description | Default |
|-------|------|-------------|---------|
| `limit` | `number` | Number of signals to return | `20` |
| `domain`| `string` | Filter by domain (`weather`, `mobility`, `all`) | `all` |
| `minConfidence` | `string` | Filter by confidence (`HIGH`, `MEDIUM`) | `null` |

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
      "weather_json": { ... }, 
      "timestamp": 1735468800
    },
    {
      "id": "uuid-...",
      "market_title": "Knicks Game High Turnout?",
      "domain": "mobility",
      "ai_digest": "Traffic patterns indicate heavy congestion...",
      "confidence": "MEDIUM",
      "weather_json": null,
      "timestamp": 1735468900
    }
  ]
}
```

---

## Analysis API

### Edge Analysis Request

Directly invoke the Edge Analyzer engine (for testing or client-side use).

```http
POST /api/analyze
```

**Body:**

```json
{
  "marketID": "market-123",
  "title": "Will it rain?",
  "location": "London",
  "useEdgeAnalyzer": true,  // Force use of new architecture
  "domain": "weather"       // Optional: explicit domain hint
}
```
