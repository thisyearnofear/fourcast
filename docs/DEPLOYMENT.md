# Deployment Guide

## Movement Network Deployment

### Account Setup

**Network:** Movement Bardock Testnet (Chain ID 250)
**RPC:** https://testnet.movementnetwork.xyz/v1
**Explorer:** https://explorer.movementnetwork.xyz/

### Step 1: Fund Your Account

**Option A: Web Faucet**
Visit: https://faucet.testnet.movementnetwork.xyz/
Paste your address and request testnet MOVE.

**Option B: Discord Faucet**
Join Movement Discord → faucet channel → request tokens.

### Step 2: Verify Balance
```bash
./bin/movement account list --profile movement
```

### Step 3: Compile Contract
```bash
cd move
../bin/movement move compile --profile movement \
  --named-addresses fourcast_addr=0xYOUR_ADDRESS
```

### Step 4: Deploy
```bash
cd move
chmod +x deploy-movement.sh
./deploy-movement.sh
```

**Or manually:**
```bash
../bin/movement move publish --profile movement \
  --named-addresses fourcast_addr=0xYOUR_ADDRESS --assume-yes
```

### Step 5: Update Environment
```env
NEXT_PUBLIC_APTOS_NETWORK=custom
NEXT_PUBLIC_APTOS_NODE_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS=0xYOUR_DEPLOYED_ADDRESS
NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT=true
```

### Step 6: Verify Deployment
Check on Explorer:
https://explorer.movementnetwork.xyz/account/0xYOUR_ADDRESS

---

## Contract Addresses (Movement M1 Testnet)

| Contract | Address |
|----------|---------|
| Signal Registry | `0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c` |
| Marketplace | `0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c` |

---

## Move Module V2 Improvements

### Storage Efficiency
- Weather data: Full JSON → 64-byte hash (80% reduction)
- AI digest: Unlimited → 512 bytes max
- Avg transaction size: 2KB → 400 bytes

### Sequential Signal IDs
Prevents collision issues from hash-based keys.

### String Validation
- Title: 256 bytes max
- Venue: 128 bytes max
- Hash: 64 bytes max
- AI Digest: 512 bytes max

### View Functions
```move
#[view]
public fun get_signal(account_addr: address, signal_id: u64): (...)
```

### Error Constants
```move
const E_SIGNAL_ALREADY_EXISTS: u64 = 1;
const E_REGISTRY_NOT_INITIALIZED: u64 = 2;
const E_STRING_TOO_LONG: u64 = 3;
```

---

## Data Flow

### Before (V1)
```
Frontend → API (SQLite) → Frontend → Aptos (full JSON)
```

### After (V2)
```
Frontend → API (SQLite + hashes) → Frontend → Aptos (hashes only)
```

---

## Testing Checklist

- [ ] Deploy module to testnet
- [ ] Verify with explorer
- [ ] Update `.env.local` with new address
- [ ] Test signal publishing from UI
- [ ] Verify transaction on Explorer
- [ ] Check signal count increases
- [ ] Verify SQLite record has tx_hash

---

## Monitoring

### Check Module Status
```bash
aptos account list --profile movement
```

### View Signal Count
```bash
aptos move view \
  --function-id '<address>::signal_registry::get_signal_count' \
  --args address:<your_address> \
  --profile movement
```

### View Specific Signal
```bash
aptos move view \
  --function-id '<address>::signal_registry::get_signal' \
  --args address:<your_address> u64:0 \
  --profile movement
```

---

## Cost Comparison

| Metric | V1 (Devnet) | V2 (Testnet) | Savings |
|--------|-------------|--------------|---------|
| Avg transaction size | ~2KB | ~400 bytes | 80% |
| Gas per signal | ~0.002 APT | ~0.001 APT | 50% |
| Storage per signal | ~2KB | ~400 bytes | 80% |

---

## Troubleshooting

### Insufficient Gas
```bash
./bin/movement account fund-with-faucet --profile movement --amount 100000000
```

### Module Not Found
- Check `NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS` matches deployed address
- Verify network is set to `custom`

### String Too Long Error
- Check `aptosPublisher.js` truncation logic
- Verify input data before sending

### Transaction Pending
- Testnet can have delays (30-60s)
- Check Explorer for status
- Wait before retrying

---

## Rollback Plan

If issues occur:
```bash
cd move/sources
mv signal_registry.move signal_registry_v2.move
mv signal_registry_v1_backup.move signal_registry.move
```

Then redeploy V1 or fix issues in V2.

---

## Mainnet Deployment

When ready for mainnet:

1. **Update Move.toml**
   Change dependency to `rev = "mainnet"`

2. **Create Mainnet Profile**
   ```bash
   aptos init --profile mainnet --network mainnet
   ```

3. **Fund with Real APT**

4. **Deploy**
   ```bash
   aptos move publish --profile mainnet \
     --named-addresses fourcast_addr=mainnet
   ```

5. **Update Environment**
   ```env
   NEXT_PUBLIC_APTOS_NETWORK=mainnet
   ```

---

## Security Notes

### Private Keys
Stored in:
- `.movement/config.yaml`
- `movement-key.txt`

**⚠️ NEVER commit these files to git!** (Already in `.gitignore`)

### API Keys
- Never commit `.env` or `.env.local`
- Use `.env.local.example` as template
- Rotate keys periodically

### Kalshi Trading
- Tokens expire every 30 minutes (auto-logout)
- Use unique client_order_id for deduplication
- All calls proxied through Next.js API routes

---

## Hackathon Submission Checklist

### Contract Deployment
- [x] Signal Marketplace deployed to Bardock testnet
- [x] Contract address verified on explorer
- [x] Environment variables updated

### Bounty Categories

**Best DeFi App ($5K)**
- [x] DeFi arbitrage endpoint
- [x] Frontend tab
- [ ] Test with live Movement data
- [ ] Demonstrate on-chain signal publishing

**Best Consumer App ($5K)**
- [x] Signal feed with tipping
- [x] Leaderboard with rankings
- [ ] Deploy and test on Movement testnet
- [ ] Showcase user experience

**Best DevEx Tool ($5K)**
- [x] Signal SDK architecture
- [x] Multi-domain framework
- [ ] Publish SDK package
- [ ] Developer documentation

**People's Choice ($5K)**
- [ ] Create demo video (5-7 min)
- [ ] Post in Movement Discord
- [ ] Engage community

---

## Resources

- Movement Docs: https://docs.movementnetwork.xyz/
- Movement Discord: https://discord.gg/movementlabs
- Explorer: https://explorer.movementnetwork.xyz/
- Faucet: https://faucet.testnet.movementnetwork.xyz/
- Hackathon: https://www.encodeclub.com/programmes/movement-m1-hackathon
