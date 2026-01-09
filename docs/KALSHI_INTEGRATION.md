# Kalshi In-App Trading Integration

## Current State

**Status**: Integrated (In-App Trading Live)

### What Exists
- `services/kalshiService.js` - Full market data & trading capabilities
- In-App Trading: `KalshiOrderPanel.js` for placing orders
- In-App Auth: `KalshiLoginModal.js`
- DeFiArbitrageTab: Integrated trading button
- Markets Page: Integrated platform-aware trading button
- API Routes: `/api/kalshi/*` for secure proxying

### What's Missing
- Advanced order types (bracket orders)
- Detailed portfolio history view
- Position management dashboard

---

## Implementation Plan

### Phase 1: Authentication Service

#### 1.1 Enhanced Kalshi Service
**File**: `services/kalshiService.js`

Add authentication methods:
```javascript
// Login with email/password
async login(email, password) {
  const response = await fetch(`${BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const data = await response.json();
  // Returns: { token, member_id, expiry }
  return data;
}

// Place an order
async placeOrder(token, params) {
  const response = await fetch(`${BASE_URL}/portfolio/orders`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ticker: params.ticker,
      action: 'buy', // or 'sell'
      side: params.side, // 'yes' or 'no'
      count: params.count, // number of contracts
      type: params.type, // 'limit' or 'market'
      yes_price: params.yes_price, // price in cents (for yes contracts)
      client_order_id: generateUniqueId() // for deduplication
    })
  });
  return response.json();
}

// Get user balance
async getBalance(token) {
  const response = await fetch(`${BASE_URL}/portfolio/balance`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}

// Get user orders
async getUserOrders(token) {
  const response = await fetch(`${BASE_URL}/portfolio/orders`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return response.json();
}
```

#### 1.2 Authentication State Management
**File**: `hooks/useKalshiAuth.js`

```javascript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useKalshiAuth = create(
  persist(
    (set, get) => ({
      token: null,
      memberId: null,
      expiry: null,
      isAuthenticated: false,
      
      login: async (email, password) => {
        const { token, member_id, expiry } = await kalshiService.login(email, password);
        set({
          token,
          memberId: member_id,
          expiry,
          isAuthenticated: true
        });
      },
      
      logout: () => {
        set({
          token: null,
          memberId: null,
          expiry: null,
          isAuthenticated: false
        });
      },
      
      // Check if token is expired and refresh if needed
      checkAuth: () => {
        const { expiry, token } = get();
        if (!token || !expiry) return false;
        
        const now = Date.now();
        if (now >= expiry) {
          get().logout();
          return false;
        }
        return true;
      }
    }),
    {
      name: 'kalshi-auth',
      partialize: (state) => ({
        token: state.token,
        memberId: state.memberId,
        expiry: state.expiry,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
);

export default useKalshiAuth;
```

---

### Phase 2: API Endpoints

#### 2.1 Kalshi Proxy API
**Why**: Keep credentials secure, handle token refresh, prevent CORS issues

**File**: `app/api/kalshi/login/route.js`
```javascript
import { NextResponse } from 'next/server';

const KALSHI_BASE_URL = process.env.KALSHI_BASE_URL || 'https://trading-api.kalshi.com/v2';

export async function POST(request) {
  try {
    const { email, password } = await request.json();
    
    const response = await fetch(`${KALSHI_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: 'Invalid credentials' },
        { status: 401 }
      );
    }
    
    const data = await response.json();
    return NextResponse.json({
      success: true,
      data: {
        token: data.token,
        memberId: data.member_id,
        expiry: Date.now() + (30 * 60 * 1000) // 30 minutes
      }
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**File**: `app/api/kalshi/orders/route.js`
```javascript
import { NextResponse } from 'next/server';

const KALSHI_BASE_URL = process.env.KALSHI_BASE_URL || 'https://trading-api.kalshi.com/v2';

export async function POST(request) {
  try {
    const { token, order } = await request.json();
    
    // Generate unique client_order_id
    const clientOrderId = `fourcast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const response = await fetch(`${KALSHI_BASE_URL}/portfolio/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        ...order,
        client_order_id: clientOrderId
      })
    });
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { success: false, error: error.message || 'Order failed' },
        { status: response.status }
      );
    }
    
    const data = await response.json();
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    const response = await fetch(`${KALSHI_BASE_URL}/portfolio/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

**File**: `app/api/kalshi/balance/route.js`
```javascript
import { NextResponse } from 'next/server';

const KALSHI_BASE_URL = process.env.KALSHI_BASE_URL || 'https://trading-api.kalshi.com/v2';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    const response = await fetch(`${KALSHI_BASE_URL}/portfolio/balance`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    const data = await response.json();
    return NextResponse.json({
      success: true,
      data
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

### Phase 3: UI Components

#### 3.1 Kalshi Login Modal
**File**: `components/KalshiLoginModal.js`

```javascript
'use client';

import { useState } from 'react';
import useKalshiAuth from '@/hooks/useKalshiAuth';

export default function KalshiLoginModal({ isOpen, onClose, onSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { login } = useKalshiAuth();

  const handleLogin = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/kalshi/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await response.json();

      if (data.success) {
        login(data.data.token, data.data.memberId, data.data.expiry);
        onSuccess?.();
        onClose();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-3xl max-w-md w-full p-6 shadow-2xl">
        <h2 className="text-2xl font-light mb-2">Connect to Kalshi</h2>
        <p className="text-sm opacity-70 mb-6">
          Log in with your Kalshi account to trade directly from Fourcast
        </p>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm opacity-70 mb-2">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-blue-500 outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-sm opacity-70 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 border border-black/10 dark:border-white/10 focus:border-blue-500 outline-none transition-colors"
              required
            />
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-500/10 px-4 py-2 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>

        <p className="text-xs opacity-50 mt-4 text-center">
          Don't have a Kalshi account?{' '}
          <a
            href="https://kalshi.com/sign-up"
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-500 hover:underline"
          >
            Sign up here
          </a>
        </p>
      </div>
    </div>
  );
}
```

#### 3.2 Kalshi Order Panel
**File**: `components/KalshiOrderPanel.js`

```javascript
'use client';

import { useState, useEffect } from 'react';
import useKalshiAuth from '@/hooks/useKalshiAuth';
import KalshiLoginModal from './KalshiLoginModal';

export default function KalshiOrderPanel({ market, isNight, onClose }) {
  const { token, isAuthenticated, checkAuth } = useKalshiAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [balance, setBalance] = useState(null);
  const [orderSide, setOrderSide] = useState('yes'); // 'yes' or 'no'
  const [orderType, setOrderType] = useState('limit'); // 'limit' or 'market'
  const [contracts, setContracts] = useState(10);
  const [limitPrice, setLimitPrice] = useState(market.currentOdds.yes * 100);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderResult, setOrderResult] = useState(null);

  useEffect(() => {
    if (isAuthenticated && checkAuth()) {
      fetchBalance();
    }
  }, [isAuthenticated]);

  const fetchBalance = async () => {
    try {
      const response = await fetch(`/api/kalshi/balance?token=${token}`);
      const data = await response.json();
      if (data.success) {
        setBalance(data.data.balance);
      }
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    }
  };

  const handleSubmitOrder = async () => {
    if (!isAuthenticated || !checkAuth()) {
      setShowLogin(true);
      return;
    }

    setIsSubmitting(true);
    setOrderResult(null);

    try {
      const order = {
        ticker: market.marketID,
        action: 'buy',
        side: orderSide,
        count: contracts,
        type: orderType,
        ...(orderType === 'limit' && { yes_price: Math.round(limitPrice) })
      };

      const response = await fetch('/api/kalshi/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, order })
      });

      const data = await response.json();

      if (data.success) {
        setOrderResult({
          success: true,
          message: `Order placed successfully! Order ID: ${data.data.order_id}`
        });
        fetchBalance(); // Refresh balance
      } else {
        setOrderResult({
          success: false,
          message: data.error || 'Order failed'
        });
      }
    } catch (error) {
      setOrderResult({
        success: false,
        message: 'Connection error. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const estimatedCost = orderType === 'market'
    ? contracts * (orderSide === 'yes' ? market.currentOdds.yes : market.currentOdds.no) * 100
    : contracts * limitPrice;

  const potentialProfit = contracts * 100 - estimatedCost;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className={`${isNight ? 'bg-gray-900' : 'bg-white'} rounded-3xl max-w-lg w-full p-6 shadow-2xl`}>
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h2 className="text-xl font-light mb-1">{market.title}</h2>
              <p className="text-sm opacity-60">Kalshi Market Trading</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Balance Display */}
          {isAuthenticated && balance !== null && (
            <div className={`${isNight ? 'bg-white/5' : 'bg-black/5'} rounded-xl p-4 mb-6`}>
              <div className="text-sm opacity-70 mb-1">Available Balance</div>
              <div className="text-2xl font-light">${(balance / 100).toFixed(2)}</div>
            </div>
          )}

          {/* Order Form */}
          <div className="space-y-4 mb-6">
            {/* Side Selection */}
            <div>
              <label className="block text-sm opacity-70 mb-2">Position</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrderSide('yes')}
                  className={`px-4 py-3 rounded-xl transition-colors ${
                    orderSide === 'yes'
                      ? 'bg-green-500 text-white'
                      : isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
                  }`}
                >
                  <div className="font-light">Yes</div>
                  <div className="text-sm opacity-70">{(market.currentOdds.yes * 100).toFixed(1)}¢</div>
                </button>
                <button
                  onClick={() => setOrderSide('no')}
                  className={`px-4 py-3 rounded-xl transition-colors ${
                    orderSide === 'no'
                      ? 'bg-red-500 text-white'
                      : isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
                  }`}
                >
                  <div className="font-light">No</div>
                  <div className="text-sm opacity-70">{(market.currentOdds.no * 100).toFixed(1)}¢</div>
                </button>
              </div>
            </div>

            {/* Order Type */}
            <div>
              <label className="block text-sm opacity-70 mb-2">Order Type</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setOrderType('limit')}
                  className={`px-4 py-3 rounded-xl transition-colors ${
                    orderType === 'limit'
                      ? isNight ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'
                      : isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
                  }`}
                >
                  Limit Order
                </button>
                <button
                  onClick={() => setOrderType('market')}
                  className={`px-4 py-3 rounded-xl transition-colors ${
                    orderType === 'market'
                      ? isNight ? 'bg-blue-500 text-white' : 'bg-blue-600 text-white'
                      : isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
                  }`}
                >
                  Market Order
                </button>
              </div>
            </div>

            {/* Number of Contracts */}
            <div>
              <label className="block text-sm opacity-70 mb-2">Number of Contracts</label>
              <input
                type="number"
                min="1"
                value={contracts}
                onChange={(e) => setContracts(parseInt(e.target.value) || 1)}
                className={`w-full px-4 py-3 rounded-xl ${
                  isNight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'
                } border focus:border-blue-500 outline-none transition-colors`}
              />
            </div>

            {/* Limit Price (only for limit orders) */}
            {orderType === 'limit' && (
              <div>
                <label className="block text-sm opacity-70 mb-2">Limit Price (cents)</label>
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(parseInt(e.target.value) || 1)}
                  className={`w-full px-4 py-3 rounded-xl ${
                    isNight ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10'
                  } border focus:border-blue-500 outline-none transition-colors`}
                />
              </div>
            )}

            {/* Order Summary */}
            <div className={`${isNight ? 'bg-white/5' : 'bg-black/5'} rounded-xl p-4 space-y-2`}>
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Estimated Cost</span>
                <span className="font-light">${(estimatedCost / 100).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="opacity-70">Potential Profit</span>
                <span className="font-light text-green-500">${(potentialProfit / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Order Result */}
          {orderResult && (
            <div
              className={`mb-4 px-4 py-3 rounded-xl ${
                orderResult.success
                  ? 'bg-green-500/10 text-green-500'
                  : 'bg-red-500/10 text-red-500'
              }`}
            >
              {orderResult.message}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className={`flex-1 px-4 py-3 rounded-xl ${
                isNight ? 'bg-white/5 hover:bg-white/10' : 'bg-black/5 hover:bg-black/10'
              } transition-colors`}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmitOrder}
              disabled={isSubmitting || (balance !== null && estimatedCost > balance)}
              className="flex-1 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Placing Order...' : isAuthenticated ? 'Place Order' : 'Connect & Trade'}
            </button>
          </div>

          {!isAuthenticated && (
            <p className="text-xs opacity-50 mt-4 text-center">
              You'll be prompted to connect your Kalshi account
            </p>
          )}
        </div>
      </div>

      <KalshiLoginModal
        isOpen={showLogin}
        onClose={() => setShowLogin(false)}
        onSuccess={() => {
          setShowLogin(false);
          fetchBalance();
        }}
      />
    </>
  );
}
```

#### 3.3 Update DeFiArbitrageTab
**File**: `app/components/signals/DeFiArbitrageTab.js`

Replace the "View on Kalshi" button with a "Trade on Kalshi" button that opens the order panel:

```javascript
import { useState } from 'react';
import KalshiOrderPanel from '@/components/KalshiOrderPanel';

// ... inside the component
const [selectedKalshiMarket, setSelectedKalshiMarket] = useState(null);

// Replace the existing Kalshi link button (around line 276-287) with:
<button
  onClick={() => setSelectedKalshiMarket(opp.kalshi)}
  className={`flex-1 px-3 py-2 rounded-lg text-xs font-light text-center transition-all ${
    isNight
      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300'
      : 'bg-emerald-400/20 hover:bg-emerald-400/30 text-emerald-700'
  }`}
>
  Trade on Kalshi 📊
</button>

// Add at the end of the component, before the closing tag:
{selectedKalshiMarket && (
  <KalshiOrderPanel
    market={selectedKalshiMarket}
    isNight={isNight}
    onClose={() => setSelectedKalshiMarket(null)}
  />
)}
```

---

### Phase 4: Environment Variables

Add to `.env.local`:
```bash
# Kalshi API Configuration
KALSHI_BASE_URL=https://trading-api.kalshi.com/v2
# For testing, use the demo environment:
# KALSHI_BASE_URL=https://demo-api.kalshi.co/trade-api/v2
```

Add to `.env.local.example`:
```bash
# ============================================
# Kalshi Integration
# ============================================

# Kalshi API Base URL
# Production: https://trading-api.kalshi.com/v2
# Sandbox: https://demo-api.kalshi.co/trade-api/v2
KALSHI_BASE_URL=https://trading-api.kalshi.com/v2
```

---

## Security Considerations

1. **Never store user passwords** - Only handle them in transit for login
2. **Token expiry** - Tokens expire every 30 minutes, implement auto-refresh
3. **Client Order IDs** - Use unique IDs to prevent duplicate orders
4. **API Proxy** - All Kalshi API calls go through Next.js API routes to:
   - Hide API implementation details
   - Add rate limiting if needed
   - Log trading activity
   - Handle errors gracefully

---

## Testing Strategy

### 1. Use Kalshi Demo/Sandbox
- URL: `https://demo-api.kalshi.co/trade-api/v2/`
- Create a demo account at Kalshi
- Test all flows without real money

### 2. Test Cases
- ✅ Login with valid credentials
- ✅ Login with invalid credentials
- ✅ Token expiry and auto-logout
- ✅ Place limit order
- ✅ Place market order
- ✅ View order history
- ✅ Cancel order
- ✅ Insufficient balance handling
- ✅ Network error handling

---

## Future Enhancements

1. **Order Management**
   - View open orders
   - Cancel orders
   - View order history

2. **Portfolio View**
   - Current positions
   - P&L tracking
   - Position management

3. **Advanced Features**
   - Bracket orders (stop-loss/take-profit)
   - Order templates
   - Watchlists

4. **Notifications**
   - Order fills
   - Price alerts
   - Market events

---

## Implementation Checklist

- [ ] Phase 1: Authentication Service
  - [ ] Enhance `kalshiService.js` with auth methods
  - [ ] Create `useKalshiAuth` hook
  - [ ] Test authentication flow

- [ ] Phase 2: API Endpoints
  - [ ] Create `/api/kalshi/login` endpoint
  - [ ] Create `/api/kalshi/orders` endpoint
  - [ ] Create `/api/kalshi/balance` endpoint
  - [ ] Add environment variables

- [ ] Phase 3: UI Components
  - [ ] Build `KalshiLoginModal` component
  - [ ] Build `KalshiOrderPanel` component
  - [ ] Update `DeFiArbitrageTab` to use order panel
  - [ ] Test UI flows

- [ ] Phase 4: Testing
  - [ ] Test on Kalshi sandbox
  - [ ] Security review
  - [ ] User acceptance testing

- [ ] Phase 5: Documentation
  - [ ] User guide for Kalshi trading
  - [ ] Developer documentation
  - [ ] Update README

---

## Resources

- [Kalshi API Documentation](https://kalshi.com/docs)
- [Kalshi Trading API v2](https://trading-api.kalshi.com/v2)
- [Kalshi Demo/Sandbox](https://demo-api.kalshi.co/trade-api/v2/)
- [Kalshi Sign Up](https://kalshi.com/sign-up)

---

## Notes

- Kalshi is US-only, ensure compliance with user location
- Consider adding KYC verification status check
- Monitor API rate limits (not documented, but likely exist)
- Token refresh logic may need to be implemented for long sessions
- Market orders execute immediately, limit orders wait in book
