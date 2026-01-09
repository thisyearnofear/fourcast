# Movement M1 Hackathon - Deployment Instructions

## Your Movement Account Details

**Account Address:** `0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c`

**Network:** Movement Bardock Testnet (Chain ID 250)

**RPC Endpoint:** https://testnet.movementnetwork.xyz/v1

**Explorer:** https://explorer.movementnetwork.xyz/?network=bardock+testnet

## Step 1: Fund Your Account

The automated faucet is currently experiencing issues. You have two options:

### Option A: Web Faucet
Visit: https://faucet.testnet.movementnetwork.xyz/

Paste your address: `0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c`

### Option B: Discord Faucet
Join the Movement Labs Discord and request testnet tokens in the faucet channel.

## Step 2: Verify Account Balance

Once funded, check your balance:

```bash
./bin/movement account list --profile movement
```

## Step 3: Compile the Contract

```bash
cd move
../bin/movement move compile --named-addresses fourcast_addr=0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c
```

## Step 4: Deploy to Movement Testnet

Use the deployment script:

```bash
cd move
chmod +x deploy-movement.sh
./deploy-movement.sh
```

Or deploy manually:

```bash
../bin/movement move publish --profile movement --named-addresses fourcast_addr=0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c --assume-yes
```

## Step 5: Update Environment Variables

After successful deployment, update your `.env.local`:

```bash
NEXT_PUBLIC_APTOS_NETWORK=custom
NEXT_PUBLIC_APTOS_NODE_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_APTOS_CUSTOM_RPC_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS=0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c
NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT=true
```

## Step 6: Verify Deployment

Check your deployed module on the explorer:

https://explorer.movementnetwork.xyz/account/0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c?network=bardock+testnet

## Hackathon Submission Checklist

Based on the Movement M1 Hackathon requirements:

### ✅ Contract Deployment
- [x] Signal Marketplace contract deployed to Bardock testnet
- [x] Contract address verified on explorer
- [x] Environment variables updated

### 🎯 Bounty Categories

#### 1. Best DeFi App ($5K)
- [x] DeFi arbitrage endpoint implemented
- [x] Frontend tab created
- [ ] Test with live Movement testnet data
- [ ] Demonstrate signal publishing on-chain

#### 2. Best Consumer App ($5K)
- [x] Signal feed with tipping functionality
- [x] Leaderboard with analyst rankings
- [ ] Deploy and test on Movement testnet
- [ ] Showcase user experience

#### 3. Best DevEx Tool ($5K)
- [x] Signal SDK architecture designed
- [x] Multi-domain framework implemented
- [ ] Publish SDK package
- [ ] Create developer documentation

#### 4. People's Choice ($5K)
- [ ] Create demo video (5-7 min)
- [ ] Post in Movement Discord
- [ ] Engage community for signals

## Next Steps After Deployment

1. **Test Signal Publishing**: Use the frontend to publish test signals
2. **Verify On-Chain**: Check that signals appear in the contract
3. **Test Tipping**: Ensure the tipping mechanism works
4. **Create Demo Content**: Record video showing the full flow
5. **Submit to Hackathon**: Include deployed contract address in submission

## Troubleshooting

### If deployment fails:
- Ensure account has sufficient MOVE tokens
- Check that the RPC endpoint is responding
- Verify the contract compiles without errors

### If faucet doesn't work:
- Try the alternative RPC endpoints (Ankr, Lava)
- Request help in Movement Discord
- Check testnet status on the explorer

## Important Links

- **Hackathon Page**: https://www.encodeclub.com/programmes/movement-m1-hackathon
- **Movement Docs**: https://docs.movementnetwork.xyz/
- **Movement Discord**: https://discord.gg/movementlabs
- **Explorer**: https://explorer.movementnetwork.xyz/
- **Faucet**: https://faucet.testnet.movementnetwork.xyz/

## Security Note

Your private key is stored in:
- `.movement/config.yaml`
- `movement-key.txt`

**⚠️ NEVER commit these files to git!** They are already in `.gitignore`.
