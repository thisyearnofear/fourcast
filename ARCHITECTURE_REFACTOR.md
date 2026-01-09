# Unified Chain Connections Architecture Refactor

## Overview

Consolidated scattered wallet connection state into a single unified `useChainConnections` hook that serves as the authoritative source for all blockchain network connectivity across EVM, Aptos, and Movement chains.

## Core Principles Applied

✅ **ENHANCEMENT FIRST**: Enhanced existing wagmi + Aptos wallet adapters into unified hook  
✅ **AGGRESSIVE CONSOLIDATION**: Eliminated 4+ separate wallet state variables and scattered prop drilling  
✅ **PREVENT BLOAT**: Removed redundant connection checks and boolean comparisons  
✅ **DRY**: Single source of truth for all chain connection state  
✅ **CLEAN**: Explicit dependencies and clear separation of concerns  
✅ **MODULAR**: Composable chain state object with optional utility functions  
✅ **PERFORMANT**: No additional network calls, memoized chain state and capability checks  
✅ **ORGANIZED**: Chain definitions centralized in `appConstants.js`, logic in `chainUtils.js`

## What Changed

### 1. New Hook: `useChainConnections` (Single Source of Truth)

**File**: `hooks/useChainConnections.js`

Consolidates:
- `useAccount()` from wagmi (EVM/Polygon)
- `useWallet()` from Aptos adapter (Aptos/Movement)
- Wallet selection logic (Movement detection)

**Returns**:
```javascript
{
  chains: {
    evm: { connected, address, chainId, chainName },
    aptos: { connected, address, chainName },
    movement: { connected, address, chainName }
  },
  canPerform(chainId, action),  // Semantic capability checks
  connectedChains: string[],     // Quick 'which chains are connected' check
  canPublish: boolean            // Can publish to any chain
}
```

**Key Design**:
- Movement is **explicitly separate** from Aptos (not hidden in aptosConnected flag)
- Each chain has `connected` state and `address`
- `canPerform` provides semantic clarity vs raw booleans
- Movement detection based on wallet type (conservative approach)

### 2. Updated `chainUtils.js`

Changed function signatures to accept chain state objects instead of raw booleans:

**Before**:
```javascript
canPerformAction(chain, isConnected, isCorrectChain)
getChainActionGuidance(chain, isConnected)
```

**After**:
```javascript
canPerformAction(chainState, action, isCorrectChain)  // chainState = chains.evm|aptos|movement
getChainActionGuidance(chainDef, chainState)          // Separate definition from state
```

This separates **chain definition** (from appConstants) from **chain state** (from useChainConnections).

### 3. Refactored Components

#### MarketsPage
- **Before**: Destructured `isConnected` from wagmi, `connected` from useAptosSignalPublisher
- **After**: Single `const { chains, canPerform } = useChainConnections()`
- **Benefit**: Single import, single hook, eliminates scattered state variables

#### MarketCard, SportsTabContent, DiscoveryTabContent
- **Before**: Props `isConnected`, `aptosConnected`
- **After**: Single prop `chains`
- **Benefit**: Future-proof (Movement now explicit), no scattered booleans

#### ChainActionWidget
- **Before**: `aptosConnected`, `evmConnected` params, manual checks inside renderChainAction
- **After**: `chains` object, `renderChainAction(chainDef, chainState, ...)`
- **Benefit**: 
  - Automatically prefers Movement over Aptos when available
  - Cleaner button state logic
  - One source of truth for wallet connection state

### 4. API Contract Updates

`handlePublishSignal()` now tracks which chain the signal was published to:
```javascript
const publishChain = chains.movement.connected ? 'movement' : 'aptos';
const authorAddress = chains[publishChain].address;

await fetch("/api/signals", {
  body: JSON.stringify({
    // ... existing fields
    publishChain,  // NEW: track which chain was used
  })
})
```

## Architectural Benefits

### Before
```
useAccount() ─┐
              ├─→ MarketsPage ─→ [isConnected, aptosConnected] ─→ MarketCard, SportsTabContent, DiscoveryTabContent
useWallet() ──┤
              └─→ handlePublishSignal (internal state)

Issues:
- Multiple sources of truth
- Prop drilling scattered booleans
- Movement detection buried in hook logic
- No semantic action checking
- Difficult to extend (add new chain?)
```

### After
```
useAccount() ┐
             ├─→ useChainConnections ─→ chains object ─→ MarketsPage ─→ All children
useWallet()  │   (Single Source)
             └─→ [Movement explicitly separate]

Benefits:
- One canonical state
- Minimal prop drilling (one object per child)
- Movement is first-class citizen
- Semantic canPerform() for business logic
- Extensible pattern (add chains.sui, chains.cardano, etc.)
- Type-safe object shape
- Memoized for performance
```

## Migration Path

### For New Components
```javascript
// Always receive chains object
function MyComponent({ chains, ... }) {
  if (chains.movement.connected) {
    // Do something Movement-specific
  }
}
```

### Legacy Code (Gradual Transition)
`useChainConnections` still exports deprecated `isConnected`, `aptosConnected` for backward compatibility:
```javascript
const { chains, isConnected, aptosConnected } = useChainConnections();
// Still works, but not recommended for new code
```

## Testing Checklist

- [x] Build passes (npm run build)
- [x] No TypeScript errors
- [x] Unified hook exports correct chain state
- [x] ChainActionWidget renders correctly for all chains
- [x] handlePublishSignal tracks publishChain
- [ ] E2E: Connect EVM wallet → MarketCard updates
- [ ] E2E: Connect Aptos wallet → ChainActionWidget shows Aptos + Movement options
- [ ] E2E: Connect Movement wallet → Prefers Movement in ChainActionWidget
- [ ] E2E: Publish signal tracks correct chain

## Files Changed

1. **New**: `hooks/useChainConnections.js` (125 lines)
2. **Updated**: `utils/chainUtils.js` (refactored function signatures)
3. **Updated**: `app/markets/page.js` (removed scattered props, use chains object)
4. **Unchanged**: `constants/appConstants.js` (already well-structured CHAINS)

## Next Steps

### High Priority
1. Add Movement detection tests (wallet type detection logic)
2. Test chain switching behavior (connect Aptos, then Movement)
3. Verify publishChain is correctly stored in DB

### Medium Priority
1. Remove legacy `isConnected`, `aptosConnected` exports from hook
2. Update OrderSigningPanel to use chains object (currently uses internal hook)
3. Create component documentation (JSDoc for chains object shape)

### Low Priority
1. Add Analytics tracking (which chain users prefer)
2. Create reusable ChainSelector component
3. Optimize Movement detection (cache wallet type)

## Decisions Made

### Why Not Separate Hooks Per Chain?
**Rejected**: Multiple hooks would recreate the original scattered state problem.

### Why Not Redux/Context?
**Rejected**: Unnecessary complexity for this use case. useChainConnections is lightweight and composable.

### Why Conservative Movement Detection?
**Chosen**: Default to Aptos unless wallet explicitly supports Movement. Safer UX (don't overclaim capabilities).

### Why Keep Legacy Exports?
**Chosen**: Gradual migration path. Allows incremental refactoring without breaking existing consumers. Remove in v0.2.
