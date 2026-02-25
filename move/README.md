# Fourcast Move Contracts

## Overview

On-chain signal registry and marketplace for Fourcast prediction market intelligence. Deployed on Movement network (Aptos-compatible).

**Contracts:**
- `signal_registry.move` - Store and manage prediction signals
- `signal_marketplace.move` - Tipping and reputation system

**Network:** Movement Testnet (Bardock, Chain ID 250)

---

## Key Features

### Efficient Storage
- **Hash-based data**: Store 64-byte hashes instead of full JSON (80% reduction)
- **Sequential IDs**: Auto-incrementing signal IDs (no collisions)
- **String limits**: Enforced at contract level

### String Length Limits
| Field | Max Size |
|-------|----------|
| Title | 256 bytes |
| Venue | 128 bytes |
| Hash | 64 bytes |
| AI Digest | 512 bytes |

### Auto-Initialization
Registry auto-initializes on first `publish_signal` call.

---

## Deployment

### Prerequisites

```bash
# Install Movement CLI
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3
aptos --version
```

### Quick Deploy

```bash
cd move
./deploy-movement.sh
```

### Manual Deploy

```bash
# Initialize profile
aptos init --profile movement \
  --network custom \
  --rest-url https://testnet.movementnetwork.xyz/v1 \
  --faucet-url https://faucet.testnet.movementnetwork.xyz

# Fund account
aptos account fund-with-faucet --profile movement --amount 100000000

# Compile
aptos move compile --profile movement \
  --named-addresses fourcast_addr=0xYOUR_ADDRESS

# Deploy
aptos move publish --profile movement \
  --named-addresses fourcast_addr=0xYOUR_ADDRESS \
  --assume-yes
```

### Fund Account

- **Web Faucet**: https://faucet.testnet.movementnetwork.xyz/
- **Discord**: Join Movement Discord → faucet channel

---

## Contract Functions

### Entry Functions

#### `initialize(account: &signer)`
Initialize signal registry. Called automatically on first publish.

#### `publish_signal(...)`
Publish a new signal.

**Parameters:**
```move
event_id: String              // 128 bytes max
market_title: String          // 256 bytes max
venue: String                 // 128 bytes max
event_time: u64               // Unix timestamp
market_snapshot_hash: String  // 64 bytes max
weather_hash: String          // 64 bytes max
ai_digest: String             // 512 bytes max
confidence: String            // HIGH/MEDIUM/LOW
odds_efficiency: String       // EFFICIENT/INEFFICIENT
```

#### `tip_signal(analyst: address, signal_id: u64, amount: u64)`
Tip an analyst for their signal.

### View Functions

#### `get_signal_count(account_addr: address): u64`
Get total signals published by an account.

#### `get_signal(account_addr: address, signal_id: u64): Signal`
Get specific signal data.

#### `get_analyst_rank(analyst_addr: address): u64`
Get analyst's leaderboard rank.

#### `get_analyst_tips(analyst_addr: address): u64`
Get total tips earned by analyst.

---

## Integration

### Frontend Usage

```javascript
import { aptosPublisher } from '@/services/aptosPublisher';

// Prepare payload
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

// Sign and submit
const response = await wallet.signAndSubmitTransaction(payload);
const result = await aptosPublisher.waitForTransaction(response.hash);
```

### Environment Variables

```env
NEXT_PUBLIC_APTOS_NETWORK=custom
NEXT_PUBLIC_APTOS_NODE_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS=0x<your_deployed_address>
NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT=true
```

---

## Data Flow

```
1. Frontend: User analyzes market with AI
2. API: Saves full signal to SQLite, computes hashes
3. Frontend: User publishes hashes to Movement
4. API: Updates SQLite record with tx_hash
5. Verification: Anyone can verify via tx_hash on explorer
```

**Explorer**: https://explorer.movementnetwork.xyz/

---

## Storage Costs

| Network | Cost per Signal |
|---------|-----------------|
| Testnet | ~0.001 APT |
| Mainnet | ~0.001 APT (est.) |

Storage is per-account (users pay for their own signals).

---

## Testing

```bash
# Run Move tests
aptos move test --named-addresses fourcast_addr=0xYOUR_ADDRESS

# Query signal count
aptos move view \
  --function-id '0xYOUR_ADDRESS::signal_registry::get_signal_count' \
  --args address:0x<account_address>

# View specific signal
aptos move view \
  --function-id '0xYOUR_ADDRESS::signal_registry::get_signal' \
  --args address:0x<account_address> u64:0
```

---

## Troubleshooting

### Module Not Found
- Verify `NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS` matches deployed address
- Check network is set to `custom`

### Insufficient Gas
```bash
aptos account fund-with-faucet --profile movement --amount 100000000
```

### String Too Long Error
- Check string truncation in `aptosPublisher.js`
- Verify input doesn't exceed limits

### Transaction Pending
- Testnet can have delays (30-60s)
- Check Explorer for status
- Wait before retrying

---

## Upgrading

1. Increment version in `Move.toml`
2. Add upgrade policy if needed
3. Redeploy with same profile
4. Update frontend module address

---

## Security

- ✅ Signals are immutable once published
- ✅ No admin functions or centralized control
- ✅ Each account controls their own registry
- ✅ Data verified via hashes
- ✅ Full data stored off-chain for efficiency

**⚠️ Never commit private keys to git** (already in `.gitignore`)

---

## Resources

- **Movement Docs**: https://docs.movementnetwork.xyz/
- **Movement Explorer**: https://explorer.movementnetwork.xyz/
- **Movement Discord**: https://discord.gg/movementlabs
- **Aptos Move**: https://aptos.dev/move
