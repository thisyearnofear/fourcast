#!/bin/bash

# Movement M1 Deployment Script for Fourcast
# Uses the local 'movement' CLI binary.

CLI="../bin/movement"
PROFILE="movement"
NETWORK_URL="https://testnet.movementnetwork.xyz/v1"

# Get the address from the profile
echo "🔍 Fetching account address..."
ADDR=$($CLI config show-profiles --profile $PROFILE | grep '"account":' | sed 's/.*"account": "\(.*\)".*/\1/')

if [ -z "$ADDR" ]; then
  echo "❌ Could not find address for profile '$PROFILE'. Did you run 'movement init'?"
  exit 1
fi

echo "👤 Using account: 0x$ADDR"

echo "🚀 Compiling Move modules for Movement M1..."
# Removed --profile flag as it is not supported in compile
$CLI move compile --named-addresses fourcast_addr=0x$ADDR

if [ $? -eq 0 ]; then
  echo "✅ Compilation successful."
  echo "🌐 Deploying to Movement Testnet (Bardock)..."

  # Use the specific address
  $CLI move publish --profile $PROFILE --named-addresses fourcast_addr=0x$ADDR --assume-yes

  if [ $? -eq 0 ]; then
    echo "🎉 Deployment successful!"
    echo "------------------------------------------------"
    echo "Update your .env.local with the following:"
    echo "NEXT_PUBLIC_APTOS_NETWORK=custom"
    echo "NEXT_PUBLIC_APTOS_NODE_URL=$NETWORK_URL"
    echo "NEXT_PUBLIC_APTOS_MODULE_ADDRESS=0x$ADDR"
    echo "NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT=true"
    echo "------------------------------------------------"
  else
    echo "❌ Deployment failed."
    echo "Check if you have funds: https://faucet.movementlabs.xyz or Discord faucet"
  fi
else
  echo "❌ Compilation failed."
fi
