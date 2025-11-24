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
- Circuit breaker patterns
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

### State Management

**Client-Side State:**
```javascript
// React useState hooks for component state
const [weatherData, setWeatherData] = useState(null);
const [selectedMarket, setSelectedMarket] = useState(null);
const [analysis, setAnalysis] = useState(null);

// Validation state with performance hooks
const locationValidation = useLocationValidation(eventType, location);
const weatherValidation = useWeatherValidation(weatherData);
```

**Server-Side State:**
- Redis caching for API responses
- Session-based user data
- SQLite for signal persistence
- Static generation where applicable

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

3. **Optimistic Updates**
   - Immediate UI feedback
   - Rollback on errors
   - Progressive enhancement

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

**Validation Endpoints:**
```
POST /api/validate/location       # Location validation
POST /api/validate/weather        # Weather data validation
POST /api/validate/order          # Order validation
POST /api/validate/market-compatibility # Market compatibility
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

**Signal Object (Off-chain demo model):**
```javascript
{
  id: "eventId-timestamp",
  event_id: "market.tokenID",
  market_title: "Title",
  venue: "City, Region",
  event_time: 1732300000,
  market_snapshot_hash: "sha256(...)",
  weather_json: { /* compact weather metrics */ },
  ai_digest: "Concise reasoning",
  confidence: "HIGH|MEDIUM|LOW",
  odds_efficiency: "INEFFICIENT|EFFICIENT",
  author_address: "0x...",
  tx_hash: null, // Filled when Aptos transaction completes
  timestamp: 1732300100
}
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

**Circuit Breaker:**
```javascript
class CircuitBreaker {
  constructor(threshold = 5, timeout = 60000) {
    this.failureThreshold = threshold;
    this.timeout = timeout;
    this.failureCount = 0;
    this.state = 'CLOSED';
  }
}
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

**Validation Framework:**
```javascript
// Location Validator
export class LocationValidator {
  static validateLocation(eventType, location, context) {
    return {
      valid: true/false,
      errors: [],
      warnings: [],
      suggestions: []
    };
  }
}
```

### Authentication & Authorization

**Current Implementation:**
- Wallet-based authentication (ConnectKit for trading, Petra for signals)
- API key management for external services
- Environment variable protection

**Future Enhancements:**
- JWT token-based auth
- Role-based access control
- API rate limiting per user

## Multi-Platform Integration

### Polymarket Integration

**Data Flow:**
1. Fetch active markets from Polymarket API
2. Filter for weather-sensitive markets
3. Normalize data to internal Market model
4. Cache results for performance

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

3. **`app/markets/page.js`** (Enhanced)
   - **Platform Badge**: Visual indicator (Polymarket = Blue, Kalshi = Green)
   - **Volume Display**: Adapts format (Polymarket = $XK, Kalshi = X Vol)
   - **Platform Filter**: Dropdown in Discovery tab (All/Polymarket/Kalshi)
   - **Client-side Filtering**: Filters markets by platform selection

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
4. **Intelligent Caching**: Dynamic TTL based on event timing

**Multi-Phase Analysis Pipeline:**
```
User Selects Event
       ↓
Phase 1: Fixture Metadata Extraction (Web Search)
       ↓
