# 🌤️ Fourcast: AI-Powered Weather Edge Analytics Platform

A multichain AI intelligence layer that analyzes weather forecasts to identify mispriced prediction markets. Built on a sophisticated infrastructure spanning multiple blockchains to optimize for trading, analytics, and reputation tracking.

## 🎯 Overview

Fourcast is an AI layer that joins real-time weather with prediction market data to surface mispricings. It aggregates markets, analyzes weather impact, and lets users publish signals on-chain.

## 🚀 Features

- **Multi-Platform Integration**: Aggregated discovery across Polymarket and Kalshi with platform badges and filters
- **Date-First Markets UI**: Today, Tomorrow, This Week, Later tabs for upcoming events
- **Weather-Aware AI Analysis**: Venice AI integration with confidence scoring
- **Dual Wallet UX**: MetaMask for trading, Petra for signals publishing
- **On-Chain Signals**: Publish to Aptos with tx hash feedback
- **Venue Extraction**: Automatic location detection for sports events
- **Cross-Platform Arbitrage**: Price discrepancy detection between platforms

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, Tailwind CSS, React Three Fiber
- **Data & AI**: WeatherAPI, Venice AI (llama-3.3-70b), Redis cache, SQLite
- **Web3**: Wagmi/ConnectKit, Aptos Wallet Standard, Move module v2 on testnet
- **Backend**: Next.js API Routes, Venice AI analysis, Polymarket/Kalshi APIs

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or 20+
- npm or yarn
- MetaMask wallet (trading on Polygon)
- Petra wallet (signals on Aptos)
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
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key
VENICE_API_KEY=your_venice_api_key
NEXT_PUBLIC_APTOS_NETWORK=testnet
NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
NEXT_PUBLIC_APTOS_MODULE_ADDRESS=0xYOUR_MODULE_ADDRESS
```

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build
```

## 📚 Documentation

- [Setup Guide](./docs/SETUP_GUIDE.md) - Installation, configuration and Aptos integration
- [Architecture Guide](./docs/ARCHITECTURE_GUIDE.md) - System design and patterns
- [Integration Guide](./docs/INTEGRATION_GUIDE.md) - Multi-platform integration and Venice AI analysis
- [API Reference](./docs/API_REFERENCE.md) - Complete API documentation and product roadmap

## 🌐 Endpoints

### Core APIs
- `GET /api/weather` - Current weather data
- `GET /api/markets` - Aggregated Polymarket/Kalshi markets
- `POST /api/analyze` - AI market analysis with weather impact
- `POST /api/signals` - Publish signals to SQLite/Aptos
- `GET /api/signals` - List latest signals
- `GET /api/leaderboard` - Reputation system leaderboard

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

Educational and entertainment purposes only. Weather prediction is inherently uncertain. Always trade responsibly and never risk more than you can afford to lose. This is a research intelligence tool, not an auto-betting system.