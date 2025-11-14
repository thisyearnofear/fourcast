# 🌤️ Weather Prediction Markets

Interactive 3D weather visualization platform with prediction markets on Arbitrum & Polymarket.

## 🚀 Features

- **3D Weather Visualization**: React Three Fiber with real-time weather data
- **Prediction Markets**: Weather outcome markets on Polymarket (Arbitrum)
- **Multi-chain Support**: Arbitrum L2 with optimistic rollups
- **Real-time Data**: WeatherAPI integration with caching
- **Weather Effects**: Dynamic 3D rain, snow, clouds, and storm simulations

## 📁 Project Structure

```
├── app/                  # Next.js App Router
│   ├── api/             # API routes
│   ├── global.css       # Global styles
│   ├── layout.js        # Root layout
│   └── page.js          # Homepage
├── components/          # React components
├── services/           # Weather services
├── onchain/            # Blockchains
├── markets/            # Prediction market logic
├── docs/               # Documentation
└── public/             # Static assets
```

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, React 19, React Three Fiber, Tailwind CSS
- **3D Graphics**: Three.js, React Three Drei, Postprocessing Effects
- **Web3**: Ethers, Arbitrum SDK, Polymarket Clob Client
- **Backend**: Next.js API Routes, WeatherAPI
- **Hosting**: Vercel (frontend), Arbitrum (smart contracts)

## 🚀 Quick Start

### Prerequisites
- Node.js 18.18+ or 20+
- npm or yarn
- MetaMask wallet

### Installation

```bash
# Clone repository
git clone <repository-url>
cd weather

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
```

### Development

```bash
# Start development server
npm run dev

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

### Weather Market Creation

Markets are created based on:
- Temperature ranges (e.g., "Will NYC exceed 80°F tomorrow?")
- Precipitation forecasts ("Will it rain in London this weekend?")
- Weather conditions ("Will there be snow in Denver?")

## 🔗 Smart Contracts

Deployed on **Arbitrum One**:
- Prediction market contracts
- Weather oracle integration
- USDC payment contracts

## 📖 Documentation

- [API Documentation](./docs/API.md)
- [Web3 Setup Guide](./docs/WEB3_SETUP.md)
- [Weather Integration](./docs/WEATHER_API.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)
- [Market Creation](./docs/MARKETS.md)

## 🎯 Roadmap

- [ ] Migrate to Arbitrum One
- [ ] Polymarket integration
- [ ] Weather oracle smart contracts
- [ ] Prediction market UI
- [ ] Cross-chain operations
- [ ] Mobile-responsive betting interface

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This platform is for educational and entertainment purposes. Weather prediction is inherently uncertain. Always trade responsibly and never risk more than you can afford to lose.
