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

# Multichain Configuration
NEXT_PUBLIC_POLYMARKET_HOST=https://clob.polymarket.com
NEXT_PUBLIC_BNB_CHAIN_ID=56
NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
NEXT_PUBLIC_APTOS_NETWORK=devnet
NEXT_PUBLIC_APTOS_MODULE_ADDRESS=0xYOUR_MODULE_ADDRESS
```

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
   aptos init --network devnet
   ```

3. **Fund Your Account**
   ```bash
   aptos account fund-with-faucet --account YOUR_ADDRESS --amount 100000000
   ```

### Deploy Move Module

1. **Compile the module**
   ```bash
   cd move
   aptos move compile --named-addresses fourcast_addr=default
   ```
   Note: You may see warnings about invalid documentation comments - these are safe to ignore.

2. **Publish to devnet**
   ```bash
   echo "yes" | aptos move publish --named-addresses fourcast_addr=default
   ```
   The `echo "yes" |` pipes an automatic confirmation to avoid the interactive prompt.

3. **Save your module address**
   The output will contain your module address in the `sender` field:
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
NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.devnet.aptoslabs.com/v1
NEXT_PUBLIC_APTOS_MODULE_ADDRESS=0xYOUR_MODULE_ADDRESS
```

### Install Petra Wallet

1. Install extension: https://petra.app
2. Create or import wallet
3. Switch to **Devnet** network in settings
4. Fund with faucet if needed: `aptos account fund-with-faucet --account YOUR_ADDRESS --amount 100000000`

### Test Deployment

1. Start dev server: `npm run dev`
2. Navigate to `/markets`
3. Connect Aptos wallet (Petra extension)
4. Publish a signal
5. Verify transaction on [Aptos Explorer](https://explorer.aptoslabs.com?network=devnet)

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