# 🚀 Setup & Deployment Guide

Complete setup guide for running the Weather Prediction Markets app locally and deploying to production.

## 📋 System Requirements

### Minimum Requirements
- **Node.js**: `18.18.0+` or `20.0+` (required)
- **npm**: `9.0+`
- **Git**: Latest stable version

### Recommended Setup
```bash
# Install Node.js 18.18+ via Node Version Manager (nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
source ~/.bashrc
nvm install 18.18
nvm use 18.18

# Verify installation
node -v  # Should show v18.18.0 or higher
npm -v   # Should show 9.0+
```

## 🔧 Local Development Setup

### 1. Clone & Install
```bash
# Clone the repository
git clone <repository-url>
cd weather-prediction-markets

# Install all dependencies (including Web3 libraries)
npm install --legacy-peer-deps
```

### 2. Environment Configuration
```bash
# Copy environment template
cp .env.local.example .env.local

# Edit with your API keys
nano .env.local  # or your preferred editor
```

**Required environment variables:**
```bash
# Weather API (free tier available)
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key_here

# WalletConnect (get from https://cloud.walletconnect.com/)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here

# Optional: Production trading credentials
POLYMARKET_PRIVATE_KEY=0x_your_private_key_here
POLYMARKET_FUNDER_ADDRESS=0x_your_funder_address_here
```

### 3. Start Development Server
```bash
# Standard mode
npm run dev

# With Turbopack (faster)
npx next dev --turbo
```

Visit `http://localhost:3000` to see your weather app with ConnectKit wallet integration!

## 🌐 Web3 Wallet Setup

### MetaMask Configuration

1. **Add Arbitrum One** network to MetaMask:
   - Network Name: `Arbitrum One`
   - RPC URL: `https://arb1.arbitrum.io/rpc`
   - Chain ID: `42161`
   - Currency Symbol: `ETH`
   - Block Explorer: `https://arbiscan.io`

2. **Get USDC** for trading (testnet only initially):
   - Bridge ETH from Ethereum mainnet
   - Swap for USDC on Arbitrum

### WalletConnect Project ID

1. Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Create a new project
3. Copy your Project ID to environment variables
4. Configure allowed domains: `localhost:3000, weather.markets`

## 🏗️ Project Architecture

### Directory Structure
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

**Frontend:**
- **Next.js 15** - App Router with server components
- **React 19** - Latest React with concurrent features
- **React Three Fiber** - Declarative 3D graphics
- **Tailwind CSS** - Utility-first styling

**Web3:**
- **ConnectKit** - Beautiful wallet connection UI
- **Wagmi** - React hooks for Ethereum
- **Arbitrum** - L2 blockchain for prediction markets

**Backend APIs:**
- **Next.js API Routes** - Serverless weather endpoint
- **WeatherAPI.com** - Real-time weather data
- **Polymarket Clob** - Prediction market integration (future)

## 🚀 Deployment

### Vercel (Recommended)
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables in Vercel dashboard
NEXT_PUBLIC_WEATHER_API_KEY=...
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...
```

### Custom Server
```bash
# Build for production
npm run build

# Start production server
npm start
```

## 🔍 Testing & Troubleshooting

### Common Issues

**Node.js Version Too Old:**
```bash
# Error: "For Next.js, Node.js version >= 18.18.0 is required"
# Solution: Upgrade Node.js
nvm install 18.18
nvm use 18.18
```

**ConnectKit Not Connecting:**
```bash
# Check WalletConnect Project ID is set
echo $NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID

# Verify MetaMask is unlocked
# Clear browser cache if issues persist
```

**Weather API Errors:**
```bash
# Check WeatherAPI key is valid
# Verify quota hasn't been exceeded
# Test with a different city
```

**3D Scene Not Loading:**
```bash
# Check browser console for WebGL errors
# Ensure hardware acceleration is enabled
# Try Chrome/Firefox if Safari issues
```

### Development Commands

```bash
# Lint code
npm run lint

# Type check (if using TypeScript)
npm run type-check

# Build for production
npm run build

# Clean build cache
rm -rf .next node_modules/.cache
```

## 🎯 Next Steps

With the app running locally, you can:

1. **Test 3D Weather Visualization**
   - Try different cities
   - Notice dynamic day/night/portal modes
   - Experience rain/snow/clouds effects

2. **Connect Your Wallet**
   - Click ConnectKit button in top-right
   - Experiment with Arbitrum network switching
   - Safe to use testnet first

3. **Add Prediction Market Features**
   - Implement `markets/` folder components
   - Add weather outcome betting UI
   - Integrate with Polymarket API

4. **Deploy to Production**
   - Push to GitHub
   - Deploy to Vercel
   - Configure production domain

## 📚 Advanced Configuration

### Custom Weather Markets

Weather prediction markets will be based on:
- **Binary Outcomes**: "Will it rain tomorrow?"
- **Temperature Ranges**: "Will NYC exceed 80°F?"
- **Weather Conditions**: "Will there be snow in Denver?"

### Polymarket Integration

When ready for trading:

1. **Create Polymarket API Keys**
2. **Set up arbitrage bot** for market making
3. **Implement risk management**
4. **Add automated market creation** from weather data

### Performance Optimization

```javascript
// Image optimization for textures
import weatherDirtTexture from '@/public/lensDirtTexture.jpg'

// Dynamic imports for heavy components
const WeatherVisualization = dynamic(() => import('@/components/WeatherVisualization'), {
  ssr: false,
  loading: () => <WeatherSkeleton />
})
```

---

## 🎉 Welcome to Weather Prediction Markets!

You're now ready to explore the intersection of weather visualization and blockchain prediction markets. Your 3D weather app is a unique blend of data visualization and financial technology - have fun building the future of weather trading! 🌤️📈
