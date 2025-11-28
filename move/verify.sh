#!/bin/bash

echo "🔍 Verifying Fourcast Move Module"
echo ""

PROFILE=${1:-testnet}

# Get account address
ACCOUNT=$(aptos config show-profiles --profile $PROFILE 2>/dev/null | grep "account" | awk '{print $2}')

if [ -z "$ACCOUNT" ]; then
    echo "❌ Profile '$PROFILE' not found"
    echo "Run: aptos init --profile $PROFILE --network $PROFILE"
    exit 1
fi

echo "📍 Account: $ACCOUNT"
echo "🌐 Network: $PROFILE"
echo ""

# Check account balance
echo "💰 Checking balance..."
aptos account list --profile $PROFILE 2>/dev/null | grep -A 1 "coin" | tail -1

# Check if module is deployed
echo ""
echo "📦 Checking module deployment..."
aptos move view \
  --function-id "${ACCOUNT}::signal_registry::get_signal_count" \
  --args address:$ACCOUNT \
  --profile $PROFILE 2>/dev/null

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Module is deployed and functional"
else
    echo ""
    echo "⚠️  Module not found or not initialized"
    echo "Deploy with: ./deploy-testnet.sh"
fi
