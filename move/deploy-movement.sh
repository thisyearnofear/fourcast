#!/bin/bash

# Movement M1 Deployment Script for Fourcast
# Ensure you have the 'aptos' CLI installed and a Movement profile configured.

PROFILE="movement"
NETWORK_URL="https://aptos.testnet.porto.movementlabs.xyz/v1"

echo "🚀 Compiling Move modules for Movement M1..."
aptos move compile --named-addresses fourcast_addr=default --profile $PROFILE

if [ $? -eq 0 ]; then
  echo "✅ Compilation successful."
  echo "🌐 Deploying to Movement Testnet (Porto)..."
  
  # Note: 'default' will be replaced by the address in your movement profile
  aptos move publish --profile $PROFILE --named-addresses fourcast_addr=default --assume-yes
  
  if [ $? -eq 0 ]; then
    echo "🎉 Deployment successful!"
    echo "------------------------------------------------"
    echo "Update your .env.local with the following:"
    echo "NEXT_PUBLIC_APTOS_NETWORK=custom"
    echo "NEXT_PUBLIC_APTOS_NODE_URL=$NETWORK_URL"
    echo "NEXT_PUBLIC_APTOS_MODULE_ADDRESS=$(aptos config show-profiles --profile $PROFILE | grep account | awk '{print $2}')"
    echo "NEXT_PUBLIC_USE_MARKETPLACE_CONTRACT=true"
    echo "------------------------------------------------"
  else
    echo "❌ Deployment failed."
  fi
else
  echo "❌ Compilation failed."
fi
