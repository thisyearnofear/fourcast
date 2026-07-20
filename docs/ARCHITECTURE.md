# Architecture Guide

## Overview

Fourcast is a **flight recorder for autonomous capital**. An agent operates under a versioned mandate — it decides from pre-match TxLINE evidence alone, seals each decision into a SHA-256 receipt, and reconciles against an independently verifiable on-chain outcome after the match finalizes. The route is one unfolding system: **Mandate Control → Proof Theatre → Diligence**.

TxLINE is the single primary data layer for fixtures, consensus odds, score events, and Merkle proofs. A custom Solana program (`match-escrow`) CPI-calls TxLINE's `txoracle::validate_stat` to trustlessly settle parametric sports insurance. The supporting infrastructure (Bright Data, Polymarket/Kalshi, Venice AI, SynthData) remains as secondary enrichment for the `/markets` and `/signals` routes.

## Flagship Route Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       TXLINE DATA LAYER (devnet)                        │
│  fixtures/snapshot  ·  odds/snapshot  ·  scores/snapshot  ·  proofs     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  FOURCAST WORLD CUP INTELLIGENCE                         │
│  services/txline/txlineService.js                                        │
│  · normalises PascalCase schema -> unified fixture shape                │
│  · auto-refreshes guest JWT on 401                                       │
│  · falls back to cached replays after July 19 cutoff                    │
└───────┬──────────────────┬──────────────────┬───────────────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│ Live odds +  │  │ Cross-venue edge │  │ Verifiable receipt        │
│ score panel  │  │ (Polymarket YES) │  │ · Merkle proof integrity  │
│              │  │                  │  │ · PDA derivation & fetch  │
└──────────────┘  └──────────────────┘  │ · On-chain root compare   │
                                        └───────────┬──────────────┘
                                                     │
                        ┌────────────────────────────▼──────────────┐
                        │  Autonomous Historical Lab (VPS)           │
                        │  PM2 worker · replay clock · receipts      │
                        │  signed heartbeat → /api/agent/historical-lab │
                        │  · decides from pre-match evidence         │
                        │  · seals SHA-256 receipt before outcome    │
                        │  · withholds proof until replay crosses    │
                        │    settlement                              │
                        └────────────────────────────┬──────────────┘
                                                     │
                    ┌────────────────────────────────┼──────────────────┐
                    ▼                                ▼                  ▼
          ┌─────────────────┐          ┌──────────────────┐  ┌───────────────────┐
          │ Mandate Control │          │ Proof Theatre    │  │ Allocator         │
          │ /agent          │          │ /world-cup       │  │ Diligence         │
          │                 │          │                  │  │ /positions        │
          │ MandateControl  │          │ ProofTheatre     │  │ MandatePanel      │
          │ DecisionDossier │          │ 6-stage timeline │  │ adherence +       │
          │ 5-stage timeline│          │                  │  │ calibration       │
          └─────────────────┘          └──────────────────┘  └───────────────────┘
                                                     │
                                        ┌────────────▼──────────────┐
                                        │  Solana Match-Escrow      │
                                        │  CPI → txoracle           │
                                        │  validate_stat            │
                                        │  (settlePolicy flow)      │
                                        └───────────────────────────┘
```

### Mandate Control (`/agent`)

The flagship hero. A live VPS worker (`scripts/fourcast-agent-worker.mjs`) operates under a versioned policy (`services/domain/decision/decisionPolicy.js`), decides from pre-match TxLINE evidence, and seals each decision into a canonical receipt (`services/domain/decision/decisionReceipt.js`). The hero eagerly fetches `/api/worldcup/verify` for the latest receipt so the proof timeline shows real reconciliation + on-chain Solana verdict.

Key components:
- **`components/MandateControl.js`** — live worker state, current mandate decision (ALLOCATE/PASS/REVIEW), proof timeline crossing from "outcome withheld" to "proof available", operator telemetry strip
- **`components/MandateBuilder.js`** — self-serve mandate config + dry-run preview. Four range sliders for the real policy knobs (`minAbsoluteEdge`, `maxAllocationPct`, `maxLossProbability`, `simulationRuns`), a dry-run button that calls `POST /api/agent/dry-run`, and a "Save as my mandate" button that persists via `POST /api/agent/mandate` and returns a Track Record URL. Draft state persists to localStorage.
- **`components/DecisionDossier.js`** — right-side drawer answering 5 allocator questions from the canonical receipt
- **`components/HistoricalLabPanel.js`** — supporting VPS telemetry panel below the hero
- **`components/AgentRunLedger.js`** — persisted decision ledger
- **`components/AgentDashboard.js`** — manual runner (demoted to Operator Controls drawer)

### Per-operator Track Record (`/agent/[operatorId]`)

The public URL a concierge DM points a prospect at (GTM §2.2 step 4). Server component (`app/agent/[operatorId]/page.js`) fetches the operator's mandate + scoped track record and renders per-operator OG metadata via `/api/og?type=operator`. The client component (`OperatorTrackRecordClient.js`) shows the mandate knobs, track record stats, and a recent forecasts table.

Key components:
- **`app/agent/[operatorId]/page.js`** — server component, `generateMetadata` for per-operator OG cards, fetches initial data
- **`app/agent/[operatorId]/OperatorTrackRecordClient.js`** — client rendering, "Copy URL" button, mandate + track record display
- **`app/api/agent/track-record/[operatorId]/route.js`** — scoped track record API
- **`app/api/agent/mandate/route.js`** — mandate persistence (POST save, GET read)
- **`app/api/agent/dry-run/route.js`** — dry-run preview using canonical decision domain modules

### Proof Theatre (`/world-cup`)

The final act of an autonomous decision. A vertical 6-stage evidence timeline for any fixture.

Key components:
- **`components/ProofTheatre.js`** — vertical timeline: pre-match evidence → seeded simulation → versioned policy gates → immutable receipt → TxLINE Merkle proof + Solana validation → reconciliation
- **`app/world-cup/WorldCupClient.js`** — fixture grid, replay viewer, verify panel, edge panel, Proof Theatre integration
- **`services/txline/solanaVerify.js`** — on-chain Merkle proof verification (PDA derivation + root comparison)
- **`services/txline/reconciliationService.js`** — receipt/proof reconciliation state machine
- **`services/txline/receiptAdapter.js`** — canonical decision receipt → TxLINE reconciliation view

### Allocator Diligence (`/positions`)

Mandate adherence as the hero; positions/P&L demoted to secondary.

Key components:
- **`components/MandatePanel.js`** — policy adherence, receipt coverage, discipline rate, max allocation, calibration
- **`components/PositionsDashboard.js`** — positions and P&L (secondary section)

### Decision Domain (`services/domain/decision/`)

The reusable product primitive — a hash-bound receipt that distinguishes a model assertion from a verifiable fact.

| Module | Responsibility |
|--------|----------------|
| `decisionPolicy.js` | Five-gate mandate policy (min edge, max allocation, tail-loss limit, simulation runs) |
| `decisionReceipt.js` | Canonical receipt builder, SHA-256 hashing, verification |
| `simulation.js` | Deterministic Monte Carlo with seed derivation |
| `historicalLab.js` | Replay-clock phase management and no-lookahead checks |

### Solana On-Chain Settlement

A custom Solana program (`match-escrow` at `AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ`) implements parametric sports insurance:

1. **`createPolicy`** — a user locks SOL in a policy PDA specifying `{fixtureId, minTs, paysRecipientOnHomeWin, amount}`
2. **`settlePolicy`** — a keeper submits the TxLINE Merkle proof; the program CPI-calls `txoracle::validate_stat`, and if the condition is met, SOL transfers to the recipient; otherwise refunded

The on-chain verification flow:
1. **Proof verification** — `solanaVerify.js` extracts the Merkle proof from a cached fixture replay
2. **PDA derivation** — derives the `daily_scores_roots` PDA using seeds `[b"daily_scores_roots", epoch_day as u16 LE]`
3. **On-chain comparison** — fetches the PDA account via Solana JSON-RPC, reads the 32-byte Merkle root, compares against `eventStatRoot`
4. **Settlement (CPI)** — `settlementService.js` builds and submits `settle_policy` transactions

Verdicts: `verified` (on-chain root matches), `onchain-mismatch` (root differs), `onchain-error` (PDA unreachable), `proof-present` (components valid but no timestamp for PDA derivation).

## Supporting Infrastructure

The following systems support the `/markets`, `/signals`, and `/labs` routes. They are secondary to the flagship TxLINE-primary route but remain part of the codebase.

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
- Polymarket fair-odds comparison (SynthData vs market odds, used by Kelly sizing)

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
│ Arc (USDC)      │────┘
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
Tracks AI predictions and outcomes for track record. The `operator_id` column (migration 0010) scopes forecasts to a single operator's Track Record URL:
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
  resolution_time INTEGER,
  operator_id TEXT,  -- migration 0010: nullable for back-compat, scopes to /agent/[operatorId]
  -- ... autopilot execution columns (migration 0003)
);
```

#### `mandates`
Persisted mandate drafts keyed by anonymous `operator_id` (migration 0011). The four policy knobs match `createDecisionPolicy()` exactly:
```sql
CREATE TABLE mandates (
  operator_id TEXT PRIMARY KEY,
  min_absolute_edge REAL NOT NULL,
  max_allocation_pct REAL NOT NULL,
  max_loss_probability REAL NOT NULL,
  simulation_runs INTEGER NOT NULL,
  policy_version TEXT NOT NULL,
  display_name TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
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
  timestamp INTEGER NOT NULL,
  run_mode TEXT DEFAULT 'advisory',  -- migration 0008
  summary TEXT                        -- migration 0008: replayable decision receipt JSON
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

### Movement/Aptos — RETIRED (2026-07)
The legacy Move-based signal layer (Movement Bardock, `signal_registry.move`)
has been removed from the codebase. Historical signals rows still carry
`chain_origin = 'APTOS'/'MOVEMENT'` and render with legacy display badges;
their tx hashes deep-link to the Aptos explorer. No new functionality may
target these chains.

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
// useChainConnections hook manages chain state (one EVM wallet, two surfaces)
{
  chains: {
    arc: { connected, address, chainId: 5042002 },   // settlement
    evm: { connected, address, chainId }             // Polygon trading
  },
  canPerform: (chainId, action) => boolean,
  canPublish: boolean  // Arc connected + correct network
}
```

## On-Chain Signal Structure

### Signal Fields (PredictionReceipt on Arc)
```
event_id      — market/event identifier
domain_hash   — hash of domain-specific data
ai_digest     — human-readable AI reasoning (max 512 bytes)
confidence    — HIGH/MEDIUM/LOW
venue         — event location (max 128 bytes)
timestamp     — unix timestamp
analyst       — publisher wallet
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

### Autopilot Scheduler & Safety Rails

Vercel Cron fires `/api/cron/autopilot` once daily at 12:00 UTC (`vercel.json` — Vercel Hobby allows only daily crons; raise the frequency after upgrading to Pro). Each tick passes through a gauntlet of gates before any trade:

1. **Auth**: `Authorization: Bearer $CRON_SECRET` required; unset secret = always 401 (fails closed).
2. **Enabled flag**: persisted in the `autopilot_schedule` table (single row, admin-gated writes via `/api/agent/schedule` + `ADMIN_SECRET`). This is the kill switch.
3. **Interval gate**: `intervalMinutes` is the *minimum gap* between runs, enforced against `last_run_at` — which is recorded *before* the run so overlapping invocations can't race past the gate.
4. **Key check**: `POLYMARKET_PRIVATE_KEY` must be present.
5. **Dry-run** (default ON): recommendations are logged with `execution_status = 'DRY_RUN'` — no orders placed. Live trading is explicit opt-in.
6. **Per-market dedup**: markets with a `SUCCESS` execution in the last 24h are skipped.
7. **Daily spend cap**: the loop stops once the sum of executed `size_pct` would exceed `daily_cap_pct` (default 0.5).

Pure predicates live in `services/autopilotSafety.js` (unit-tested in `tests/autopilotSafety.test.js`); the non-streaming runner is `services/scheduler.js`. Note: dry-run executions are tagged `DRY_RUN` and intentionally do **not** count toward dedup or the cap — dry-run history therefore repeats markets across ticks and does not rehearse the rails.

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
| `/api/operator/pulse` | meta | Operator chrome liveness snapshot |

### Data Flow

```
Frontend (markets page, signals page, landing)
  │
  ├── /api/analyze/stream        ──→ /api/analyze ──→ aiService.server.js ──→ Venice AI + SynthData + Weather
  ├── /api/markets               ──→ polymarketService.js / kalshiService.js
  ├── /api/signals               ──→ db.js (SQLite + Movement/Aptos)
  ├── /api/operator/pulse        ──→ db.js (track record + autopilot runs)
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

### Operator Evidence Interface
- Primary product surfaces should make stored system activity visible: latest sweep, fresh edges, forecast count, execution status, and track-record proof.
- Analysis progress must reflect real server-side lifecycle events from the canonical analysis route. Do not use timer-only fake stages for model work.
- Market, signal, and position surfaces should present the same decision chain: evidence captured, recommendation recorded, receipt linked when available, and outcome reconciled.

## Tech Stack

- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Backend**: Node.js 20+, SQLite (Turso), Redis
- **Primary data**: TxLINE devnet (free World Cup tier, service level 1) — fixtures, odds, scores, Merkle proofs
- **Settlement/verification**: Solana devnet, TxLINE `txoracle` program, custom `match-escrow` program (CPI → `validate_stat`)
- **Secondary enrichment**: Polymarket gamma API (cross-venue edge), Kalshi (optional), Venice AI (Llama 3.3 70B), SynthData (ML forecasts), Open-Meteo (weather)
- **Wallets**: MetaMask, WalletConnect (EVM); Phantom/Solflare (Solana)
- **Legacy**: Arc (Circle L1), Movement/Aptos, EVM trading contracts — retired or secondary
