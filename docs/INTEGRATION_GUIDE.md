# Integration Guide - Fourcast Weather Edge Analysis

## Venice AI Analysis Output - Deep Reasoning Testing Results

### Current Configuration

**Model:** `llama-3.3-70b`
**Web Search:** ✅ Enabled (`enable_web_search: "auto"`)
**Deep Reasoning:** ❌ NOT enabled
**Temperature:** 0.3 (deterministic, factual)
**Max Tokens:** 1000 per response

### Testing Results: Llama 3.3 70B vs Qwen3-235B

#### ✅ LLAMA 3.3 70B (Current Setup)

**Performance:**
- Response Time: **7.5 seconds**
- Analysis Length: **499 characters**
- Key Factors: 5 identified
- Cost: **~$0.01 per analysis**
- Margin: **98%+**

**Output Quality:**
- ✅ Clean, parseable JSON immediately
- ✅ Fast enough for good UX (< 10s)
- ✅ Real-time web search data included
- ✅ Event-specific analysis (not templated)
- ❌ Generic key factors ("Rainy conditions", "Wind speed", "Home-field advantage")
- ❌ No causal reasoning shown ("No" for logical connectors like "because", "due to")

#### ❌ QWEN3-235B with `strip_thinking_response: true` (BROKEN)

**Status:** Failed to parse JSON

**Issue:** The `strip_thinking_response` parameter doesn't work as expected. Instead of stripping thinking tags, it returned plain text analysis without the JSON wrapper.

**Why it failed:**
- Venice's documentation lists `strip_thinking_response` as a valid parameter
- However, it appears to remove the JSON structure entirely on Qwen3-235B
- The model reverts to natural language explanations instead of structured JSON
- **This parameter doesn't work as a simple strip — it fundamentally changes the output format**

#### ✅ QWEN3-235B with `disable_thinking: true` (WORKS WELL)

**Performance:**
- Response Time: **66.8 seconds** (8.9x slower than Llama)
- Analysis Length: **627 characters** (25% longer)
- Key Factors: 5 identified (ALL SPECIFIC)
- Cost: **~$0.03 per analysis** (3x more expensive)
- Margin: **85%+**

**Output Quality:**
- ✅ Clean, parseable JSON
- ✅ **MUCH more specific key factors** (statistics, percentages, comparisons)
- ✅ **Includes causal reasoning** ("will affect", "impacting")
- ✅ **Deeper market analysis** (references odds explicitly in recommendation)
- ✅ Better odds assessment and positioning
- ❌ **Significantly slower** (9x slower = poor UX for real-time analysis)
- ❌ **Higher cost** (3x more expensive)

### Reasoning Model Options Evaluated

#### ❌ `strip_thinking_response: true` (DO NOT USE)
- Doesn't strip tags, breaks JSON output
- Returns natural language instead of structured JSON
- Venice documentation is misleading on this parameter

#### ✅ `disable_thinking: true` (WORKS)
- Maintains JSON structure
- Prevents `thinking` tag generation
- High-quality output but slow
- 3x cost increase
- Better for non-time-critical analysis

### ⚠️ DeepSeek R1 (Not Tested - Retired)

**Why It Wasn't Tested:**

Venice officially retired DeepSeek R1 from their web interface (May 2025 announcement). Reasons:

1. **Performance**: 60+ second response times (worse than Qwen3-235B's 67s)
2. **Adoption**: Only 5% of users selected it despite consuming 2/3 of GPU resources
3. **Cost**: More expensive than alternatives without better output quality
4. **UX**: Slow responses don't justify marginal quality gains

**Status**: Still available via API, but Venice's official position is **not recommended** for customer-facing applications.

**Better Alternative**: Qwen3-235B with `disable_thinking: true` provides similar reasoning quality with slightly faster response times and broader support.

## Cost Implications for Credit System

### Llama 3.3 70B Pricing
- **Base cost:** ~$0.01 per analysis
- **Margin at $1 = 10 credits:** 98%+

### Qwen3-235B Pricing
- **Base cost:** ~$0.03 per analysis (3x higher)
- **Margin at $1 = 5 credits:** 85%+

## Recommendation for Your Charging System

### OPTION A: Stick with Llama 3.3 70B (RECOMMENDED FOR MVP) ⭐⭐⭐
```
Pricing: $1 = 10 credits
Cost per analysis: ~$0.01
Margin: 98%+

✓ Fast response (7.5s - good UX)
✓ Extremely profitable
✓ Reliable JSON output
✓ Works now without changes
✓ Good enough quality for MVP
✗ Less specific analysis
✗ No causal reasoning
```

**Implementation:** No changes needed. Current setup is production-ready.

---

### OPTION B: Switch to Qwen3-235B (BEST QUALITY) ⭐⭐
```
Pricing: $1 = 5 credits (or $1 = 3 credits for tighter margin)
Cost per analysis: ~$0.03
Margin: 85%+

✓ Much more specific analysis
✓ 25% longer responses
✓ Includes statistical backing
✓ Causal reasoning visible
✗ 8.9x slower (67s vs 7.5s)
✗ Poor UX for time-sensitive predictions
✗ Lower margins
```

**When to use:** Deep analysis tier, research mode, premium tier

**Implementation Required:**
```javascript
// In aiService.server.js callVeniceAI function
const veniceParams = {
  enable_web_search: 'auto',
  disable_thinking: true  // ← CRITICAL for Qwen3-235B
};

const response = await client.chat.completions.create({
  model: mode === 'deep' ? 'qwen3-235b' : 'llama-3.3-70b',
  max_tokens: mode === 'deep' ? 2000 : 1000,
  venice_parameters: veniceParams,
  // ... rest of config
});
```

---

### OPTION C: Hybrid Tier System (FUTURE ENHANCEMENT) ⭐⭐⭐⭐
```
Basic Analysis: Llama 3.3 70B
  → 1 credit per analysis
  → Fast (7.5s)
  → Cost to you: $0.01

Deep Analysis: Qwen3-235B
  → 5 credits per analysis
  → Slow (67s) but detailed
  → Cost to you: $0.03

User chooses per analysis
```

**Benefits:**
- ✓ Flexibility meets different needs
- ✓ Maximize revenue from power users
- ✓ Cater to casual vs serious predictors
- ✗ More complex implementation
- ✗ Need to manage two models in production

**Suggested Pricing:**
- $1 = 10 credits
- Basic analysis = 1 credit ($0.10)
- Deep analysis = 5 credits ($0.50)
- Whitelist gets unlimited basic

## What Changed (Previously Documented)

Previously we noted:
- ❌ Deep reasoning was "difficult to implement"
- ❌ Qwen3-235B option was considered but abandoned

After testing:
- ✅ Deep reasoning IS implementable (just use `disable_thinking: true`)
- ✅ The challenge was handling `thinking` tags, not the model itself
- ✅ Quality improvement is substantial (100% vs 20% specific factors)
- ✅ Trade-off is acceptable: 8.9x slower but 25% better analysis

## Summary & Recommendation

**For MVP (Now):**
- Keep Llama 3.3 70B
- Charge $1 = 10 credits
- Users get good analysis in 7.5s
- You keep 98%+ margin
- **Recommended: Deploy as-is**

**For v2 (After MVP):**
- Add Qwen3-235B as "Deep Analysis" tier
- Charge $1 = 10 credits (1 basic or 2 deep analyses)
- Give users choice per analysis
- Better monetization + quality

**Critical Implementation Note:**
If you ever switch to Qwen3-235B, use:
```javascript
venice_parameters: {
  enable_web_search: 'auto',
  disable_thinking: true  // ← MUST use this, not strip_thinking_response
}
```

The `strip_thinking_response` parameter breaks JSON output on Qwen3-235B. Use `disable_thinking` instead.

## Integration Architecture

### /ai vs /discovery Differentiation
The `/ai` and `/discovery` pages use different analysis modes:

**/ai Page (Event Weather Analysis):**
- `analysisType: 'event-weather'`
- Extracts event venues from markets
- Fetches weather at **event locations**
- Scores by weather impact at venue
- Focuses on sports events only

**/discovery Page (Global Market Discovery):**
- `analysisType: 'discovery'`
- No venue extraction needed
- Scores by market efficiency (volume, liquidity, volatility)
- Browses all market categories globally

### Data Flow Comparison

**Event Weather Analysis Flow:**
```
Markets → Extract Event Venue → Get Venue Weather → Score by Weather + Odds
(Always shows event-relevant results)
```

**Global Discovery Flow:**
```
All Markets → Score by Volume/Liquidity/Volatility → Rank & Return
(Always shows high-volume results, location-agnostic)
```

## Signal Publishing Implementation

### ✅ Completed Tasks

1. **Aptos Provider Integration**
   - Wrapped application in `AptosProvider` in `app/layout.js`
   - Enables Aptos wallet connectivity across the entire app

2. **Dual Wallet UX**
   - Updated `app/markets/page.js` header
   - Added "Trading" wallet (MetaMask/ConnectKit)
   - Added "Signals" wallet (Petra/Aptos)
   - Clear visual distinction between the two

3. **Signal Publishing Logic**
   - Implemented "Progressive Enhancement" flow:
     1. **Save to SQLite**: Immediate local save (fast feedback)
     2. **Publish to Aptos**: If wallet connected, sign & submit transaction
     3. **Link Records**: Update SQLite record with Aptos `tx_hash`

4. **Backend Updates**
   - Added `updateSignalTxHash` to `services/db.js`
   - Added `PATCH /api/signals` endpoint to handle hash updates

### Progressive Enhancement Pattern

**Flow:**
1. Signal saves to SQLite → Immediate success ✅
2. Aptos publish (async) → On-chain proof 🔗
3. If Aptos fails → Signal still exists, can retry 🔄
4. Update SQLite with tx_hash → Link local + blockchain 🎯

**Benefits:**
- Fast user feedback (SQLite)
- Graceful degradation (works offline)
- Retry mechanism (recover from failures)
- Best UX (fast + reliable)

### Kalshi Integration

#### Core Components

1. **`services/kalshiService.js`**

   - Fetches weather markets from Kalshi's public API
   - Supports 4 weather series: NYC, Chicago, Miami, Austin
   - Normalizes Kalshi data to match our internal `Market` model
   - Handles platform-specific data (prices in cents, volume in contracts)

2. **`app/api/markets/route.js`** (Enhanced)

   - Aggregates data from both Polymarket and Kalshi
   - Merges results and sorts by volume
   - Applies filters to both platforms
   - Returns unified market list with `platform` field

3. **`app/markets/page.js`** (Enhanced)
   - **Platform Badge**: Visual indicator (Polymarket = Blue, Kalshi = Green)
   - **Volume Display**: Adapts format (Polymarket = $XK, Kalshi = X Vol)
   - **Platform Filter**: Dropdown in Discovery tab (All/Polymarket/Kalshi)
   - **Client-side Filtering**: Filters markets by platform selection

### Date-First UI Implementation

#### UI Redesign
- **Before**: Search-based filter (search for teams/locations)
- **After**: Date-based tabs showing upcoming events
  - Today
  - Tomorrow
  - This Week
  - Later

#### State Changes
Removed:
- `sportsSearchText` / `setSportsSearchText`
- `sportsMaxDays` / `setSportsMaxDays`
- `includeFutures` / `setIncludeFutures`

Added:
- `selectedDateRange` / `setSelectedDateRange` - controls which time period to show

#### API Changes
Date range maps to `maxDaysToResolution`:
- "today" → 1 day
- "tomorrow" → 2 days
- "this-week" → 7 days
- "later" → 60 days

## Farcaster / Neynar Integration

### Setup

1. **Get API Keys**
   - Register at https://dev.neynar.com
   - Create a new application
   - Generate API key

2. **Create Bot Signer**
   - Go to Neynar Dashboard → "Agents and Bots" → "Use Existing Account"
   - Click Sign in With Neynar
   - Connect your Farcaster account (or create fourcast bot account)
   - Approve signer via onchain transaction (~$2 OP ETH on Optimism)
   - Copy the generated `SIGNER_UUID`

3. **Set Environment Variables**
   ```bash
   NEYNAR_API_KEY=your_neynar_api_key
   FARCASTER_SIGNER_UUID=your_signer_uuid
   NEYNAR_WEBHOOK_SECRET=your_webhook_secret (optional, for signature verification)
   ```

4. **Configure Webhook in Neynar Dashboard**
   - Target URL: `https://yourapp.com/api/farcaster/webhook`
   - Events: `cast.created`
   - This enables real-time mention detection

### Architecture

**Service Layer** (`services/farcasterService.js`):
- Single source of truth for Neynar API interactions
- Encapsulates: publishing casts, fetching users, formatting messages
- Reusable across bot and web endpoints

**Webhook Handler** (`app/api/farcaster/webhook/route.js`):
- Receives mention events from Neynar
- Parses natural language (e.g., "@fourcast weather in NYC")
- Fetches data from core services (weather, markets)
- Publishes formatted response casts

**Data Reuse**:
- Weather data flows through `weatherService` (same as web)
- Market signals formatted via `formatSignalCast()` helper
- Authentication via stored `FARCASTER_SIGNER_UUID`

### Capabilities

Users mention `@fourcast` with natural language queries:

```
@fourcast weather in New York
→ Returns current conditions + 3-day forecast as cast

@fourcast weather for London
→ Same formatted response for different location

@fourcast NYC
→ Detects location automatically
```

### Future Enhancements

**Tier 1 (Easy)**
- Direct market queries: "@fourcast markets for weather"
- Market analysis: "@fourcast analyze POLY weather"
- Leaderboard checks: "@fourcast top forecasters"

**Tier 2 (Moderate)**
- Profile linking: Store user Farcaster FID + wallet in profile
- Direct messages: Send analysis to user via Warpcast DM
- Cast embeds: Include market links in weather casts

**Tier 3 (Advanced)**
- Automated signals: Publish market signals as casts
- Onchain interactions: Execute trades from Farcaster mentions
- Reputation sync: Pull Farcaster user score for credibility ranking

## Weather Data Integration

### Open-Meteo Primary Source

Fourcast uses **Open-Meteo** as the primary weather data source with **WeatherAPI** as fallback:

**Open-Meteo Advantages:**
- ✅ Free with no API key required
- ✅ Unlimited requests (no rate limiting)
- ✅ Extended forecast (up to 16 days vs 3 days)
- ✅ Comprehensive data (temperature, humidity, wind, precipitation, UV index, weather codes)

**Architecture:**
```
Primary:   Open-Meteo → Geocoding API → Weather API
Fallback:  WeatherAPI (if Open-Meteo fails)
Cache:     10-minute TTL, LRU eviction at 100 entries
Limit:     15 requests/hour per IP
Fallback:  Demo data when all sources fail
```

**Implementation Files:**
- `services/dataConverter.js` - Centralized data conversion (shared utility)
- `services/weatherService.js` - Client/SSR weather fetching
- `app/api/weather/route.js` - Server-side endpoint with caching & rate limiting

**Data Conversion:**
Raw Open-Meteo data (WMO weather codes, raw metrics) → WeatherAPI-compatible format (human-readable conditions, all temperature/wind/precipitation units)

**Endpoints:**
- Geocoding: `https://geocoding-api.open-meteo.com/v1/search`
- Weather: `https://api.open-meteo.com/v1/forecast`

To test conversion: `npm run test:converter`

---

_Integration Guide - Last updated: December 2024_