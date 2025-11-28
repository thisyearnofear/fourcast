#!/bin/bash

echo "🚀 Deploying Fourcast Signal Registry to Aptos Testnet"
echo ""

# Check if aptos CLI is installed
if ! command -v aptos &> /dev/null; then
    echo "❌ Aptos CLI not found. Install from: https://aptos.dev/tools/aptos-cli/"
    exit 1
fi

# Navigate to move directory
cd "$(dirname "$0")"

# Initialize testnet profile if needed
echo "📝 Setting up testnet profile..."
aptos init --profile testnet --network testnet --skip-faucet || true

# Fund the account
echo "💰 Funding testnet account..."
aptos account fund-with-faucet --profile testnet --amount 100000000

# Compile the module
echo "🔨 Compiling Move module..."
aptos move compile --named-addresses fourcast_addr=testnet

if [ $? -ne 0 ]; then
    echo "❌ Compilation failed"
    exit 1
fi

# Publish the module
echo "📤 Publishing to testnet..."
aptos move publish --profile testnet --named-addresses fourcast_addr=testnet --assume-yes

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Get your module address: aptos account list --profile testnet"
    echo "2. Update NEXT_PUBLIC_APTOS_MODULE_ADDRESS in .env.local"
    echo "3. Update NEXT_PUBLIC_APTOS_NETWORK=testnet in .env.local"
    echo ""
else
    echo "❌ Deployment failed"
    exit 1
fi
