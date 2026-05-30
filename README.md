# 🔮 Fourcast: AI Prediction Market Intelligence with Live Web Data

**AI agent for Polymarket & Kalshi — real-time web intelligence via Bright Data, edge detection, Kelly sizing, USDC settlement on Arc.**

![Status](https://img.shields.io/badge/Status-Live-green)
![Settlement](https://img.shields.io/badge/Settlement-Arc%20%C2%B7%20USDC-indigo)
![Bright Data](https://img.shields.io/badge/Bright%20Data-SERP%20%2B%20Scraping%20Browser%20%2B%20Web%20Unlocker-cyan)
![Hackathon](https://img.shields.io/badge/Web%20Data%20UNLOCKED-Bright%20Data%20Hackathon-blue)

## 🎯 What We Do

Fourcast is an intelligence agent for prediction markets that uses **live web data** to find mispriced markets. It helps traders and autonomous workflows:
- **Real-time web intelligence** - Bright Data SERP API, Scraping Browser, and Web Unlocker for live evidence gathering
- **AI-powered analysis** - Venice AI (Llama 3.3 70B) with 200+ ML models across crypto, sports, politics & more
- **Multi-platform trading** - Polymarket & Kalshi integration with live odds
- **On-chain signals** - USDC settlement on Arc (Circle L1); legacy Movement/Aptos testnet
- **DeFi arbitrage** - Detect price discrepancies across platforms

---

## 🚀 Features

### For Traders
- **Live Web Intelligence** - Bright Data SERP API gathers real-time search results for each market; Scraping Browser extracts evidence from JS-rendered pages; Web Unlocker bypasses bot-protected sites
- **Deep Research Pipeline** - For high-conviction markets, the agent scrapes the top source via Scraping Browser, extracts informative sentences, and synthesizes evidence with the LLM
- **Live Market Analysis** - AI-generated predictions with confidence scores (HIGH/MEDIUM/LOW) and clickable source provenance
- **ML-Backed Forecasts** - SynthData integration for crypto/equity price predictions (BTC, ETH, SOL, SPY, NVDA, etc.)
- **Cross-Platform Arbitrage** - Find mispriced odds between Polymarket and Kalshi
- **Direct Trading** - Place orders on Polymarket/Kalshi from the interface

### For Analysts
- **Signal Publishing** - Publish predictions on-chain with Arc as the preferred settlement path when configured, with Movement testnet as legacy fallback
- **Reputation System** - Track win rates, Brier scores, and accuracy streaks
- **Tipping** - Earn APT for high-quality signals
- **Leaderboards** - Compete with other analysts

### For Developers
- **Unified API** - Access markets, signals, and AI analysis
- **SDK** - Build custom signal publishers and domain analyzers
- **Modular Architecture** - Extend with new data sources and chains

---

## 🏗️ Architecture

```mermaid
graph LR
    A[Polymarket/Kalshi] -->|Live Odds| B(AI Analysis Engine)
    C[Weather API] -->|Real-time Data| B
    D[SynthData] -->|ML Forecasts| B
    E[Bright Data] -->|SERP + Scraping Browser| B
    B -->|Signals| F[SQLite Database]
    B -->|Publish| G[Arc · USDC Settlement]
    F --> H[Frontend Dashboard]
    G -->|Verify| H
    H -->|Trade| A
```

### Tech Stack
- **Frontend**: Next.js 15, React 19, Tailwind CSS, Three.js
- **Backend**: Node.js, SQLite (Turso), Redis
- **AI**: Venice AI (Llama 3.3 70B) with Edge Search
- **Web Intelligence**: Bright Data (SERP API, Scraping Browser, Web Unlocker)
- **Blockchains**: 
  - **Arc (Circle L1)** — primary settlement, USDC subscriptions, signals (integrating)
  - Polygon — Polymarket/Kalshi execution
  - Movement/Aptos — legacy testnet signals
- **Data Sources**: Polymarket, Kalshi, Open-Meteo, SynthData, Bright Data SERP

---

## ⚡ Quick Start

### 1. Installation

```bash
git clone https://github.com/thisyearnofear/fourcast.git
cd fourcast
npm install
```

The pre-commit hook will install automatically to protect against committing secrets.

### 2. Environment Setup

Copy `.env.example` to `.env.local`:

```bash
# Required: Bright Data (web intelligence)
BRIGHT_DATA_API_KEY=your_api_key
BRIGHT_DATA_SERP_ZONE=your_serp_zone

# Optional: Bright Data deep research
BRIGHT_DATA_SBR_AUTH=brd-customer-xxx-zone-yyy:password
BRIGHT_DATA_UNLOCKER_ZONE=your_unlocker_zone

# Required: AI & Weather
VENICE_API_KEY=your_venice_api_key
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key

# Optional: Movement (signal publishing)
NEXT_PUBLIC_APTOS_NETWORK=custom
NEXT_PUBLIC_APTOS_NODE_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS=0x...

# Optional: Polymarket Trading
POLYMARKET_PRIVATE_KEY=your_private_key

# Optional: Kalshi Trading
KALSHI_API_KEY=your_api_key
```

Get Bright Data keys at [brightdata.com](https://brightdata.com) -- hackathon participants get $250 in credits with promo code `unlocked`.

See [Setup Guide](./docs/SETUP.md) for complete configuration.

### 3. Run the App

```bash
npm run dev
```

Navigate to `http://localhost:3000`

---

## 📂 Project Structure

```
fourcast/
├── app/                    # Next.js pages and components
├── components/             # React components (UI, 3D, trading)
├── services/               # Backend services (AI, markets, chains)
├── sdk/                    # Signal SDK for developers
├── move/                   # Move contracts (signal registry)
└── docs/                   # Documentation
```

---

## 📊 Supported Platforms

| Platform | Purpose | Status |
|----------|---------|--------|
| Polymarket | Live odds, trading | ✅ Live |
| Kalshi | Live odds, trading | ✅ Live |
| **Arc (Circle)** | USDC settlement, subscriptions | ✅ Testnet |
| Movement/Aptos | Legacy signal publishing | ✅ Testnet |
| BNB Chain | Trading contracts | 🧪 Beta |
| Polygon | Trading contracts | 🧪 Beta |
| Arbitrum | Trading contracts | 🧪 Beta |

---

## 📚 Documentation

- **[Features](./docs/FEATURES.md)** - What works today vs. future roadmap
- **[Setup Guide](./docs/SETUP.md)** - Installation, environment, wallets
- **[Architecture](./docs/ARCHITECTURE.md)** - System design and data flows
- **[API Reference](./docs/API_REFERENCE.md)** - All endpoints and schemas
- **[Deployment](./docs/DEPLOYMENT.md)** - Production deployment guide

---

## 🤝 Contributing

We welcome contributions! Areas of interest:
- New data sources (sentiment, on-chain metrics)
- Additional prediction market platforms
- EVM chain integrations
- UI/UX improvements

---

## 📄 License

MIT

---

## 🔮 Vision

**Fourcast the future** — quantitative prediction intelligence with Arc-native USDC settlement. The agent scans venues, sizes edge with Kelly, publishes verifiable signals, and executes cross-platform arbitrage when fees allow.

**Today**: RFB 02 intelligence · RFB 05 cross-venue arb · RFB 06 social signals & builder monetization  
**Docs**: [Hackathon strategy](./docs/HACKATHON.md) · [Demo script](./docs/DEMO_SCRIPT.md) · [Brand copy](./constants/brand.js)
