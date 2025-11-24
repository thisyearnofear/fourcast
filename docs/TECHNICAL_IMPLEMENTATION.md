# Implementation Guide - Fourcast Key Fixes & Validations

## Venice AI Integration Fixes

### Problem
The application was experiencing `400 status code (no body)` errors when users clicked "Analyze" on sports betting markets. The Venice AI API was completely non-functional.

### Root Causes & Solutions

#### 1. Unsupported `response_format` Parameter ❌
```
response_format: { type: "json_object" }
```
Venice AI doesn't support this OpenAI parameter.

**Solution:** Remove the parameter and use prompt engineering instead

#### 2. Wrong `enable_web_search` Type ❌
```
venice_parameters: {
  enable_web_search: true // Boolean causes 400 error
}
```
Venice requires string `"auto"`, not boolean `true`.

**Solution:** Use string value
```
venice_parameters: {
  enable_web_search: "auto" // String "auto", not boolean true
}
```

#### 3. Invalid Parameters ❌
```
venice_parameters: {
  enable_web_search: "auto",
  include_venice_system_prompt: true, // Doesn't exist
  strip_thinking_response: true // Doesn't exist
}
```
These parameters don't exist in Venice API.

**Solution:** Only use valid parameters
```
venice_parameters: {
  enable_web_search: "auto" // Only this is valid
}
```

#### 4. Wrong Model Choice ❌
```
model: "qwen3-235b" // Outputs thinking tags that break JSON parsing
```
`qwen3-235b` outputs thinking tags that break JSON parsing.

**Solution:** Use `llama-3.3-70b` for clean JSON output
```
model: "llama-3.3-70b" // Clean JSON output
```

### Applied Fixes

#### Fixed API Parameters
```
// File: services/aiService.server.js

const veniceParams = {};
if (webSearch) {
  veniceParams.enable_web_search = "auto"; // String, not boolean
}

const response = await client.chat.completions.create({
  model: "llama-3.3-70b", // Clean JSON output
  messages,
  temperature: 0.3,
  max_tokens: 1000,
  // Removed response_format
  venice_parameters: Object.keys(veniceParams).length > 0 ? veniceParams : undefined,
});
```

#### Enhanced JSON Parsing
```
// Handle markdown code blocks and thinking tags
let content = response.choices[0].message.content.trim();

if (content.startsWith('```')) {
  content = content.replace(/```json\n?|\n?```/g, '').trim();
}

const jsonMatch = content.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  content = jsonMatch[0];
}

const parsed = JSON.parse(content);
```

#### Updated System Prompts
```
content: `You are an expert sports betting analyst...

STRICT REQUIREMENTS:
- You MUST respond with ONLY a valid JSON object, no other text before or after
- Do NOT wrap the JSON in markdown code blocks
- Output a single JSON object with the required fields only`
```

## Files Modified

1. **`services/aiService.server.js`**
   - Fixed `callVeniceAI()` function
   - Fixed `verifyEventLocation()` function
   - Fixed `extractEventMetadataViaVenice()` function
   - Updated `getAIStatus()` to reflect correct model

## Test Scripts Created

1. **`scripts/test-venice-api.js`** - Basic API connectivity
2. **`scripts/test-venice-params.js`** - Parameter validation
3. **`scripts/test-venice-models.js`** - Model comparison
4. **`scripts/test-fixed-venice.js`** - Full integration test
5. **`scripts/test-production-flow.js`** - End-to-end production test

## Test Results

### Before Fixes
```
❌ 400 status code (no body)
❌ No AI analysis available
❌ Users see error messages
```

### After Fixes
```
✅ Venice AI integration test PASSED!
✅ All required keys present
✅ Key factors is valid array
✅ Analysis has meaningful content

Example Output:
{
  "weather_impact": "LOW",
  "odds_efficiency": "FAIR",
  "confidence": "MEDIUM",
  "analysis": "The weather conditions for the match...",
  "key_factors": [
    "Current form of both teams",
    "Head-to-head statistics",
    "Home advantage for Randers FC"
  ],
  "recommended_action": "Bet on Randers FC to win"
}
```

## Validation Framework

### Core Principles
- **User-Centric Validation**: Actionable feedback with real-time guidance
- **Performance-First Design**: Smart caching and debounced validation
- **Extensible Architecture**: Modular validators and reusable components

### Validation Hierarchy
```
┌─────────────────────────────────────┐
│       Validation Orchestrator       │
├─────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  │
│  │  Location   │  │   Weather   │  │
│  │ Validator   │  │  Validator  │  │
│  └─────────────┘  └─────────────┘  │
│  ┌─────────────┐  ┌─────────────┐  │
│  │   Market    │  │   Trading   │  │
│  │ Validator   │  │  Validator  │  │
│  └─────────────┘  └─────────────┘  │
└─────────────────────────────────────┘
```

### Performance Optimizations
- **Smart Caching**: 5-minute cache for location, 3-minute for weather, 30-second for orders
- **Debounced Validation**: 200ms for orders, 300ms for analysis, 500ms for location
- **Request Cancellation**: Automatic cleanup of outdated validation requests

## Venue Extraction System

### Purpose
Extract event venue locations from sports markets to enable `/ai` page event-weather analysis.

### Venue Extraction Methods
1. **Team-to-City Mapping**: ~65% success rate for major sports teams
2. **Title Pattern Matching**: ~40% success for "@ City" or "in City" patterns
3. **Stadium Name Mapping**: Dedicated stadium-to-city mapping for common venues
4. **Description Parsing**: ~10% success rate for venue info in descriptions

### Current Status
- **✅ SUCCESS:** 22% - Clear venue extraction (e.g., "Kansas City, MO")
- **⚠️ PARTIAL:** 53.5% - Extracted but uncertain (e.g., "At Arrowhead", "Tampa, FL")
- **❌ FAILED:** 24.2% - No venue found (non-location-specific markets)

### Integration with Market Analysis
```
// In polymarketService.js - Event Weather Mode
if (analysisType === 'event-weather') {
  const eventLocation = VenueExtractor.extractFromMarket(market);
  const eventWeather = await weatherService.getCurrentWeather(eventLocation);
  edgeScore = assessMarketWeatherEdge(market, eventWeather);
  return { eventLocation, eventWeather, edgeScore };
}
```

### Stadium Mapping Coverage
- **NFL Stadiums**: Arrowhead, Lambeau Field, Sofi, Nissan, AT&T, etc.
- **NBA/NHL Stadiums**: Chase Center, Staples Center, Madison Square Garden, etc.
- **International**: Anfield, Emirates Stadium, Old Trafford, etc.

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

## Testing Checklist

### Pre-Testing Setup

- [ ] Verify `VENICE_API_KEY` is set in `.env.local`
  ```bash
  grep VENICE_API_KEY .env.local
  ```

- [ ] Verify API key is valid (42 characters)
  ```bash
  node -e "const fs = require('fs'); const env = fs.readFileSync('.env.local', 'utf-8'); const match = env.match(/VENICE_API_KEY=(.+)/); console.log('Key length:', match?.[1]?.trim().length);"
  ```

### Unit Tests

#### Test 1: Basic Venice API Connectivity
```bash
node scripts/test-venice-api.js
```

**Expected Output:**
```
✅ All tests passed! Venice API is working correctly.
```

#### Test 2: Production Flow
```bash
node scripts/test-production-flow.js
```

**Expected Output:**
```
✅ Production flow test PASSED!

Assessment:
  Weather Impact: LOW/MEDIUM/HIGH
  Odds Efficiency: FAIR/OVERPRICED/UNDERPRICED
  Confidence: LOW/MEDIUM/HIGH
```

### Integration Tests

#### Test 3: Start Development Server
```bash
npm run dev
```

**Expected:**
- [ ] Server starts without errors
- [ ] No Venice API errors in console
- [ ] Application loads at http://localhost:3000

#### Test 4: Navigate to Markets Page
1. Open browser to http://localhost:3000/markets
