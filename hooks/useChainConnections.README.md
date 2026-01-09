# useChainConnections Hook

**Unified chain connection state management across EVM, Aptos, and Movement.**

Single source of truth for all blockchain wallet connections.

## Usage

```javascript
import { useChainConnections } from '@/hooks/useChainConnections';

export default function MyComponent() {
  const { chains, canPerform, canPublish } = useChainConnections();

  // Check if a specific chain is connected
  if (chains.movement.connected) {
    console.log('Movement connected:', chains.movement.address);
  }

  // Check if we can perform an action
  if (canPerform('movement', 'publish_and_monetize')) {
    // User can publish AND receive tips on Movement
  }

  // Quick check: can we publish anywhere?
  if (canPublish) {
    // Either Aptos or Movement is connected
  }
}
```

## Return Value

```javascript
{
  // Primary: Unified chain state
  chains: {
    evm: {
      id: 'evm',
      connected: boolean,
      address: string | null,
      chainName: 'Polygon',
      chainId: 137
    },
    aptos: {
      id: 'aptos',
      connected: boolean,
      address: string | null,
      chainName: 'Aptos'
    },
    movement: {
      id: 'movement',
      connected: boolean,
      address: string | null,
      chainName: 'Movement'
    }
  },

  // Utility: Semantic capability checking
  canPerform: (chainId: 'evm'|'aptos'|'movement', action: string) => boolean,

  // Utility: List of connected chains
  connectedChains: ('evm' | 'aptos' | 'movement')[],

  // Utility: Can publish to any chain?
  canPublish: boolean,

  // Legacy (deprecated, for backward compatibility)
  isConnected: boolean,        // EVM only
  aptosConnected: boolean      // Aptos or Movement
}
```

## Supported Actions

### For `canPerform(chainId, action)`

| Action | EVM | Aptos | Movement |
|--------|-----|-------|----------|
| `'trade'` | ✅ | ❌ | ❌ |
| `'publish'` | ❌ | ✅ | ✅ |
| `'publish_and_monetize'` | ❌ | ❌ | ✅ |

```javascript
// Examples
canPerform('evm', 'trade')                           // true if EVM connected
canPerform('aptos', 'publish')                       // true if Aptos connected
canPerform('movement', 'publish_and_monetize')       // true if Movement connected
canPerform('movement', 'publish')                    // true if Movement connected
canPerform('aptos', 'publish_and_monetize')          // false (Aptos can't monetize)
```

## Chain State Shape

Each chain in `chains` has the same shape:

```javascript
{
  id: string,              // 'evm', 'aptos', or 'movement'
  connected: boolean,      // Is user wallet connected to this chain?
  address: string | null,  // Wallet address, null if not connected
  chainName: string        // Display name for UI
  chainId?: number         // (EVM only) Chain ID for network validation
}
```

## Common Patterns

### Pattern 1: Check and Act

```javascript
if (chains.movement.connected) {
  publishSignal(chains.movement.address);
} else if (chains.aptos.connected) {
  publishSignal(chains.aptos.address);
} else {
  showConnectPrompt();
}
```

### Pattern 2: Prefer Premium Chain

```javascript
// Prefer Movement (has monetization), fall back to Aptos
const publishChain = chains.movement.connected ? 'movement' : 'aptos';
const publishAddress = chains[publishChain].address;

if (publishAddress) {
  publishSignal(publishAddress, publishChain);
}
```

### Pattern 3: Show Available Actions

```javascript
const availableActions = [
  chains.evm.connected && { label: 'Trade', action: 'trade' },
  chains.movement.connected && { label: 'Publish & Monetize', action: 'publish_and_monetize' },
  chains.aptos.connected && { label: 'Publish Signal', action: 'publish' }
].filter(Boolean);

return <ActionMenu actions={availableActions} />;
```

### Pattern 4: Semantic Capability Check

```javascript
function TradeButton({ market }) {
  const { canPerform } = useChainConnections();
  
  const canTrade = canPerform('evm', 'trade');
  
  return (
    <button disabled={!canTrade}>
      {canTrade ? 'Place Order' : 'Connect EVM Wallet'}
    </button>
  );
}
```

## Movement vs Aptos Detection

### How Movement is Detected

The hook checks if the connected wallet supports Movement network:

```javascript
const isMovementWallet = useMemo(() => {
  if (!aptosWalletConnected || !connectedWallet) return false;
  
  const walletName = connectedWallet?.name?.toLowerCase() || '';
  const movementAwareWallets = ['petra', 'martian', 'movespoon'];
  
  return movementAwareWallets.some(w => walletName.includes(w));
}, [aptosWalletConnected, connectedWallet]);
```

### Current Movement-Aware Wallets
- Petra
- Martian
- MoveSpoon

More wallets will be added as they integrate Movement support.

## Performance

- ✅ Memoized chain state (no unnecessary re-renders)
- ✅ No additional network calls
- ✅ Efficient wallet type detection (cached)
- ✅ Minimal overhead over raw wallet hooks

## Dependency Graph

```
useChainConnections
├── wagmi/useAccount (EVM)
├── @aptos-labs/wallet-adapter-react/useWallet (Aptos)
└── useMemo (performance)
```

Uses only the native wallet adapters. No additional dependencies.

## Error Handling

If either wallet adapter is not available in your app:

```javascript
// Still works - returns null/false for unavailable chains
const { chains } = useChainConnections();
chains.evm.connected  // false if wagmi provider missing
chains.aptos.connected // false if Aptos adapter missing
```

Safe to use in any component.

## Future Extensions

### To Add a New Chain

1. Add to `CHAINS` in `appConstants.js`:
   ```javascript
   CHAINS.SUI = {
     id: 'sui',
     name: 'Sui',
     display: 'Actions (Sui)',
     // ...
   }
   ```

2. Update `useChainConnections` to add chain state:
   ```javascript
   const chains = useMemo(() => ({
     // ...existing chains
     sui: {
       id: 'sui',
       connected: suiConnected,  // from useSuiWallet() hook
       address: suiAddress,
       chainName: 'Sui'
     }
   }), [...dependencies])
   ```

3. Update `canPerform` action handling:
   ```javascript
   if (chainState.id === 'sui') {
     return action === 'your_action';
   }
   ```

Done! All components automatically get new chain support.

## Debugging

Enable logging to debug chain connections:

```javascript
const { chains } = useChainConnections();
console.log('Chain state:', JSON.stringify(chains, null, 2));
```

Output:
```json
{
  "evm": {
    "id": "evm",
    "connected": true,
    "address": "0x742d35Cc6634C0532925a3b844Bc2e3AeAbe3b0d",
    "chainName": "Polygon",
    "chainId": 137
  },
  "aptos": {
    "id": "aptos",
    "connected": false,
    "address": null,
    "chainName": "Aptos"
  },
  "movement": {
    "id": "movement",
    "connected": true,
    "address": "0x1234567890abcdef...",
    "chainName": "Movement"
  }
}
```

## Migration from Old API

### Old Way (Scattered State)
```javascript
const { isConnected } = useAccount();
const { connected: aptosConnected } = useWallet();

function MyComponent({ isConnected, aptosConnected }) {
  if (isConnected && aptosConnected) {
    // Confusing: can we trade OR publish?
  }
}
```

### New Way (Unified)
```javascript
const { chains, canPerform } = useChainConnections();

function MyComponent() {
  if (canPerform('evm', 'trade') && canPerform('movement', 'publish_and_monetize')) {
    // Clear: we can do both
  }
}
```

## Related Files

- `constants/appConstants.js` - Chain definitions
- `utils/chainUtils.js` - Chain utility functions
- `app/markets/page.js` - Example usage
- `components/ChainActionWidget.js` - UI component using chains
