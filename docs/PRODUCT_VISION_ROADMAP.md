# Weather-Driven Edge Detection: Complete Technical Roadmap

## MVP Path (2-3 weeks)

Minimum to prove concept:
1. List weather-sensitive markets (from Polymarket API)
2. Let users click "Analyze" on any market
3. Run Venice AI, show results in modal
4. Trade button (existing integration)
5. Track trades (store in DB with optional wallet context)

**That's it.** No background jobs, no edge dashboard yet, no portfolio page.

Once this works and people use it, add:
- Automated scanning for top 50 markets
- Edge dashboard with rankings
- Portfolio analytics

## Executive Summary

**Current State:** We have trading infrastructure (order submission, wallet integration) but lack market discovery. Users can trade if they manually find opportunities.

**What We're Building:** An on-demand system that allows users to analyze weather-driven edges in prediction markets when they choose to.

**Core Insight:** Weather forecasts change faster than prediction market odds. Our competitive advantage is matching structured weather data to unstructured market descriptions.

**MVP Approach:** Start with on-demand analysis (user clicks "Analyze" to get AI insights) rather than automated scanning. This is simpler to build, proves the concept faster, and controls costs better.

---

## Complete User Journey (MVP: 4 Phases)

### Phase 1: Discovery 🔍
**Status:** Needs Simple Implementation
**Goal:** User finds a market they want to analyze

**How It Works (MVP):**
- User browses Polymarket markets directly OR
- Search interface: "Find weather-sensitive markets in [location]"
- Simple list: market title, current odds, volume, event time
- Filter by: category (sports/weather/political), liquidity (>$50k), timeframe (today/week)

**Note:** Not fully automated. User selects which markets to analyze.

### Phase 2: Intelligence 🧠
**Status:** Partially Built (Venice AI integration exists)
**Goal:** AI explains why a market matters and quantifies opportunity

**How It Works: On-Demand Analysis (MVP)**
- User clicks [Analyze This Market] button on any market
- System:
  1. Extracts location from market title/description
  2. Fetches weather forecast for that location
  3. Sends to Venice AI: "Market + Weather → Probability estimate?"
  4. Returns: confidence, probability, reasoning, edge size
- Results displayed in modal with [Trade] button
- Results cached per market (reused if user revisits)

### Phase 3: Action 💰
**Status:** Built ✓
**Goal:** User places order directly from intelligence

**Existing Infrastructure:**
- Order submission modal (`/api/orders`)
- Wallet balance checking (`/api/wallet`)
- CLOB client integration for on-chain execution

### Phase 4: Tracking 📈
**Status:** Needs Simple Implementation
**Goal:** User sees if their edge thesis was correct

**How It Works (MVP):**
- Optional wallet connection (uses existing ConnectKit)
- Store user's trades: market, odds at entry, timestamp
- Show: "Your trades" page with outcomes as markets resolve
- Calculate: win rate, avg. confidence vs. actual win %
- Learn: "Which confidence levels actually predict wins?"

---

## Polymarket API: What We Actually Get

### Available Endpoints

#### 1. Events Endpoint (Best for Discovery)
```
GET https://gamma-api.polymarket.com/events
```

**Why Use This:**
- More efficient than `/markets` for bulk discovery
- Events group related markets (e.g., "NBA Nov 15" contains all games that night)
- Better for categorical filtering

**Query Parameters:**
- `limit`: Max 100 results per request (pagination required)
- `offset`: For pagination
- `closed`: Filter by status (false = active only)
- `tag_id`: Filter by category

**Returns:**
```javascript
{
  id: "event_123",
  title: "NBA: Lakers vs Warriors - Nov 15, 2024",
  slug: "lakers-vs-warriors-nov-15",
  description: "Will the Lakers win?",
  startDate: "2024-11-15T02:00:00Z",  // Event start (not resolution)
  endDate: "2024-11-16T06:00:00Z",    // Market closes/resolves
  markets: [
    {
      id: "market_456",
      question: "Will Lakers win by 10+ points?",
      outcomes: ["Yes", "No"],
      outcomePrices: "[\"0.45\", \"0.55\"]",  // Current odds (JSON string)
      clobTokenIds: ["token_yes", "token_no"], // For trading
      active: true,
      volume: "125000.50",
      liquidity: "45000.00"
    }
  ],
  tags: ["NBA", "Sports"]
}
```

#### 2. Markets Endpoint (For Details)
```
GET https://gamma-api.polymarket.com/markets/{marketId}
```

**Returns Additional Detail:**
- `resolutionSource`: Where truth comes from (e.g., "ESPN")
- `negRisk`: Risk indicator
- `enableOrderBook`: Trading mechanism
- Full `description`: Unstructured text with rules

#### 3. Price History
```
GET https://gamma-api.polymarket.com/markets/{marketId}/history
```

**Returns:**
- Timestamped price movements
- Used to calculate volatility and momentum

### What Polymarket Does NOT Provide

**Critical Gap: Structured Location Data**

**Problem:**
- Market title: "Will it rain at LA Marathon on March 9?"
- Description: "Market resolves YES if Weather.com reports >0.1 inches of rain in Los Angeles, CA between 6am-12pm PST on March 9, 2025"

**What We Get:**
- Unstructured text description
- `endDate`: When market resolves (might be days after event)
- No GPS coordinates
- No structured event datetime
- No specific weather station reference

**What We Need:**
- Exact location: 34.0522°N, 118.2437°W (LA Marathon start line)
- Event datetime: March 9, 2025 6:00 AM PST
- Weather API query: Historical weather at that location/time
- Resolution logic: "Did rain exceed 0.1 inches?"

**Why This Matters:**
- Weather API needs coordinates or city name
- "Los Angeles" is 503 square miles - weather varies significantly
- Event time ≠ Resolution time (game at 1pm, market resolves at 11pm)

---

## Location Extraction Service

#### Phase 1: Automated Location Extraction (Week 1)
**Build a Location Extraction Service:**

```javascript
// services/locationExtractor.ts
export function extractLocation(marketTitle: string): string | null {
  // "Will the Lakers beat the Warriors in LA?" → "Los Angeles"
  // "Chicago Marathon rain forecast" → "Chicago"
  // Regex + dictionary for city names
  
  const cityNames = ['Los Angeles', 'Chicago', 'New York', 'Denver']; // Extended list
  for (const city of cityNames) {
    if (marketTitle.toLowerCase().includes(city.toLowerCase())) {
      return city;
    }
  }
  return null;
}
```

**Benefits:**
- 60-70% coverage day 1
- Scales better than manual tagging
- Immediate value for on-demand analysis

#### Phase 2: Enhanced Extraction (Week 2-3)
**Improved Parsing:**
- Extract teams from sports markets
- Lookup venues and coordinates
- Integrate with external APIs for better accuracy

#### Phase 3: Full Metadata Enrichment (Month 2)
**Complete Market Context:**
- Event datetime parsing
- Weather relevance scoring
- Resolution source identification

---

## Data Storage Strategy

### MVP Approach: Redis Caching Only

No persistent database needed for MVP. Use Redis for:

1. **Venice AI Analysis Cache** (most important)
   ```
   Key: analysis:{marketID}
   Value: {
     aiProbability, 
     confidence, 
     reasoning, 
     timestamp
   }
   TTL: 6 hours (distant events) / 1 hour (near events)
   ```

2. **User Trades (Optional)**
   ```
   Key: trades:{walletAddress}
   Value: Array of {
     marketID, 
     entryPrice, 
     size, 
     timestamp, 
     entryOdds
   }
   TTL: Never expire (user's history)
   ```

3. **Market Metadata Cache**
   ```
   Key: market:{marketID}
   Value: {
     title,
     location,
     currentOdds,
     volume,
     endDate
   }
   TTL: 5 minutes
   ```

**Why Redis for MVP:**
- Zero infrastructure (use Upstash or Redis Cloud for serverless)
- Instant reads (sub-millisecond)
- No schema migrations
- Easy to migrate to persistent DB later
- Cost: ~$5-10/month for MVP volumes

**Polymarket handles:**
- ✅ Market data fetching (on-demand)
- ✅ Price history (/markets/{id}/history)
- ✅ Order submission & execution
- ✅ Resolution outcomes (on-chain)

**You query Polymarket for:**
- Market list (on page load)
- Market details (before analysis)
- Order confirmation (post-trade)
- Outcome verification (portfolio page, 1-2x per week per market)

---

## Services Architecture

### 1. Market Discovery Service (`services/marketDiscoveryService.js`)

**Purpose:** Fetch and filter weather-relevant markets from Polymarket /events endpoint

**Usage:** On-demand when user visits discovery page
- Query: `GET /api/markets?category=sports&minVolume=50000&days=7`
- Result: Array of markets with location, odds, volume

### 2. Location Extractor (`services/locationExtractor.ts`)

**Purpose:** Parse market titles to extract location names

**Usage:** Inside marketDiscoveryService before returning results
- Input: "Will it rain at Chicago Marathon on Oct 13?"
- Output: "Chicago" → Weather API lookup
- Target accuracy: >70% on real markets

### 3. Weather Service (`services/weatherService.js`)

**Purpose:** Fetch current/forecast weather for extracted locations

**Usage:** On-demand during analysis
- Cache: 1 per location (reuse if multiple markets in same city)

### 4. Edge Detection via Venice AI (`services/aiService.js`)

**Current:** ✅ Built, uses in-memory cache
**Update:** Migrate to Redis cache (same logic, persistent)
- Cache key: `analysis:{marketID}`
- TTL: 6 hours (distant events) / 1 hour (near events)

---

## API Endpoints

### GET /api/markets
**Purpose:** Fetch weather-relevant markets for browsing/discovery

**Query Parameters:**
```
category=sports|weather|political  (optional, default: all)
minVolume=50000                      (optional, default: $10k)
days=7                              (optional, default: 30)
search=chicago                       (optional)
```

**Response:**
```javascript
{
  "markets": [
    {
      "id": "market_123",
      "title": "Will it rain at Chicago Marathon?",
      "location": "Chicago",
      "currentOdds": { "yes": 0.35, "no": 0.65 },
      "volume24h": "125000",
      "liquidity": "45000",
      "endDate": "2024-10-13T12:00:00Z",
      "category": "Sports",
      "weatherRelevance": 8.5
    }
  ],
  "cached": true|false
}
```

### POST /api/analyze
**Purpose:** Run Venice AI edge analysis for a market (with Redis caching)

**Request:**
```javascript
{
  "marketId": "market_123",
  "eventType": "Chicago Marathon",
  "location": "Chicago",
  "weatherData": { ... },
  "currentOdds": "35% YES / 65% NO"
}
```

**Response:**
```javascript
{
  "marketId": "market_123",
  "assessment": {
    "weather_impact": "HIGH",
    "odds_efficiency": "INEFFICIENT",
    "confidence": "HIGH"
  },
  "reasoning": "Weather forecast shows 70% precip...",
  "key_factors": ["..."],
  "recommended_action": "...",
  "cached": false  // true if from Redis cache
}
```

### POST /api/trades (Optional, Week 4)
**Purpose:** Log user trade for portfolio tracking

**Request:**
```javascript
{
  "walletAddress": "0x123...",
  "marketId": "market_123",
  "entryPrice": 0.35,
  "size": 10,
  "confidence": "HIGH"
}
```

### GET /api/portfolio/{walletAddress} (Optional, Week 4)
**Purpose:** User's trade history and P&L tracking**

**Queries Polymarket to get:**
- Market outcomes (resolved Y/N)
- Calculate win rate per confidence level
- Total P&L

---

## UI Components - Minimal MVP

### Market Discovery Page (`/app/discovery/page.jsx`)

```
┌───────────────────────────────────────────────┐
│  Weather Edges         [← Back to Weather]     │
├───────────────────────────────────────────────┤
│                                                │
│  Sort: [Volume ▼]  Min: [$10k ▼]             │
│                                                │
│  ┌─────────────────────────────────────────┐ │
│  │ Will it rain at Chicago Marathon? [🔴] │ │
│  │ Odds: 35% YES  |  Vol: $125k            │ │
│  │                                          │ │
│  │ [Analyze] ← fast click                   │ │
│  └─────────────────────────────────────────┘ │
│                                                │
│  ┌─────────────────────────────────────────┐ │
│  │ NFL: Cowboys temperature-sensitive       │ │
│  │ Odds: 52% YES  |  Vol: $89k             │ │
│  │ [Analyze]                                │ │
│  └─────────────────────────────────────────┘ │
│                                                │
└───────────────────────────────────────────────┘
```

**Constraints:**
- List only: title, odds, volume
- Sort by volume (default)
- One click = instant analysis
- No category/date filters (MVP only)

### Analysis Results Modal

```
┌─────────────────────────────────────────┐
│  Chicago Marathon Rain                   │
├─────────────────────────────────────────┤
│                                         │
│  Confidence:     HIGH 🎯                │
│  Weather Impact: Significant            │
│  Edge Size:      +28% (misprice)        │
│                                         │
│  Weather:  52°F, 70% rain, 0.3" exp    │
│  Odds:     35% YES (market)             │
│                                         │
│  AI Reasoning:                          │
│  "Weather forecasts 70% precip chance.  │
│   Market at 35% is too low. Historical  │
│   marathons see 60%+ outcomes in rain." │
│                                         │
│  [Cancel]  [Trade Now →]                │
│                                         │
└─────────────────────────────────────────┘
```

**After outcome resolves:**
```
[✅] You won this edge!  [👍 Helpful]
```

### Portfolio Page (Week 4+, if requested)

Simple card view:
```
Your Trades (3 total)
├─ Won: 2  Avg Confidence: HIGH (67%)
├─ Lost: 1  Avg Confidence: MEDIUM (45%)
└─ Win Rate: 66.7% (HIGH confidence edges)
```

**Only add if users ask for it.**

---

## On-Demand Processing

### No Scheduled Automation (MVP)
For the MVP, all processing is triggered by user actions rather than scheduled jobs:

- Market discovery: Happens when user visits discovery page
- Edge detection: Happens when user clicks "Analyze This Market"
- Weather updates: Happens when user requests analysis
- Odds updates: Happens during analysis

### Future Automation (Post-MVP)
Once the on-demand system is validated, we can add scheduled processing for:
- Nightly market scanning
- Automated edge detection for high-volume markets
- Proactive weather updates
```

---

## Implementation Timeline

### Week 0: Pre-Build Validation (2-3 days)
**Before committing to 4 weeks, answer:**
- [ ] Can we extract location from 30 random Polymarket markets? (Target: >70%)
- [ ] Does Venice AI give consistent results on same market? (Rerun 5 markets twice)
- [ ] Do Polymarket titles naturally include location info? (Browse 20 markets manually)

**If any fail, pivot before Week 1 starts.**

### Week 1: Foundation & MVP Minimum
- [ ] Set up Redis (Upstash, ~$5/month)
- [ ] Migrate aiService.js to Redis cache (analysis:{marketID})
- [ ] Build locationExtractor.ts (simple regex + city dictionary, no ML)
- [ ] Implement marketDiscoveryService.js using /events endpoint
- [ ] GET /api/markets returns: list of markets, extracted location, current odds

### Week 2: Minimal Discovery UI & Fast Path to Trade
- [ ] Build Market Discovery page (/app/discovery) - **bare minimum:** list + sort by volume
- [ ] Refactor POST /api/analyze to use Redis cache
- [ ] Build Analysis Modal showing: confidence, reasoning, edge size
- [ ] Add [Trade Now] button → existing order flow
- [ ] **Constraint:** Page load to first trade < 2 minutes

### Week 3: Validation & Fast Feedback Loop
- [ ] Test location extraction on real markets (document failures)
- [ ] Add "outcome feedback" button: after market resolves, user thumbs up/down ✅/❌
- [ ] Monitor Venice costs & analyses per user
- [ ] Add error handling for location extraction failures (allow manual override)
- [ ] **Metric:** Track HIGH confidence edge win rate (target: >65%)

### Week 4: Portfolio (Only If Users Ask)
- [ ] If users request it: build simple trade ledger
- [ ] Query Polymarket /history for outcomes
- [ ] Show: win rate by confidence, total P&L
- [ ] **Don't build:** Complex analytics, performance charts (premature)

## Week 0: Hypothesis Validation (Do This First)

**DO NOT START WEEK 1 UNTIL THESE PASS:**

### Question 1: Can we extract location from market titles?
**Test:** Pick 30 random Polymarket markets. Try to extract city/location using regex.
```
Example markets:
- "Will it rain at Chicago Marathon on Oct 13?" → "Chicago" ✅
- "NFL: Cowboys @ Denver" → "Denver" ✅ 
- "Will James win the UK election?" → ❌ (no location)
- "Temperature above 90°F in Phoenix" → "Phoenix" ✅
```
**Pass criteria:** >70% accuracy (21 out of 30)
**If fail:** Add more cities to dictionary, or pivot to manual override UI

### Question 2: Does Venice AI consistently analyze the same market?
**Test:** Pick 5 markets. Analyze each twice with identical weather data.
```
Market A, Analysis 1: Confidence HIGH, Edge +25%
Market A, Analysis 2: Confidence HIGH, Edge +23% ✅ (variance 2%)
```
**Pass criteria:** Variance <15% between runs
**If fail:** Adjust Venice prompt for determinism, or model is unreliable

### Question 3: Is there market supply?
**Test:** Browse Polymarket for 1 hour. Count markets with weather keywords.
**Pass criteria:** >10 weather-sensitive markets exist today
**If fail:** Pivot to other prediction markets or wait for market expansion

### Decision
- ✅ All 3 pass → Proceed to Week 1
- ❌ Any fail → Replan or pivot

## Rate Limiting & Cost Control

**Venice AI:**
- Free tier: ~100 requests/day
- Cost: $0.01 per analysis
- Daily budget: $0.50 = 50 markets analyzed

**Strategy:**
- Only analyze markets with volume > $50k (eliminates thin markets)
- Only re-analyze edges if odds moved >5% or weather changed
- Batch analyze: 5 markets per request if possible
- Queue failed analyses for retry later

**Monitoring:**
- Track: analyses/day, cost/day, failures/day
- Alert: if cost exceeds $2/day or error rate >10%

## Venice AI Model Prompt Template

You mention ai_model = 'llama-3.3-70b' but don't show the actual prompt. Add:

### Edge Detection Prompt Template

You are a prediction market analyst. Analyze this opportunity:

**Market:** {question}
**Current Odds:** {yes_price}% YES, {no_price}% NO
**Volume:** {volume}
**Location:** {location}
**Event Time:** {event_datetime}

**Weather Forecast:**
- Temperature: {temp}°F
- Precipitation: {precip_chance}% chance, {precip_amount}" expected
- Wind: {wind_speed} mph
- Conditions: {conditions_text}

**Your Task:**
1. Estimate true probability (0-100%) accounting for weather impact
2. Assess confidence in this estimate (HIGH/MEDIUM/LOW)
3. Calculate edge: (true_prob - market_price) × market_price (if buying YES)
4. Explain your reasoning in 2-3 sentences

**Output JSON:**
{
  "true_probability": 58,
  "confidence": "HIGH",
  "weather_impact": "Significant - rain reduces runner pace",
  "edge_size": 0.23,
  "reasoning": "..."
}

This ensures consistency across analyses.

---

## Critical Success Metrics

### MVP Validation (Weeks 1-3)
These prove the core hypothesis works:

| Metric | Target | Why It Matters |
|--------|--------|-----|
| Location extraction accuracy | >70% | Can we tag markets with weather? |
| Venice AI consistency | Variance <15% | Same market, similar analysis? |
| HIGH confidence edge win rate | >65% | Do flagged edges actually win? |
| Page load → First trade time | <2 min | Is friction low enough? |

**If ANY of these fail, the product doesn't work.** Pivot immediately.

### First 30 Days (After MVP Launch)
Measure product-market fit signals:

| Metric | Target | Why |
|--------|--------|-----|
| Analyses per user | 3+ | Are users coming back? |
| Analysis → Trade conversion | >10% | Do edges look compelling enough? |
| Outcome feedback rate | >50% | Are users telling us if we're right? |
| HIGH confidence win rate (live) | >65% | Is the signal real in production? |

**Stop here if win rate is <55%.** Something is wrong with Venice calibration or market selection.

### Scale Metrics (Post-PMF)
Only chase these after proving above:
- Total users
- Portfolio analytics depth
- Automation of edge detection

---

## PMF Risk Map

### High Risk (Kills the Product)

**1. Location extraction fails**
- If we can't tag >70% of markets with location, we can't analyze them
- **Mitigation:** Week 0 validation on 30 random markets
- **Fallback:** Allow manual location override in Week 2

**2. Venice AI doesn't identify mispricings**
- If HIGH confidence edges win <55%, the signal doesn't work
- **Mitigation:** Test consistency in Week 0, monitor live in Week 3
- **Fallback:** Adjust Venice prompt, try different models

**3. Friction is too high**
- If page load → trade takes >2 minutes, users won't return
- **Mitigation:** Build minimal UI (list only, one-click analyze)
- **Fallback:** Pre-fetch markets, cache aggressively

### Medium Risk (Slow Growth)

**4. Not enough analyzable markets**
- If <10 weather-sensitive markets exist on Polymarket daily, no supply
- **Mitigation:** Browse Polymarket, count markets with weather keywords
- **Fallback:** Expand to other prediction markets (not just Polymarket)

**5. Users don't want to trade on edges**
- If analysis → trade conversion is <5%, edges don't matter
- **Mitigation:** Make [Trade Now] prominent, reduce friction
- **Fallback:** Pivot to "trading recommendations" instead of "do it yourself"

### Low Risk (Nice-to-Have)

- Portfolio page complexity
- Market filtering options
- Analytics depth
- Mobile optimization

---

## Lean Decisions

**What NOT to build (for MVP):**
- Automated background scanning (do on-demand)
- Complex discovery filters (just sort by volume)
- Portfolio analytics (let users track on Polymarket)
- Beautiful charts (text is fine)
- Mobile app (web is fine)

**What to validate first (Week 0):**
- Can we extract location?
- Does Venice identify edges?
- Is there market supply?

---

## Engineering Priority: What's Actually Needed

### Week 1: Absolute Must-Haves

| Component | Why | Effort |
|-----------|-----|--------|
| Redis client integration | Cache analysis results (no Venice API costs on repeat) | 50 LOC |
| locationExtractor.ts | Parse market title → extract city name | 100 LOC |
| Polymarket /events endpoint service | Better API than /markets for discovery | 150 LOC |
| GET /api/markets endpoint | Return markets with extracted location | 100 LOC |

**Total: ~400 LOC, 2-3 days**

### Week 2: MVP User Experience

| Component | Why | Effort |
|-----------|-----|--------|
| /app/discovery page | Minimal list + [Analyze] button | 300 LOC |
| Analysis modal | Show confidence, reasoning, edge size | 250 LOC |
| Redis caching in /api/analyze | Don't re-query Venice for same market | 50 LOC |
| [Trade Now] button | Hook into existing order flow | 100 LOC |
| Manual location override | Fallback when extraction fails | 100 LOC |

**Total: ~800 LOC, 3-4 days**

### Week 3: Learn If It Works

| Component | Why | Effort |
|-----------|-----|--------|
| Outcome feedback (👍/👎 button) | Track: "Did this edge actually win?" | 150 LOC |
| Win rate dashboard (admin only) | Analytics: HIGH confidence win rate % | 200 LOC |
| Location extraction test report | Document which markets we couldn't parse | 100 LOC |
| Venice cost monitoring | Alert if costs exceed $5/day budget | 50 LOC |

**Total: ~500 LOC, 2-3 days**

### DO NOT BUILD (yet):
- Background job scheduling
- Market filtering by category/date/liquidity
- Portfolio page with P&L tracking
- Charts, visualizations, or "rich" UX
- Mobile app
- Analytics export

**Why?** These are scaling problems, not PMF problems. Build them after users ask for them.

---


