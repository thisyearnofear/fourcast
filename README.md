# 🌤️ Fourcast: AI-Powered Weather Edge Analytics on BNB Chain

**Built for BNB Chain Prediction Markets Hackathon**

An AI intelligence layer that analyzes weather forecasts to identify mispriced prediction markets. Uses BNB Chain for low-cost prediction receipts and performance tracking, while leveraging Polymarket's established liquidity for market data.

## 🎯 Core Value Proposition

Weather impacts billions in outcomes (sports performance, voter turnout, event logistics), but retail prediction market participants systematically under-weight these factors. Fourcast uses AI to detect information asymmetries where current odds don't reflect weather-adjusted probabilities.

## 🔗 Why BNB Chain?

**Low Transaction Costs:** Weather predictions require frequent on-chain receipts. BNB Chain's <$0.10 gas fees enable sustainable micro-predictions at scale.

**Fast Finality:** 3-second block time means instant prediction confirmation for time-sensitive weather markets.

**Liquidity Access:** BNB ecosystem provides capital infrastructure for weather-sensitive markets.

**Smart Architecture:** Rather than bootstrapping our own prediction markets (expensive, slow), we use BNB Chain for what it does best—low-cost, high-speed analytics tracking—while pulling market data from established platforms like Polymarket.

See [BNB Chain Architecture](./docs/BNB_CHAIN_ARCHITECTURE.md) for our hybrid design rationale.

## 🚀 MVP Scope (No Model Training Required)

### What It Does

- Fetches upcoming events from Polymarket (sports games, marathons, outdoor events)
- Retrieves weather forecasts for event locations via WeatherAPI
- Queries Venice AI to analyze: "Given these weather conditions, do the current market odds reflect the weather impact?"
- Displays ranked opportunities with AI-generated explanations and confidence scores

### Key Features

- **Weather Context Engine**: Matches events to location forecasts (temp, precipitation, wind, humidity)
- **AI Analysis**: LLM evaluates team/participant climate adaptation, playing styles, historical performance in similar conditions
- **Edge Detection**: Compares AI-assessed probability vs. current Polymarket odds
- **Transparent Reasoning**: Shows full AI explanation for each flagged opportunity
- **Real-time Updates**: Monitors forecast changes and odds shifts

## 🔗 Integration with Existing Platform

Built as a new module within the existing Fourcast app:

- **Leverages existing**: WeatherAPI integration, Polymarket client, Next.js infrastructure
- **Adds new**: Event scraper, AI analysis engine, edge-finder UI dashboard
- **Extends markets from**: Weather-specific predictions → Weather-influenced event outcomes

## 🛠️ Technical Approach

Event Detection → Weather Fetch → AI Analysis → Edge Scoring → User Dashboard

### APIs Used
- WeatherAPI (already integrated)
- Polymarket API (already integrated)
- Venice AI API (new)
- Sports/Event APIs (ESPN, The Odds API)

### AI Prompt Pattern

Using Venice AI (qwen3-235b model for deep reasoning):

Analyze this event for weather-related edge:
- Event: [NFL game, marathon, etc.]
- Participants: [teams/athletes with home climates]
- Weather: [forecast details]
- Current Odds: [Polymarket probability]

Assess:
1. Does weather significantly favor one outcome?
2. Are odds efficiently priced or is there asymmetry?
3. Confidence: LOW/MEDIUM/HIGH

Provide 2-3 paragraph analysis with specific reasoning.

## 📊 Success Metrics

- **Accuracy**: Do flagged edges materialize more than random?
- **User engagement**: Do users find analyses valuable?
- **Market validation**: Can we identify odds movements after weather forecasts update?

## 📁 Project Structure

```
├── app/                  # Next.js App Router
│   ├── api/             # API routes
│   ├── global.css       # Global styles
│   ├── layout.js        # Root layout
│   └── page.js          # Homepage
├── components/          # React components
├── services/           # Weather & AI services
├── onchain/            # Blockchain integration
├── markets/            # Prediction market logic
├── docs/               # Documentation
└── public/             # Static assets
```

## 🛠️ Tech Stack

- **Blockchain**: BNB Chain (primary), Arbitrum (secondary) - Smart contract deployment
- **Smart Contracts**: Solidity 0.8.20, OpenZeppelin, Fee-only prediction receipts
- **Frontend**: Next.js 15, React 19, React Three Fiber, Tailwind CSS
- **3D Graphics**: Three.js, React Three Drei, Postprocessing Effects
- **Web3**: Wagmi, ConnectKit, Ethers 6
- **AI**: Venice AI (qwen3-235b for deep reasoning)
- **Market Data**: Polymarket Gamma API
- **Backend**: Next.js API Routes, WeatherAPI, Redis caching
- **Database**: SQLite for prediction history and analytics
- **Hosting**: Vercel (frontend), BNB Chain (contracts)

## 🚀 Quick Start

### Prerequisites
- Node.js 18.18+ or 20+
- npm or yarn
- MetaMask wallet

### Installation

```bash
# Clone repository
git clone <repository-url>
cd fourcast

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.local.example .env.local
```

### Environment Setup

```bash
# .env.local
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key
NEXT_PUBLIC_POLYMARKET_HOST=https://clob.polymarket.com
NEXT_PUBLIC_ARBITRUM_CHAIN_ID=42161
VENICE_API_KEY=your_venice_api_key     # For AI analysis
```

### Development

```bash
# Start development server
npm run dev -- --turbopack

# Build for production
npm run build

# Start production server
npm start
```

## 🌐 Web3 Integration

### Polymarket Setup

1. **Install Polymarket Client**:
```bash
npm install @polymarket/clob-client ethers
```

2. **Initialize Client** (see `onchain/polymarket.ts`):
```typescript
import { ClobClient } from "@polymarket/clob-client";

const client = new ClobClient(
  "https://clob.polymarket.com",
  137, // Polygon
  signer,
  creds,
  signatureType
);
```

3. **Place Prediction Bet**:
```typescript
const order = await client.createAndPostOrder({
  tokenID: weatherMarketTokenId,
  price: 0.50, // 50% probability estimation
  side: Side.BUY,
  size: 1,
  feeRateBps: 0,
});
```

## 📈 2-Week MVP Deliverables

- Event ingestion for NFL games
- Weather-to-event matching system
- AI analysis pipeline with Venice AI API
- Dashboard showing top 5 opportunities weekly
- Track record page comparing predictions vs. outcomes

## 🎯 Roadmap

- [ ] Event ingestion system (NFL, sports, political events)
- [ ] AI analysis engine with Claude/GPT
- [ ] Edge detection and scoring algorithm
- [ ] Real-time dashboard with ranked opportunities
- [ ] Weather forecast monitoring and alerts
- [ ] Historical performance tracking
- [ ] Mobile-responsive interface
- [ ] Cross-chain operations

## 📖 Documentation

- [Getting Started & Development Guide](./docs/GUIDE.md)
- [API Reference](./docs/API.md)
- [Product Roadmap & Vision](./docs/ROADMAP.md)
- [Integration & Development Details](./docs/INTEGRATION.md)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This platform is for educational and entertainment purposes. Weather prediction is inherently uncertain. Always trade responsibly and never risk more than you can afford to lose. This is a research intelligence tool, not an auto-betting system.
