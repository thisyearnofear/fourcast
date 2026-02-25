# Deployment Guide

## Frontend Deployment (Vercel)

### Quick Deploy

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

### Environment Variables

Set these in Vercel dashboard:

```env
# Required
VENICE_API_KEY=your_venice_api_key
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key

# Recommended
REDIS_URL=redis://localhost:6379
# Or Upstash:
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...

# Optional: Movement
NEXT_PUBLIC_APTOS_NETWORK=custom
NEXT_PUBLIC_APTOS_NODE_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS=0x...

# Optional: Trading
POLYMARKET_PRIVATE_KEY=your_private_key
KALSHI_API_KEY=your_api_key
KALSHI_SECRET_KEY=your_secret_key
```

---

## Movement Contract Deployment

### Prerequisites

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

### Deploy Signal Registry

```bash
cd move

# Compile
aptos move compile --profile movement \
  --named-addresses fourcast_addr=0xYOUR_ADDRESS

# Deploy
aptos move publish --profile movement \
  --named-addresses fourcast_addr=0xYOUR_ADDRESS \
  --assume-yes
```

### Update Environment

After deployment, update your `.env.local`:

```env
NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS=0x<your_deployed_address>
NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT=true
```

### Verify Deployment

Check on explorer: https://explorer.movementnetwork.xyz/account/0xYOUR_ADDRESS

---

## EVM Contract Deployment

### PredictionReceipt Contract

Deploy to each supported chain (BNB, Polygon, Arbitrum):

```bash
# Install Hardhat
npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox

# Compile contracts
npx hardhat compile

# Deploy to BNB Chain
npx hardhat run scripts/deploy.js --network bnb

# Deploy to Polygon
npx hardhat run scripts/deploy.js --network polygon

# Deploy to Arbitrum
npx hardhat run scripts/deploy.js --network arbitrum
```

### Update Environment

```env
PREDICTION_CONTRACT_ADDRESS_BNB=0x...
PREDICTION_CONTRACT_ADDRESS_POLYGON=0x...
PREDICTION_CONTRACT_ADDRESS_ARBITRUM=0x...
```

---

## Database Setup

### SQLite (Local Development)

SQLite is used by default. No setup required.

### Turso (Production)

1. **Create Account**: https://turso.tech

2. **Create Database**
```bash
# Install Turso CLI
npm install -g @libsql/client

# Create database
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

## Redis Setup

### Local Redis (Development)

```bash
# macOS
brew install redis
brew services start redis

# Verify
redis-cli ping  # Should return: PONG
```

### Upstash Redis (Production)

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

## Monitoring & Health Checks

### Health Check Endpoint

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

### Logging

Fourcast uses Pino for structured logging:

```bash
# Development (pretty-printed)
npm run dev

# Production (JSON logs)
NODE_ENV=production npm start
```

---

## Troubleshooting

### Module Not Found (Movement)
- Verify `NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS` matches deployed address
- Check network is set to `custom` for Movement testnet

### Insufficient Gas
```bash
# Fund via faucet
https://faucet.testnet.movementnetwork.xyz/
```

### Transaction Pending
- Movement testnet can have delays (30-60s)
- Check Explorer: https://explorer.movementnetwork.xyz/
- Wait before retrying

### Database Connection Failed
- Check Turso URL and auth token
- Verify database is not suspended
- Test connection: `turso db shell <database>`

### Redis Connection Failed
- For local: `brew services restart redis`
- For Upstash: Check URL and token
- App works without Redis (falls back to in-memory)

---

## Cost Estimates

### Monthly Operating Costs (Production)

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Pro | $20/mo |
| Upstash Redis | Pay-as-you-go | ~$5/mo |
| Turso Database | Free tier | $0/mo |
| Venice AI | Pay-per-use | ~$30/mo (3000 analyses) |
| Movement Testnet | Free | $0/mo |
| **Total** | | **~$55/mo** |

### Gas Costs (Movement)

| Operation | Gas Cost |
|-----------|----------|
| Publish Signal | ~0.001 APT |
| Tip Signal | ~0.0005 APT |
| Initialize Registry | ~0.002 APT |

---

## Security Best Practices

### Private Keys
- Never commit `.env` or `.env.local` to git
- Use environment variables in Vercel dashboard
- Rotate API keys periodically
- Use separate wallets for development and production

### API Keys
- Restrict API key permissions where possible
- Use rate limiting
- Monitor usage for anomalies

### Database
- Enable authentication (Turso auth tokens)
- Use connection pooling
- Regular backups (Turso automatic)

---

## Rollback Plan

If deployment issues occur:

```bash
# Revert Vercel deployment
vercel rollback

# Or redeploy previous version
vercel --prod --commit <previous-commit>
```

For contract issues:
- Keep backup of previous Move contract version
- Document upgrade path before deploying changes

---

## Resources

- **Vercel Docs**: https://vercel.com/docs
- **Movement Docs**: https://docs.movementnetwork.xyz/
- **Turso Docs**: https://docs.turso.tech/
- **Upstash Docs**: https://upstash.com/docs
- **Venice AI**: https://docs.venice.ai/
