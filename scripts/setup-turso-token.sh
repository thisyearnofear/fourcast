#!/bin/bash

# Setup Turso token in .env.local
# Run: bash scripts/setup-turso-token.sh

echo "🔑 Generating Turso database token..."
TOKEN=$(source ~/.zshrc && turso db tokens create fourcast 2>/dev/null | tail -1)

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to generate token"
  echo "Make sure you have Turso CLI installed and are logged in:"
  echo "  turso auth login"
  exit 1
fi

echo "✅ Token generated"

# Update .env.local
if grep -q "TURSO_AUTH_TOKEN" .env.local; then
  # Replace existing token
  sed -i '' "s|^TURSO_AUTH_TOKEN=.*|TURSO_AUTH_TOKEN=$TOKEN|" .env.local
  echo "✅ Updated TURSO_AUTH_TOKEN in .env.local"
else
  # Append new token
  echo "TURSO_AUTH_TOKEN=$TOKEN" >> .env.local
  echo "✅ Added TURSO_AUTH_TOKEN to .env.local"
fi

echo ""
echo "🎉 Token setup complete!"
echo "You can now test with: npm run test:turso"
