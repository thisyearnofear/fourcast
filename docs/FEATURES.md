# Features & Capabilities

## What Works Today

### 🎯 Core Features

#### Search-First Intelligence
- **AI-Powered Search Landing** — Instant analysis entry with "Quick Search" and category navigation
- **Deep Reasoning Visualizer** — Real-time "thinking" overlay for AI analysis, showing provenance and provenance-backed logic
- **Evidence-Based UI** — Explicit data provenance for AI predictions, citing data sources (SynthData, OpenMeteo, Venice AI)

#### Prediction Markets Distribution
- **One-Click Prediction Deep-Linking** — Shareable, pre-analyzed market links that hydrate state automatically
- **Frictionless Capital Flow** — Integrated "Quick Swap" (ETH to USDC) for users with insufficient liquidity

#### Unified Wallet Connection
- **Single Connect Wallet button** — Hides EVM/Aptos/Arc chain complexity
- **Connected status chip** — Green pulse dot + truncated address
- **Chain details popover** — Optional per-chain status and "Disconnect all"

#### Portfolio Overview
- **Track record card** — Signals count, win rate %, Brier score at a glance
- **Loading skeleton** — Graceful fetch state
- **Auto-hides** when no data (first-time user)
- **Links to /signals** for full stats

#### Monetization (USDC on Arc)
- **Free tier**: 3 AI analyses per day
- **Pro tier** ($9.99/mo): Unlimited analyses, deep mode, weather, web search
- **Premium tier** ($19.99/mo): Kelly Criterion, API access, arbitrage execution
- **Subscription smart contract** on Arc testnet (0xC7e26e89...)
- **Rate limit bypass** for active subscribers — checked on-chain via viem

#### AI-Powered Market Analysis
- **Venice AI Integration** - Llama 3.3 70B with web search
- **ML-Backed Forecasts** - SynthData integration for crypto/equities
- **Sports & Events Intelligence** - Weather-aware analysis for sports and event markets
- **Confidence Scoring** - HIGH/MEDIUM/LOW with calibration
- **Edge Detection** - Identify mispriced markets (>5% edge)
- **Kelly Criterion Sizing** - Mathematically optimal fractional Kelly sizing calibrated to wallet balance and AI confidence levels (Pro/Premium feature)

**Supported Assets for ML Forecasts:**
- Crypto: BTC, ETH, SOL
- Equities: SPY, NVDA, GOOGL, TSLA, AAPL
- Commodities: XAU (Gold)

#### Multi-Platform Trading
- **Polymarket** - Live odds, order placement
- **Kalshi** - Live odds, order placement
- **Cross-Platform Arbitrage** - Detect price discrepancies
- **Unified Arbitrage Execution** — One-click buy on cheap venue, sell on expensive with real-time per-leg status
- **Autonomous Autopilot Trading** — Programmatic server-side signing and gasless relayer order execution using Polymarket private keys and Builder Program attribution
- **Telegram Bot (@fourcasterbot)** — /edge commands for AI prediction analysis via messaging

#### On-Chain Signals
- **Arc Publishing** - Publish predictions on Arc testnet via PredictionReceiptERC20 when configured
- **Legacy Fallback** - Movement/Aptos publish path remains available when Arc is not connected
- **Tipping System** - Reward analysts with APT on legacy Movement signals
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

Fourcast the future. We're building **quantitative prediction intelligence** for the decentralized web.

### The Problem
Retail traders lack access to the sophisticated, multi-source analysis tools that institutional quants take for granted. Prediction markets span crypto, sports, politics, and more — but actionable edge requires combining ML forecasts, real-time data (including weather for sports), and AI reasoning at scale.

### Our Solution
Combine ML forecasts, AI reasoning, and real-time data sources to create verifiable, composable signals that traders and developers can trust — across every prediction market vertical.

### Long-Term Goals
1. **Become the standard** for quantitative prediction market analysis
2. **Build a developer ecosystem** around composable signal infrastructure
3. **Expand data integrations** across new verticals and data sources
4. **Position Movement/Aptos** as the go-to chain for prediction intelligence

---

## Use Cases — by customer loop

Fourcast commits to one primary customer. The other use cases exist to feed that loop.

### 🥇 For Quant Operators (Primary — the product)

- Run an autonomous agent loop: discover → AI forecast → Kelly-sized positions → attributed execution
- Compare odds across Polymarket and Kalshi with fee-aware arbitrage detection
- Build a public **Audited Track Record** on Arc that follow-on capital can verify
- Earn Builder attribution revenue from every Autopilot fill
- Track Brier score, win rate, calibration, and operator-tier performance metrics

### 📣 For Signal Analysts (Acquisition Layer — not the headline)

- Publish predictions with verifiable on-chain track record
- Build a follower graph — the funnel into the Operator tier
- Earn tips and surface relevant operators to the marketplace
- Visibility into which analysts graduate to Operator status

### 🧪 For Developers

- Access unified API for prediction markets
- Build custom signal publishers (SDK ships later — gated until Operator tier is validated)
- Integrate Fourcast analysis into apps
- Create new domain analyzers

### 🎓 For Researchers

- Study market efficiency across platforms using the on-chain data
- Analyze weather impacts on outcomes
- Access historical forecast data
- Validate AI prediction models — but only as a side effect of the Operator loop

> **Who Fourcast is not for.** Casual retail looking for a free alpha feed. Retail-tier behavior (no wallet, no capital, no signal-publishing intent) is allowed under the free tier but never optimized for. The product **underserves** that use case on purpose.

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

---

## 🏆 Agora Agents Hackathon Integration

Fourcast is an **Arc-native prediction market intelligence agent** in the [Agora Agents Hackathon](https://agora.thecanteenapp.com/) (Canteen × Circle). **RFB 02** (primary) · **RFB 05** · **RFB 06**. Demo: [DEMO_SCRIPT.md](./DEMO_SCRIPT.md). UI copy: [constants/brand.js](../constants/brand.js).

### Arc-Native Features (New)

#### Arc Settlement Layer
- **Signal publishing on Arc** — On-chain predictions with sub-second finality, ~$0.01 USDC fees
- **USDC-denominated tipping** — Reward analysts with USDC instead of APT
- **Circle Wallets** — Agent-managed trading accounts with automated key management
- **Paymaster** — All gas fees paid in USDC, no volatile gas tokens
- **CCTP/Gateway** — Cross-chain USDC transfers for multi-venue trading

#### Enhanced Agent Intelligence
- **Kelly Criterion sizing** — Optimal bet sizing based on edge magnitude and confidence
- **Builder code monetization** — Polymarket V2 builder integration earns USDC per fill
- **Reasoning trace on-chain** — Hash AI reasoning and pin on Arc for verification
- **USYC idle capital** — Park agent capital in yield between trading cycles
- **App Kit integration** — Bridge/Swap/Send components in UI

### Supported Chains (Updated)

| Chain | Purpose | Status |
|-------|---------|--------|
| **Arc (Circle L1)** | Primary settlement — USDC subs ✅, signals/tips rolling out | ✅ Testnet |
| Movement/Aptos | Legacy signal publishing | ✅ Testnet |
| BNB Chain | Trading contracts | 🧪 Beta |
| Polygon | Trading contracts | 🧪 Beta |
| Arbitrum | Trading contracts | 🧪 Beta |

### Hackathon Resources
- **Strategy doc**: [HACKATHON.md](./HACKATHON.md)
- **Arc CLI**: `uv tool install git+https://github.com/the-canteen-dev/ARC-cli`
- **Arc docs**: https://arc-node.thecanteenapp.com/
- **Hackathon page**: https://agora.thecanteenapp.com/
- **Submission form**: https://forms.gle/hFPM2t4Jt1zGfqzM7
