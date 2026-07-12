# Architecture Guide

## Overview

Fourcast is an **AI agent that finds mispriced prediction markets with auditable live-web evidence**. It combines Bright Data web scraping, AI analysis (Venice AI), Polymarket/Kalshi venue data, and USDC settlement on Circle Arc to help traders and autonomous workflows find and act on market inefficiencies.

## Core Components

### 1. AI Analysis Engine (`services/aiService.server.js` → facade)

The AI engine generates predictions using Venice AI (Llama 3.3 70B) with multiple data sources. The former 1,781-line god-file has been decomposed into focused modules:

| Module | Lines | Responsibility |
|--------|-------|----------------|
| `aiVeniceClient.js` | 340 | Venice AI API client + shared constants (`WEATHER_SENSITIVE_CATEGORIES`, `isWeatherSensitiveCategory`, `detectEventTypeFromTitle`) + `callVeniceAI` |
| `aiEventMetadata.js` | 121 | Event location verification + metadata extraction via Venice AI |
| `aiWeatherAnalysis.js` | 539 | Single-market weather impact analysis (`analyzeWeatherImpactServer`) |
| `aiAgentLoop.js` | 799 | Autonomous agent loop — async generator (`runAgentLoop`) |
| `aiStatus.js` | 24 | AI service status/availability (`getAIStatus`) |
| `aiService.server.js` | 19 | Facade — re-exports the 3 public functions for backward compatibility |

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

#### Polymarket Service (`services/polymarketService.js` → facade)

The former 2,706-line god-file has been decomposed into focused modules:

| Module | Lines | Responsibility |
|--------|-------|----------------|
| `polymarketCache.js` | 80 | Shared cache state (Maps, durations, URLs) + cache methods |
| `polymarketHelpers.js` | 910 | Pure utility functions: location/metadata extraction, weather edge & efficiency assessment, order book enrichment, depth calculation, tag normalization |
| `polymarketDiscovery.js` | 1,218 | Market discovery: sports metadata, category tags, market search, catalog building, weather-sensitive market ranking |
| `polymarketTrading.js` | 322 | Trading: market validation, enriched details, price history, order building/validation, server-side execution |
| `polymarketService.js` | 40 | Facade — re-exports all 32 methods as a backward-compatible singleton |

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

### Arc (Primary Settlement Layer) — Agora Agents Hackathon
- **Purpose**: Signal publishing, USDC settlement, agent accounts, cross-chain coordination
- **Network**: Arc testnet (Chain ID 5042002)
- **Contract**: `PredictionReceiptERC20` for signal publishing; SubscriptionManager for USDC plans
- **Features**: On-chain signals, USDC-denominated subscriptions, sub-second finality, ~$0.01 tx fees
- **Circle Tools**: CCTP, Gateway, Wallets, Paymaster, USYC, App Kit
- **Status**: Arc publish routing is wired in the app; contract deployment/env config still required for live publishing

### Movement/Aptos (Signal Layer — Legacy)
- **Purpose**: Publish verifiable prediction signals
- **Network**: Movement testnet (Bardock, Chain ID 250)
- **Contract**: `signal_registry.move`, `signal_marketplace.move`
- **Features**: Signal publishing, tipping, reputation tracking
- **Status**: Being superseded by Arc integration

### EVM Chains (Trading Layer)
- **Supported**: BNB, Polygon, Arbitrum
- **Purpose**: Trading contracts and prediction logging
- **Contracts**: `PredictionReceipt` per chain
- **Features**: On-chain trade logging, fee collection

### Arc Data Flow (Agora Agents Hackathon)
```
┌─────────────────┐     ┌──────────────────┐
│ Polymarket      │     │ Kalshi           │
│ (Odds + Trading)│     │ (Odds + Trading) │
└────────┬────────┘     └────────┬─────────┘
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│ AI Analysis Engine (Venice AI)          │
│ + SynthData ML Forecasts               │
│ + Weather Data (Open-Meteo)            │
│ + Kelly Criterion Position Sizing      │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ Arc Settlement Layer                     │
│ ├─ SignalRegistry.sol (on-chain preds)  │
│ ├─ PredictionReceipt.sol (trade logs)   │
│ ├─ BuilderFeeSplitter.sol (monetize)    │
│ ├─ CCTP/Gateway (cross-chain USDC)     │
│ ├─ Circle Wallets (agent accounts)     │
│ ├─ Paymaster (USDC gas)                │
│ └─ USYC (idle capital yield)           │
└──────────────────┬──────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────┐
│ Frontend Dashboard                      │
│ + App Kit (Bridge/Swap/Send)           │
│ + Arc chain selector                    │
│ + USDC-denominated tipping              │
└─────────────────────────────────────────┘
```

### Chain Connection Flow
```javascript
// useChainConnections hook manages multi-chain state
{
  chains: {
    arc: { connected, walletAddress, chainId: 5042002, balance },  // NEW
    aptos: { connected, walletAddress, network },
    evm: { connected, chainId, balance }
  },
  canPerform: { arc: boolean, aptos: boolean, evm: boolean },
  canPublish: boolean  // Arc or Aptos
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

The agent scans markets, filters candidates, generates forecasts, detects arbitrage, and manages risk:

1. **Discover**: Scan Polymarket/Kalshi for markets
2. **Filter**: Remove recently analyzed (<6hrs), low-volume markets
3. **Forecast**: Generate AI predictions using Venice LLMs and SynthData ML percentiles
4. **Sizing (Kelly Criterion)**: Calculate mathematically optimal fractional Kelly sizing ($p \cdot b - q)/b$ scaled by confidence and risk tolerance
5. **Arbitrage**: Detect cross-platform price discrepancies
6. **Autopilot Execution**: (Optional) Programmatically sign and submit trades using a server-side private key with Polymarket Builder attribution headers

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

### Canonical Namespace Structure (`/app/api/*`)

The API routes are organized into canonical namespaces. Every route exists at its original path for backwards compatibility, but new code should use the canonical paths below.

```
intelligence/           # AI analysis & predictions
├── analyze             # POST /api/intelligence/analyze  — AI forecast + weather analysis
├── predictions         # POST /api/intelligence/predictions — On-chain prediction requests
└── (future: validate, weather, synth)

markets/                # Market data
└── ...                 # /api/markets — Discovery (Polymarket/Kalshi)

agent/                  # Autonomous agent
├── /                   # Loop execution
├── track-record        # Performance history
├── backtest            # Historical backtesting
├── resolve             # Outcome resolution
└── executions          # Trade execution log

signals/                # Signal CRUD
├── /                   # Create, read signals
└── resolve             # On-chain signal resolution

wallet/                 # Wallet connection & chain interactions
├── /                   # Wallet state
├── orders              # Polymarket orders
├── positions           # Open positions
├── cctp/transfer       # Cross-chain USDC transfers
└── kalshi/             # Kalshi login, orders, balance

social/                 # Social & communication
├── bot/telegram        # Telegram bot (@fourcasterbot)
├── farcaster/webhook   # Farcaster frames integration
└── (future: discord, web push)

meta/                   # System & observability
├── health              # Service health
├── stats               # Usage statistics
├── leaderboard         # Analyst rankings
└── (future: status, metrics)

legacy/                 # Deprecated — kept for backwards compatibility
├── weather             # /api/weather → use intelligence/analyze with weather
├── debug               # /api/debug — dev only
├── og                  # /api/og — Open Graph image generation
├── synth/warm-cache    # /api/synth/warm-cache
└── defi/arbitrage      # /api/defi/arbitrage
```

### Route Inventory (36 routes)

| Path | Canonical Namespace | Description |
|------|-------------------|-------------|
| `/api/analyze` → `intelligence/analyze` | intelligence | AI analysis endpoint (Venice AI + weather + SynthData) |
| `/api/predictions` → `intelligence/predictions` | intelligence | On-chain prediction requests |
| `/api/validate/*` → `intelligence/validate/*` | intelligence | Input/weather/market validation |
| `/api/markets` | markets | Market discovery (Polymarket/Kalshi) |
| `/api/signals` | signals | Signal CRUD |
| `/api/agent/*` | agent | Agent loop, track record, backtest |
| `/api/kalshi/*` | wallet | Kalshi trading |
| `/api/wallet` | wallet | Wallet connection state |
| `/api/orders` | wallet | Polymarket orders |
| `/api/positions` | wallet | Open positions |
| `/api/bot/telegram` | social | Telegram bot |
| `/api/farcaster/*` | social | Farcaster integration |
| `/api/cctp/transfer` | wallet | Cross-chain USDC |
| `/api/leaderboard` | meta | Analyst rankings |
| `/api/stats` | meta | User statistics |
| `/api/meta/health` | meta | Service health |

### Data Flow

```
Frontend (markets page, signals page, landing)
  │
  ├── /api/intelligence/analyze ──→ aiService.server.js ──→ Venice AI + SynthData + Weather
  ├── /api/markets               ──→ polymarketService.js / kalshiService.js
  ├── /api/signals               ──→ db.js (SQLite + Movement/Aptos)
  ├── /api/agent/*               ──→ aiService.server.js (agent loop)
  └── /api/wallet/*              ──→ chainConfig.js / polymarketService.js
```

### Caching Strategy
- **Redis**: AI analysis results (15min), SynthData forecasts (15min)
- **In-memory**: Market catalogs (30min), sports metadata (24hr)
- **SQLite**: Persistent signals, forecasts, track records

### Runtime Rules
- **`export const runtime = 'nodejs'`** for all routes that need `fs`, `crypto`, or server-only imports
- **`export const runtime = 'edge'`** for high-throughput validation-only routes: `validate/order`, `validate/location`, `validate/weather`, `validate/market-compatibility`, `api/weather`
- CI enforces runtime declarations via lint rules

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
  - **Arc** (Circle L1) — primary settlement, USDC-native, sub-second finality
  - Movement/Aptos (signal publishing — legacy)
  - EVM chains (BNB, Polygon, Arbitrum — trading contracts)
- **Circle Tools**: CCTP, Gateway, Circle Wallets, Paymaster, USYC, App Kit
- **Wallets**: MetaMask, WalletConnect (EVM + Arc); Nightly, Petra (Aptos)
- **Data**: Polymarket, Kalshi, Open-Meteo, SynthData
