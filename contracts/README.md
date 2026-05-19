# Subscription Manager Contract

On-chain subscription management for Fourcast Pro/Premium tiers on Arc (Circle L1).

## Hackathon Relevance

This contract demonstrates Circle Tool Usage for the Agora Agents Hackathon:

| Tool | Usage |
|------|-------|
| **Arc (Circle L1)** | Contract deployed on Arc testnet (chain 5042002) |
| **USDC** | Subscription payments denominated in USDC (6 decimals) |
| **Paymaster** | All gas fees paid in USDC — no volatile gas tokens |
| **CCTP/Gateway** | Cross-chain USDC from user wallets to subscription treasury |

## Prerequisites

- Node 20+
- Arc testnet RPC access (default: https://arc-node.thecanteenapp.com/)
- Deployer wallet with testnet USDC for gas
- USDC token address on Arc testnet (ask Circle dev team)
- Treasury wallet address to receive subscription payments

## Setup

```bash
# 1. Install Foundry (for Solidity compilation)
curl -L https://foundry.paradigm.xyz | bash
foundryup

# 2. Compile the contract
cd contracts
forge build

# 3. Set env vars
export ARC_RPC_URL=https://arc-node.thecanteenapp.com/
export USDC_TOKEN_ADDRESS=0x...  # USDC on Arc testnet
export TREASURY_ADDRESS=0x...     # Where subscription payments go
export DEPLOYER_PRIVATE_KEY=0x... # Deployer wallet key

# 4. Deploy
node ../scripts/deploy-subscription.js
```

## Deploy Script Output

```
🔑 Deployer: 0x...
📄 USDC: 0x...
🏦 Treasury: 0x...

🚀 Deploying SubscriptionManager...
📝 Tx: 0x...
✅ SubscriptionManager deployed!
   Address: 0x...   ← Add this to .env.local
   Block: 123456

📋 Add to .env.local:
   NEXT_PUBLIC_SUBSCRIPTION_CONTRACT=0x...
   NEXT_PUBLIC_USDC_TOKEN=0x...
```

## Frontend Integration

The `useSubscription` hook (`hooks/useSubscription.js`) provides:

```js
const { subscription, txState, subscribe, hasActiveSubscription } = useSubscription();

// subscription.active — whether user has active subscription
// subscription.tier — 0=None, 1=Pro, 2=Premium
// subscribe(1) — trigger Pro subscription (approve + subscribe)
// txState.status — idle → approving → subscribing → confirming → success/error
// hasActiveSubscription — convenience boolean for rate limit bypass
```

## Contract Addresses

| Chain | Address | Explorer |
|-------|---------|----------|
| Arc Testnet | `0x...` (deploy first) | [Arc Explorer](https://arc-explorer.thecanteenapp.com/) |

## Upgrading

The contract is non-upgradable for security. To upgrade:
1. Deploy a new SubscriptionManager
2. Update `NEXT_PUBLIC_SUBSCRIPTION_CONTRACT` in .env.local
3. Users' existing subscriptions expire naturally
