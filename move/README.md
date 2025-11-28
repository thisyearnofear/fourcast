# Fourcast Signal Registry - Move Module

## Overview

On-chain signal registry for Fourcast weather-aware prediction market analysis. Stores signals with weather and AI analysis hashes for efficient on-chain verification.

## Key Improvements (v2)

### 1. Hash-Based Storage
- Stores `weather_hash` instead of full JSON (64 bytes vs 1KB+)
- Stores truncated `ai_digest` (512 bytes max)
- Full data remains in SQLite for querying

### 2. Sequential Signal IDs
- Uses auto-incrementing counter instead of hash-based keys
- Allows multiple signals per market
- Simpler querying and indexing

### 3. Better Error Handling
- Explicit error codes
- Auto-initialization on first publish
- View functions for querying

### 4. Testnet Deployment
- More stable than devnet
- Better for production testing
- Same API as mainnet

## Deployment

### Prerequisites
```bash
# Install Aptos CLI
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3

# Verify installation
aptos --version
```

### Deploy to Testnet
```bash
cd move
./deploy-testnet.sh
```

### Manual Deployment
```bash
# Initialize testnet profile
aptos init --profile testnet --network testnet

# Fund account
aptos account fund-with-faucet --profile testnet --amount 100000000

# Compile
aptos move compile --named-addresses fourcast_addr=testnet

# Publish
aptos move publish --profile testnet --named-addresses fourcast_addr=testnet
```

## Module Functions

### Entry Functions

#### `initialize(account: &signer)`
Initialize signal registry for an account. Called automatically on first `publish_signal`.

#### `publish_signal(...)`
Publish a new signal on-chain.

**Parameters:**
- `event_id`: Market event identifier (128 bytes max)
- `market_title`: Market question/title (256 bytes max)
- `venue`: Event location (128 bytes max)
- `event_time`: Unix timestamp of event
- `market_snapshot_hash`: Hash of market data snapshot (64 bytes)
- `weather_hash`: Hash of weather data (64 bytes)
- `ai_digest`: Truncated AI analysis (512 bytes max)
- `confidence`: AI confidence level (32 bytes)
- `odds_efficiency`: Market efficiency assessment (32 bytes)

### View Functions

#### `get_signal_count(account_addr: address): u64`
Returns number of signals published by an account.

#### `get_signal(account_addr: address, signal_id: u64): (...)`
Returns full signal data for a specific signal ID.

## Integration

### Frontend Usage

```javascript
import { aptosPublisher } from '@/services/aptosPublisher';

// Prepare transaction payload
const payload = aptosPublisher.preparePublishSignalPayload({
  event_id: market.id,
  market_title: market.title,
  venue: market.location,
  event_time: Math.floor(new Date(market.endDate).getTime() / 1000),
  market_snapshot_hash: snapshotHash,
  weather_hash: weatherHash,
  ai_digest: analysis.reasoning.slice(0, 500),
  confidence: analysis.assessment.confidence,
  odds_efficiency: analysis.assessment.odds_efficiency,
});

// User signs with wallet
const response = await wallet.signAndSubmitTransaction(payload);
const result = await aptosPublisher.waitForTransaction(response.hash);
```

### Environment Variables

```bash
NEXT_PUBLIC_APTOS_NETWORK=testnet
NEXT_PUBLIC_APTOS_MODULE_ADDRESS=0x<your_testnet_address>
```

## Data Flow

1. **Frontend**: User analyzes market with AI
2. **API**: Saves full signal to SQLite, returns hashes
3. **Frontend**: User publishes hashes to Aptos
4. **API**: Updates SQLite record with tx_hash
5. **Verification**: Anyone can verify signal authenticity via tx_hash

## Storage Costs

Approximate gas costs per signal:
- Devnet: ~0.001 APT
- Testnet: ~0.001 APT  
- Mainnet: ~0.001 APT

Storage is per-account, so users pay for their own signals.

## Troubleshooting

### "Module not found"
- Verify `NEXT_PUBLIC_APTOS_MODULE_ADDRESS` matches deployed address
- Check network matches (testnet vs devnet)

### "Insufficient gas"
- Fund account: `aptos account fund-with-faucet --profile testnet`

### "String too long"
- Check string truncation in `aptosPublisher.js`
- Verify data doesn't exceed limits

### "Transaction failed"
- Check Aptos Explorer for detailed error
- Verify timestamp is available (requires Aptos Framework)

## Testing

```bash
# Run Move tests
aptos move test --named-addresses fourcast_addr=testnet

# Query signal count
aptos move view \
  --function-id 'testnet::signal_registry::get_signal_count' \
  --args address:0x<account_address>
```

## Upgrading

To upgrade the module:
1. Increment version in `Move.toml`
2. Add upgrade policy if needed
3. Redeploy with same profile
4. Update frontend module address if changed

## Security Considerations

- Signals are immutable once published
- Each account controls their own registry
- No admin functions or centralized control
- Weather/AI data verified via hashes
- Full data stored off-chain for efficiency
