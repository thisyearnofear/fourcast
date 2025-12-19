# Architecture Guide - Fourcast System Design

## System Overview

Fourcast is a Next.js-based weather edge analysis platform that combines real-time weather data with prediction market analysis to identify profitable betting opportunities. The platform aggregates markets from multiple exchanges (Polymarket and Kalshi) and leverages AI to analyze weather impact on outcomes.

## Architecture Principles

### 1. **Separation of Concerns**
- Frontend: React/Next.js with Tailwind CSS
- Backend: Next.js API routes
- Services: Dedicated business logic modules
- Data: Weather APIs, Market APIs, AI services

### 2. **Performance-First Design**
- Server-side rendering for fast initial loads
- API response caching with Redis
- Optimistic UI updates
- Debounced API calls

### 3. **Scalability**
- Stateless API design
- Horizontal scaling capability
- Database connection pooling
- CDN for static assets

### 4. **Reliability**
- Comprehensive error handling
- Fallback mechanisms
- Health check endpoints

## Core Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js App   │    │   API Routes    │    │   Services      │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ AI Analysis │ │◄──►│ │ /api/       │ │◄──►│ │ Weather     │ │
│ │ Page        │ │    │ │ analyze     │ │    │ │ Service     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Market      │ │    │ │ /api/       │ │    │ │ Market      │ │
│ │ Browser     │ │    │ │ markets     │ │    │ │ Service     │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                      ┌─────────────────┐
                      │ External APIs   │
                      │                 │
                      │ ┌─────────────┐ │
                      │ │ WeatherAPI  │ │
                      │ │ Venice AI   │ │
                      │ │ Polymarket  │ │
                      │ │ Kalshi      │ │
                      │ └─────────────┘ │
                      └─────────────────┘
```

## Frontend Architecture

### Component Structure

```
app/
├── ai/                    # Main AI analysis page
│   ├── page.js           # Enhanced page with validation
│   └── components/       # AI-specific components
├── markets/              # Markets page with date filtering
│   └── page.js           # Date-first UI (Today/Tomorrow/Week/Later)
├── api/                  # API routes
├── components/          # Shared components
├── signals/             # Signal publishing and reputation
└── discovery/           # Market discovery features
```

### Performance Optimizations

1. **Code Splitting**
   - Dynamic imports for heavy components
   - Route-based code splitting
   - Lazy loading of non-critical features

2. **Caching Strategy**
   ```javascript
   // Service worker caching
   // Redis server-side caching
   // Next.js built-in caching
   ```

## Backend Architecture

### API Design

**Core Endpoints:**
```
GET  /api/weather          # Weather data
GET  /api/markets          # Market listings (Polymarket + Kalshi)
POST /api/analyze          # AI analysis
POST /api/orders           # Trading orders
GET  /api/predictions      # User predictions
POST /api/signals          # Publish signal to SQLite
PATCH /api/signals         # Update signal with tx_hash
GET  /api/signals          # List latest signals
GET  /api/leaderboard      # Reputation leaderboard
GET  /api/profile          # User profile
GET  /api/predictions/health # Health check
```

### Service Layer

**Service Abstraction:**
```javascript
// Weather Service
export class WeatherService {
  static async getCurrentWeather(location) {
    // Redis cache check
    // API call if cache miss
    // Response transformation
    // Error handling
  }
}

// Market Service (Polymarket)
import { PolymarketService } from '@/services/polymarketService';

// Market Service (Kalshi)
import { KalshiService } from '@/services/kalshiService';

// AI Service
import { AIService } from '@/services/aiService.server';
```

## Data Architecture

### Data Flow

```
Weather API → WeatherService → Redis Cache → Frontend
                      ↓
Polymarket API → PolymarketService → Redis Cache → API Aggregation
                      ↓
Kalshi API → KalshiService → Redis Cache → API Aggregation
                      ↓
Venice AI → AnalysisService → Cache → Frontend
```

### Data Models

**Weather Data:**
```javascript
{
  location: {
    name: "New York, NY",
    coordinates: { lat: 40.7, lon: -74.0 }
  },
  current: {
    temp_f: 72,
    condition: "Sunny",
    wind_mph: 8,
    humidity: 65
  },
  forecast: { /* 3-7 day forecast */ }
}
```

**Market Data:**
```javascript
{
  marketID: "token123",
  platform: "polymarket", // or "kalshi"
  title: "Will it rain tomorrow?",
  currentOdds: { yes: 0.3, no: 0.7 },
  volume24h: 10000,
  liquidity: "HIGH",
  resolutionDate: "2024-11-19T12:00:00Z",
  eventType: "Weather",
  location: "New York, USA",
  weatherRelevance: {
    impact: "HIGH",
    factors: ["precipitation", "wind"]
  }
}
```

**Analysis Result:**
```javascript
{
  assessment: {
    weather_impact: "HIGH",
    odds_efficiency: "UNDERPRICED",
    confidence: "MEDIUM"
  },
  analysis: "Detailed AI analysis...",
  key_factors: ["Factor 1", "Factor 2"],
  recommended_action: "BET YES - Weather edge identified"
}
```

## Venice AI Integration Fixes

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

## Integration Patterns

### External API Integration

**Retry Pattern:**
```javascript
const retryWithBackoff = async (fn, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(Math.pow(2, i) * 1000);
    }
  }
};
```

### Error Handling

**Structured Error Responses:**
```javascript
{
  error: {
    code: "VALIDATION_ERROR",
    message: "Invalid location provided",
    details: {
      field: "location",
      value: "invalid_location",
      expected: "Valid city name or coordinates"
    }
  },
  timestamp: "2024-11-18T06:16:08.063Z"
}
```

## Security Architecture

### Input Validation

**Multi-Layer Validation:**
1. Client-side validation (immediate feedback)
2. API route validation (security)
3. Service-level validation (business rules)

## Multi-Platform Integration

### Kalshi Integration

**Enhanced Multi-Platform Support:**
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

### Platform Differentiation Features
- **Polymarket**: Blue badge (`bg-blue-900/40`)
- **Kalshi**: Green/Emerald badge (`bg-emerald-900/40`)
- Volume formatting adapts: Polymarket `$123K` vs Kalshi `456 Vol`

## AI Analysis Architecture

### Venice AI Integration

**Key Improvements:**
1. **Web Search Integration**: Enables `enable_web_search: "auto"` for real-time data
2. **Proper Model Selection**: Uses `llama-3.3-70b` for clean JSON output (avoids `qwen3-235b` thinking tags)
3. **Robust Error Handling**: Implements fallback strategies

## On-Chain Signal Architecture

### Movement L1 Integration (Hackathon Focus)

**Decision Rationale:**
- ✅ **Security**: No private keys in backend
- ✅ **Accountability**: Signals tied to user addresses (reputation building)
- ✅ **Simplicity**: Wallet handles all cryptographic operations
- ✅ **Cost Distribution**: Users pay minimal gas (native Move coin)
- ✅ **Decentralization**: True ownership of published signals
- ✅ **Composability**: Same Move module works for any signal domain

### Progressive Enhancement Pattern

**Flow:**
1. Signal saves to SQLite → Immediate success ✅
2. Movement publish (async) → On-chain proof 🔗
3. If Movement fails → Signal still exists, can retry 🔄
4. Update SQLite with tx_hash → Link local + blockchain 🎯

### Move Module Design (v2) - Domain Agnostic

**Signal Storage Model:**
```move
struct Signal has store, drop, copy {
    event_id: String,              // Domain-specific identifier
    market_title: String,          // Generic: any market/event title
    venue: String,                 // Domain-agnostic: location/context
    event_time: u64,               // Unix timestamp
    market_snapshot_hash: String,  // Hash of market state
    weather_hash: String,          // Can be any "context hash"
    ai_digest: String,             // Truncated analysis (512 bytes)
    confidence: String,            // HIGH/MEDIUM/LOW
    odds_efficiency: String,       // EFFICIENT/INEFFICIENT
    author_address: address,       // Analyst/publisher address
    timestamp: u64,                // Publication time
    total_tips: u64,               // Reputation earned
}

struct SignalRegistry has key {
    signals: Table<u64, Signal>,   // Sequential IDs
    signal_count: u64,
    total_platform_volume: u64,    // Total tipping volume
}
```

**Why This Shape Works for Any Domain:**
- `market_snapshot_hash` → Weather state, on-chain state, sentiment state
- `ai_digest` → Analysis from any source
- `venue` → Event location, ecosystem, or context
- `event_time` → Resolution time for any market
- `confidence` → Analyst certainty (universal metric)
- `odds_efficiency` → Price discrepancy detection (generalizes)

### Signal SDK Pattern (TypeScript)

**Core Abstraction:**
```typescript
interface SignalPublisher {
  // Domain-specific data → generic Signal shape
  analyzeEdge(config: EdgeConfig): Promise<Signal>
  
  // Publish to Movement network
  publishOnChain(signal: Signal): Promise<TransactionHash>
  
  // Track reputation
  getAnalystStats(address: Address): Promise<AnalystStats>
}

// Weather domain (existing)
const weatherSignals = new SignalPublisher({
  dataSource: "weatherapi.com",
  analysisModel: "llama-3.3-70b",
  network: "movement-testnet"
})

// Mobility domain (fork example)
const mobilitySignals = new SignalPublisher({
  dataSource: "google-popular-times",
  analysisModel: "llama-3.3-70b",
  network: "movement-testnet"
})

// Media sentiment domain (fork example)
const sentimentSignals = new SignalPublisher({
  dataSource: "neynar-farcaster",
  analysisModel: "llama-3.3-70b",
  network: "movement-testnet"
})
```

**Benefits:**
- No code duplication across domains
- Same on-chain contract, different data sources
- New domain = 50 lines of config, not 500 lines of code
- CLI tool: `npx @fourcast/sdk init <domain>`

### Dual Wallet UX

- **Trading Wallet**: MetaMask/ConnectKit (for trading operations)
- **Signals Wallet**: Petra/Aptos/Movement (for publishing signals)
- Clear visual distinction between the two wallets

### Hackathon Deployment Strategy

**Movement Testnet:**
1. **Deploy base Signal Registry Module** (reusable)
2. **Weather Domain** - Existing; proves stability
3. **Mobility Domain** - New; proves adaptability
4. **Media Domain** - New; proves ecosystem integration
5. **On-Chain Domain** - New; proves crypto-native use case

**All use the same Move contract.** Only the backend analyzer differs.

**Proof:** Video showing all 4 signal types publishing to same contract.

---

_Architecture Guide - Last updated: November 2024_