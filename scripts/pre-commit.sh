#!/bin/bash

# Fourcast Pre-Commit Hook
# Prevents committing sensitive files and secrets

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔒 Running pre-commit checks..."

ERRORS=0

# 1. Check for .env files (except .env.local.example)
echo "Checking for environment files..."
ENV_FILES=$(git diff --cached --name-only | grep -E '^\.(env|env.*\.local|env.*\.production)$' | grep -v '^\.env\.local\.example$' | grep -v '^\.env\.example$' || true)
if [ ! -z "$ENV_FILES" ]; then
    echo -e "${RED}❌ Cannot commit .env files!${NC}"
    echo "The following files should not be committed:"
    echo "$ENV_FILES"
    echo ""
    echo "To fix:"
    echo "  git reset HEAD $ENV_FILES"
    echo "  echo '.env*' >> .gitignore (if not already there)"
    ERRORS=1
fi

# 2. Check for private keys
echo "Checking for private keys..."
KEY_FILES=$(git diff --cached --name-only | grep -E '\.(pem|key|pub)$' || true)
if [ ! -z "$KEY_FILES" ]; then
    echo -e "${RED}❌ Cannot commit private keys or certificates!${NC}"
    echo "The following files should not be committed:"
    echo "$KEY_FILES"
    ERRORS=1
fi

# 3. Check for blockchain config files
echo "Checking for blockchain config files..."
BLOCKCHAIN_FILES=$(git diff --cached --name-only | grep -E '^\.aptos/|^\.movement/|movement-key\.txt|config\.yaml$' || true)
if [ ! -z "$BLOCKCHAIN_FILES" ]; then
    echo -e "${RED}❌ Cannot commit blockchain config files!${NC}"
    echo "The following files should not be committed:"
    echo "$BLOCKCHAIN_FILES"
    ERRORS=1
fi

# 4. Check for secrets in staged content
echo "Scanning for secrets in staged changes..."
SECRETS_PATTERNS=(
    'API_KEY=[A-Za-z0-9]{20,}'
    'APIKEY=[A-Za-z0-9]{20,}'
    'api_key: [A-Za-z0-9]{20,}'
    'PRIVATE_KEY=0x[A-Fa-f0-9]{64}'
    'private_key: 0x[A-Fa-f0-9]{64}'
    'SECRET=[A-Za-z0-9]{20,}'
    'secret: [A-Za-z0-9]{20,}'
    'PASSWORD=[^ ]{8,}'
    'password: [^ ]{8,}'
)

STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -v '\.md$' || true)

if [ ! -z "$STAGED_FILES" ]; then
    for file in $STAGED_FILES; do
        if [ -f "$file" ]; then
            for pattern in "${SECRETS_PATTERNS[@]}"; do
                if git show ":$file" | grep -qE "$pattern"; then
                    echo -e "${YELLOW}⚠️  Potential secret found in: ${file}${NC}"
                    echo "   Pattern matched: $pattern"
                    echo "   Please verify this is not a real secret before committing."
                    ERRORS=1
                fi
            done
        fi
    done
fi

# 5. Check for hardcoded addresses that look like private keys
echo "Checking for hardcoded private keys in code..."
if [ ! -z "$STAGED_FILES" ]; then
    for file in $STAGED_FILES; do
        if [ -f "$file" ] && [[ "$file" == *.js || "$file" == *.ts || "$file" == *.jsx || "$file" == *.tsx ]]; then
            # Check for 64-character hex strings that might be private keys
            if git show ":$file" | grep -qE '0x[A-Fa-f0-9]{64}' | grep -vE '(MODULE_ADDRESS|CONTRACT_ADDRESS|0x0{64})'; then
                echo -e "${YELLOW}⚠️  Potential 64-char hex string in: ${file}${NC}"
                echo "   Verify this is not a private key (should be a public address)"
            fi
        fi
    done
fi

# 6. Check for .env.local.example changes (should be safe, but warn)
if git diff --cached --name-only | grep -q '^\.env\.local\.example$'; then
    echo -e "${YELLOW}⚠️  .env.local.example is being modified${NC}"
    echo "   Please ensure no real values are included, only placeholders"
fi

# Final result
echo ""
if [ $ERRORS -eq 0 ]; then
    echo -e "${GREEN}✅ All pre-commit checks passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Pre-commit checks failed!${NC}"
    echo ""
    echo "Please fix the issues above before committing."
    echo "If you're sure about what you're doing, use: git commit --no-verify"
    exit 1
fi
