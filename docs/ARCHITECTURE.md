# Architecture Guide

## Overview

Fourcast is a **modular signal intelligence layer** for the Movement network. It aggregates off-chain data (Weather, Mobility, Sentiment), processes it via AI edge nodes, and publishes verifiable prediction signals on-chain.

## Core Innovation: EdgeAnalyzer Pattern

The `EdgeAnalyzer` pattern decouples the *method* of analysis from the *domain* of data, enabling any data domain to use the same signal infrastructure.

### Base Class (`services/analysis/EdgeAnalyzer.js`)

```javascript
class EdgeAnalyzer {
  async analyze(context) {
    // 1. Validate Context
    this.validate(context);

    // 2. Enrich (Domain Specific)
    const data = await this.enrichContext(context);

    // 3. Construct Prompt (Domain Specific)
    const prompt = this.constructPrompt(data);

    // 4. AI Processing (Generic)
    const result = await this.executeAnalysis(prompt);

    // 5. Format for Blockchain (Standard)
    return this.formatSignal(result);
  }
}
```

## Domain Implementations

### Weather Domain
- **Source**: Open-Meteo API (primary), WeatherAPI (fallback)
- **Trigger**: Market title contains "Rain", "Temperature", "Snow"
- **Enrichment**: GFS forecast models, 16-day forecasts
- **Output**: Weather-weighted confidence score

### Mobility Domain
- **Source**: Google Popular Times (simulated)
- **Trigger**: Market title contains "Attendance", "Turnout", "Delay"
- **Enrichment**: Live crowd density, traffic flow
- **Output**: Logistics-weighted confidence score

### Sentiment Domain (Coming Soon)
- **Source**: Neynar API (Farcaster)
- **Trigger**: Narrative shifts, social momentum
- **Enrichment**: Cast engagement, follower sentiment
- **Output**: Sentiment-weighted confidence score

### DeFi Arbitrage Domain
- **Source**: Polymarket + Kalshi price feeds
- **Trigger**: Price discrepancies >5%
- **Enrichment**: Cross-platform odds, liquidity scores
- **Output**: Arbitrage opportunity signals

## Data Pipeline

```
Raw Data Sources → EdgeAnalyzer Nodes → Signal Verification → Movement M1 Blockchain
                                              ↓
                                    Unified API / SQLite
                                              ↓
                                    React Frontend (Live Feed)
                                              ↓
                                    Analyst Reputation/Tips
```

### Polymorphic Dispatch

```javascript
const candidates = [
  { domain: 'weather', title: 'Rain in London?' },
  { domain: 'mobility', title: 'Wembley Crowd Size?' }
];

for (const market of candidates) {
  const analyzer = getAnalyzer(market.domain);
  const signal = await analyzer.analyze(market);
  await db.save(signal);
}
```

## On-Chain Standardization

All signals use a unified Move struct regardless of domain:

```move
struct Signal {
    event_id: String,           // Market/event identifier
    domain_hash: String,        // Hashed domain-specific data
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

**Database Tables:**
- `agent_forecasts`: Stores forecasts with AI probability, market odds, edge, Brier scores
- `agent_runs`: Execution metadata (markets scanned, candidates filtered, forecasts made)

**Key Functions:**
- `saveForecast()`: Persist forecasts for track record
- `resolveForecast()`: Update with actual outcome, calculate Brier score
- `getAgentTrackRecord()`: Retrieve historical performance
- `wasRecentlyAnalyzed()`: Check if market was analyzed recently (prevents redundant API calls)

### Calibration Guardrails

- If edge >30%, override confidence to LOW
- Warning: "Edge >30% - high uncertainty"
- Rationale: Markets are usually more right than LLMs; extreme edges are suspicious

## AI Model Configuration

### Production Model: Llama 3.3 70B
- Response Time: ~7.5 seconds
- Cost: ~$0.01 per analysis
- Margin: 98%+ at $1 = 10 credits
- Output: Clean, parseable JSON

### Deep Analysis Model: Qwen3-235B
- Response Time: ~67 seconds
- Cost: ~$0.03 per analysis
- Margin: 85%+ at $1 = 5 credits
- Output: More specific analysis with causal reasoning
- Use: `disable_thinking: true` parameter (NOT `strip_thinking_response`)

### Hybrid Tier System (Future)
- Basic Analysis: 1 credit (Llama 3.3 70B)
- Deep Analysis: 5 credits (Qwen3-235B)

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

## Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, Three.js
- **Backend**: Node.js, SQLite (Turso), Redis
- **AI**: Venice AI (Llama 3.3 70B) with Edge Search
- **Blockchain**: Movement M1 Testnet (Bardock)
- **Wallet**: Nightly, Petra, Razor (Aptos Standard)

## Design Principles

### Enhancement First
- Reuse existing signal marketplace
- Extend services (no new service for each domain)
- Single Move contract for all domains

### Aggressive Consolidation
- One signal shape (Move module)
- One analyzer pattern (EdgeAnalyzer)
- Config-driven domains (no code duplication)

### Progressive Enhancement
1. Save to SQLite (immediate feedback)
2. Publish to Movement (async, on-chain proof)
3. Link records (update SQLite with tx_hash)
4. Graceful degradation (works offline, retry mechanism)
