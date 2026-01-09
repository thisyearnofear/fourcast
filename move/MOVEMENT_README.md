# Movement M1 Deployment Guide

To deploy Fourcast contracts to the Movement M1 Testnet (Bardock), follow these steps.

## Network Information

**Testnet:** Bardock  
**Chain ID:** 250  
**RPC Endpoint:** https://testnet.movementnetwork.xyz/v1  
**Faucet:** https://faucet.testnet.movementnetwork.xyz/  
**Explorer:** https://explorer.movementnetwork.xyz/?network=bardock+testnet  

## 1. Move.toml Configuration

The Movement M1 network uses a fork of the Aptos framework. Your `Move.toml` should reference the Movement Labs fork:

```toml
[dependencies.AptosFramework]
git = "https://github.com/movementlabsxyz/aptos-core.git"
rev = "movement"
subdir = "aptos-move/framework/aptos-framework"
```

## 2. CLI Configuration

The Movement CLI profile has been configured at `.movement/config.yaml` with:

- **Network:** Custom (Bardock Testnet)
- **RPC URL:** https://testnet.movementnetwork.xyz/v1
- **Faucet URL:** https://faucet.testnet.movementnetwork.xyz
- **Account Address:** 0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c

## 3. Fund Your Account

Visit the faucet to get testnet tokens:
https://faucet.testnet.movementnetwork.xyz/

Or request tokens in the Movement Labs Discord faucet channel.

## 4. Deployment

Deploy using the deployment script:

```bash
cd move
chmod +x deploy-movement.sh
./deploy-movement.sh
```

Or deploy manually:

```bash
./bin/movement move publish --profile movement --named-addresses fourcast_addr=0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c --assume-yes
```

## 5. Environment Variables

Update your `.env.local` to point the frontend to Movement:

```bash
NEXT_PUBLIC_APTOS_NETWORK=custom
NEXT_PUBLIC_APTOS_NODE_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_APTOS_CUSTOM_RPC_URL=https://testnet.movementnetwork.xyz/v1
NEXT_PUBLIC_MOVEMENT_MODULE_ADDRESS=0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c
NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT=true
```

## 6. Verify Deployment

Check your deployed contract on the explorer:
https://explorer.movementnetwork.xyz/account/0x25789991c3c0238539509fee5ff4e3789cfcd84763e3d1c3d625947b04c1fb8c?network=bardock+testnet

## Alternative RPC Endpoints

For higher rate limits during heavy usage:

- **Ankr:** https://rpc.ankr.com/http/movement_bardock/v1
- **Lava:** https://movementt.lava.build

## Testnet Evolution

| Phase   | Status     | Chain ID | Notes                    |
|---------|------------|----------|--------------------------|
| Suzuka  | Deprecated | -        | Pre-Nov 2024             |
| Porto   | Deprecated | -        | Nov 2024 incentivized    |
| Bardock | **Active** | 250      | Current production-ready |

