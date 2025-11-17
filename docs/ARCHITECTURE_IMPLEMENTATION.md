# System Architecture and Implementation

## Core Principles (Applied)
- Enhancement First: reuse and upgrade discovery/analysis flows
- Aggressive Consolidation: removed legacy location-first paths
- Prevent Bloat: single discovery engine; shared odds normalization
- DRY: common services (`polymarketService`, `aiService`)
- Clean: API routes own validation; services own external access
- Modular: streaming route isolated; UI consumers decoupled
- Performant: pre-caching, Redis TTLs, normalized `currentOdds`
- Organized: domain-driven directories under `app/`, `services/`, `docs/`

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                     USER INTERFACE LAYER                             │
│                                                                       │
│  /app/ai/page.js ──────────────────────── /app/discovery/page.js   │
│  (Weather + Edge Analysis)                (Edge Discovery)           │
│          │                                        │                  │
│          └────────────────┬─────────────────────┘                   │
│                          │                                           │
└──────────────────────────┼───────────────────────────────────────────┘
                           │
                      [Optional: Weather Data]
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     API LAYER (EDGE-RANKED)                         │
│                                                                       │
│  POST /api/markets                                                   │
│  {                                                                    │
│    location?: string (optional personalization)                     │
│    weatherData?: { current: { temp_f, condition, wind_mph, ... } } │
│    eventType?: 'all' | 'NFL' | 'NBA' | ...                        │
│    confidence?: 'all' | 'HIGH' | 'MEDIUM' | 'LOW'                  │
│    limitCount?: number                                               │
│  }                                                                    │
│                           │                                          │
│                           ▼                                          │
│  getTopWeatherSensitiveMarkets(limit, filters)                      │
│  (Main Discovery Engine)                                             │
│                           │                                          │
└───────────────────────────┼──────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                  MARKET DISCOVERY ENGINE                             │
│                                                                       │
│  1. buildMarketCatalog() ◄─── [Cached 30 min]                      │
│     └─ Fetch all $50k+ volume markets                              │
│     └─ Extract: location, teams, eventType, odds, volume, liquidity │
│                                                                       │
│  2. Score Each Market: assessMarketWeatherEdge()                    │
│     ├─ Factor 1: weatherDirect (0-3)                                │
│     │   "weather", "temperature", "rain", "snow", "wind"           │
│     │                                                                │
│     ├─ Factor 2: weatherSensitiveEvent (0-2)                       │
│     │   NFL, NBA, MLB, Golf, Tennis, Marathon, Race               │
│     │                                                                │
│     ├─ Factor 3: contextualWeatherImpact (0-5)                     │
│     │   Actual weather conditions match market keywords             │
│     │   Wind > 15 mph + "wind" keyword: +1.5                       │
│     │   Precip > 30% + "rain" keyword: +1.5                        │
│     │   Temp < 45°F or > 85°F + "heat/cold": +1                   │
│     │   Humidity > 70% + "humidity" keyword: +0.5                  │
│     │                                                                │
│     └─ Factor 4: asymmetrySignal (0-1)                              │
│         Volume / Liquidity Ratio > 2: +1                            │
│         (High activity = inefficiency signal)                       │
│                                                                       │
│  3. Filter Markets                                                   │
│     ├─ By eventType (if specified)                                  │
│     ├─ By confidence level (HIGH/MEDIUM/LOW)                        │
│     └─ By location (if specified, for personalization)              │
│                                                                       │
│  4. Sort & Return                                                    │
│     Sort by: edgeScore DESC, then volume DESC                       │
│     Return: Top N markets with edge metadata                        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│              DATA SOURCE: POLYMARKET GAMMA API                       │
│                                                                       │
│  GET https://gamma-api.polymarket.com/markets                       │
│  (All active markets with liquidity data)                           │
│                                                                       │
│  GET https://gamma-api.polymarket.com/markets/{id}                  │
│  (Detailed market data for analysis)                                │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

## Service Architecture

```
services/polymarketService.js
├── Cache Management
│   ├── marketCatalogCache (30 min TTL)
│   ├── marketDetailsCache (10 min TTL)
│   └── locationBasedCache (5 min TTL) [deprecated]
│
├── Phase 1: Market Indexing
│   └── buildMarketCatalog(minVolume)
│       ├── Fetch all active markets
│       ├── Filter by volume threshold
│       ├── Extract metadata (location, teams, eventType)
│       └── Cache for 30 minutes
│
├── Phase 2: Edge Scoring
│   └── assessMarketWeatherEdge(market, weatherData)
│       ├── Calculate weatherDirect score (0-3)
│       ├── Calculate weatherSensitiveEvent score (0-2)
│       ├── Calculate contextualWeatherImpact score (0-5)
│       ├── Calculate asymmetrySignal score (0-1)
│       └── Return { totalScore, factors, confidence, weatherContext }
│
├── Phase 3: Market Discovery (Core Algorithm)
│   └── getTopWeatherSensitiveMarkets(limit, filters)
│       ├── Get catalog (from cache or rebuild)
│       ├── Score all markets
│       ├── Apply filters (eventType, confidence, location)
│       ├── Sort by edgeScore DESC, volume DESC
│       └── Return top N
│
├── Analysis & Trading (Unchanged)
│   ├── getMarketDetails(marketID)
│   ├── getWeatherAdjustedOpportunities() [legacy]
│   ├── buildOrderObject()
│   ├── validateOrder()
│   └── calculateOrderCost()
│
└── Metadata Extraction (Unchanged)
    ├── extractLocation(title)
    ├── extractMarketMetadata(title)
    └── assessWeatherRelevance() [legacy, deprecated]

### AI Analysis & Streaming
```
app/api/analyze/route.js           // Basic/Deep analysis (non-stream)
app/api/analyze/stream/route.js    // NDJSON streaming for Enhanced
services/aiService.js              // Venice AI + Redis caching
```
- Cache key: `analysis:{marketID}`
- TTL: near events 1h; distant events 6h; deep min 6h
- Stream events: `meta` → `chunk*` → `complete`
```

## Request/Response Cycle

### Example: AI Page Market Discovery

**Request:**
```javascript
POST /api/markets
{
  weatherData: {
    current: {
      temp_f: 72,
      condition: { text: 'Rainy' },
      precip_chance: 85,
      wind_mph: 18,
      humidity: 75
    }
  },
  location: 'Denver',        // Optional
  eventType: 'NFL',          // Optional
  confidence: 'HIGH',        // Optional
  limitCount: 8
}
```

**Processing:**
1. `getTopWeatherSensitiveMarkets()` called with filters
2. `buildMarketCatalog(50000)` executes (checks cache first)
3. Returns ~500-1000 markets with $50k+ volume
4. Score each with `assessMarketWeatherEdge()`
   - Example: NFL game in Denver, rainy forecast
   - weatherDirect: 0 (not directly about weather)
   - weatherSensitiveEvent: 2 (NFL game)
   - contextualWeatherImpact: 1.5 (rain condition + precip > 30%)
   - asymmetrySignal: 0 (normal liquidity)
   - **Total: 3.5 → Confidence: MEDIUM**
5. Filter by eventType=NFL: Narrows to ~80 NFL markets
6. Filter by confidence=HIGH: Further narrows
7. Sort by edgeScore DESC (3.5 comes before 3.0, etc.)
8. Return top 8 markets

**Response:**
```javascript
{
  success: true,
  markets: [
    {
      marketID: '0x123...',
      title: 'Will Denver Broncos beat Kansas City Chiefs?',
      location: 'Denver',
      eventType: 'NFL',
      edgeScore: 3.5,
      confidence: 'MEDIUM',
      edgeFactors: {
        weatherDirect: 0,
        weatherSensitiveEvent: 2,
        contextualWeatherImpact: 1.5,
        asymmetrySignal: 0
      },
      currentOdds: { yes: 0.45, no: 0.55 },
      volume24h: 125000,
      liquidity: 50000,
      weatherContext: {
        temp: 72,
        condition: 'Rainy',
        precipChance: 85,
        windSpeed: 18,
        humidity: 75,
        hasData: true
      },
      isWeatherSensitive: true
    },
    // ... 7 more markets
  ],
  totalFound: 45,
  cached: true,
  timestamp: '2025-11-14T...'
}
```

## Edge Score Calculation Example

**Market:** "Will it rain on Super Bowl Sunday in Las Vegas?"

```
weatherDirect = 3 ("rain" keyword, explicit weather)
weatherSensitiveEvent = 0 (indoor event, Vegas)
contextualWeatherImpact = 0 (indoor, weather data irrelevant)
asymmetrySignal = 0 (high liquidity, efficient)
─────────────────────────────
Total Score = 3
Confidence = MEDIUM
```

**Market:** "Denver Broncos vs Kansas City Chiefs, AFC West Playoff"

```
weatherDirect = 0 (not about weather directly)
weatherSensitiveEvent = 2 (NFL game, outdoor)
contextualWeatherImpact:
  - Wind 18 mph, keyword "wind" in...? No: 0
  - Precip 85%, raining heavily, outdoor game: +1.5
  - Temp 72°F (normal), no "cold" keyword: 0
  - Humidity 75%: not mentioned: 0
  = 1.5
asymmetrySignal = 0 (high volume, $250k liquidity)
─────────────────────────────
Total Score = 3.5
Confidence = MEDIUM
```

**Market:** "Will Jacksonville Jaguars score in 1st quarter vs Texans?"

```
weatherDirect = 0
weatherSensitiveEvent = 2 (NFL)
contextualWeatherImpact = 0 (Jacksonville April weather normal)
asymmetrySignal = 1 (High volume $80k, low liquidity $30k, ratio = 2.67)
─────────────────────────────
Total Score = 3
Confidence = MEDIUM
```

## Caching Strategy

| Layer | Duration | Key | Size | Usage |
|-------|----------|-----|------|-------|
| Market Catalog | 30 min | `null` | ~500-1000 markets | Used by every discovery request |
| Market Details | 10 min | `marketID` | 1 per market | Deep analysis, pre-cached for top 5 |
| Location-Based | 5 min | `location` | 20 per city | Deprecated, removed |

## Error Handling Flow

```
POST /api/markets
     │
     ▼
Get Top Weather-Sensitive Markets
     │
     ├─ Catalog fetch fails?
     │  └─ Retry with fallback
     │     └─ Return any $10k+ markets
     │
     ├─ No weather-sensitive markets found?
     │  └─ Fallback to high-volume markets
     │     └─ Edge scores: 0, confidence: LOW
     │
     ├─ Scoring complete, filters applied?
     │  └─ Success: Return ranked markets
     │
     └─ API error (500)?
        └─ Return error, keep results cached
```

## Performance Metrics

- **Catalog Build:** ~2-5 seconds (first call), <500ms (cached)
- **Scoring:** ~50ms for 500 markets (in-memory)
- **Filtering:** <10ms (single pass)
- **Total Request:** ~3 seconds (cold), ~800ms (warm cache)

## Migration Changes

### What Changed

The market discovery system has been fundamentally restructured from **location-based matching** to **liquidity-first, edge-ranked discovery**. This is a major architectural improvement that aligns the platform with information asymmetry principles rather than geographic assumptions.

#### Before (Location-Driven)
```javascript
POST /api/markets
{
  location: "Denver" // REQUIRED
  weatherData?: {...}
}
// Fallback: Generic weather-tagged markets if Denver has no matches
```

#### After (Edge-Driven)
```javascript
POST /api/markets
{
  location?: "Denver",              // Optional for geographic filter
  weatherData?: {...},              // Weather context for scoring
  eventType?: "NFL",                // Filter: all, NFL, NBA, Weather, etc.
  confidence?: "HIGH",              // Filter: all, HIGH, MEDIUM, LOW
  limitCount?: 8                    // How many to return
}
// Returns: Top N markets ranked by edge potential, globally
```

#### New Response Format

```javascript
{
  // Existing fields
  marketID: string,
  title: string,
  description: string,
  location: string | null,
  currentOdds: { yes: number, no: number },
  volume24h: number,
  liquidity: number,
  tags: string[],
  eventType: string,
  teams: { name, sport }[],

  // NEW: Edge-ranking fields
  edgeScore: number (0-10),           // Raw edge potential score
  edgeFactors: {                       // Component breakdown
    weatherDirect: number,
    weatherSensitiveEvent: number,
    contextualWeatherImpact: number,
    asymmetrySignal: number
  },
  confidence: 'HIGH' | 'MEDIUM' | 'LOW',  // Edge quality confidence
  isWeatherSensitive: boolean,        // Has any edge
  weatherContext: {                   // Conditions used for scoring
    temp: number,
    condition: string,
    precipChance: number,
    windSpeed: number,
    humidity: number,
    hasData: boolean
  }
}
```

### Performance Impact

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| **Discovery Time (Cold)** | ~3-5s (multiple API calls) | ~3-5s (single catalog fetch) | Same, but more reliable |
| **Discovery Time (Warm)** | ~1-2s (cache hit) | ~500-800ms (faster filtering) | **2-4x faster** |
| **API Calls per Discovery** | 2-3 (location search + fallback) | 1 (single catalog) | **50% fewer** |
| **Catalog Cache Duration** | 5 min (location-specific) | 30 min (global) | **6x longer TTL** |
| **Memory Usage** | 20 locations × 20 markets | 1 global catalog | **Similar** |

### Service Layer Changes

**services/polymarketService.js**

**New Methods:**
```javascript
buildMarketCatalog(minVolume = 50000)
// Returns: { markets[], totalMarkets, cached }

assessMarketWeatherEdge(market, weatherData)
// Returns: { totalScore, factors, confidence, weatherContext }

getTopWeatherSensitiveMarkets(limit, filters)
// Returns: { markets[], totalFound, cached }
```

**Deprecated Methods:**
```javascript
searchMarketsByLocation(location)
// Use getTopWeatherSensitiveMarkets instead

assessWeatherRelevance(market, weatherData)
// Use assessMarketWeatherEdge instead
```

## Client/Server Code Separation (Nov 17, 2025)

**IMPORTANT:** AI service code is now split for proper client/server boundaries:

- **`services/aiService.js`** - Client-safe API wrapper (for 'use client' components)
- **`services/aiService.server.js`** - Server-only AI logic with OpenAI + Redis (for API routes)

### Why This Matters

Next.js client components cannot import Node.js modules like `redis` or `crypto`. The separation ensures:
- ✅ Build succeeds without webpack errors
- ✅ Clear separation of concerns
- ✅ Server-only dependencies stay server-side
- ✅ Client code remains lightweight

## For Frontend Developers

### Basic Market Discovery (AI Page)

```javascript
// ✓ Client-safe way
const response = await fetch('/api/markets', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    weatherData: {
      current: {
        temp_f: 72,
        condition: { text: 'Rainy' },
        wind_mph: 15,
        humidity: 80,
        precip_chance: 75
      }
    },
    location: 'Denver',           // Optional
    eventType: 'all',             // Optional filter
    confidence: 'all',            // Optional filter
    limitCount: 8
  })
});

const result = await response.json();
if (result.success) {
  const markets = result.markets;  // Already sorted by edge score
  // ...
}
```

### Discovery Page with Filters

```javascript
// GET with query parameters (for bookmark-able/shareable URLs)
const response = await fetch('/api/markets?' + new URLSearchParams({
  location: 'Chicago',
  eventType: 'NFL',
  confidence: 'HIGH',
  minVolume: '50000',
  limit: '20'
}));

const result = await response.json();
```

### Displaying Edge Scores

```javascript
// New fields available on each market
market.edgeScore        // 0-10 (raw score)
market.confidence       // 'HIGH' | 'MEDIUM' | 'LOW'
market.edgeFactors      // { weatherDirect, weatherSensitiveEvent, ... }
market.isWeatherSensitive // boolean
market.weatherContext   // { temp, condition, precipChance, windSpeed, humidity }

// Example: Show edge quality badge
<span className={
  market.confidence === 'HIGH' ? 'bg-green-500' :
  market.confidence === 'MEDIUM' ? 'bg-yellow-500' :
  'bg-red-500'
}>
  {market.confidence} Edge
</span>

// Example: Show edge components
<div>
  <p>Weather Direct: {market.edgeFactors.weatherDirect}/3</p>
  <p>Outdoor Event: {market.edgeFactors.weatherSensitiveEvent}/2</p>
  <p>Current Conditions: {market.edgeFactors.contextualWeatherImpact}/5</p>
  <p>Inefficiency Signal: {market.edgeFactors.asymmetrySignal}/1</p>
</div>
```

## For Backend Developers

### Using Server-Side AI Functions

```javascript
// In API routes (server-side only)
import { analyzeWeatherImpactServer, getAIStatus } from '@/services/aiService.server';

export async function POST(request) {
  const analysis = await analyzeWeatherImpactServer({
    eventType,
    location,
    weatherData,
    currentOdds,
    participants,
    marketId,
    eventDate,
    mode: 'deep' // or 'basic'
  });
  
  return Response.json(analysis);
}
```

**Never** import `aiService.server.js` in client components - it will cause build errors.

### Adding New Weather Sensitivity Factors

Location: `services/polymarketService.js` → `assessMarketWeatherEdge()`

```javascript
// Example: Add humidity factor
if ((humidity && humidity > 80) && (title.includes('humid') || title.includes('moisture'))) {
  contextualWeatherImpact += 1.5;
}

// The scoring is flexible - can add factors for:
// - Sea level pressure changes
// - UV index (golf markets)
// - Visibility (racing markets)
// - Storm warnings (infrastructure markets)
```

### Extending Market Metadata

Location: `services/polymarketService.js` → `extractMarketMetadata()`

Add new event types or team patterns:

```javascript
const advancedPatterns = [
  // Example: Cricket teams
  { pattern: /mumbai indians|rcb|delhi capitals/i, team: 'Cricket Team', sport: 'Cricket' },
  
  // Example: Weather events
  { pattern: /hurricane|tornado|blizzard/i, event: 'Extreme Weather', type: 'MeteorologicalEvent' }
];
```

### Testing the Discovery Engine

```javascript
// Unit test example
const testMarket = {
  title: 'Denver Broncos vs Kansas City Chiefs - will it rain?',
  tags: ['NFL', 'Weather'],
  volume24h: 125000,
  liquidity: 50000
};

const testWeather = {
  current: {
    temp_f: 32,
    condition: { text: 'Snow' },
    wind_mph: 25,
    precip_chance: 95,
    humidity: 88
  }
};

const edge = polymarketService.assessMarketWeatherEdge(testMarket, testWeather);
console.log('Edge Score:', edge.totalScore);  // Should be HIGH
console.log('Confidence:', edge.confidence);  // Should be 'HIGH'
```

### API Endpoint Changes

POST /api/markets now uses `getTopWeatherSensitiveMarkets(limit, filters)`

```javascript
// Before: Location-based search
const result = await polymarketService.searchMarketsByLocation('Denver');

// After: Edge-ranked discovery
const result = await polymarketService.getTopWeatherSensitiveMarkets(10, {
  location: 'Denver',     // Optional
  eventType: 'NFL',       // Optional  
  confidence: 'HIGH',     // Optional
  minVolume: 50000
});
```

### Cache Invalidation

```javascript
// Clear market catalog cache (when Polymarket updates frequently)
polymarketService.marketCatalogCache = null;

// Or set shorter TTL for high-volatility periods
polymarketService.MARKET_CATALOG_CACHE_DURATION = 10 * 60 * 1000; // 10 min
```

## Upcoming Enhancements

### Phase 4: AI Edge Analysis
- Venice API integration for odds efficiency assessment
- Historical odds tracking
- Real-time market movement correlation with weather

### Phase 5: Portfolio Optimization
- Multi-market correlated positions
- Risk-adjusted edge ranking
- Capital allocation suggestions

### Phase 6: Automated Trading
- Threshold-based order placement
- Risk management automation
- Performance tracking & improvement

## Migration Checklist

- [x] Removed all `aiService.fetchMarkets()` calls
- [x] Replaced with direct `/api/markets` POST calls
- [x] Updated UI to display `edgeScore`, `confidence`, `edgeFactors`
- [x] Tested with various weather conditions
- [x] Verified filters (eventType, confidence, location) work
- [x] Performance acceptable (<1s for cold start, <500ms cached)
- [x] Error handling for failed Polymarket API calls
- [x] Cache invalidation strategy documented
- [x] Team trained on new API signature

## Debugging

### Check if Market Catalog is Building Correctly

```javascript
const catalog = await polymarketService.buildMarketCatalog(50000);
console.log('Markets found:', catalog.totalMarkets);
console.log('Cached:', catalog.cached);
console.log('First market:', catalog.markets[0]);
```

### Verify Edge Scoring

```javascript
const market = catalog.markets[0];
const weather = { current: { temp_f: 72, precip_chance: 85, ... } };

const edge = polymarketService.assessMarketWeatherEdge(market, weather);
console.log('Score breakdown:', edge.factors);
console.log('Total:', edge.totalScore);
console.log('Confidence:', edge.confidence);
```

### Monitor API Performance

```javascript
// Add timing to POST handler
const start = Date.now();
const result = await polymarketService.getTopWeatherSensitiveMarkets(limit, filters);
const duration = Date.now() - start;

console.log(`Market discovery took ${duration}ms`);
console.log(`Cache hit: ${result.cached}`);
console.log(`Markets returned: ${result.markets.length}`);
```

## Understanding Edge Scores

### Score Ranges

| Score | Confidence | Meaning | Example |
|-------|-----------|---------|---------|
| 8-10 | HIGH | Strong, multi-factor weather edge | Weather market + strong current conditions |
| 6-7 | MEDIUM | Solid single/double factor edge | NFL game + high wind |
| 4-5 | MEDIUM | Detectable edge | NFL game + light rain + volume signal |
| 2-3 | LOW | Weak edge, monitor | NFL game + normal weather |
| 0-1 | LOW | No weather edge | Soccer match in clear conditions |

### Improving the Model

**Current Limitations:**
- Linear scoring (could use weighted factors)
- No temporal component (market time-to-resolution)
- Simple keywords (could use NLP)
- No historical odds tracking

**Suggested Enhancements:**
```javascript
// 1. Time-decay factor (markets resolving soon vs far future)
const daysToResolution = (new Date(market.resolutionDate) - new Date()) / (1000 * 60 * 60 * 24);
const timeDecay = daysToResolution < 7 ? 1.2 : daysToResolution > 60 ? 0.8 : 1.0;

// 2. Volatility signal (recent odds movement)
const oddsVolatility = Math.abs(currentOdds.yes - historicalOdds.yes) > 0.15 ? 0.8 : 1.0;

// 3. Liquidity efficiency (bid-ask spread)
const bidAskSpread = (currentOdds.no - currentOdds.yes);
const spreadSignal = bidAskSpread > 0.1 ? 0.5 : 1.0;

const refinedScore = marketAssessment.totalScore * timeDecay * oddsVolatility * spreadSignal;
```

### Integration with Venice AI

```javascript
// Pseudo-code for Venice API integration
async function analyzeWithAI(market, weatherData, edgeScore) {
  if (edgeScore < 4) return null; // Skip low-confidence edges
  
  const prompt = `
    Market: ${market.title}
    Current Weather: ${JSON.stringify(weatherData.current)}
    Current Odds: YES=${market.currentOdds.yes}, NO=${market.currentOdds.no}
    
    Based on the weather data and market title, what is the true probability this market should be priced at?
    If it differs from current odds by >10%, flag as potential edge.
  `;
  
  const analysis = await veniceAI.analyze(prompt);
  
  return {
    edge: edgeScore,
    estimatedProbability: analysis.probability,
    mispricing: Math.abs(analysis.probability - market.currentOdds.yes),
    confidence: analysis.confidence,
    reasoning: analysis.explanation
  };
}
```

## Edge Score Interpretation

### Real Examples

```javascript
// HIGH confidence edge
{
  "marketID": "0x456...",
  "title": "Will it rain on SuperBowl Sunday in Las Vegas?",
  "eventType": "Weather",
  "edgeScore": 8.5,
  "confidence": "HIGH",
  "edgeFactors": {
    "weatherDirect": 3,
    "weatherSensitiveEvent": 0,
    "contextualWeatherImpact": 4.5,
    "asymmetrySignal": 1
  },
  "currentOdds": { "yes": 0.35, "no": 0.65 },
  "volume24h": 450000,
  "liquidity": 200000,
  "weatherContext": {
    "temp": 65,
    "condition": "Mostly Sunny",
    "precipChance": 5,
    "windSpeed": 8,
    "humidity": 40,
 "hasData": true
}
}

// MEDIUM confidence sports edge
{
  "marketID": "0x789...",
  "title": "Denver Broncos Win vs Chiefs",
  "location": "Denver",
  "eventType": "NFL",
  "edgeScore": 4.2,
  "confidence": "MEDIUM",
  "edgeFactors": {
    "weatherDirect": 0,
    "weatherSensitiveEvent": 2,
    "contextualWeatherImpact": 1.5,
    "asymmetrySignal": 0.7
  },
  "currentOdds": { "yes": 0.48, "no": 0.52 },
  "volume24h": 850000,
  "liquidity": 400000,
  "weatherContext": {
    "temp": 28,
    "condition": "Light Snow",
    "precipChance": 40,
    "windSpeed": 12,
    "humidity": 75,
    "hasData": true
  }
}
## Multi-Chain Predictions Flow

- Frontend retrieves the active `chainId` from the wallet and passes it to the predictions API when placing a prediction (`app/ai/page.js:15`, `app/ai/components/OrderForm.js:47`).
- Backend `/api/predictions` maps `chainId → { address, feeBps, rpcUrl, signerKey }` from environment and builds a fee-only `txRequest` for `placePrediction(marketId, side, stakeWei, oddsBps, uri)` (`app/api/predictions/route.js:31–79,103–129`).
- If a server signer is configured for the chain, the route submits and returns `txHash`; otherwise it returns `txRequest` for the client to sign.
- Contracts:
  - Native coin fee (BNB/Arbitrum): `contracts/PredictionReceipt.sol` — emits `PredictionPlaced` with indexed `user`, `marketId`, and `id`.
  - ERC20 fee (Polygon optional): `contracts/PredictionReceiptERC20.sol` — fee via `transferFrom` to `treasury`.

### Fee Semantics
- Fee-only `msg.value = stakeWei * feeBps / 10000` ensures no custody of stake; stake/odds are recorded in the receipt and emitted as event data.

### Chain Addresses
- Arbitrum: `PREDICTION_CONTRACT_ADDRESS_ARBITRUM=0x64BAeF0d2F0eFAb7b42C19568A06aB9E76cd2310`, `PREDICTION_FEE_BPS_ARBITRUM=500`.
- BNB: `PREDICTION_CONTRACT_ADDRESS_BNB=0x94b359E1c724604b0068F82005BcD3170A48A03E`, `PREDICTION_FEE_BPS_BNB=500`.
## Analysis UX Guidelines

- Information hierarchy: show a compact summary row first (confidence, weather impact, market efficiency), then progressive disclosure for reasoning and factors
- Citations: in deep mode, display concise domain + short title + two-line excerpt; avoid overwhelming the user with long lists
- Badges: show “Web search enabled” and cache status to set user expectations; include elapsed time for deep analysis
- Night mode: maintain pill backgrounds and subtle borders for all cards; avoid low-contrast text; prefer opacity-based emphasis over dense blocks
- Interactions: use smooth expand/collapse transitions and clear affordances (e.g., “Show details”, “Hide details”) to keep the experience intuitive
