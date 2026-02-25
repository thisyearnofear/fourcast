#!/bin/bash

# Install pre-commit hook
# Run this after cloning or if the hook gets removed

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
HOOK_SOURCE="$SCRIPT_DIR/scripts/pre-commit.sh"
HOOK_DEST="$SCRIPT_DIR/.git/hooks/pre-commit"

if [ ! -f "$HOOK_SOURCE" ]; then
    echo "❌ Error: pre-commit.sh not found in scripts/"
    exit 1
fi

cp "$HOOK_SOURCE" "$HOOK_DEST"
chmod +x "$HOOK_DEST"

echo "✅ Pre-commit hook installed successfully!"
echo ""
echo "The hook will check for:"
echo "  - .env files (except .env.local.example)"
echo "  - Private keys and certificates"
echo "  - Blockchain config files"
echo "  - Potential secrets in code"
echo ""
echo "To bypass: git commit --no-verify"
