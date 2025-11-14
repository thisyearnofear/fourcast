# Polymarket Integration Guide

## Overview

This document describes the Polymarket integration for Weather Edge Finder—enabling users to place prediction market orders directly from AI-generated edge analysis.

### Architecture Pattern

```
AI Analysis (AIInsightsPanel)
    ↓
Trade Button → Order Modal (side, price, size)
    ↓
/api/wallet (check balance/allowance)
    ↓
/api/orders (server-side order submission)
    ↓
CLOB Client (Polymarket blockchain interaction)
```

**Key Principle**: All credential handling is **server-side only**. The frontend connects via wagmi wallet, backend initializes CLOB client from environment secrets.

---

## Setup

### 1. Environment Configuration

Copy and configure the template:

```bash
cp .env.polymarket.example .env.local
```

Required variables:

```env
# Private key for signing orders
POLYMARKET_PRIVATE_KEY=your_private_key_here

# Optional: Builder API for production gasless transactions
POLY_BUILDER_API_KEY=
POLY_BUILDER_SECRET=
POLY_BUILDER_PASSPHRASE=
```

**Getting Private Key:**

- **Magic Link (Email Login)**: https://reveal.magic.link/polymarket
- **Web3 Wallet (MetaMask)**: Settings → Account Details → Export Private Key
- **Important**: Never commit `.env.local` to version control. It's in `.gitignore`.

### 2. Install Dependencies

```bash
npm install
```

Required packages (already in package.json):
- `@polymarket/clob-client` - CLOB order submission
- `@ethersproject/wallet` - Wallet management for server-side signing
- `ethers` - Blockchain utilities
- `wagmi` - Frontend wallet connection

### 3. Verify Wallet Configuration

The integration uses your existing wallet setup via ConnectKit (top-right of app):

- Connected wallet address is passed to `/api/wallet` for balance checks
- USDC balance must be > order cost for orders to submit
- No manual approval needed (handled by `/api/orders` validation)

---

## API Routes

### POST /api/orders

**Submit a prediction market order**

Request body:
```javascript
{
  marketID: "string",           // Market ID from Polymarket
  price: 0.35,                  // Price 0-1 (35% probability)
  side: "BUY" | "SELL",
  size: 5,                       // Number of tokens
  feeRateBps: 0,                // Basis points (optional)
  walletData: {
    address: "0x...",           // Connected wallet
    signer: "wagmi",            // Indicator only
    usdcBalance: "100.00"       // From /api/wallet
  }
}
```

Response (success):
```javascript
{
  success: true,
  orderID: "0x...",
  order: {
    marketID,
    side,
    size,
    price,
    cost: "17.50", // price * size
    status: "submitted"
  },
  timestamp: "ISO-8601"
}
```

Response (error):
```javascript
{
  success: false,
  error: "Description of what went wrong",
  detail: "Technical details if available"
}
```

**Common errors:**

| Error | Cause | Solution |
|-------|-------|----------|
| `Invalid wallet address` | Wallet not connected | Connect wallet in UI |
| `Insufficient balance` | Not enough USDC | Deposit USDC to wallet |
| `Market not found` | Invalid marketID | Verify market exists |
| `Price must be between 0 and 1` | Invalid price | Check price range |
| `Signature verification failed` | Server credentials issue | Verify POLYMARKET_PRIVATE_KEY in .env |

**Rate Limiting:** 20 orders per hour per user (429 error if exceeded)

---

### POST /api/wallet

**Check wallet balance and USDC allowance**

Request body:
```javascript
{
  walletAddress: "0x..."  // Connected wallet address
}
```

Response:
```javascript
{
  success: true,
  wallet: {
    address: "0x...",
    balance: {
      raw: "1000000000",     // Raw units (6 decimals for USDC)
      formatted: "1000.00",  // User-readable
      symbol: "USDC"
    },
    allowance: {
      raw: "5000000000",
      formatted: "5000.00",
      symbol: "USDC",
      spender: "0x4d97..."   // Polymarket CLOB contract
    },
    canTrade: true,          // Has balance AND allowance
    needsApproval: false     // Requires approval transaction
  },
  timestamp: "ISO-8601"
}
```

**GET /api/wallet** (info):
```
GET /api/wallet
Returns service status and capabilities
```

**GET /api/wallet?address=0x...** (quick check):
```
GET /api/wallet?address=0x...
Returns balance for an address without approval check
```

---

## Client Service Layer

### polymarketService

Handles market data, order validation, and cost calculation.

**Key Methods:**

```javascript
// Get market details with trading metadata
const market = await polymarketService.getMarketDetails(marketID);
// Returns: { ...marketData, tradingMetadata: { tickSize, negRisk, chainId } }

// Validate order before submission
const validation = await polymarketService.validateOrder({
  marketID, price, side, size
});
// Returns: { valid: true/false, marketData, error? }

// Build order object for CLOB
const order = polymarketService.buildOrderObject(
  marketData, price, side, size, feeRateBps
);

// Calculate cost breakdown
const cost = polymarketService.calculateOrderCost(price, size, feeRateBps);
// Returns: { baseCost: "17.50", fee: "0.00", total: "17.50" }
```

---

## Frontend Integration

### AIInsightsPanel Component

Enhanced to include order placement:

**New State:**
```javascript
const [showOrderModal, setShowOrderModal] = useState(false);
const [orderForm, setOrderForm] = useState({
  side: 'BUY',
  price: null,
  size: 1
});
const [walletStatus, setWalletStatus] = useState(null);
const [orderResult, setOrderResult] = useState(null);
```

**New Handlers:**
```javascript
// Check wallet balance/allowance
checkWalletStatus()

// Calculate order cost for display
getOrderCost()

// Submit order to backend
handleSubmitOrder()
```

**UI Changes:**
- Added "Trade This Edge" button below analysis
- Modal for order entry with:
  - Wallet balance display
  - Side selector (BUY/SELL)
  - Price input (0.00-1.00)
  - Size input (tokens)
  - Cost preview
  - Order submission button
- Real-time validation + error messaging
- Success confirmation

---

## User Flow

1. **User views analysis** → AI provides edge assessment
2. **Clicks "Trade This Edge"** → Order modal opens
3. **Modal loads wallet status** → Shows USDC balance
4. **User inputs order details**:
   - Side (BUY or SELL)
   - Price (market odds)
   - Size (number of tokens)
5. **System calculates cost** → Displayed to user
6. **User confirms** → `/api/orders` submission
7. **Order submitted** → CLOB client sends to Polymarket
8. **Confirmation** → Order ID shown or error message

---

## Order Lifecycle

### On `/api/orders` POST:

1. **Validate Input** - Check all fields present and valid
2. **Rate Limit** - Enforce per-user rate limits
3. **Verify Wallet** - Check wallet connected with valid signer
4. **Validate Order** - Check market exists, price range, sufficient size
5. **Check Balance** - Ensure USDC balance > order cost
6. **Initialize CLOB** - Create signer from POLYMARKET_PRIVATE_KEY
7. **Build Order** - Construct order with market metadata (tick size, negRisk)
8. **Submit to Polymarket** - Call `clobClient.createAndPostOrder()`
9. **Return Result** - Order ID on success or error message

### Key Validations:

| Field | Range | Error |
|-------|-------|-------|
| price | 0-1 | "Price must be between 0 and 1" |
| size | > 0 | "Size must be greater than 0" |
| marketID | Exists on Polymarket | "Market not found" |
| balance | ≥ cost | "Insufficient balance" |
| wallet | Connected | "Wallet not connected" |

---

## Error Handling

**Frontend** (in AIInsightsPanel):
- Wallet not connected → Show "Connect wallet to trade"
- Insufficient balance → Show required vs available
- Network error → Show retry button
- Order failed → Display error message with details

**Backend** (in /api/orders):
- Missing fields → 400 Bad Request
- Rate limit exceeded → 429 Too Many Requests
- Wallet validation → 401 Unauthorized
- Network/signature error → 400 Bad Request
- Server configuration → 500 Internal Server Error

---

## Testing

### Local Testing

1. **Set up env vars**:
   ```bash
   # Use a test/development private key
   POLYMARKET_PRIVATE_KEY=0x1234...
   ```

2. **Check wallet route**:
   ```bash
   curl -X POST http://localhost:3000/api/wallet \
     -H "Content-Type: application/json" \
     -d '{"walletAddress":"0x..."}'
   ```

3. **Test order validation** (without signature):
   ```bash
   curl -X GET http://localhost:3000/api/orders
   ```

4. **In UI**:
   - Connect wallet with some USDC
   - Load market data
   - Generate analysis
   - Click "Trade This Edge"
   - Try submitting order

### Testnet (Polygon Mumbai)

For testing without real money:
1. Get Polygon Mumbai RPC
2. Update `NEXT_PUBLIC_ARBITRUM_RPC_URL` to Mumbai endpoint
3. Get test USDC from faucet
4. Test order flow

---

## Production Deployment

### Security Checklist

- [ ] Private key stored securely in environment (not in code)
- [ ] `.env.local` added to `.gitignore`
- [ ] Rate limiting configured appropriately
- [ ] Error messages don't leak sensitive info
- [ ] CORS policies configured for your domain
- [ ] RPC endpoints have rate limiting

### For Builder API (Gasless):

If using Builder Signing Server for production:

1. Set up remote signing server (see README)
2. Add to `.env.local`:
   ```env
   POLY_BUILDER_API_KEY=...
   POLY_BUILDER_SECRET=...
   POLY_BUILDER_PASSPHRASE=...
   ```
3. Update `/api/orders` to use `BuilderConfig` (commented example included)
4. Remove POLYMARKET_PRIVATE_KEY

### Monitoring

Track:
- Orders submitted per user/hour
- Success vs error rates
- Common error types
- Average order cost
- Wallet connection rate

---

## Troubleshooting

### "Signature verification failed"

**Causes:**
- POLYMARKET_PRIVATE_KEY is invalid or empty
- Private key format incorrect (needs 0x prefix)
- Funder address doesn't match key

**Fix:**
```bash
# Verify key is valid
node -e "require('ethers').Wallet.createRandom(); console.log('Valid')"

# Check env var
echo $POLYMARKET_PRIVATE_KEY
```

### "Invalid NegRisk flag"

**Cause:** Market has `negRisk: true` but order doesn't

**Fix:** Check market details in response, pass correct flag to order

### "Insufficient Balance"

**Cause:** User doesn't have enough USDC

**Fix:** Show deposit instructions, or allow buying USDC through in-app flow

### "Rate limit exceeded"

**Cause:** User exceeded 20 orders/hour

**Fix:** Display remaining quota, wait time shown in error

---

## Roadmap

### Phase 1 (Current)
- ✅ Basic order submission
- ✅ Balance checking
- ✅ Error handling
- ✅ UI integration

### Phase 2
- [ ] Allowance approval UI (if needed)
- [ ] Order history tracking
- [ ] Performance analytics
- [ ] Multi-chain support

### Phase 3
- [ ] Advanced order types (conditional, stop-loss)
- [ ] Portfolio tracking
- [ ] Slippage protection
- [ ] Builder API integration (gasless)

---

## References

- [Polymarket CLOB Docs](https://docs.polymarket.com/developers)
- [CLOB Client Library](https://github.com/polymarket/clob-client)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
- [Wagmi Documentation](https://wagmi.sh/)
