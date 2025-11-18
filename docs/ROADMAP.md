# Product Roadmap: /ai vs /discovery Differentiation

**Last Updated:** November 2024  
**Status:** In Planning → In Progress

---

## Problem Statement

Currently, `/ai` and `/discovery` pages are functionally identical:
- Both fetch weather for **user location** (geolocation)
- Both pass that to the same `/api/markets` endpoint
- Both show the same markets + analysis
- `/ai` shows empty results when user location weather doesn't match market keywords

**Root cause:** The product model is backwards. For sports events, the event *location* is relevant, not the user's location.

---

## Vision

### `/ai` Page: "Event Weather Analysis"
Analyze upcoming **sports/event markets** to find edges where **venue weather** creates mispricings.

**User Journey:**
- Browse upcoming sports events (NFL, NBA, Soccer, etc.)
- See weather forecast at the **game location**
- Understand how weather impacts odds
- Find weather-driven trading edges

**Success Metric:** Users see 5-10 relevant events per session (vs. empty page today).

### `/discovery` Page: "Global Market Discovery"
Browse **all prediction markets** globally. Optionally filter by category/volume. Deep-dive analysis on any market.

**User Journey:**
- Search for markets by name, category, or keywords
- Filter by volume, timeframe, category
- Click to analyze any market (weather context is secondary)
- Find all types of edges (not just weather)

**Success Metric:** High-volume markets always visible, quick access to analysis.

---

## Detailed Design

### `/ai` Page Requirements

**Data Architecture:**
- Source: Polymarket sports events only
- Event metadata: `eventType`, `teams`, `eventLocation` (parsed from title/description)
- Weather: Fetch for **event location**, not user location
- Scoring: Weather at venue + current odds → edge score

**UI Components:**
- Header: "Event Weather Analysis" + "Analyzing [Sports Season]"
- Market cards show:
  - Event name + teams
  - **Venue location** (e.g., "Arrowhead Stadium, Kansas City, MO")
  - Game day forecast (temp, precipitation, wind, humidity)
  - How weather impacts this team/sport
  - Edge score + confidence
- Filters:
  - Sport type (NFL, NBA, Soccer, etc.)
  - Team name
  - Venue region (optional: USA, Europe, etc.)
  - Days to event (7d, 14d, 30d)
  - Confidence level (HIGH, MEDIUM, LOW)
- Search: By team name, venue city, or event keywords

**API Changes:**
- `/api/markets` POST body:
  - `eventType: 'Sports'` (hard-coded for /ai)
  - `location: null` (don't use user location)
  - `analysisType: 'event-weather'` (new parameter to tell backend: fetch event weather, not user weather)
  - Other filters: `confidence`, `minVolume`, `maxDaysToResolution`

**Backend Logic:**
- In `polymarketService.getTopWeatherSensitiveMarkets()`:
  - If `analysisType === 'event-weather'`:
    - Extract event venue from market metadata
    - Call `weatherService.getCurrentWeather(eventVenue)` for each market
    - Use event weather for `assessMarketWeatherEdge()`
  - Score by: event weather relevance + odds mismatch + volume
  - Return sports markets only, ranked by edge score

---

### `/discovery` Page Requirements

**Data Architecture:**
- Source: All Polymarket categories globally
- Event metadata: Not required (works on any market)
- Weather: User location only (for UI theming, not analysis)
- Scoring: Volume, liquidity, volatility (weather is optional edge signal)

**UI Components:**
- Header: "Market Discovery" + stats (total markets, trending)
- Market cards show:
  - Market title
  - Category badge
  - 24h volume + volume trend
  - Liquidity
  - Edge score (if weather edge exists, show it; otherwise show neutral)
- Filters:
  - Category dropdown (Sports, Politics, Crypto, Finance, etc.)
  - Minimum volume ($10k, $50k, $100k+)
  - Search by keywords
- Search: Free-form (team names, keywords, market titles)
- Analysis: Works on any market type (weather + general market factors)

**API Changes:**
- `/api/markets` POST body:
  - `eventType: 'all'` (default)
  - `location: null` (user location not used)
  - `analysisType: 'discovery'` (or omit, use as default)
  - Other filters: `confidence`, `minVolume`, `category`, `searchText`

**Backend Logic:**
- In `polymarketService.getTopWeatherSensitiveMarkets()`:
  - If `analysisType === 'discovery'` or not specified:
    - Ignore user weather
    - Score by: volume, liquidity, volatility, market efficiency
    - Return all markets, ranked by volume/liquidity (not weather)
  - Weather edge is computed but is secondary ranking signal
  - Return top markets regardless of weather sensitivity

---

## Implementation Phases

### Phase 1: Backend Refactoring (Days 1-2)

**Goal:** Enable event weather fetching and location-agnostic discovery.

**Files to Modify:**
1. **`services/polymarketService.js`**
   - Update `getTopWeatherSensitiveMarkets()` signature to accept `analysisType` param
   - Add logic:
     ```javascript
     if (analysisType === 'event-weather') {
       // For /ai: Fetch weather at event location
       const eventLocation = extractVenueFromMarket(market);
       const eventWeather = await weatherService.getCurrentWeather(eventLocation);
       edgeScore = assessMarketWeatherEdge(market, eventWeather);
     } else {
       // For /discovery: Use volume/liquidity scoring
       edgeScore = assessMarketEfficiency(market);
     }
     ```
   - Add helper: `extractVenueFromMarket(market)` to pull venue from title/teams/parsed data
   - Modify `assessMarketWeatherEdge()` to accept event weather (not just user weather)

2. **`app/api/markets/route.js`**
   - Accept `analysisType` parameter from client
   - Pass to `polymarketService.getTopWeatherSensitiveMarkets(limit, { ...filters, analysisType })`
   - No other logic changes needed

**Testing:**
- Verify `/api/markets` with `analysisType: 'event-weather'` returns sports markets with venue weather
- Verify `/api/markets` with `analysisType: 'discovery'` returns all markets, ranked by volume

---

### Phase 2: `/ai` Page Refactor (Days 2-3)

**Goal:** Convert /ai from user-location-based to event-location-based.

**Files to Modify:**
1. **`app/ai/page.js`**
   - Remove: User location geolocation step (lines 168-171)
   - Remove: `currentLocation` state
   - Add: Pass `analysisType: 'event-weather'` to `/api/markets` API call (line 195-210)
   - Update header:
     - Remove: "Weather Edge Analysis" + "in {currentLocation}"
     - Add: "Event Weather Analysis"
   - Update market card display:
     - Show `market.eventLocation` or extracted venue
     - Show event weather forecast (from analysis response)
   - Update filters:
     - Change "Search Markets" to "Search Events"
     - Add sport type filter: Football, Basketball, Soccer, etc.
     - Optional: Venue region filter (USA, Europe, etc.)
     - Keep: Confidence, Volume, Days to resolution
   - Remove: "Futures" toggle (focus on sports events only)

2. **`app/ai/components/` (if needed)**
   - May need to tweak market selector to display venue + event weather
   - Otherwise components can stay as-is

**Testing:**
- Navigate to /ai
- Verify: No geolocation prompt, no "Weather at your location" message
- Verify: Markets show venue location + game-day weather
- Verify: Search by team name works
- Verify: Filters (sport type, confidence) work

---

### Phase 3: `/discovery` Page Simplification (Days 3-4)

**Goal:** Position discovery as general market browser, not weather-focused.

**Files to Modify:**
1. **`app/discovery/page.js`**
   - Remove: User weather loading (lines 43-79) or keep only for UI theming
   - Update header:
     - Change: "Weather-Sensitive Edges" to "Market Discovery"
     - Update subtitle: "Browse prediction markets globally"
   - Remove from API call: `weatherData` parameter (line 177-178)
   - Add: `analysisType: 'discovery'` to API call
   - Update market cards:
     - Focus on: Market title, category, volume, liquidity
     - De-emphasize: Edge score (show if present, but not primary)
   - Keep filters: Category, Volume, Search
   - Remove: Location-based search (change "Search by location" to "Search markets")
   - Keep analysis: Same analysis flow works for all markets

2. **No backend changes needed** — already handles this

**Testing:**
- Navigate to /discovery
- Verify: Markets load regardless of user location
- Verify: Search is free-form (works on any keyword)
- Verify: Category/volume filters work
- Verify: Analysis still works on any market
- Verify: No empty states (plenty of markets always shown)

---

### Phase 4: Venue Extraction & Weather Service (Days 4-5)

**Goal:** Reliably extract event venues and fetch weather for them.

**Files to Create/Modify:**
1. **`services/venueExtractor.js`** (NEW)
   ```javascript
   export class VenueExtractor {
     static extractFromMarket(market) {
       // Try multiple sources in order:
       // 1. market.eventLocation (if populated)
       // 2. Parse from market.title (e.g., "NFL @ Miami" → Miami)
       // 3. Use market.teams with team-city mapping
       // 4. Default to null
       return venue;
     }
   }
   ```

2. **`services/polymarketService.js`**
   - Update `buildMarketCatalog()` to populate `market.eventLocation` during parsing
   - Reference existing code at lines 1129-1303 for team/event extraction

3. **`services/weatherService.js`**
   - Verify caching is robust (don't re-fetch same location repeatedly)
   - Consider rate limiting for multiple concurrent requests

**Testing:**
- Verify venue extraction works for 10 sample markets
- Verify weather fetches correctly for extracted venues
- Verify caching prevents redundant API calls

---

### Phase 5: UI Polish & Copywriting (Days 5-6)

**Goal:** Make value propositions crystal clear.

**Changes:**
1. `/ai` page:
   - Add explanation: "Analyzing weather forecasts at upcoming event venues to find trading opportunities"
   - Cards show: "Game in [Venue], Weather: [Details], Your Edge: [Explanation]"
   - Button text: "Analyze This Match" (not generic "Analyze")

2. `/discovery` page:
   - Add explanation: "Discover high-volume prediction markets across all categories. Deep-dive with AI analysis."
   - Cards focus on: "This market has [volume/liquidity/trend]. Get AI insights."

3. Navigation:
   - PageNav clearly labels: "AI Weather Analysis" vs "Market Discovery"

4. Help/Onboarding:
   - /ai: "How It Works" → "Analyze event venues for weather-driven edges"
   - /discovery: "How It Works" → "Find markets, deep-dive with AI, trade with confidence"

---

## Success Metrics

### /ai Page
- **No empty states** in normal conditions (>5 markets always shown)
- **Venue accuracy** (>90% of cards show correct event location)
- **Click-through** to analysis (>40% of market selections lead to analysis)
- **User feedback** ("Finally can see weather for the actual game!")

### /discovery Page
- **Always populated** (never empty, hundreds of markets available)
- **Search quality** (>80% of search results match user intent)
- **Analysis speed** (standard analysis <10s, deep analysis <30s)
- **Cross-page traffic** (users navigate between /ai and /discovery intentionally)

---

## Rollback Plan

If any phase introduces bugs:
1. **Phase 1 (Backend):** Rollback polymarketService changes, revert to location-agnostic discovery
2. **Phase 2 (/ai):** Revert to old page, keep backend changes
3. **Phase 3 (/discovery):** Already backward-compatible, no harm in changes
4. **Phase 4 (Venue):** Graceful degradation if extraction fails (fall back to null location)
5. **Phase 5 (UI):** Pure cosmetic, always safe to undo

---

## Related Issues

- **Weather API rate limiting:** Monitor calls during Phase 4 (venue extraction = multiple weather calls)
- **Market metadata quality:** Some markets may not have venue data—handle gracefully
- **Team-to-city mapping:** `/ai` may need a reference table for sports teams if venue extraction fails

---

## Next Steps

1. Review this roadmap with team
2. Proceed to Phase 1: Backend refactoring
3. Test each phase before moving to next
4. Deploy to staging before production
