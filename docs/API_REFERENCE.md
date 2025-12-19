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

#### Get Market Details
```http
GET /api/markets/{marketID}
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

#### List Latest Signals
```http
GET /api/signals
```

**Query Parameters:**
- `limit` (optional): Number of signals to return (default: 20)

### Reputation System

#### Get Leaderboard
```http
GET /api/leaderboard
```

#### Get User Profile
```http
GET /api/profile/{address}
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

### Validation Endpoints

#### Location Validation
```http
POST /api/validate/location
```

**Request Body:**
```json
{
  "eventType": "NFL",
  "location": "New York, NY",
  "additionalContext": {
    "title": "Team A vs Team B"
  }
}
```

#### Weather Validation
```http
POST /api/validate/weather
```

#### Order Validation
```http
POST /api/validate/order
```

#### Market Compatibility
```http
POST /api/validate/market-compatibility
```

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid location provided",
    "details": {
      "field": "location",
      "value": "invalid_location",
      "expected": "Valid city name or coordinates"
    }
  },
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

### Common Error Codes

| Code                     | HTTP Status | Description                     |
| ------------------------ | ----------- | ------------------------------- |
| `VALIDATION_ERROR`       | 400         | Invalid input parameters        |
| `WEATHER_API_ERROR`      | 502         | External weather API failure    |
| `AI_SERVICE_ERROR`       | 503         | AI analysis service unavailable |
| `MARKET_API_ERROR`       | 502         | External market API failure     |
| `INSUFFICIENT_LIQUIDITY` | 400         | Order exceeds market liquidity  |
| `RATE_LIMIT_EXCEEDED`    | 429         | Too many requests               |

## Rate Limiting

### Current Limits

- **General API**: 100 requests per minute per IP
- **Analysis API**: 10 requests per minute per IP
- **Trading API**: 5 requests per minute per wallet

## Movement Hackathon Strategy (Dec 2024 - Jan 2025)

### Target: Multi-Category Victory Through Signal Marketplace Composability

Fourcast is competing across **Best DeFi App**, **Best Consumer App**, **Best DevEx Tool**, and **People's Choice** by proving the Signal Marketplace is a reusable, forkable infrastructure for any edge case.

#### Phase 1: DeFi Primitive Layer (🎯 Best DeFi App - $5K) ✅ COMPLETE

**Status:** SHIPPED Dec 19, 2024

**DeFi Arbitrage Endpoint:**
```
GET /api/defi/arbitrage?minSpread=5&limit=20&minVolume=50000
```

Returns cross-platform arbitrage opportunities with:
- Platform-specific pricing (Polymarket vs Kalshi odds comparison)
- Spread calculations (% and basis points)
- Capital efficiency (profit per $1k deployed)
- Liquidity scores (0-100 based on 24h volume)
- Flash loan suitability indicators (spreads >10%)
- Direct execution links to both platforms

**Frontend:** "💱 DeFi Arbs" tab in `/signals` page with:
- Filterable opportunities (adjustable spread threshold 1-30%)
- Quick preview cards (buy/sell platform, odds, spread %)
- Expandable details (capital requirements, liquidity analysis, AI digest)
- Direct links to view/execute on Polymarket & Kalshi

**Implementation:**
- `app/api/defi/arbitrage/route.js` - Endpoint (180 LOC)
- `app/components/signals/DeFiArbitrageTab.js` - UI (340 LOC)
- `app/signals/page.js` - Tab integration
- Reuses `arbitrageService.js`, `polymarketService.js`, `kalshiService.js`

**Why It Wins:**
- Novel: Arbitrage signals as composable DeFi primitives (not just betting)
- Revenue model: Clear path (LP fees per signal → analyst reputation → leaderboard)
- Real mainnet potential: Opportunities are quantifiable and executable
- Enhancement-first: No rebuilds, leveraged existing services

---

#### Phase 2: Consumer Experience (🎯 Best Consumer App - $5K) ✅ COMPLETE

**Status:** SHIPPED Dec 19, 2024

**Consolidation:**
- Merged `userStatsService.js` + `resolutionService.js` → unified `reputationService.js`
- Deleted `shareableContentService.js` (moved lightweight sharing logic to `utils/shareSignal.js`)
- Updated all imports across API routes and components
- Eliminated code duplication, single source of truth for reputation

**Enhanced Leaderboard UI:**
- Analyst tier badges (Sage 👑, Elite 🌟, Forecaster 🎯, Predictor 📊, Novice 🌱)
- Earnings display in APT (calculated from tips received)
- Win rate %, total signals, rank
- Mobile-responsive grid (1-col → 4-col)

**Backend (reputationService.js):**
- `getUserStats()` - Win rate, streaks, tiers, earnings
- `getUserRanking()` - Leaderboard rankings
- `resolveSignal()` - Market outcome integration (Polymarket/Kalshi)
- Backward compatible export functions

**Core User Flow:**
- Users browse signals feed → Click analyst profile → See tier & earnings → Tip (existing Aptos integration)
- Analysts publish signals → Receive tips → Climb tier system → Earn reputation
- Leaderboard shows top analysts with transparent earnings

**Code Changes:**
- `services/reputationService.js` - Unified reputation system (350 LOC)
- `utils/shareSignal.js` - Lightweight sharing (40 LOC)
- `app/components/signals/LeaderboardTab.js` - Enhanced UI with tiers & earnings

**Why It Wins:**
- Real economic model: tipping as reward mechanism (Movement gas costs enable micro-tips)
- Transparent reputation: community can verify analyst track records
- Simple but powerful: tier system motivates quality signals
- Working demo ready with existing Aptos integration

---

#### Phase 3: DevEx Tool + Ecosystem Composability (🎯 Best DevEx Tool - $5K)

**Timeframe:** Week 3-4 + Video Proof

**The Core Idea:** Prove that Fourcast's signal infrastructure is **forkable for any edge case**.

**Strategy:** Create a forking framework + video demonstrating adaptation to different signal types.

**Reusable Components Exposed:**
1. **Signal Registry Module** (`signal_marketplace.move`)
   - Deployed as standalone package
   - Type-safe Move contract for any signal type
   - On-chain reputation tracking (works for any domain)

2. **TypeScript Signal SDK** (new)
   - Standardized shape for signal publishing
   - Weather → generic edge data
   - Move module interaction abstraction
   - CLI tool to initialize new signal domain

3. **Backend Signal Analyzer Pattern** (`aiService.js`)
   - Generic analysis loop: fetch edge data → AI → publish signal
   - Works with any data source (not just weather)
   - Consolidate logic for easy templating

**Video Proof of Concept (5-7 min):**
Demonstrate forking Fourcast for **3 edge case domains** in parallel:

1. **Mobility & Geospatial Signals**
   - Data: Google Popular Times API / foot traffic analytics
   - Use case: Predict event turnout, retail demand
   - Shows: Same Move module, different data source

2. **Media & Narrative Edge Signals**
   - Data: Farcaster sentiment shifts (existing integration!)
   - Use case: Predict narrative-driven market moves
   - Shows: Existing Neynar integration adapted for signals

3. **On-Chain Activity Edge Signals**
   - Data: Movement network transaction patterns
   - Use case: Predict governance/DeFi protocol outcomes
   - Shows: Signal primitives for crypto-native markets

**Video Flow:**
- 30 sec: Explain Fourcast's modular architecture
- 1 min each: Fork, customize, and deploy each signal type
- 30 sec: All three variants running in parallel
- 1 min: Show how any team can replicate this

**Deliverable:**
- SDK TypeScript package (documented, tested)
- 3 deployable signal domains running on Movement testnet
- Video on GitHub + posted in Movement Discord
- Simple getting-started guide for developers

**Why It Wins:**
- **Solves real DevEx gap**: No reusable signal framework exists
- **Composable**: Other builders extend, not rebuild
- **Scalable**: Proves Fourcast can power entire ecosystem of signal types
- **Monetization path**: SDKs, domain-specific subscriptions

---

#### Phase 4: People's Choice (🎯 People's Choice - $5K)

**Timeframe:** Ongoing

Strategy: Win genuine community love through each of the above.

- DeFi devs vote for arbitrage signals API
- Community votes on best analyst signals
- Developers endorse DevEx tooling in Discord/GitHub

**Key:** Don't build special "People's Choice" feature. Build something so good communities naturally want to use and vote for it.

---

### Consolidation Strategy (Core Principles)

**ENHANCEMENT FIRST:**
- Reuse existing signal marketplace, not new payment systems
- Extend `arbitrageService.js` → new DeFi layer
- Adapt existing Neynar integration → media sentiment signals
- No x402 integration (not a true fit for this use case)

**AGGRESSIVE CONSOLIDATION:**
- Delete: `shareableContentService.js` (merge into signal publishing)
- Merge: `userStatsService.js` + `resolutionService.js` → unified reputation tracker
- Reuse: `aiService.js` for any signal type (keep pattern generic)

**PREVENT BLOAT:**
- One signal marketplace for all domains
- One Move module deployed 3 ways
- One video proof of adaptability
- No separate apps, no separate contracts

**DRY:**
- Signal shape is DDD (domain-driven design): use everywhere
- Move module = single source of truth for on-chain state
- Analyzer pattern = single template for all edge detection

---

## Product Roadmap (Post-Hackathon)

### Phase 1: Core Platform (Completed ✅)

**Q4 2024:**
- ✅ Weather data integration
- ✅ Market discovery and analysis
- ✅ Basic AI-powered insights
- ✅ User-friendly interface
- ✅ Trading integration
- ✅ Polymarket aggregation
- ✅ Venue extraction for sports events

### Phase 2: Signal Marketplace + DeFi Layer (IN PROGRESS 🚧 - Hackathon Focus)

**Jan 2025 - Hackathon:**
- 🚧 DeFi arbitrage signals API
- 🚧 Consumer reputation & voting features
- 🚧 DevEx SDK for signal domain forks
- 🚧 Multi-domain signal infrastructure proof
- 🚧 Movement network testnet deployment

**Post-Hackathon Q1 2025:**
- 📋 Signal resolution tracking (Polymarket/Kalshi outcomes)
- 📋 Advanced analytics for analyst track records
- 📋 Multi-chain signal publication (Aptos, Movement, beyond)
- 📋 Subscription-based signal access tiers

### Phase 3: Ecosystem Expansion (Future 🔮)

**Q2-Q3 2025:**
- 🔮 White-label signal domain deployments
- 🔮 Cross-chain DeFi signal aggregation
- 🔮 Institutional signal subscriptions
- 🔮 Signal derivative products (prediction markets on signals)

### Phase 4: AI & Automation (Future 🤖)

**2026:**
- 🤖 Autonomous signal generation (agents)
- 🤖 Multi-signal consensus models
- 🤖 Predictive analytics for signal performance
- 🤖 Natural language signal explanations

## API Versioning

### Current Version: v1

### Version Strategy

- **Minor Updates**: Backward compatible additions
- **Major Updates**: Breaking changes with deprecation period
- **Deprecation Notice**: 90-day notice before breaking changes

## Monitoring & Analytics

### Health Check

```http
GET /api/predictions/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "weather": {
      "status": "operational",
      "response_time_ms": 150
    },
    "market": {
      "status": "operational",
      "response_time_ms": 200
    },
    "ai": {
      "status": "operational",
      "response_time_ms": 2500
    },
    "database": {
      "status": "operational",
      "response_time_ms": 50
    }
  },
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

## Signals Resolution & Credibility Roadmap

### Phase 1: Resolution Tracking (IN PROGRESS 🚧)

**Priority: HIGH** - Foundation for signal credibility

- 🚧 Integrate Polymarket resolution API to fetch market outcomes
- 🚧 Integrate Kalshi resolution API for sports/event outcomes
- 🚧 Add `outcome` and `resolved_at` fields to signals table
- 🚧 Mark signals as won/lost/pending based on market resolutions
- 🚧 Update `/api/signals` endpoint to include resolution status
- 🚧 Refactor leaderboard to calculate real win rates from outcomes

### Phase 2: Personal Signals & Status (PLANNED 📋)

**Priority: HIGH** - User engagement

- 📋 Create "My Signals" tab in signals page
- 📋 Show user's personal win rate and signal count
- 📋 Add status badges: ✓ Won | ✗ Lost | ⏳ Pending
- 📋 Quick status view with resolution dates
- 📋 Filter: "Show only my signals"

### Phase 3: Signal Scoring & Search (PLANNED 📋)

**Priority: MEDIUM**

- 📋 Full-text search across `ai_digest` and `market_title`
- 📋 Sortable feed: newest, highest confidence, highest accuracy
- 📋 "Odds improvement" scoring: did signal beat market consensus?
- 📋 Signal quality metrics displayed on cards

### Phase 4: Alerts & Social (FUTURE 🔮)

**Priority: LOW** - Advanced features

- 🔮 Follow analyst alerts when they publish new signals
- 🔮 Comparison view: side-by-side analysis on same event
- 🔮 Export signals: CSV/JSON download of track record

---

## Support & Community

### Support Channels

- **GitHub Issues**: Bug reports and feature requests
- **Discord Community**: Real-time support and discussion
- **Email Support**: support@fourcast.com
- **Status Page**: status.fourcast.com

---

_API Reference & Product Roadmap - Last updated: November 2024_