# Getting Started

## Quick Start: Polymarket Integration

### 30-Second Setup

1. **Ensure API keys are set** in `.env.local`:
```bash
VENICE_API_KEY=your_venice_api_key_here
```

2. **Install dependencies** (already done):
```bash
npm install
```

3. **Start dev server:**
```bash
npm run dev
```

4. **Open browser:**
Navigate to `http://localhost:3001`

5. **Test the feature:**
   - Allow location access or enter a city
   - Wait for weather to load
   - Click the lightbulb icon (💡) in bottom-left
   - Panel expands → "Fetching markets..."
   - Wait 2-3 seconds for market list to load
   - Click any market to see AI analysis

### Timeline
- **0-2 sec**: Markets loading spinner
- **2-3 sec**: Market list appears (top 10 weather-sensitive events)
- **User clicks market**: Analysis starts (spinner)
- **3-8 sec**: Venice AI analyzes market
- **8+ sec**: Results display with confidence score, key factors, recommendation

## System Requirements

### Minimum Requirements
- **Node.js**: `18.18.0+` or `20.0+`
- **npm**: `9.0+`
- **Git**: Latest stable version

### Recommended Setup
```bash
# Install Node.js 18.18+ via Node Version Manager
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18.18
nvm use 18.18
# Verify: node -v → v18.18.0+, npm -v → 9.0+
```

## Local Development Setup

### 1. Clone & Install
```bash
git clone <repository-url>
cd weather-prediction-markets
npm install --legacy-peer-deps
```

### 2. Environment Configuration
```bash
cp .env.local.example .env.local
# Edit with your API keys
```

### 3. AI Integration Setup

#### Get Venice AI Key
1. Visit [Venice AI](https://venice.ai/)
2. Sign up and get API key
3. Add to `.env.local`:
```bash
VENICE_API_KEY=your_venice_api_key_here
```

#### Model Selection
- **Primary**: `qwen3-235b` (deep reasoning)
- **Alternative**: `mistral-31-24b` (vision support)

#### Basic Usage
```typescript
import OpenAI from 'openai';
const client = new OpenAI({
    apiKey: process.env.VENICE_API_KEY,
    baseURL: 'https://api.venice.ai/api/v1'
});
```

### 4. Web3 Wallet Setup

#### MetaMask Configuration
1. Add Arbitrum One network to MetaMask:
   - RPC URL: `https://arb1.arbitrum.io/rpc`
   - Chain ID: `42161`
   - Block Explorer: `https://arbiscan.io`

2. Get USDC for trading (bridge from Ethereum mainnet)

#### WalletConnect Project ID
1. Create project at [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Add to environment
3. Configure domains: `localhost:3000, weather.markets`

### 5. Start Development Server
```bash
npm run dev
# With Turbopack (faster): npx next dev --turbo
```

Visit `http://localhost:3000` for the weather app with ConnectKit wallet integration!

## Environment Variables

### Required Variables
```bash
# Weather API
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key

# AI Analysis (Venice AI)
VENICE_API_KEY=your_venice_api_key

# Web3/WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Polymarket/Web3
NEXT_PUBLIC_POLYMARKET_HOST=https://clob.polymarket.com
NEXT_PUBLIC_ARBITRUM_CHAIN_ID=42161

# Optional: Production trading
POLYMARKET_PRIVATE_KEY=0x_your_private_key
POLYMARKET_FUNDER_ADDRESS=0x_your_funder_address
```

## Project Architecture

```
├── app/                      # Next.js App Router
│   ├── api/weather/          # Weather API endpoints
│   ├── global.css            # Global styles
│   ├── layout.js             # Root layout with ConnectKit
│   └── page.js               # Main weather app with 3D viz
├── components/               # React components
│   ├── Scene3D.js           # Three.js weather visualization
│   ├── LocationSelector.js  # City/location picker
│   └── ..
├── onchain/                 # Blockchain integrations
│   └── config.ts            # Wagmi/Arbitrum configuration
├── services/                # Business logic
│   └── weatherService.js    # WeatherAPI integration
├── markets/                 # Prediction market logic
├── docs/                    # Documentation
└── public/                  # Static assets (textures, icons)
```

### Key Technologies
- **Next.js 15** - App Router with server components
- **React 19** - Latest React with concurrent features
- **React Three Fiber** - Declarative 3D graphics
- **Tailwind CSS** - Utility-first styling
- **ConnectKit** - Wallet connection UI
- **Wagmi** - Ethereum hooks
- **Arbitrum** - L2 blockchain

## Deployment

### Vercel (Recommended)
1. Install Vercel CLI: `npm i -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`
4. Set environment variables in Vercel dashboard

### Custom Server
```bash
npm run build
npm start
```

## Troubleshooting

### Common Issues

**Node.js Version Too Old:**
```bash
nvm install 18.18
nvm use 18.18
```

**AI Analysis Not Working:**
- Check `VENICE_API_KEY` is set
- Ensure Venice account has credits

**Wallet Not Connecting:**
- Verify WalletConnect Project ID
- Check MetaMask has Arbitrum One network
- Clear browser cache

**Weather API Errors:**
- Check `NEXT_PUBLIC_WEATHER_API_KEY`
- Verify quota hasn't been exceeded

**3D Scene Not Loading:**
- Check browser console for WebGL errors
- Ensure hardware acceleration enabled

### Development Commands

```bash
npm run dev          # Start dev server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Lint code
npm run type-check   # Type checking
```

## Next Steps

With the app running:
1. Test 3D weather visualization in different cities
2. Connect wallet and switch to Arbitrum
3. Explore Polymarket integration features
4. Deploy to Vercel for production

Ready? `npm run dev` and click the 💡 button!
