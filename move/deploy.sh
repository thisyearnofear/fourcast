#!/bin/bash

set -e

ACCOUNT="0x2f8f549bd4b7a715296ac63a5a75e5027a9181c6f46d7a56b9ccfbdea3170ee5"
CONFIG_DIR="../.aptos-testnet"

cd "$(dirname "$0")"

echo "🚀 Fourcast Testnet Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Account: $ACCOUNT"
echo ""

# Check balance
echo "💰 Checking account balance..."
BALANCE=$(APTOS_CONFIG_DIR=$CONFIG_DIR aptos account list --profile testnet 2>&1)

if echo "$BALANCE" | grep -q "\"Result\": \[\]"; then
    echo ""
    echo "⚠️  Account not funded yet!"
    echo ""
    echo "Please fund your account first:"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🌐 Visit: https://aptos.dev/network/faucet"
    echo ""
    echo "1. Paste address: $ACCOUNT"
    echo "2. Select 'Testnet'"
    echo "3. Click 'Get APT'"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "After funding, run this script again."
    exit 1
fi

echo "✅ Account funded"
echo ""

# Compile
echo "🔨 Compiling Move module..."
APTOS_CONFIG_DIR=$CONFIG_DIR aptos move compile \
    --named-addresses fourcast_addr=$ACCOUNT

echo ""
echo "✅ Compilation successful"
echo ""

# Publish
echo "📤 Publishing to testnet..."
APTOS_CONFIG_DIR=$CONFIG_DIR aptos move publish \
    --profile testnet \
    --named-addresses fourcast_addr=$ACCOUNT \
    --assume-yes

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment successful!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Update your .env.local:"
echo ""
echo "NEXT_PUBLIC_APTOS_NETWORK=testnet"
echo "NEXT_PUBLIC_APTOS_MODULE_ADDRESS=$ACCOUNT"
echo "NEXT_PUBLIC_APTOS_NODE_URL=https://fullnode.testnet.aptoslabs.com/v1"
echo ""
echo "🔍 View on Explorer:"
echo "https://explorer.aptoslabs.com/account/$ACCOUNT?network=testnet"
echo ""
