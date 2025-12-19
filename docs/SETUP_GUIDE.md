# Setup Guide - Fourcast Weather Edge Analysis

## Quick Start

### Prerequisites
- Node.js 18+ (or 20+)
- npm or yarn
- MetaMask wallet (for trading on Polygon)
- Petra wallet (for signals on Aptos)
- Environment variables configured

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd fourcast

# Install dependencies
npm install --legacy-peer-deps

# Set up environment variables
cp .env.local.example .env.local
# Edit .env.local with your API keys
```

### Environment Configuration

Required environment variables:

```env
# Weather API
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key

# Venice AI (for market analysis)
VENICE_API_KEY=your_venice_api_key

# Redis (for caching - optional)
REDIS_URL=redis://localhost:6379

# Polymarket & Builder Program
NEXT_PUBLIC_POLYMARKET_HOST=https://clob.polymarket.com
# NOTE: Users sign orders in browser - no server private key needed
POLY_BUILDER_API_KEY=your_builder_key           # optional: enables leaderboard
POLY_BUILDER_SECRET=your_builder_secret         # optional
POLY_BUILDER_PASSPHRASE=your_builder_passphrase # optional

# Multichain Configuration
NEXT_PUBLIC_BNB_CHAIN_ID=56
NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
NEXT_PUBLIC_APTOS_NETWORK=testnet
NEXT_PUBLIC_APTOS_MODULE_ADDRESS=0xYOUR_MODULE_ADDRESS

# Farcaster / Neynar Integration
NEYNAR_API_KEY=your_neynar_api_key
FARCASTER_SIGNER_UUID=your_signer_uuid_from_neynar
NEYNAR_WEBHOOK_SECRET=your_webhook_secret_from_neynar  # optional
```

### Farcaster Setup

To enable Farcaster bot integration:

1. **Register at Neynar**: https://dev.neynar.com
2. **Create bot signer**:
   - Neynar Dashboard → Agents & Bots → Use Existing Account
   - Connect to @fourcast (or your bot Farcaster account)
   - Approve signer onchain via Optimism KeyGateway (~$2 OP ETH)
   - Copy the signer UUID
3. **Set environment variables** (above)
4. **Configure webhook** (production only):
   - Neynar Dashboard → Webhooks
   - Target URL: `https://yourdomain.com/api/farcaster/webhook`
   - Events: `cast.created`

### Development

```bash
# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Aptos Blockchain Integration

### Prerequisites

1. **Install Aptos CLI**
   ```bash
   brew install aptos
   ```

2. **Create Aptos Account**
   ```bash
   aptos init --network testnet
   ```

3. **Fund Your Account**
   Visit https://aptos.dev/network/faucet and request testnet APT

### Deploy Move Module (v2)

The v2 module uses hash-based storage for efficiency and is deployed on testnet for stability.

1. **Quick Deploy**
   ```bash
   cd move
   ./deploy.sh
   ```

2. **Manual Deploy**
   ```bash
   cd move
   aptos move compile --named-addresses fourcast_addr=testnet
   aptos move publish --profile testnet --named-addresses fourcast_addr=testnet --assume-yes
   ```

3. **Save your module address**
   The deployment will output your module address. Copy it for the next step.
   ```json
   {
     "sender": "0xYOUR_MODULE_ADDRESS",
     ...
   }
   ```
   Copy this address for the next step.

### Configure Frontend

Add to `.env.local`:
```env
NEXT_PUBLIC_APTOS_NETWORK=testnet
NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1
NEXT_PUBLIC_APTOS_MODULE_ADDRESS=0xYOUR_MODULE_ADDRESS
```

### Install Petra Wallet

1. Install extension: https://petra.app
2. Create or import wallet
3. Switch to **Testnet** network in settings
4. Fund with faucet if needed: https://aptos.dev/network/faucet

### Test Deployment

1. Start dev server: `npm run dev`
2. Navigate to `/markets`
3. Connect Aptos wallet (Petra extension)
4. Publish a signal
5. Verify transaction on [Aptos Explorer](https://explorer.aptoslabs.com?network=testnet)

## Validation Framework

### Core Principles
- **User-Centric Validation**: Actionable feedback with real-time guidance
- **Performance-First Design**: Smart caching and debounced validation
- **Extensible Architecture**: Modular validators and reusable components

### Validation Hierarchy
```
┌─────────────────────────────────────┐
│       Validation Orchestrator       │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  │
│  │  Location   │  │   Weather   │  │
│  │ Validator   │  │  Validator  │  │
│  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   Market    │  │   Trading   │  │
│  │ Validator   │  │  Validator  │  │
│  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
```

### Performance Optimizations
- **Smart Caching**: 5-minute cache for location, 3-minute for weather, 30-second for orders
- **Debounced Validation**: 200ms for orders, 300ms for analysis, 500ms for location
- **Request Cancellation**: Automatic cleanup of outdated validation requests

## Project Structure

```
fourcast/
├── app/                 # Next.js app directory
│   ├── ai/             # AI analysis page
│   ├── api/            # API routes
│   ├── markets/        # Markets page with date filtering
│   └── components/     # Shared components
├── services/           # Business logic services
│   ├── weatherService.js
│   ├── polymarketService.js
│   ├── kalshiService.js
│   └── aiService.server.js
├── components/         # Reusable components
├── docs/              # Documentation
└── scripts/           # Test and utility scripts
```

## Development Workflow

1. **Branch Strategy**: Feature branches from main
2. **Code Review**: Required for all changes
3. **Testing**: Must pass all tests before merge
4. **Documentation**: Update docs with changes

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### E2E Tests
```bash
npm run test:e2e
```

## Troubleshooting

### Common Issues

1. **Weather API Errors**
   - Check API key validity
   - Verify rate limits
   - Ensure proper error handling

2. **AI Analysis Failures**
   - Verify Venice API key
   - Check API quotas
   - Review error logs

3. **Venice AI 400 Errors**
   - Ensure `enable_web_search` is string `"auto"`, not boolean `true`
   - Verify using `llama-3.3-70b` model (not `qwen3-235b`)
   - Remove `response_format` parameter

4. **Performance Issues**
   - Enable Redis caching
   - Monitor API response times
   - Optimize database queries

### Debug Mode

Enable debug logging:

```env
DEBUG=true
LOG_LEVEL=debug
```

## Resources

- Aptos Docs: https://aptos.dev
- Petra Wallet: https://petra.app
- Aptos Explorer: https://explorer.aptoslabs.com
- Venice AI Documentation: https://docs.venice.ai/
- WeatherAPI: https://www.weatherapi.com/

## Testing Checklist

### Pre-Testing Setup

- [ ] Verify `VENICE_API_KEY` is set in `.env.local`
  ```bash
  grep VENICE_API_KEY .env.local
  ```

- [ ] Verify API key is valid (42 characters)
  ```bash
  node -e "const fs = require('fs'); const env = fs.readFileSync('.env.local', 'utf-8'); const match = env.match(/VENICE_API_KEY=(.+)/); console.log('Key length:', match?.[1]?.trim().length);"
  ```

### Unit Tests

#### Test 1: Basic Venice API Connectivity
```bash
node scripts/test-venice-api.js
```

**Expected Output:**
```
✅ All tests passed! Venice API is working correctly.
```

#### Test 2: Production Flow
```bash
node scripts/test-production-flow.js
```

**Expected Output:**
```
✅ Production flow test PASSED!

Assessment:
  Weather Impact: LOW/MEDIUM/HIGH
  Odds Efficiency: FAIR/OVERPRICED/UNDERPRICED
  Confidence: LOW/MEDIUM/HIGH
```

### Integration Tests

#### Test 3: Start Development Server
```bash
npm run dev
```

**Expected:**
- [ ] Server starts without errors
- [ ] No Venice API errors in console
- [ ] Application loads at http://localhost:3000

#### Test 4: Navigate to Markets Page
1. Open browser to http://localhost:3000/markets
2. Wait for markets to load

**Expected:**
- [ ] Markets list displays
- [ ] No console errors
- [ ] Events show with odds

#### Test 5: Analyze a Market
1. Click on any market (e.g., "Will Randers FC win on 2025-11-24?")
2. Click "Analyze" button
3. Wait for analysis to complete

**Expected:**
- [ ] Loading indicator appears
- [ ] Analysis completes within 5-10 seconds
- [ ] No 400 errors in console
- [ ] Weather conditions display
- [ ] AI reasoning displays
- [ ] Key factors list displays
- [ ] Recommended action displays

#### Test 6: Test Cross-Platform Functionality
1. Go to Discovery tab
2. Use platform filter to switch between Polymarket and Kalshi
3. Verify platform badges appear correctly
4. Check volume formatting adapts (Polymarket = $XK, Kalshi = X Vol)

**Expected:**
- [ ] Platform badges show correctly (blue for Polymarket, green for Kalshi)
- [ ] Volume formatting adapts to platform
- [ ] Filtering works properly

## Key Takeaways

### ✅ DO:
- Use `llama-3.3-70b` for JSON responses
- Use `enable_web_search: "auto"` (string)
- Use prompt engineering for JSON output
- Parse responses defensively
- Implement progressive enhancement for signal publishing
- Use platform-specific UI elements for multi-platform support

### ❌ DON'T:
- Use `response_format` (not supported)
- Use `enable_web_search: true` (boolean)
- Use invalid parameters
- Use `qwen3-235b` for JSON (thinking tags)
- Assume synchronous on-chain publishing - use SQLite for immediate feedback
- Ignore platform-specific data formats

## Support

If you encounter issues:
1. Check `VENICE_API_KEY` in `.env.local`
2. Run `node scripts/test-fixed-venice.js`
3. Verify using `llama-3.3-70b` model
4. Ensure `enable_web_search: "auto"` (string)
5. Check console logs for specific errors

---

_Setup Guide - Last updated: November 2024_