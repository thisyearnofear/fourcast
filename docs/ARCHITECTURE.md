# Architecture Guide

## Overview

Fourcast is a **multi-chain prediction market intelligence platform** that combines AI analysis, live market data, and on-chain signal publishing to help traders find and act on market inefficiencies.

## Core Components

### 1. AI Analysis Engine (`services/aiService.server.js`)

The AI engine generates predictions using Venice AI (Llama 3.3 70B) with multiple data sources:

```javascript
// Core analysis flow
1. Fetch market data (Polymarket/Kalshi)
2. Enrich with weather data (Open-Meteo)
3. Add ML forecasts (SynthData for crypto/equities)
4. Generate AI prediction with confidence score
5. Optional: Publish to blockchain
```

**AI Models:**
- **Production**: Llama 3.3 70B (~7.5s response, ~$0.01/analysis)
- **Deep Analysis**: Qwen3-235B (~67s response, ~$0.03/analysis)

**Configuration:**
```javascript
{
  model: "llama-3.3-70b",
  enable_web_search: "auto",  // String, not boolean
  disable_thinking: true      // For Qwen model
}
```

### 2. Market Data Services

#### Polymarket Service (`services/polymarketService.js`)
- Live odds fetching from `gamma-api.polymarket.com`
- Order signing and placement via CLOB
- Market catalog caching (30min)
- Sports metadata caching (24hr)

#### Kalshi Service (`services/kalshiService.js`)
- Series and event market fetching
- Order placement with JWT authentication
- Token auto-refresh (30min expiry)

#### SynthData Service (`services/synthService.js`)
- ML-backed price forecasts for crypto/equities
- Supported assets: BTC, ETH, SOL, XAU, SPY, NVDA, GOOGL, TSLA, AAPL
- Prediction percentiles (P5/P50/P95), volatility forecasts
- Polymarket edge detection (fair odds vs market odds)

### 3. Weather Integration (`services/weatherService.js`)

- **Primary**: Open-Meteo API (GFS forecast models)
- **Fallback**: WeatherAPI
- 16-day forecasts, current conditions
- Location validation and venue extraction

### 4. Data Pipeline

```
┌─────────────────┐
│ Polymarket      │
│ Kalshi          │
│ SynthData       │
│ Weather API     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ AI Analysis     │
│ Engine          │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ SQLite Database │◄───┐
│ (Signals,       │    │
│  Forecasts,     │    │
│  Track Record)  │    │
└────────┬────────┘    │
         │             │
         ▼             │
┌─────────────────┐    │
│ Movement/Aptos  │────┘
│ (On-chain       │    (async publish,
│  signals)       │     verification)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Frontend        │
│ (Signals Feed,  │
│  Markets,       │
│  Trading UI)    │
└─────────────────┘
```

### 5. Database Schema

#### `agent_forecasts`
Tracks AI predictions and outcomes for track record:
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

#### `agent_runs`
Execution metadata for agent loops:
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

#### `signals` (SQLite cache)
Local cache of on-chain signals:
```sql
CREATE TABLE signals (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  market_title TEXT,
  venue TEXT,
  ai_digest TEXT,
  confidence TEXT,
  odds_efficiency TEXT,
  author_address TEXT,
  timestamp INTEGER,
  tx_hash TEXT
);
```

## Multi-Chain Architecture

### Movement/Aptos (Signal Layer)
- **Purpose**: Publish verifiable prediction signals
- **Network**: Movement testnet (Bardock, Chain ID 250)
- **Contract**: `signal_registry.move`, `signal_marketplace.move`
- **Features**: Signal publishing, tipping, reputation tracking

### EVM Chains (Trading Layer)
- **Supported**: BNB, Polygon, Arbitrum
- **Purpose**: Trading contracts and prediction logging
- **Contracts**: `PredictionReceipt` per chain
- **Features**: On-chain trade logging, fee collection

### Chain Connection Flow
```javascript
// useChainConnections hook manages multi-chain state
{
  chains: {
    aptos: { connected, walletAddress, network },
    evm: { connected, chainId, balance }
  },
  canPerform: { aptos: boolean, evm: boolean },
  canPublish: boolean  // Aptos-only
}
```

## On-Chain Signal Structure

### Move Struct (Signal Registry)
```move
struct Signal {
    event_id: String,           // Market/event identifier
    domain_hash: String,        // Hash of domain-specific data
    ai_digest: String,          // Human-readable AI reasoning (max 512 bytes)
    confidence: String,         // HIGH/MEDIUM/LOW
    venue: String,              // Event location (max 128 bytes)
    timestamp: u64,             // Unix timestamp
    analyst: address,           // Publisher wallet
    total_tips: u64             // Accumulated tips in octas
}
```

### String Length Limits
- Title: 256 bytes max
- Venue: 128 bytes max
- Hash: 64 bytes max
- AI Digest: 512 bytes max

## Agent System

### Autonomous Forecasting Loop

The agent scans markets, filters candidates, generates forecasts, and detects arbitrage:

1. **Discover**: Scan Polymarket/Kalshi for markets
2. **Filter**: Remove recently analyzed (<6hrs), low-volume markets
3. **Forecast**: Generate AI predictions with confidence scores
4. **Arbitrage**: Detect cross-platform price discrepancies

### Track Record Infrastructure

**Key Functions:**
- `saveForecast()`: Persist forecasts for track record
- `resolveForecast()`: Update with actual outcome, calculate Brier score
- `getAgentTrackRecord()`: Retrieve historical performance
- `wasRecentlyAnalyzed()`: Check if market was analyzed recently

### Calibration Guardrails

- If edge >30%, override confidence to LOW
- Warning: "Edge >30% - high uncertainty"
- Rationale: Markets are usually more right than LLMs; extreme edges are suspicious

## Reputation System

### Analyst Tiers
- **Sage 👑**: Top performers
- **Elite 🌟**: Consistent winners
- **Forecaster 🎯**: Active analysts
- **Predictor 📊**: Regular contributors
- **Novice 🌱**: New analysts

### Metrics Tracked
- Win rate, Brier scores, calibration curves
- Total tips earned (in APT)
- Signal count, accuracy streaks
- Confidence-stratified accuracy

## API Architecture

### Route Structure (`/app/api/*`)
```
/api/analyze        - AI analysis endpoint
/api/signals        - Signal CRUD operations
/api/markets        - Market discovery (Polymarket/Kalshi)
/api/defi/arbitrage - Cross-platform arbitrage detection
/api/agent          - Agent track record and forecasting
/api/kalshi         - Kalshi trading (login, orders, balance)
/api/leaderboard    - Analyst rankings
/api/stats          - User statistics
/api/weather        - Weather data
/api/farcaster      - Social integration (optional)
```

### Caching Strategy
- **Redis**: AI analysis results (15min), SynthData forecasts (15min)
- **In-memory**: Market catalogs (30min), sports metadata (24hr)
- **SQLite**: Persistent signals, forecasts, track records

## Design Principles

### Progressive Enhancement
1. Save to SQLite (immediate feedback)
2. Publish to Movement (async, on-chain proof)
3. Link records (update SQLite with tx_hash)
4. Graceful degradation (works offline, retry mechanism)

### Aggressive Consolidation
- One signal shape (Move module)
- Config-driven data sources (no code duplication)
- Unified API for all market platforms

### Enhancement First
- Reuse existing signal marketplace
- Extend services (no new service for each domain)
- Single Move contract for all domains

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Three.js
- **Backend**: Node.js, SQLite (Turso), Redis
- **AI**: Venice AI (Llama 3.3 70B) with Edge Search
- **Blockchains**: 
  - Movement/Aptos (signal publishing)
  - EVM chains (trading contracts)
- **Wallets**: Nightly, Petra (Aptos); MetaMask, WalletConnect (EVM)
- **Data**: Polymarket, Kalshi, Open-Meteo, SynthData
