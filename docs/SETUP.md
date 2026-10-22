# Setup Guide

> **Note (2026-07):** The flagship route is the TxLINE-primary Mandate Control
> → Proof Theatre → Diligence flow. TxLINE onboarding is the primary setup
> path. The Movement/Aptos and Arc stacks described below are legacy/secondary;
> see docs/ARCHITECTURE.md ("Supporting Infrastructure").

## Prerequisites
- Node.js 24+ (CI and `.nvmrc` both pin 24; see `package.json` `engines`)
- npm or yarn
- Git
- Solana wallet (for TxLINE on-chain subscribe)

## Quick Start

```bash
git clone https://github.com/thisyearnofear/fourcast.git
cd fourcast
npm install
cp .env.local.example .env.local
npm run dev
```

Navigate to `http://localhost:3000/agent` — the Mandate Control hero.

---

## TxLINE Onboarding (primary, ~2 minutes)

TxLINE is the primary data layer for the flagship route. Generate a Solana
keypair and run the on-chain subscribe + activate flow. Devnet SOL is required
for transaction fees.

```bash
# Generate wallet (saves secret key to .env.local, chmod 600)
node scripts/txline-generate-wallet.mjs

# Fund the printed public address with devnet SOL (https://faucet.solana.com),
# then run subscribe + activate in one step:
node scripts/txline-subscribe-and-activate.mjs
```

The script:
1. Submits an on-chain `subscribe` transaction (service level 1, 4 weeks) to the TxLINE devnet program
2. Calls `POST /auth/guest/start` for a guest JWT
3. Signs `${txSig}::${jwt}` with the wallet keypair
4. Calls `POST /api/token/activate` to receive the API token
5. Saves `TXLINE_API_TOKEN`, `TXLINE_GUEST_JWT`, `TXLINE_LAST_TX_SIG` to `.env.local`
6. Smoke-tests `/api/fixtures` and prints the response shape

To renew the JWT later without re-subscribing:
```bash
node scripts/txline-subscribe-and-activate.mjs --reactivate-only
```

### Snapshot a fixture (for replay mode)

```bash
# After onboarding (TXLINE_API_TOKEN, TXLINE_GUEST_JWT in .env.local)
node scripts/txline-snapshot-fixture.mjs 18175981 991
```

This writes `cache/txline/replays/18175981.json` containing the fixture, score
events, and the full Merkle proof from `/api/scores/stat-validation`. The
`/world-cup` UI then surfaces this fixture as `final` with a "Verify on Solana"
button.

### Run the autonomous worker (VPS)

```bash
# One-shot cycle (writes status + appends to runs.ndjson)
npm run agent:once

# Continuous loop (PM2 recommended for production)
npm run agent:live
```

The worker posts a bearer-authenticated heartbeat to
`POST /api/agent/historical-lab`; the Mandate Control hero polls
`GET /api/agent/historical-lab` every 15 seconds.

### TxLINE Environment Variables

```env
TXLINE_API_TOKEN=<activated API token from POST /api/token/activate>
TXLINE_GUEST_JWT=<guest JWT from POST /auth/guest/start; renewable without re-subscribing>
TXLINE_API_ORIGIN=https://txline-dev.txodds.com   # devnet host
TXLINE_SOLANA_NETWORK=devnet
TXLINE_PROGRAM_ID=6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
TXLINE_SERVICE_LEVEL=1
TXLINE_MODE=live
TXLINE_LAST_TX_SIG=<subscribe tx signature>
TXLINE_SOLANA_PUBLIC_KEY=<wallet public address; non-sensitive>

# Match-escrow program for on-chain settlement (CPI → txoracle validate_stat)
NEXT_PUBLIC_MATCH_ESCROW_PROGRAM_ID=AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ
NEXT_PUBLIC_TXORACLE_PROGRAM_ID=6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J

# Worker heartbeat auth (generate a strong random secret)
FOURCAST_AGENT_WORKER_SECRET=<your bearer token>

# Per-operator mandate (optional — see "Self-serve mandate flow" below)
# When set, the worker pulls the persisted mandate from the DB instead of
# the env-var defaults below. The operator_id must match a mandate saved
# via the MandateBuilder UI on /agent.
# FOURCAST_AGENT_OPERATOR_ID=<uuid from /agent MandateBuilder>

# Policy knobs (used when FOURCAST_AGENT_OPERATOR_ID is NOT set)
FOURCAST_AGENT_MIN_EDGE=0.05
FOURCAST_AGENT_MAX_ALLOCATION_PCT=0.03
FOURCAST_AGENT_MAX_LOSS_PROBABILITY=0.75
FOURCAST_AGENT_SIMULATION_RUNS=10000
```

**`TXLINE_SOLANA_SECRET_KEY` MUST NOT be set on Vercel** — it is a signing
key used only locally to (re-)activate the subscription.

See [README](../README.md) for the full TxLINE onboarding flow.

### Self-serve mandate flow (concierge test, GTM §2.2)

The mandate builder on `/agent` lets a prospect configure the four policy
knobs in-browser, run a dry-run against the canonical France–Sweden fixture,
and save their mandate to get a public Track Record URL — no account, no
VPS, no wallet. The flow:

1. Prospect visits `/agent`, adjusts the four sliders in the Mandate Builder.
2. Clicks "Run dry-run on France–Sweden" to see the verdict + gate checks.
3. Clicks "Save as my mandate" — the server mints an `operator_id` (UUID),
   persists the mandate, and returns a Track Record URL (`/agent/<uuid>`).
4. The concierge deploys the VPS worker with `FOURCAST_AGENT_OPERATOR_ID=<uuid>`.
   The worker pulls the mandate from the DB and runs under that policy.
5. The concierge DMs the prospect their Track Record URL daily (see
   `GET /api/cron/daily-summary`).

No auth in this flow — the `operator_id` is an unauthenticated UUID stored in
the prospect's localStorage. Auth + private mandates are a Premium-tier
feature, post-concierge-test.

---

## Secondary Setup (optional)

The following setup paths are for the supporting `/markets`, `/signals`, and
`/labs` routes. They are not required for the flagship TxLINE-primary route.

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
4. Deploy contracts (see [Deployment guide](#deployment-guide))

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
ARC_RPC_URL=https://rpc.testnet.arc.network/...  # From arc-canteen login
ARC_CHAIN_ID=5042002
ARC_PRIVATE_KEY=your_arc_deployer_private_key
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network/...
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
ARC_RPC_URL=https://rpc.testnet.arc.network/...  # From arc-canteen login
ARC_CHAIN_ID=5042002
ARC_PRIVATE_KEY=your_arc_deployer_private_key
NEXT_PUBLIC_ARC_CHAIN_ID=5042002
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network/...
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

See the [Deployment guide](#deployment-guide) for full deployment instructions.

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

See [Deployment guide](#deployment-guide) for detailed instructions.

---

## Resources

- **TxLINE Quickstart**: https://txline.txodds.com/documentation/quickstart
- **Solana Faucet**: https://faucet.solana.com
- **Solana Explorer**: https://explorer.solana.com
- **Venice AI**: https://docs.venice.ai/
- **Polymarket**: https://polymarket.com
- **Kalshi**: https://kalshi.com
- **Turso**: https://docs.turso.tech/
- **Upstash Redis**: https://upstash.com/docs


---

## Deployment Guide

> **Note (2026-07):** The flagship route is the TxLINE-primary Mandate Control
> → Proof Theatre → Diligence flow. TxLINE env vars are required for live mode;
> without them the app falls back to cached replay mode (still renders, just no
> live odds or fixtures). The Movement/Aptos and Arc stacks below are
> legacy/secondary; see docs/ARCHITECTURE.md ("Supporting Infrastructure").

### Frontend Deployment (Vercel)

#### Quick Deploy

```bash
## Install Vercel CLI
npm i -g vercel

## Deploy
vercel --prod
```

#### Function / deployment storage hygiene

Hobby teams meter **Functions** and **Deployment** storage across retained
deploys. Prefer pruning historic URLs over raising plan limits:

```bash
## Confirm live production (note deployment URL + aliases)
vercel inspect https://fourcastapp.vercel.app --scope papas-projects-5b188431

## List every deployment URL (paginate with --next when prompted)
vercel ls fourcast --scope papas-projects-5b188431

## Delete only by URL; --safe keeps active production / git-main / live preview aliases
vercel rm <urls...> --safe --yes --scope papas-projects-5b188431
```

Never `vercel rm fourcast` by project name. Do not change env or DNS while
pruning — old builds are regenerable from git.

**Packaging controls (keep serverless NFTs lean):**

| Control | Purpose |
|---------|---------|
| `.vercelignore` | Exclude Solidity/video/docs/tooling trees from uploads (`scripts/` and `onchain/` must ship for prepare + WalletLayer) |
| `outputFileTracingExcludes` in `next.config.mjs` | Keep those trees + `better-sqlite3` / `puppeteer*` out of λ traces |
| `services/db.js` | Load `better-sqlite3` only on the local SQLite path; production uses Turso |
| `services/brightDataService.js` | Dynamic-import `puppeteer-core` only for direct Scraping Browser (prefer `BRIGHT_DATA_PROXY_URL` → VPS) |

Heavy work (scraping browser, miners, local SQLite) belongs on the VPS, not in
every Vercel Node function. After a prune, Usage meters can lag before totals drop.

#### Environment Variables

Set these in Vercel dashboard. **TxLINE vars are primary** — without them the
flagship route falls back to cached replay mode.

```env
## Primary — TxLINE (required for live mode)
TXLINE_API_TOKEN=<activated API token>
TXLINE_GUEST_JWT=<guest JWT; renewable without re-subscribing>
TXLINE_API_ORIGIN=https://txline-dev.txodds.com
TXLINE_SOLANA_NETWORK=devnet
TXLINE_PROGRAM_ID=6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
TXLINE_SERVICE_LEVEL=1
TXLINE_MODE=live
TXLINE_LAST_TX_SIG=<subscribe tx signature>
TXLINE_SOLANA_PUBLIC_KEY=<wallet public address>

## Match-escrow program (on-chain settlement)
NEXT_PUBLIC_MATCH_ESCROW_PROGRAM_ID=AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ
NEXT_PUBLIC_TXORACLE_PROGRAM_ID=6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J

## Worker heartbeat auth (for the autonomous VPS worker)
FOURCAST_AGENT_WORKER_SECRET=<your bearer token>

## Secondary — AI & weather (for /markets and /signals routes)
VENICE_API_KEY=your_venice_api_key
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key

## Recommended
REDIS_URL=redis://localhost:6379
## Or Upstash:
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

## Optional: Trading (for /markets route)
POLYMARKET_PRIVATE_KEY=your_private_key
KALSHI_API_KEY=your_api_key
KALSHI_SECRET_KEY=your_secret_key
```

#### TxLINE World Cup (primary sports data layer)

The `/world-cup` route needs these on Vercel to run in live mode. Without
them it falls back to cached replay mode (still renders, just no live odds or
fixtures). All values below are placeholders — see `.env.local.example` and
the README onboarding flow for how to obtain real values.

```env
TXLINE_API_TOKEN=<activated API token from POST /api/token/activate>
TXLINE_GUEST_JWT=<guest JWT from POST /auth/guest/start; renewable without re-subscribing>
TXLINE_API_ORIGIN=https://txline-dev.txodds.com   # devnet host (must match the network used for subscribe)
TXLINE_SOLANA_NETWORK=devnet
TXLINE_PROGRAM_ID=6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
TXLINE_SERVICE_LEVEL=1
TXLINE_MODE=live
TXLINE_LAST_TX_SIG=<subscribe tx signature from the on-chain subscribe transaction>
TXLINE_SOLANA_PUBLIC_KEY=<wallet public address; non-sensitive>

## Match-escrow program for on-chain settlement (CPI → txoracle validate_stat)
## Defaults to devnet program ID below if unset.
NEXT_PUBLIC_MATCH_ESCROW_PROGRAM_ID=AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ
NEXT_PUBLIC_TXORACLE_PROGRAM_ID=6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J
```

**`TXLINE_SOLANA_SECRET_KEY` MUST NOT be set on Vercel** — it is a signing
key used only locally to (re-)activate the subscription. The deployed app
only needs the activated `TXLINE_API_TOKEN` + `TXLINE_GUEST_JWT` for data
access. The guest JWT is renewable anytime via `POST /auth/guest/start`
without re-signing.

To push these from local `.env.local` to Vercel production in one shot:

```bash
## After `vercel login` (one-time, browser-based)
bash scripts/deploy-txline-env.sh                # production env (default)
bash scripts/deploy-txline-env.sh --env=preview  # preview env instead
```

The script reads each var from `.env.local` and pipes it to `vercel env add`
via stdin — values never appear in argv or stdout. It skips
`TXLINE_SOLANA_SECRET_KEY` by design.

After pushing new env vars, Vercel requires a redeploy for them to take
effect. Autodeploy picks them up on the next push; for an immediate refresh
without a code change, use:

```bash
npx vercel redeploy <latest-prod-url> --target production
```

See [README](../README.md) for the full TxLINE onboarding flow (wallet
generation, on-chain subscribe + activate, snapshot script).

---

### Movement Contract Deployment

#### Prerequisites

1. **Install Movement CLI**
```bash
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3
aptos --version
```

2. **Setup Testnet Profile**
```bash
aptos init --profile movement \
  --network custom \
  --rest-url https://testnet.movementnetwork.xyz/v1 \
  --faucet-url https://faucet.testnet.movementnetwork.xyz
```

3. **Fund Account**
- Web faucet: https://faucet.testnet.movementnetwork.xyz/
- Or request in Movement Discord

#### Deploy Signal Registry

```bash
cd move

## Compile
aptos move compile --profile movement \
  --named-addresses fourcast_addr=0xYOUR_ADDRESS

## Deploy
aptos move publish --profile movement \
  --named-addresses fourcast_addr=0xYOUR_ADDRESS \
  --assume-yes
```

#### Update Environment

After deployment, update your `.env.local`:

```env
NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS=0x<your_deployed_address>
NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT=true
```

#### Verify Deployment

Check on explorer: https://explorer.movementnetwork.xyz/account/0xYOUR_ADDRESS

---

### EVM Contract Deployment

#### PredictionReceipt Contract

Deploy to each supported chain (BNB, Polygon, Arbitrum):

```bash
## Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

## Compile contracts
npx hardhat compile

## Deploy to BNB Chain
npx hardhat run scripts/deploy.js --network bnb

## Deploy to Polygon
npx hardhat run scripts/deploy.js --network polygon

## Deploy to Arbitrum
npx hardhat run scripts/deploy.js --network arbitrum
```

#### Update Environment

```env
PREDICTION_CONTRACT_ADDRESS_BNB=0x...
PREDICTION_CONTRACT_ADDRESS_POLYGON=0x...
PREDICTION_CONTRACT_ADDRESS_ARBITRUM=0x...
```

---

### Database Setup

#### SQLite (Local Development)

SQLite is used by default. No setup required.

#### Turso (Production)

1. **Create Account**: https://turso.tech

2. **Create Database**
```bash
## Install Turso CLI
npm install -g @libsql/client

## Create database
turso db create fourcast-production
```

3. **Get Connection URL**
```bash
turso db show fourcast-production --url
```

4. **Update Environment**
```env
TURSO_DATABASE_URL=libsql://...
TURSO_AUTH_TOKEN=your_auth_token
```

---

### Redis Setup

#### Local Redis (Development)

```bash
## macOS
brew install redis
brew services start redis

## Verify
redis-cli ping  # Should return: PONG
```

#### Upstash Redis (Production)

1. **Create Account**: https://upstash.com

2. **Create Database**
   - Go to Upstash Console
   - Create new Redis database
   - Copy REST URL and Token

3. **Update Environment**
```env
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...
```

---

### Monitoring & Health Checks

#### Health Check Endpoint

```bash
curl https://yourdomain.com/api/predictions/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "services": {
    "database": "connected",
    "redis": "connected",
    "ai": "available"
  }
}
```

#### Logging

Fourcast uses Pino for structured logging:

```bash
## Development (pretty-printed)
npm run dev

## Production (JSON logs)
NODE_ENV=production npm start
```

---

### Troubleshooting

#### Module Not Found (Movement)
- Verify `NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS` matches deployed address
- Check network is set to `custom` for Movement testnet

#### Insufficient Gas
```bash
## Fund via faucet
https://faucet.testnet.movementnetwork.xyz/
```

#### Transaction Pending
- Movement testnet can have delays (30-60s)
- Check Explorer: https://explorer.movementnetwork.xyz/
- Wait before retrying

#### Database Connection Failed
- Check Turso URL and auth token
- Verify database is not suspended
- Test connection: `turso db shell <database>`

#### Redis Connection Failed
- For local: `brew services restart redis`
- For Upstash: Check URL and token
- App works without Redis (falls back to in-memory)

---

### Cost Estimates

#### Monthly Operating Costs (Production)

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Pro | $20/mo |
| Upstash Redis | Pay-as-you-go | ~$5/mo |
| Turso Database | Free tier | $0/mo |
| Venice AI | Pay-per-use | ~$30/mo (3000 analyses) |
| TxLINE devnet | Free World Cup tier | $0/mo |
| Solana devnet | Free | $0/mo |
| **Total** | | **~$55/mo** |

#### Gas Costs (Solana devnet)

| Operation | Gas Cost |
|-----------|----------|
| TxLINE subscribe | ~0.001 SOL |
| Create policy (lock SOL) | ~0.0005 SOL |
| Settle policy (CPI → validate_stat) | ~0.002 SOL |

---

### Security Best Practices

#### Private Keys
- Never commit `.env` or `.env.local` to git
- Use environment variables in Vercel dashboard
- Rotate API keys periodically
- Use separate wallets for development and production

#### API Keys
- Restrict API key permissions where possible
- Use rate limiting
- Monitor usage for anomalies

#### Database
- Enable authentication (Turso auth tokens)
- Use connection pooling
- Regular backups (Turso automatic)

---

### Rollback Plan

If deployment issues occur:

```bash
## Revert Vercel deployment
vercel rollback

## Or redeploy previous version
vercel --prod --commit <previous-commit>
```

For contract issues:
- Keep backup of previous Move contract version
- Document upgrade path before deploying changes

---

### Resources

- **Vercel Docs**: https://vercel.com/docs
- **TxLINE Quickstart**: https://txline.txodds.com/documentation/quickstart
- **Solana Docs**: https://solana.com/docs
- **Turso Docs**: https://docs.turso.tech/
- **Upstash Docs**: https://upstash.com/docs
- **Venice AI**: https://docs.venice.ai/


---

## Git Hooks

Fourcast uses git hooks to prevent committing sensitive files and secrets.

### Pre-commit Hook

Automatically runs before every commit to check for:

#### Blocked Files
- `.env` files (except `.env.local.example`)
- Private keys (`.pem`, `.key`, `.pub`)
- Blockchain config files (`.aptos/`, `.movement/`, `movement-key.txt`, `config.yaml`)
- Certificates (`.crt`, `.cert`)

#### Secret Scanning
Scans staged changes for patterns like:
- `API_KEY=...`
- `PRIVATE_KEY=0x...`
- `SECRET=...`
- `PASSWORD=...`

### Installation

The hook installs automatically when you run:

```bash
npm install
```

Or manually:

```bash
npm run hooks:install
```

### Testing

To test the hook before committing:

```bash
npm run hooks:test
```

### Bypassing

If you need to commit something that triggers a false positive:

```bash
git commit --no-verify
```

⚠️ **Use with caution** - only bypass if you're certain the content is safe.

### Scripts

- `scripts/pre-commit.sh` - The actual hook script
- `scripts/install-hooks.sh` - Installs all hooks
- `.git/hooks/pre-commit` - Installed hook location

### Troubleshooting

#### Hook not running?
1. Check if script is executable: `chmod +x scripts/pre-commit.sh`
2. Reinstall: `npm run hooks:install`

#### False positive?
- Review the pattern that matched
- If it's truly safe, use `--no-verify`
- Consider using environment variables instead of hardcoded values

#### Hook file missing?
Run `npm install` or `npm run hooks:install` to reinstall.
