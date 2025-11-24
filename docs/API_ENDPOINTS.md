# API Reference & Product Roadmap

## Overview

The Fourcast API provides comprehensive access to weather edge analysis, market data, and AI-powered insights for prediction markets. This document covers all available endpoints, their usage, and the product roadmap.

## Base URL

```
Production: https://your-domain.vercel.app/api
Development: http://localhost:3000/api
```

## Authentication

Currently, no authentication is required for read operations. Trading operations require wallet connection through ConnectKit.

**Future:** JWT token authentication for enhanced security and rate limiting.

## Core Endpoints

### Weather Data

#### Get Current Weather
```http
GET /api/weather
```

**Query Parameters:**
- `location` (optional): City name or coordinates
- `units` (optional): 'metric' or 'imperial' (default: 'imperial')

**Response:**
```json
{
  "success": true,
  "weatherData": {
    "location": {
      "name": "New York, NY",
      "region": "New York",
      "country": "United States",
      "coordinates": {
        "lat": 40.7,
        "lon": -74.0
      }
    },
    "current": {
      "temp_f": 72,
      "temp_c": 22.2,
      "condition": "Partly cloudy",
      "wind_mph": 8,
      "wind_kph": 13,
      "humidity": 65,
      "precip_chance": 20,
      "uv": 5
    },
    "forecast": {
      "forecastday": [
        {
          "date": "2024-11-18",
          "day": {
            "maxtemp_f": 75,
            "mintemp_f": 60,
            "condition": "Sunny",
            "maxwind_mph": 12,
            "totalprecip_mm": 0
          }
        }
      ]
    }
  },
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

Note: ID fields may be `marketID`, `id`, or `tokenID`. The UI resolves card state using `marketID || id || tokenID`.

### Market Data

#### Get Weather-Sensitive Markets
```http
POST /api/markets
```

**Request Body:**
```json
{
  "weatherData": { /* weather object */ },
  "location": "New York, NY",
  "eventType": "all",
  "confidence": "MEDIUM",
  "limitCount": 12,
  "analysisType": "discovery", // or "event-weather"
  "platform": "all" // or "polymarket", "kalshi"
}
```

**Response:**
```json
{
  "success": true,
  "markets": [
    {
      "marketID": "token_123",
      "platform": "polymarket", // or "kalshi"
      "title": "Will it rain in NYC tomorrow?",
      "description": "Precipitation forecast for New York City",
      "currentOdds": {
        "yes": 0.25,
        "no": 0.75
      },
      "volume24h": 5000,
      "liquidity": "HIGH",
      "resolutionDate": "2024-11-19T12:00:00Z",
      "weatherRelevance": {
        "impact": "HIGH",
        "factors": ["precipitation", "humidity"],
        "totalScore": 85
      },
      "validation": {
        "marketDataQuality": "GOOD",
        "marketWarnings": []
      }
    }
  ],
  "totalFound": 1,
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

#### Get Market Details
```http
GET /api/markets/{marketID}
```

**Response:**
```json
{
  "success": true,
  "market": {
    "marketID": "token_123",
    "platform": "polymarket",
    "title": "Will it rain in NYC tomorrow?",
    "description": "Precipitation forecast for New York City",
    "currentOdds": {
      "yes": 0.25,
      "no": 0.75
    },
    "volume24h": 5000,
    "liquidity": "HIGH",
    "resolutionDate": "2024-11-19T12:00:00Z",
    "marketMaker": "Polymarket",
    "validation": {
      "market": { /* market validation */ },
      "pricing": { /* pricing validation */ }
    }
  }
}
```

### AI Analysis

#### Analyze Market
```http
POST /api/analyze
```

**Request Body:**
```json
{
  "eventType": "Weather Prediction",
  "location": "New York, NY",
  "currentOdds": {
    "yes": 0.25,
    "no": 0.75
  },
  "participants": "New York City residents",
  "weatherData": { /* weather object */ },
  "marketID": "token_123",
  "eventDate": "2024-11-19T12:00:00Z",
  "mode": "basic",
  "analysisType": "event-weather" // or "discovery"
}
```

**Response:**
```json
{
  "success": true,
  "assessment": {
    "weather_impact": "HIGH",
    "odds_efficiency": "UNDERPRICED",
    "confidence": "MEDIUM"
  },
  "analysis": "Current weather conditions show 80% chance of precipitation tomorrow, but market odds only reflect 25% probability. Weather forecast indicates significant rainfall expected due to approaching cold front. This creates a potential edge of 55% above current market odds.",
  "key_factors": [
    "Cold front approaching NYC region",
    "High humidity levels (85%)",
    "Atmospheric pressure dropping rapidly",
    "Historical accuracy of weather model: 87%"
  ],
  "recommended_action": "BET YES - Strong weather edge identified with 55% expected value",
  "citations": [
    "Weather.gov forecast data",
    "Historical precipitation patterns",
    "Market efficiency studies"
  ],
  "limitations": "Weather predictions inherently uncertain, consider position sizing",
  "cached": false,
  "source": "venice_ai",
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

#### Stream Analysis
```http
POST /api/analyze/stream
```

**Response:** Server-Sent Events (SSE)
```json
data: {"type": "meta", "assessment": {"weather_impact": "HIGH", "odds_efficiency": "UNDERPRICED", "confidence": "MEDIUM"}, "cached": false, "source": "venice_ai", "web_search": false, "timestamp": "2024-11-18T06:17:51.772Z"}

data: {"type": "chunk", "text": "Analyzing current weather conditions for New York City..."}

data: {"type": "chunk", "text": " Weather forecast shows 80% precipitation probability due to approaching cold front."}

data: {"type": "complete", "assessment": {"weather_impact": "HIGH", "odds_efficiency": "UNDERPRICED", "confidence": "MEDIUM"}, "analysis": "Complete analysis with detailed reasoning", "key_factors": ["Factor 1", "Factor 2"], "recommended_action": "BET YES"}
```

### Signal Publishing

#### Publish Signal to SQLite (Immediate)
```http
POST /api/signals
```

**Request Body:**
```json
{
  "event_id": "market.tokenID",
  "market_title": "Will it rain in NYC tomorrow?",
  "venue": "New York, NY",
  "event_time": 1732300000,
  "market_snapshot_hash": "sha256(...)",
  "weather_json": { /* compact weather metrics */ },
  "ai_digest": "Concise reasoning",
  "confidence": "HIGH",
  "odds_efficiency": "INEFFICIENT",
  "author_address": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "signalId": "signal_123",
  "message": "Signal saved to SQLite - publishing to Aptos pending wallet connection",
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

#### Update Signal with Aptos Transaction Hash
```http
PATCH /api/signals
```

**Request Body:**
```json
{
  "signalId": "signal_123",
  "txHash": "0x123456789..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Signal updated with Aptos transaction hash",
  "timestamp": "2024-11-18T06:17:52.123Z"
}
```

#### List Latest Signals
```http
GET /api/signals
```

**Query Parameters:**
- `limit` (optional): Number of signals to return (default: 20)

**Response:**
```json
{
  "success": true,
  "signals": [
    {
      "id": "signal_123",
      "event_id": "market.tokenID",
      "market_title": "Will it rain in NYC tomorrow?",
      "venue": "New York, NY",
      "event_time": 1732300000,
      "market_snapshot_hash": "sha256(...)",
      "weather_json": { /* compact weather metrics */ },
      "ai_digest": "Concise reasoning",
      "confidence": "HIGH",
      "odds_efficiency": "INEFFICIENT",
      "author_address": "0x...",
      "tx_hash": "0x123456789...",
      "timestamp": 1732300100
    }
  ],
  "total": 1,
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

### Reputation System

#### Get Leaderboard
```http
GET /api/leaderboard
```

**Query Parameters:**
- `limit` (optional): Number of top analysts to return (default: 10)

**Response:**
```json
{
  "success": true,
  "leaderboard": [
    {
      "address": "0x...",
      "signalCount": 42,
      "predictionCount": 128,
      "accuracy": 0.78,
      "reputationScore": 95.5
    }
  ],
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

#### Get User Profile
```http
GET /api/profile/{address}
```

**Response:**
```json
{
  "success": true,
  "profile": {
    "address": "0x...",
    "signalCount": 42,
    "predictionCount": 128,
    "accuracy": 0.78,
    "reputationScore": 95.5,
    "firstPrediction": "2024-01-15T12:00:00Z",
    "latestSignals": [/* recent signals */],
    "topMarkets": [/* most analyzed markets */]
  },
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

### Trading Operations

#### Place Order
```http
POST /api/orders
```

**Request Body:**
```json
{
  "marketID": "token_123",
  "side": "YES",
  "price": 0.25,
  "quantity": 100,
  "walletAddress": "0x...",
  "chainId": 56
}
```

**Response:**
```json
