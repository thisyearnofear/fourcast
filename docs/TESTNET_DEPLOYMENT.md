# Testnet Deployment Guide

## Issues Identified with Devnet Module

1. **Storage inefficiency**: Storing full JSON weather data on-chain (1KB+ per signal)
2. **Transaction size limits**: Large strings causing transaction failures
3. **Duplicate key issues**: Using hash as key prevented multiple signals per market
4. **Devnet instability**: Frequent downtime and transaction failures
5. **No string validation**: Could exceed Move's string size limits

## Improvements in V2 Module

### 1. Hash-Based Storage
- Weather data: Full JSON → 64-byte hash
- AI digest: Unlimited → 512 bytes max
- Reduces transaction size by ~80%

### 2. Sequential Signal IDs
```move
// Old: Hash-based (collision issues)
table::add(&mut registry.signals, market_snapshot_hash, signal);

// New: Auto-increment (no collisions)
table::add(&mut registry.signals, signal_count, signal);
```

### 3. String Length Limits
```move
const MAX_TITLE_LENGTH: u64 = 256;
const MAX_VENUE_LENGTH: u64 = 128;
const MAX_HASH_LENGTH: u64 = 64;
const MAX_DIGEST_LENGTH: u64 = 512;
```

### 4. View Functions
```move
#[view]
public fun get_signal(account_addr: address, signal_id: u64): (...)
```

### 5. Better Error Handling
```move
const E_SIGNAL_ALREADY_EXISTS: u64 = 1;
const E_REGISTRY_NOT_INITIALIZED: u64 = 2;
const E_STRING_TOO_LONG: u64 = 3;
```

## Deployment Steps

### 1. Install Aptos CLI (if needed)
```bash
curl -fsSL "https://aptos.dev/scripts/install_cli.py" | python3
aptos --version
```

### 2. Deploy to Testnet
```bash
cd move
./deploy-testnet.sh
```

This will:
- Create testnet profile
- Fund account with testnet APT
- Compile module
- Publish to testnet
- Display your module address

### 3. Update Environment Variables
```bash
# In .env.local
NEXT_PUBLIC_APTOS_NETWORK=testnet
NEXT_PUBLIC_APTOS_MODULE_ADDRESS=0x<address_from_deployment>
```

### 4. Verify Deployment
```bash
cd move
./verify.sh testnet
```

### 5. Update Frontend (if needed)

The `aptosPublisher.js` has been updated to:
- Use hash-based storage
- Truncate strings to limits
- Remove weather JSON compaction

No other frontend changes needed - the API remains compatible.

## Data Flow Changes

### Before (Devnet)
```
Frontend → API (saves to SQLite) → Frontend → Aptos (full JSON)
```

### After (Testnet)
```
Frontend → API (saves to SQLite + returns hashes) → Frontend → Aptos (hashes only)
```

## Testing Checklist

- [ ] Deploy module to testnet
- [ ] Verify module with `./verify.sh`
- [ ] Update `.env.local` with new address
- [ ] Test signal publishing from UI
- [ ] Verify transaction on Aptos Explorer
- [ ] Check signal count increases
- [ ] Verify SQLite record has tx_hash

## Rollback Plan

If issues occur:
```bash
cd move/sources
mv signal_registry.move signal_registry_v2.move
mv signal_registry_v1_backup.move signal_registry.move
```

Then redeploy v1 or fix issues in v2.

## Cost Comparison

| Metric | Devnet V1 | Testnet V2 | Savings |
|--------|-----------|------------|---------|
| Avg transaction size | ~2KB | ~400 bytes | 80% |
| Gas per signal | ~0.002 APT | ~0.001 APT | 50% |
| Storage per signal | ~2KB | ~400 bytes | 80% |

## Monitoring

### Check Module Status
```bash
aptos account list --profile testnet
```

### View Signal Count
```bash
aptos move view \
  --function-id '<address>::signal_registry::get_signal_count' \
  --args address:<your_address> \
  --profile testnet
```

### View Specific Signal
```bash
aptos move view \
  --function-id '<address>::signal_registry::get_signal' \
  --args address:<your_address> u64:0 \
  --profile testnet
```

## Troubleshooting

### "Insufficient gas"
```bash
aptos account fund-with-faucet --profile testnet --amount 100000000
```

### "Module not found"
- Check `NEXT_PUBLIC_APTOS_MODULE_ADDRESS` matches deployed address
- Verify network is set to `testnet`

### "String too long" error
- Check `aptosPublisher.js` truncation logic
- Verify input data before sending

### Transaction pending forever
- Testnet is more stable than devnet, but can still have delays
- Check Aptos Explorer: https://explorer.aptoslabs.com/?network=testnet
- Wait 30-60 seconds before retrying

## Next Steps

1. **Deploy to testnet** using `./deploy-testnet.sh`
2. **Test thoroughly** with real market data
3. **Monitor gas costs** and transaction success rate
4. **Consider mainnet** once stable on testnet
5. **Add indexer** for querying signals across all users

## Mainnet Considerations

When ready for mainnet:
1. Change `Move.toml` dependency to `rev = "mainnet"`
2. Create mainnet profile: `aptos init --profile mainnet --network mainnet`
3. Fund with real APT
4. Deploy: `aptos move publish --profile mainnet --named-addresses fourcast_addr=mainnet`
5. Update `.env.local` to `NEXT_PUBLIC_APTOS_NETWORK=mainnet`

## Support

- Aptos Discord: https://discord.gg/aptoslabs
- Aptos Docs: https://aptos.dev
- Explorer: https://explorer.aptoslabs.com
