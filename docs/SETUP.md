# Setup Guide

## Prerequisites
- Node.js 20+
- npm or yarn
- Git

## Quick Start

```bash
git clone https://github.com/thisyearnofear/fourcast.git
cd fourcast
npm install
cp .env.local.example .env.local
npm run dev
```

Navigate to `http://localhost:3000`

---

## Environment Configuration

### Required Variables

```env
# AI & Weather (Required for analysis)
VENICE_API_KEY=your_venice_api_key
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key

# Redis (Optional, recommended for caching)
REDIS_URL=redis://localhost:6379
# Or use Upstash:
# UPSTASH_REDIS_REST_URL=...
# UPSTASH_REDIS_REST_TOKEN=...
```

### Optional: Movement/Aptos (Signal Publishing)

For publishing signals to Movement testnet:

```env
NEXT_PUBLIC_APTOS_NETWORK=custom
NEXT_PUBLIC_APTOS_NODE_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS=0x<your_deployed_address>
NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT=true
```

**Setup:**
1. Install Petra wallet: https://petra.app
2. Switch to Movement testnet (Bardock, Chain ID 250)
3. Fund via faucet: https://faucet.testnet.movementnetwork.xyz/
4. Deploy contracts (see [Deployment Guide](./docs/DEPLOYMENT.md))

### Optional: Polymarket Trading

```env
POLYMARKET_PRIVATE_KEY=your_private_key_here
```

**⚠️ Security**: Never commit private keys to git. Use `.env.local` only.

**Setup:**
1. Export from MetaMask: Settings → Account → Export Private Key
2. Or use Magic Link: https://reveal.magic.link/polymarket
3. Fund wallet with USDC on Polygon

### Optional: Kalshi Trading

```env
KALSHI_API_KEY=your_api_key
KALSHI_SECRET_KEY=your_secret_key
```

**Setup:**
1. Create account at https://kalshi.com
2. Generate API key in account settings
3. Complete KYC if required for trading

### Optional: SynthData (ML Forecasts)

```env
SYNTH_API_KEY=your_synth_api_key
```

**Setup:**
1. Get API key from https://synthdata.co
2. Enables ML-backed forecasts for BTC, ETH, SOL, SPY, NVDA, etc.

### Optional: EVM Chains (Trading Contracts)

```env
# BNB Chain
PREDICTION_CONTRACT_ADDRESS_BNB=0x...
PREDICTION_FEE_BPS_BNB=500
BNB_RPC_URL=...
BNB_PRIVATE_KEY=...

# Polygon
PREDICTION_CONTRACT_ADDRESS_POLYGON=0x...
PREDICTION_FEE_BPS_POLYGON=100
POLYGON_RPC_URL=...
POLYGON_PRIVATE_KEY=...

# Arbitrum
PREDICTION_CONTRACT_ADDRESS_ARBITRUM=0x...
PREDICTION_FEE_BPS_ARBITRUM=500
ARB_RPC_URL=...
ARB_PRIVATE_KEY=...
```

---

## Wallet Setup

### For Movement/Aptos (Signal Publishing)

**Petra Wallet**
1. Install: https://petra.app
2. Create/import wallet
3. Add Movement testnet:
   - Network: Custom
   - RPC: https://testnet.movementnetwork.xyz/v1
   - Chain ID: 250
4. Fund via faucet

**Nightly Wallet** (alternative)
- Also supports Movement testnet
- Connect via wallet adapter

### For EVM Chains (Trading)

**MetaMask**
1. Add networks:
   - **Polygon**: https://chainlist.org/chain/137
   - **BNB Chain**: https://chainlist.org/chain/56
   - **Arbitrum**: https://chainlist.org/chain/42161
2. Fund with native tokens (MATIC, BNB, ETH)
3. Connect to Fourcast interface

---

## Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Testing Specific Services

```bash
# Test Turso/SQLite connection
npm run test:turso

# Test DB operations
npm run test:db

# Test signals API
npm run test:api
```

---

## Troubleshooting

### Venice AI 400 Errors
- Use `llama-3.3-70b` model (not `qwen3-235b`)
- Set `enable_web_search: "auto"` (string, not boolean)
- Remove `response_format` parameter

### Insufficient Gas (Movement)
```bash
# Fund via faucet
https://faucet.testnet.movementnetwork.xyz/

# Or request in Movement Discord
```

### Module Not Found
- Verify `NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS` matches deployed address
- Check network is set to `custom` for Movement testnet

### Transaction Pending
- Movement testnet can have delays (30-60s)
- Check Explorer: https://explorer.movementnetwork.xyz/
- Wait before retrying

### Redis Connection Failed
- For local Redis: `brew install redis && brew services start redis`
- For Upstash: Check URL and token in `.env.local`
- App works without Redis (falls back to in-memory caching)

### Polymarket Order Signing Failed
- Verify `POLYMARKET_PRIVATE_KEY` is correct format
- Ensure wallet has USDC on Polygon
- Check network is Polygon mainnet (not testnet)

---

## Production Deployment

1. Set up production environment variables
2. Deploy to Vercel/Netlify
3. Configure Redis (Upstash recommended)
4. Update `NEXT_PUBLIC_HOST` to production URL
5. Deploy Move contracts to testnet/mainnet

See [Deployment Guide](./docs/DEPLOYMENT.md) for detailed instructions.

---

## Resources

- **Movement Docs**: https://docs.movementnetwork.xyz/
- **Movement Explorer**: https://explorer.movementnetwork.xyz/
- **Venice AI**: https://docs.venice.ai/
- **Petra Wallet**: https://petra.app
- **Polymarket**: https://polymarket.com
- **Kalshi**: https://kalshi.com
- **SynthData**: https://synthdata.co
