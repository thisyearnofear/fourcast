#!/bin/bash

echo "🔍 Verifying Builder Integration..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

checks=0
passes=0

# Check 1: Service file exists
echo "1. Checking builderService..."
if [ -f "services/builderService.js" ]; then
  echo -e "${GREEN}✓${NC} services/builderService.js exists"
  ((passes++))
else
  echo -e "${RED}✗${NC} services/builderService.js missing"
fi
((checks++))

# Check 2: Hook file exists
echo "2. Checking useBuilder hook..."
if [ -f "hooks/useBuilder.js" ]; then
  echo -e "${GREEN}✓${NC} hooks/useBuilder.js exists"
  ((passes++))
else
  echo -e "${RED}✗${NC} hooks/useBuilder.js missing"
fi
((checks++))

# Check 3: Components exist
echo "3. Checking components..."
for comp in BuilderStats BuilderBadge BuilderDashboard; do
  if [ -f "components/${comp}.js" ]; then
    echo -e "${GREEN}✓${NC} components/${comp}.js exists"
    ((passes++))
  else
    echo -e "${RED}✗${NC} components/${comp}.js missing"
  fi
  ((checks++))
done

# Check 4: API route exists
echo "4. Checking /api/builder route..."
if [ -f "app/api/builder/route.js" ]; then
  echo -e "${GREEN}✓${NC} app/api/builder/route.js exists"
  ((passes++))
else
  echo -e "${RED}✗${NC} app/api/builder/route.js missing"
fi
((checks++))

# Check 5: Orders API enhanced
echo "5. Checking /api/orders enhancement..."
if grep -q "builderService" "app/api/orders/route.js"; then
  echo -e "${GREEN}✓${NC} builderService imported in orders route"
  ((passes++))
else
  echo -e "${RED}✗${NC} builderService not imported in orders route"
fi
((checks++))

# Check 6: Documentation exists (consolidated)
echo "6. Checking documentation..."
if grep -q "Polymarket Builder Program" "docs/INTEGRATION_GUIDE.md"; then
  echo -e "${GREEN}✓${NC} Builder Program docs in INTEGRATION_GUIDE.md"
  ((passes++))
else
  echo -e "${RED}✗${NC} Builder docs missing from INTEGRATION_GUIDE.md"
fi
((checks++))

# Check 7: Setup script exists
echo "7. Checking setup script..."
if [ -f "scripts/setup-builder.js" ]; then
  echo -e "${GREEN}✓${NC} scripts/setup-builder.js exists"
  ((passes++))
else
  echo -e "${RED}✗${NC} scripts/setup-builder.js missing"
fi
((checks++))

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "Result: ${GREEN}${passes}/${checks}${NC} checks passed"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ $passes -eq $checks ]; then
  echo -e "${GREEN}✓ All builder integration files in place!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Add credentials to .env.local"
  echo "2. Run: node scripts/setup-builder.js"
  echo "3. Import components where needed"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some files are missing!${NC}"
  exit 1
fi
