Phase 2: Location Verification (Web Search)
       ↓
Phase 3: Weather Data Fetching
       ↓
Phase 4: AI Analysis (Web Search + Weather Context)
       ↓
Phase 5: Response Formatting & Caching
```

### Venue Extraction System

**Purpose**: Extract event venue locations from sports markets to enable `/ai` page event-weather analysis.

**Venue Extraction Methods:**
1. **Team-to-City Mapping**: ~65% success rate for major sports teams
2. **Title Pattern Matching**: ~40% success for "@ City" or "in City" patterns
3. **Stadium Name Mapping**: Dedicated stadium-to-city mapping for common venues
4. **Description Parsing**: ~10% success rate for venue info in descriptions

**Integration with Market Analysis:**
```javascript
// In polymarketService.js - Event Weather Mode
if (analysisType === 'event-weather') {
  const eventLocation = VenueExtractor.extractFromMarket(market);
  const eventWeather = await weatherService.getCurrentWeather(eventLocation);
  edgeScore = assessMarketWeatherEdge(market, eventWeather);
  return { eventLocation, eventWeather, edgeScore };
}
```

### /ai vs /discovery Differentiation

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

## On-Chain Signal Architecture

### Aptos Integration Pattern

**Architecture Pattern: User Wallet Connection**

**Decision Rationale:**
- ✅ **Security**: No private keys in backend
- ✅ **Accountability**: Signals tied to user addresses (reputation building)
- ✅ **Simplicity**: Wallet handles all cryptographic operations
- ✅ **Cost Distribution**: Users pay gas fees (~$0.0001 per signal)
- ✅ **Decentralization**: True ownership of published signals
- ✅ **Risk Mitigation**: Minimize backend complexity for first deployment

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

### Move Module Design

**Signal Storage Model:**
```move
struct Signal has store, drop, copy {
    event_id: String,
    market_title: String,
    venue: String,
    event_time: u64,
    market_snapshot_hash: String,
    weather_json: String,
    ai_digest: String,
    confidence: String,
    odds_efficiency: String,
    author_address: address,
    timestamp: u64,
}

struct SignalRegistry has key {
    signals: Table<String, Signal>,
    signal_count: u64,
}
```

**Event Emissions:**
```move
#[event]
struct SignalPublished has drop, store {
    signal_id: String,
    event_id: String,
    author: address,
    timestamp: u64,
    confidence: String,
    odds_efficiency: String,
}
```

### Dual Wallet UX

- **Trading Wallet**: MetaMask/ConnectKit (for trading operations)
- **Signals Wallet**: Petra/Aptos (for publishing signals)
- Clear visual distinction between the two wallets

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

## Deployment Architecture

### Environment Strategy

```
Development → Staging → Production
     ↓           ↓          ↓
Local DB     Test DB     Production DB
Local Redis  Test Redis  Production Redis
Mock APIs    Sandbox APIs Live APIs
```

### Infrastructure Requirements

**Minimum Viable Setup:**
- Next.js hosting (Vercel/Netlify)
- Redis instance (Upstash/Redis Cloud)
- Database (PostgreSQL/MongoDB)

**Production Setup:**
- Load balancer for scaling
- CDN for static assets
- Monitoring and alerting
- Backup and disaster recovery

## Monitoring & Observability

### Health Checks

**System Health Endpoint:**
```javascript
// /api/predictions/health
{
  status: "healthy",
  services: {
    weather: "operational",
    market: "operational",
    ai: "operational",
    database: "operational"
  },
  timestamp: "2024-11-18T06:16:08.063Z"
}
```

### Performance Metrics

**Key Metrics:**
- API response times
- Error rates by endpoint
- Cache hit ratios
- User engagement metrics

**Logging Strategy:**
- Structured JSON logging
- Contextual error information
- Performance tracking
- Security event logging

## Scaling Considerations

### Horizontal Scaling

**Stateless API Design:**
- All API routes are stateless
- Session data in Redis/database
- Independent service instances

**Database Scaling:**
- Read replicas for heavy queries
- Connection pooling
- Query optimization

### Vertical Scaling

**Resource Optimization:**
- Efficient algorithms
- Memory management
- CPU utilization optimization

## Development Best Practices

### Code Organization

**Service Layer Pattern:**
```javascript
// services/weatherService.js
export class WeatherService {
  static async getCurrentWeather(location) {
    // Implementation
  }
}

// In API routes
import { WeatherService } from '@/services/weatherService';
```

**Component Composition:**
```javascript
// Reusable validation components
<ValidationDisplay validation={validation} />
<RiskIndicator riskLevel={risk} />
<ValidationStatusBar {...validationStates} />
```

### Testing Strategy

**Unit Tests:** Individual functions and components
**Integration Tests:** API endpoint and service integration
**E2E Tests:** Complete user workflows

## Future Architecture Enhancements

### Microservices Migration
- Weather service separation
- Market analysis service
- AI processing service
- User management service

### Event-Driven Architecture
- Real-time market updates
- Weather alert system
- User notification system

### Advanced Caching
- Multi-layer caching strategy
- Predictive caching
- Cache warming