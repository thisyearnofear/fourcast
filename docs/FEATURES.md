# Features & Capabilities

## What Works Today

### 🎯 Core Features

#### AI-Powered Market Analysis
- **Venice AI Integration** - Llama 3.3 70B with web search
- **Weather-Aware Predictions** - Real-time weather data for sports/events
- **ML-Backed Forecasts** - SynthData integration for crypto/equities
- **Confidence Scoring** - HIGH/MEDIUM/LOW with calibration
- **Edge Detection** - Identify mispriced markets (>5% edge)

**Supported Assets for ML Forecasts:**
- Crypto: BTC, ETH, SOL
- Equities: SPY, NVDA, GOOGL, TSLA, AAPL
- Commodities: XAU (Gold)

#### Multi-Platform Trading
- **Polymarket** - Live odds, order placement
- **Kalshi** - Live odds, order placement
- **Cross-Platform Arbitrage** - Detect price discrepancies

#### On-Chain Signals (Movement Testnet)
- **Signal Publishing** - Publish predictions to blockchain
- **Tipping System** - Reward analysts with APT
- **Reputation Tracking** - Win rates, Brier scores, accuracy streaks
- **Leaderboards** - Top analysts by performance

#### User Interface
- **Signals Feed** - Browse published predictions
- **Markets Discovery** - Filter by sport, volume, resolution date
- **DeFi Arbitrage Tab** - Cross-platform opportunities
- **My Signals** - Track your published predictions
- **Top Analysts** - Leaderboard with tier rankings

---

### 📊 Data Sources

| Source | Purpose | Status |
|--------|---------|--------|
| Polymarket | Live odds, trading | ✅ Production |
| Kalshi | Live odds, trading | ✅ Production |
| Open-Meteo | Weather forecasts | ✅ Production |
| SynthData | ML price forecasts | ✅ Production |
| Venice AI | AI analysis engine | ✅ Production |

---

### 🔗 Supported Chains

| Chain | Purpose | Status |
|-------|---------|--------|
| Movement (Aptos) | Signal publishing, tipping | ✅ Testnet |
| BNB Chain | Trading contracts | 🧪 Beta |
| Polygon | Trading contracts | 🧪 Beta |
| Arbitrum | Trading contracts | 🧪 Beta |

---

### 📈 Analytics & Tracking

#### Agent Track Record
- Total forecasts made
- Win rate percentage
- Brier score (calibration)
- Average edge detected
- Confidence stratification (HIGH/MEDIUM/LOW accuracy)

#### Analyst Reputation
- Signals published
- Tips earned (APT)
- Accuracy streaks
- Tier progression (Novice → Sage)

---

## In Development

### 🔨 Currently Being Built

#### Enhanced Analytics
- [ ] Path-dependent market analysis
- [ ] Advanced volatility modeling
- [ ] Historical backtesting interface
- [ ] Portfolio tracking across markets

#### Trading Improvements
- [ ] One-click arbitrage execution
- [ ] Automated limit orders
- [ ] Position management dashboard
- [ ] P&L tracking and reporting

#### Platform Expansion
- [ ] Additional prediction markets (Metaculus, Manifold)
- [ ] More EVM chain integrations
- [ ] Mobile-responsive UI improvements
- [ ] Telegram bot for alerts

---

## Future Vision

### 🚀 Roadmap

#### Phase 1: Premium Signals (Q2 2025)
- Tiered access model (free vs. premium)
- Advanced AI models (Qwen3-235B for deep analysis)
- Custom alert system
- API access for developers

#### Phase 2: Developer Ecosystem (Q3 2025)
- Public SDK for custom signal publishers
- Domain analyzer framework
- Webhook integrations
- Developer documentation and examples

#### Phase 3: DePIN Integration (Q4 2025)
- Weather oracle network
- Decentralized data verification
- Community-run analysis nodes
- Token-gated access

#### Phase 4: Prediction Markets 2.0 (2026)
- Native prediction market protocol
- Weather-parametric markets
- Automated market maker (AMM) design
- Cross-chain liquidity aggregation

---

## Vision Statement

Fourcast is building a **weather-aware prediction intelligence layer** for the decentralized web.

### The Problem
Weather significantly impacts real-world outcomes (sports, events, commodities), but this data is underutilized in prediction markets. Retail traders lack access to sophisticated analysis tools that institutional quants take for granted.

### Our Solution
Combine real-time environmental data, ML forecasts, and AI reasoning to create verifiable, composable signals that traders and developers can trust.

### Long-Term Goals
1. **Become the standard** for weather-aware prediction analysis
2. **Build a developer ecosystem** around composable signal infrastructure
3. **Create new market types** that leverage weather parametrics
4. **Position Movement/Aptos** as the go-to chain for prediction intelligence

---

## Use Cases

### For Traders
- Find mispriced markets using AI analysis
- Compare odds across Polymarket and Kalshi
- Execute arbitrage strategies
- Track personal performance over time

### For Analysts
- Publish predictions with verifiable track record
- Earn tips for high-quality signals
- Build reputation in the community
- Compete on leaderboards

### For Developers
- Access unified API for prediction markets
- Build custom signal publishers
- Integrate AI analysis into your apps
- Create new domain analyzers

### For Researchers
- Study market efficiency across platforms
- Analyze weather impacts on outcomes
- Access historical forecast data
- Validate AI prediction models

---

## Technical Capabilities

### AI Models
- **Production**: Llama 3.3 70B (fast, cost-effective)
- **Deep Analysis**: Qwen3-235B (slower, more detailed)
- **Web Search**: Automatic fact-checking and context

### Caching Strategy
- **Redis**: AI results (15min), ML forecasts (15min)
- **In-Memory**: Market catalogs (30min), metadata (24hr)
- **SQLite**: Persistent signals, forecasts, track records

### Rate Limits
| Endpoint | Limit |
|----------|-------|
| AI Analysis | 3/hour per IP |
| Weather API | 15/hour per IP |
| Signals | Standard API limits |
| Kalshi Trading | Token expires 30min |

---

## Comparison: Fourcast vs. Traditional Tools

| Feature | Fourcast | Manual Analysis | Institutional Tools |
|---------|----------|-----------------|---------------------|
| AI Analysis | ✅ Automated | ❌ Manual | ✅ Expensive |
| Weather Data | ✅ Real-time | ⚠️ Separate | ✅ Integrated |
| Multi-Platform | ✅ Polymarket + Kalshi | ❌ One at a time | ⚠️ Limited |
| On-Chain Record | ✅ Verifiable | ❌ None | ❌ Private |
| Cost | ✅ Free tier | ✅ Free | ❌ $$$$ |
| Accessibility | ✅ Retail-friendly | ✅ Free | ❌ Institutional only |

---

## Get Started

1. **Try the Demo**: Visit [fourcast](http://localhost:3000)
2. **Read the Docs**: See [Setup Guide](./SETUP.md)
3. **Join the Community**: [Discord](https://discord.gg/movementlabs)
4. **Build Something**: Check out [API Reference](./API_REFERENCE.md)

---

**Last Updated**: February 2025
