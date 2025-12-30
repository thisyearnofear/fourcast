# Movement M1 Deployment Guide

To deploy Fourcast contracts to the Movement M1 Testnet, you need to adjust your `Move.toml` and environment configuration.

## 1. Move.toml Configuration

The Movement M1 network is compatible with the Aptos framework, but it is recommended to ensure your `Move.toml` points to the correct dependencies if you encounter issues.

**Current (Aptos Testnet):**
```toml
[dependencies.AptosFramework]
git = "https://github.com/aptos-labs/aptos-core.git"
rev = "testnet"
subdir = "aptos-move/framework/aptos-framework"
```

**Movement M1 Recommended:**
If the standard Aptos framework fails, try using the specific commit or tag supported by Movement M1 nodes. Often, the standard `testnet` branch works, but ensure your CLI is configured for the Movement network.

## 2. CLI Configuration

Initialize your Movement CLI profile:

```bash
aptos init --profile movement --network custom --url https://aptos.testnet.porto.movementlabs.xyz/v1 --faucet-url https://faucet.testnet.porto.movementlabs.xyz/
```

*Note: Verify the latest RPC and Faucet URLs from the official Movement Labs documentation or Discord.*

## 3. Deployment

Deploy using the `movement` profile:

```bash
aptos move publish --profile movement --named-addresses fourcast_addr=default
```

## 4. Environment Variables

Update your `.env.local` to point the frontend to Movement:

```bash
NEXT_PUBLIC_APTOS_NETWORK=custom
NEXT_PUBLIC_APTOS_NODE_URL=https://aptos.testnet.porto.movementlabs.xyz/v1
NEXT_PUBLIC_APTOS_MODULE_ADDRESS=0xYOUR_PUBLISHED_ADDRESS
```
