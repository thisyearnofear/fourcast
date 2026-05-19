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

### Optional: Arc & Circle (Agora Agents Hackathon)

For deploying and transacting on Arc (Circle's stablecoin-native L1):

```env
# Arc (Circle L1)
ARC_RPC_URL=https://arc-node.thecanteenapp.com/...  # From arc-canteen login
ARC_CHAIN_ID=5042002
ARC_PRIVATE_KEY=your_arc_deployer_private_key
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://arc-node.thecanteenapp.com/...
NEXT_PUBLIC_ARC_SIGNAL_REGISTRY=0x...  # After deployment
NEXT_PUBLIC_ARC_PREDICTION_RECEIPT=0x...  # After deployment
NEXT_PUBLIC_ARC_BUILDER_FEE_SPLITTER=0x...  # After deployment
NEXT_PUBLIC_ARC_USDC_ADDRESS=0x...  # USDC on Arc testnet

# Circle Developer Tools
NEXT_PUBLIC_CIRCLE_API_KEY=your_circle_api_key
NEXT_PUBLIC_CIRCLE_WALLET_SET_ID=your_wallet_set_id
```

See [Arc & Circle Setup](#arc--circle-setup-agora-agents-hackathon) below for full setup instructions.

---

## Arc & Circle Setup (Agora Agents Hackathon)

Fourcast integrates with Arc (Circle's stablecoin-native L1) for the [Agora Agents Hackathon](https://agora.thecanteenapp.com/). Arc provides sub-second deterministic finality and ~$0.01 USDC transaction fees.

### 1. Install ARC CLI

```bash
# Install uv if you haven't
curl -LsSf https://astral.sh/uv/install.sh | sh

# Install ARC CLI
uv tool install git+https://github.com/the-canteen-dev/ARC-cli

# Login to get RPC access
arc-canteen login

# Verify connection
arc-canteen rpc eth_chainId
# Should return: 0x4d24b2 (Chain ID 5042002)
```

### 2. Join Hackathon Discords

- **Canteen Discord**: https://discord.gg/TGnyfKh23V
- **Arc Builder Discord**: https://discord.com/invite/buildonarc (mention Canteen + Agora in onboarding)

### 3. Set Up Circle Developer Account

1. Create account at https://developers.circle.com
2. Generate an API key
3. Create a Wallet Set for agent wallets
4. Note your API key and Wallet Set ID

### 4. Foundry (for Solidity contracts on Arc)

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Verify
forge --version
cast --version
```

### 5. Arc Environment Variables

Add these to your `.env.local`:

```env
# Arc (Circle L1)
ARC_RPC_URL=https://arc-node.thecanteenapp.com/...  # From arc-canteen login
ARC_CHAIN_ID=5042002
ARC_PRIVATE_KEY=your_arc_deployer_private_key
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://arc-node.thecanteenapp.com/...
NEXT_PUBLIC_ARC_SIGNAL_REGISTRY=0x...  # After deployment
NEXT_PUBLIC_ARC_PREDICTION_RECEIPT=0x...  # After deployment
NEXT_PUBLIC_ARC_BUILDER_FEE_SPLITTER=0x...  # After deployment
NEXT_PUBLIC_ARC_USDC_ADDRESS=0x...  # USDC on Arc testnet

# Circle Developer Tools
NEXT_PUBLIC_CIRCLE_API_KEY=your_circle_api_key
NEXT_PUBLIC_CIRCLE_WALLET_SET_ID=your_wallet_set_id
```

### 6. Get Testnet USDC

Arc testnet USDC can be obtained through:
- The ARC CLI faucet: `arc-canteen faucet`
- Circle testnet faucet (check Arc builder Discord)
- Request in Canteen Discord

### 7. Deploy Contracts on Arc

See [Deployment Guide](./DEPLOYMENT.md#arc-contract-deployment-agora-agents-hackathon) for full deployment instructions.

Quick start:
```bash
cd contracts
forge build
forge create SignalRegistry.sol:SignalRegistry --rpc-url $ARC_RPC_URL --private-key $ARC_PRIVATE_KEY
```

### 8. Verify Everything Works

```bash
# Check Arc connection
arc-canteen rpc eth_chainId

# Check your balance
cast balance $YOUR_ADDRESS --rpc-url $ARC_RPC_URL

# Run the app
npm run dev
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

### Telegram Bot (@fourcasterbot)

```bash
# 1. Create bot (already done: @fourcasterbot)
# Skip this step — bot exists.

# 2. Set token in .env.local
echo "TELEGRAM_BOT_TOKEN=your_token_here" >> .env.local

# 3. Verify webhook
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"

# 4. Test: message @fourcasterbot on Telegram
# /start — welcome
# /edge BTC — analyze Bitcoin markets
```

---

## Production Deployment

1. Set up production environment variables
2. Deploy to Vercel/Netlify
3. Configure Redis (Upstash recommended)
4. Update `NEXT_PUBLIC_HOST` to production URL
5. Deploy Move contracts to testnet/mainnet

### Arc Subscription Contract

The optional USDC subscription system uses a smart contract on Arc (Circle L1):

```bash
# Prerequisites: Foundry (forge)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# Set env vars in .env.local:
# ARC_RPC_URL — from `arc-canteen status`
# NEXT_PUBLIC_USDC_TOKEN — USDC token on Arc testnet
# TREASURY_ADDRESS — wallet receiving subscription payments
# DEPLOYER_PRIVATE_KEY — deployer wallet (send testnet USDC for gas)

# Compile and deploy
cd contracts/subscription
forge build
cd ../..
forge create --rpc-url "$ARC_RPC_URL" --private-key "$DEPLOYER_PRIVATE_KEY" --broadcast \
  contracts/SubscriptionManager.sol:SubscriptionManager \
  --constructor-args "$NEXT_PUBLIC_USDC_TOKEN" "$TREASURY_ADDRESS"

# Add the deployed address to .env.local:
# NEXT_PUBLIC_SUBSCRIPTION_CONTRACT=0x<address>
```

### Build

```bash
# Development
npm run dev

# Production build (Turbopack — no --webpack flag needed)
npm run build

# Lint & TypeScript check
npm run lint
npm run typecheck
```

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
- **Arc (Circle L1)**: https://www.arcchain.xyz/
- **Circle Developer**: https://developers.circle.com
- **Agora Agents Hackathon**: https://agora.thecanteenapp.com/
