# Setup Guide

## Prerequisites
- Node.js 20+
- npm or yarn
- MetaMask wallet (trading on Polygon)
- Petra wallet (signals on Movement)

## Installation

```bash
git clone https://github.com/thisyearnofear/fourcast.git
cd fourcast
npm install
cp .env.local.example .env.local
```

## Environment Configuration

### Required Variables
```env
# Movement M1 Testnet
NEXT_PUBLIC_APTOS_NETWORK=custom
NEXT_PUBLIC_APTOS_NODE_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_APTOS_MODULE_ADDRESS=0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c

# AI & Data
VENICE_API_KEY=your_venice_api_key
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key

# Optional: Polymarket Builder Program
POLY_BUILDER_API_KEY=your_builder_key
POLY_BUILDER_SECRET=your_builder_secret
POLY_BUILDER_PASSPHRASE=your_builder_passphrase

# Optional: Farcaster/Neynar Integration
NEYNAR_API_KEY=your_neynar_api_key
FARCASTER_SIGNER_UUID=your_signer_uuid
```

## Farcaster Bot Setup (Optional)

1. Register at https://dev.neynar.com
2. Create bot signer: Dashboard → Agents & Bots → Use Existing Account
3. Connect @fourcast account, approve signer on Optimism (~$2 OP ETH)
4. Copy signer UUID to `FARCASTER_SIGNER_UUID`
5. Configure webhook (production): Target `https://yourdomain.com/api/farcaster/webhook`

## Development

```bash
npm run dev        # Start dev server
npm test           # Run tests
npm run build      # Production build
```

## Movement Deployment

### Quick Deploy
```bash
cd move
./deploy-movement.sh
```

### Manual Deploy
```bash
cd move
../bin/movement move compile --profile movement --named-addresses fourcast_addr=0xYOUR_ADDRESS
../bin/movement move publish --profile movement --named-addresses fourcast_addr=0xYOUR_ADDRESS --assume-yes
```

### Fund Account (Testnet)
- Web Faucet: https://faucet.testnet.movementnetwork.xyz/
- Discord: Join Movement Discord → faucet channel

### Update Environment
After deployment, update `.env.local` with your deployed module address.

## Testing

### Venice API Test
```bash
node scripts/test-venice-api.js
```

### Production Flow Test
```bash
node scripts/test-production-flow.js
```

### Dev Server
```bash
npm run dev
# Navigate to http://localhost:3000/markets
```

## Troubleshooting

### Venice AI 400 Errors
- Use `llama-3.3-70b` model (not `qwen3-235b`)
- Set `enable_web_search: "auto"` (string, not boolean)
- Remove `response_format` parameter

### Insufficient Gas (Movement)
```bash
./bin/movement account fund-with-faucet --profile movement --amount 100000000
```

### Module Not Found
- Verify `NEXT_PUBLIC_APTOS_MODULE_ADDRESS` matches deployed address
- Check network is set to `custom` for Movement testnet

### Transaction Pending
- Movement testnet can have delays (30-60s)
- Check Explorer: https://explorer.movementnetwork.xyz/
- Wait before retrying

## Wallet Setup

### Petra (Movement Signals)
1. Install: https://petra.app
2. Create/import wallet
3. Switch to Movement Testnet (Bardock, Chain ID 250)
4. Fund via faucet

### MetaMask (Polymarket Trading)
1. Add Polygon network
2. Connect to Polymarket
3. Sign orders client-side (no server key needed)

## Resources
- Movement Docs: https://docs.movementnetwork.xyz/
- Movement Explorer: https://explorer.movementnetwork.xyz/
- Venice AI: https://docs.venice.ai/
- Petra Wallet: https://petra.app
