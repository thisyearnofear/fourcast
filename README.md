# 🌤️ Fourcast: AI-Powered Weather Edge Analytics Platform

A multichain AI intelligence layer that analyzes weather forecasts to identify mispriced prediction markets. Built on a sophisticated infrastructure spanning multiple blockchains to optimize for trading, analytics, and reputation tracking.

## 🎯 Core Value Proposition

Weather impacts billions in outcomes (sports performance, voter turnout, event logistics), but retail prediction market participants systematically under-weight these factors. Fourcast uses AI to detect information asymmetries where current odds don't reflect weather-adjusted probabilities.

## 🔗 Multichain Architecture

Our platform leverages a sophisticated three-chain architecture, each optimized for specific functions:

### **Polygon (Polymarket) = Trading & Liquidity**
- Live prediction market orders and settlements
- Established institutional-grade liquidity infrastructure
- Professional trading tools, order books, and market depth
- Real-time odds data and market movements

### **BNB Chain = Analytics & Performance Tracking**
- Low-cost prediction receipts (<$0.10 per transaction)
- Fast finality (3-second blocks) for instant confirmation
- Immutable performance tracking and analytics storage
- Cross-chain prediction history and validation

### **Aptos = Reputation & Signal Registry**
- On-chain signal publishing and reputation tracking
- Cryptographic proof of AI analysis and predictions
- Decentralized analyst scoring and leaderboards
- Move-based smart contracts for signal integrity

### **Why This Design?**
Rather than building on a single chain, we optimize for each use case:
- **Trade where liquidity exists** (Polygon/Polymarket)
- **Track performance affordably** (BNB Chain)
- **Build reputation transparently** (Aptos)
- **Unified intelligence layer** across all chains

This multichain approach delivers institutional-grade trading with affordable analytics and transparent reputation—combining the strengths of each ecosystem.

See [Architecture Guide](./docs/ARCHITECTURE.md) for technical details.

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

### **Multichain Infrastructure**
- **Polygon**: Polymarket integration, trading execution
- **BNB Chain**: Analytics contracts, performance tracking
- **Aptos**: Signal registry, reputation system (Move smart contracts)

### **Smart Contracts & Web3**
- **Solidity 0.8.20**: BNB Chain analytics contracts with OpenZeppelin
- **Move**: Aptos signal registry and reputation tracking
- **Web3 Integration**: Wagmi, ConnectKit, Aptos Wallet Standard
- **Wallets**: MetaMask (trading), Petra (signals), multi-wallet UX

### **Frontend & UX**
- **Framework**: Next.js 15, React 19, React Three Fiber
- **Styling**: Tailwind CSS, responsive design
- **3D Graphics**: Three.js, React Three Drei, postprocessing effects
- **State Management**: React hooks, Web3 context providers

### **AI & Data**
- **AI Engine**: Venice AI (qwen3-235b for deep reasoning)
- **Market Data**: Polymarket Gamma API, real-time odds
- **Weather Data**: WeatherAPI integration, forecast analysis
- **Backend**: Next.js API Routes, Redis caching, SQLite analytics

### **Infrastructure & Deployment**
- **Hosting**: Vercel (frontend), multichain contract deployment
- **Database**: SQLite for local analytics, on-chain for immutable records
- **APIs**: RESTful endpoints, streaming AI analysis, WebSocket connections

## 🚀 Quick Start

### Prerequisites
- Node.js 18.18+ or 20+
- npm or yarn
- MetaMask wallet (for trading on Polygon)
- Petra wallet (for signals on Aptos)
- API keys: WeatherAPI, Venice AI

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
# Weather & AI Services
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key
VENICE_API_KEY=your_venice_api_key

# Multichain Configuration
NEXT_PUBLIC_POLYMARKET_HOST=https://clob.polymarket.com
NEXT_PUBLIC_BNB_CHAIN_ID=56
NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
NEXT_PUBLIC_APTOS_NETWORK=devnet

# Contract Addresses (update after deployment)
NEXT_PUBLIC_BNB_ANALYTICS_CONTRACT=0x...
NEXT_PUBLIC_APTOS_SIGNAL_REGISTRY_MODULE=0x...::signal_registry
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

## 🌐 Multichain Web3 Integration

### Trading Layer (Polygon/Polymarket)
```bash
npm install @polymarket/clob-client ethers
```

```typescript
import { ClobClient } from "@polymarket/clob-client";

const client = new ClobClient(
  "https://clob.polymarket.com",
  137, // Polygon
  signer,
  creds,
  signatureType
);

// Execute prediction market order
const order = await client.createAndPostOrder({
  tokenID: weatherMarketTokenId,
  price: 0.50, // AI-analyzed probability
  side: Side.BUY,
  size: 1,
  feeRateBps: 0,
});
```

### Analytics Layer (BNB Chain)
```solidity
// Prediction receipt contract
contract WeatherAnalytics {
    struct PredictionReceipt {
        uint256 timestamp;
        string marketId;
        string weatherData;
        uint256 confidence;
        address analyst;
    }
    
    function recordPrediction(
        string memory marketId,
        string memory weatherData,
        uint256 confidence
    ) external;
}
```

### Reputation Layer (Aptos)
```typescript
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";

// Publish signal to Aptos
const payload = {
  function: `${MODULE_ADDRESS}::signal_registry::publish_signal`,
  arguments: [
    eventId,
    marketTitle,
    venue,
    eventTime,
    marketSnapshotHash,
    weatherJson,
    aiDigest,
    confidence,
    oddsEfficiency,
  ],
};

const transaction = await aptos.signAndSubmitTransaction({
  signer: account,
  data: payload,
});
```

## 🚀 Key Features & Capabilities

### **Real-Time Intelligence**
- Automated event detection and weather correlation
- AI-powered market inefficiency identification
- Live odds monitoring and forecast updates
- Cross-chain data aggregation and analysis

### **Multichain Operations**
- Seamless trading on Polygon via Polymarket integration
- Cost-efficient analytics tracking on BNB Chain
- Transparent reputation building on Aptos blockchain
- Unified dashboard across all chains

### **Professional Tools**
- Dual-wallet UX (MetaMask + Petra) for different functions
- Real-time market analysis with confidence scoring
- Historical performance tracking and validation
- Comprehensive API for algorithmic integration

### **Advanced Analytics**
- Weather impact modeling for various event types
- Market efficiency scoring and edge detection
- Analyst reputation and leaderboard systems
- Cryptographic proof of predictions and outcomes

## 📖 Documentation

Comprehensive documentation in 3 focused guides:

- **[Setup Guide](./docs/SETUP.md)** - Installation, configuration, and development workflow
- **[Architecture Guide](./docs/ARCHITECTURE.md)** - System design, patterns, and scalability
- **[API Reference & Roadmap](./docs/API.md)** - Complete API documentation and product roadmap

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
