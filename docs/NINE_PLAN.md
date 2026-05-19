# 7→9 Action Plan: UI/UX, Frontend, Product Design, Intuitiveness

## Priority Matrix

| # | Change | Dimension | Effort | Impact |
|---|--------|-----------|--------|--------|
| 1 | Fix meta description in layout.js | Product | 30s | Low but sets the right frame |
| 2 | Add gesture guidance to carousel | Intuitiveness | 1hr | High — fixes click vs drag confusion |
| 3 | Extract carousel physics → hook | Frontend | 2hr | High — splits 810-line monolith |
| 4 | Replace `window.location.href` with `router.push()` | Frontend | 30min | Medium — removes full page reloads |
| 5 | Add empty states to MarketsPage | Intuitiveness | 1hr | High — eliminates raw error messages |
| 6 | Add skeleton loaders for carousel | UI | 1hr | High — removes black-screen spinner |
| 7 | Add first-visit tooltip to carousel | Intuitiveness | 2hr | High — guides first-time users |
| 8 | Simplify chain connection UX | Intuitiveness | 3hr | High — hides blockchain complexity |
| 9 | Create next.config.js with ws fallback | Frontend | 10min | Medium — fixes dependency warnings |
| 10 | Add portfolio overview card on Markets | Product | 3hr | Medium — shows "where's my money" |
| 11 | Rate limit → paywall conversion flow | Product | 4hr | Medium — monetization foundation |
| 12 | Split carousel into components | UI | 3hr | Medium — component hygiene |
| 13 | Create CSS custom properties for design system | UI | 4hr | Medium — stops style drift |

---

## 1. Meta Description (layout.js)

**Change**: `"A decentralized weather application."` → `"Prediction intelligence powered by AI, ML models & live weather data. Find edges across crypto, sports, and political prediction markets."`

**File**: `app/layout.js` line 13
**Effort**: 30 seconds

---

## 2. Carousel Gesture Guidance

Add a small "Drag to browse" / "Click to enter" hint that appears briefly on first visit and then fades. This solves the core intuitiveness problem: users don't know the carousel is interactive.

**In `CarouselLanding.js`**, add state and a toast-like hint:

```jsx
// State
const [showGestureHint, setShowGestureHint] = useState(true);

// In render, after the dots:
{showGestureHint && (
  <div className="carousel-gesture-hint">
    <span className="carousel-gesture-icon">↔</span>
    <span>Drag to browse · Click to explore</span>
  </div>
)}
```

Auto-dismiss: `setShowGestureHint(false)` fires 4 seconds after entry animation completes.

**CSS addition** in global.css:
```css
.carousel-gesture-hint {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -80%);
  z-index: 15;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(10, 10, 15, 0.6);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: rgba(255, 255, 255, 0.6);
  font-size: 13px;
  font-weight: 300;
  pointer-events: none;
  animation: gesture-hint-in 0.5s ease-out, gesture-hint-out 0.5s ease-in 3.5s forwards;
}
@keyframes gesture-hint-in { from { opacity: 0; transform: translate(-50%, -60%); } to { opacity: 1; transform: translate(-50%, -80%); } }
@keyframes gesture-hint-out { from { opacity: 1; } to { opacity: 0; } }
.carousel-gesture-icon { font-size: 18px; animation: gesture-pulse 2s ease-in-out infinite; }
@keyframes gesture-pulse { 0%, 100% { transform: translateX(-4px); } 50% { transform: translateX(4px); } }
```

---

## 3. Extract Carousel Physics → Hook

Extract all physics, scroll, and interaction logic from `CarouselLanding.js` into `hooks/useCarouselPhysics.js`. This drops the component from 810 lines to ~250, making it maintainable.

**New file**: `hooks/useCarouselPhysics.js` (~450 lines)
**Refactored**: `components/CarouselLanding.js` (~250 lines, imports the hook)

The hook exposes:
```js
{
  stateRef,       // Same mutable ref
  measure,        // Re-mesures card dimensions
  updateTransforms, // Updates card CSS transforms
  startCarousel,  // Starts physics loop
  stopCarousel,   // Stops physics loop
  animateEntry,   // GSAP entry animation
  onWheel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}
```

---

## 4. Fix Navigation (window.location → router.push)

In `WeatherPage.js`, lines 358 and 377:
```js
// BEFORE
onClick={() => window.location.href = '/markets'}
onClick={() => window.location.href = '/signals'}

// AFTER
import { useRouter } from 'next/navigation';
// ...
const router = useRouter();
// ...
onClick={() => router.push('/markets')}
onClick={() => router.push('/signals')}
```

This eliminates full-page reloads when navigating from the weather page.

---

## 5. Empty States on MarketsPage

The markets page currently shows: `setError(result.message || "No markets found. Try adjusting filters.")`

Replace with actual empty state component that provides guidance:

```jsx
function EmptyState({ category, onSwitchCategory }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{category === 'Crypto' ? '₿' : '📊'}</div>
      <h3>No {category} markets right now</h3>
      <p>Try a different category, or expand your filters for more results.</p>
      <div className="empty-suggestions">
        {['Sports', 'Politics', 'Weather'].filter(c => c !== category).map(c => (
          <button key={c} onClick={() => onSwitchCategory(c)}>
            Browse {c} →
          </button>
        ))}
      </div>
    </div>
  );
}
```

Replace the raw error display in `MarketsPage.js`:
```jsx
// Find the error display section and wrap it:
{error && (
  <EmptyState
    category={discoveryFilters.category}
    onSwitchCategory={(cat) => setDiscoveryFilters(prev => ({...prev, category: cat}))}
  />
)}
```

---

## 6. Skeleton Loaders for Carousel

Replace the solid black loader background with skeleton card outlines:

```css
/* In carousel CSS */
.carousel-skeleton {
  position: absolute;
  inset: 0;
  z-index: 99;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 28px;
  background: #0a0a0f;
  transition: opacity 0.3s ease;
}
.carousel-skeleton.hidden {
  opacity: 0;
  pointer-events: none;
}
.carousel-skeleton-card {
  width: min(26vw, 360px);
  aspect-ratio: 4/5;
  border-radius: 16px;
  background: linear-gradient(135deg, rgba(255,255,255,0.03), rgba(255,255,255,0.06));
  border: 1px solid rgba(255,255,255,0.04);
  animation: skeleton-pulse 1.5s ease-in-out infinite;
}
@keyframes skeleton-pulse {
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
}
```

Then in `CarouselLanding.js`, render 3 skeleton cards behind the loader that are replaced by real cards when entry animation begins.

---

## 7. First-Visit Tooltip

Combine with the gesture hint from #2, but add a "Let's find your first edge" CTA:

```jsx
// New component: CarouselWelcome.js
export default function CarouselWelcome({ onEnter }) {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return true;
    return !!localStorage.getItem('fourcast_visited');
  });

  if (dismissed) return null;

  return (
    <div className="carousel-welcome">
      <h2>🔮 Fourcast</h2>
      <p>AI-powered prediction intelligence. Drag to explore verticals, then click to dive in.</p>
      <div className="carousel-welcome-actions">
        <button onClick={() => { setDismissed(true); localStorage.setItem('fourcast_visited', 'true'); onEnter(); }}>
          Show me around →
        </button>
      </div>
    </div>
  );
}
```

This appears as a floating card in the center of the carousel on the very first visit, then auto-dismisses.

---

## 8. Simplify Chain Connection UX

**Problem**: 4 chains (Arc, Aptos, Movement, EVM) with 3 purposes (settlement, signals, trading) = 12 combinations. Users don't know what to connect.

**Solution**: Single "Connect Wallet" button that auto-detects the right chain:

```jsx
// Simplified approach — file: app/components/UnifiedConnect.js
export default function UnifiedConnect() {
  const { chains, canPublish } = useChainConnections();
  const [showDetails, setShowDetails] = useState(false);

  // Show simple state
  if (canPublish) return <WalletStatus connected />;

  return (
    <div>
      <button onClick={/* evm wallet connect flow */}>
        Connect Wallet ←
      </button>
      {showDetails && (
        <ChainDetail>
          <p>Fourcast uses Arc for USDC settlement and Movement for on-chain signals.</p>
          <p>Connect any EVM wallet — we'll handle the rest.</p>
        </ChainDetail>
      )}
    </div>
  );
}
```

Hide the `ActiveChainIndicator` and `ChainSelector` behind a "Details" toggle. Default: one-button connect.

---

## 9. Create next.config.js

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Polyfill ws for walletconnect
    config.resolve.fallback = {
      ...config.resolve.fallback,
      ws: false,
    };
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
};

module.exports = nextConfig;
```

This suppresses the `ws` module resolution warnings and allows dynamic images.

---

## 10. Portfolio Overview Card

On the MarketsPage, above the filter bar, add a compact card:

```jsx
function PortfolioOverview() {
  const { stats } = useAgentTrackRecord();

  return (
    <div className="portfolio-card">
      <div className="portfolio-stat">
        <span className="portfolio-label">Signals Published</span>
        <span className="portfolio-value">{stats.totalForecasts || 0}</span>
      </div>
      <div className="portfolio-stat">
        <span className="portfolio-label">Win Rate</span>
        <span className="portfolio-value">{stats.winRate || '—'}%</span>
      </div>
      <div className="portfolio-stat">
        <span className="portfolio-label">Tips (USDC)</span>
        <span className="portfolio-value">{stats.totalTips || '0.00'}</span>
      </div>
    </div>
  );
}
```

---

## 11. Rate Limit → Paywall Flow

Already have `analysisRateLimit` map in `api/analyze/route.js`. Add a toast + overlay:

```jsx
// In MarketsPage.js, after each analysis attempt fails from rate limit:
if (result.rateLimited) {
  addToast(
    "You've used your free analyses. Upgrade to Pro for unlimited access.",
    'info',
    8000,
    null,
    'Upgrade →'
  );
}
```

This is a low-friction conversion point — the user just experienced value (they got some free analyses) and now hits a gentle wall.

---

## Implementation Order

Execute in this sequence for maximum impact per hour:

| Order | Item | Hours | Gain |
|-------|------|-------|------|
| 1 | Meta description (layout.js) | 0.01 | Sets product identity |
| 2 | next.config.js | 0.2 | Stabilizes build |
| 3 | Fix window.location → router.push | 0.5 | Smoother navigation |
| 4 | Add gesture guidance to carousel | 1 | Fixes #1 confusion |
| 5 | Add skeleton loaders | 1 | Removes black screen |
| 6 | Add empty states | 1.5 | Eliminates raw errors |
| 7 | Extract carousel physics hook | 2 | Architectural hygiene |
| 8 | Add first-visit tooltip | 2 | Guides first-time users |

That's ~8 hours of work to hit high-impact changes across all 4 dimensions. Items 9-13 can wait.
