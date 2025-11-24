{
  "success": true,
  "order": {
    "orderID": "order_456",
    "status": "pending",
    "marketID": "token_123",
    "side": "YES",
    "price": 0.25,
    "quantity": 100,
    "filledQuantity": 0,
    "averageFillPrice": null,
    "fees": {
      "network": 0.001,
      "protocol": 0.25,
      "total": 0.251
    }
  },
  "transactionHash": "0x...",
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

### Validation Endpoints

#### Location Validation
```http
POST /api/validate/location
```

**Request Body:**
```json
{
  "eventType": "NFL",
  "location": "New York, NY",
  "additionalContext": {
    "title": "Team A vs Team B"
  }
}
```

#### Weather Validation
```http
POST /api/validate/weather
```

#### Order Validation
```http
POST /api/validate/order
```

#### Market Compatibility
```http
POST /api/validate/market-compatibility
```

*Validation responses follow the format described in VALIDATION.md*

## Error Handling

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid location provided",
    "details": {
      "field": "location",
      "value": "invalid_location",
      "expected": "Valid city name or coordinates"
    }
  },
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input parameters |
| `WEATHER_API_ERROR` | 502 | External weather API failure |
| `AI_SERVICE_ERROR` | 503 | AI analysis service unavailable |
| `MARKET_API_ERROR` | 502 | External market API failure |
| `INSUFFICIENT_LIQUIDITY` | 400 | Order exceeds market liquidity |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

## Rate Limiting

### Current Limits
- **General API**: 100 requests per minute per IP
- **Analysis API**: 10 requests per minute per IP
- **Trading API**: 5 requests per minute per wallet

### Rate Limit Headers
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1637234271
```

## SDK & Client Libraries

### JavaScript/TypeScript

```javascript
import { FourcastClient } from '@fourcast/sdk';

const client = new FourcastClient({
  apiKey: 'your-api-key', // Optional for read operations
  baseURL: 'https://your-domain.vercel.app/api'
});

// Get weather data
const weather = await client.weather.getCurrent('New York, NY');

// Analyze market
const analysis = await client.analyze.market({
  eventType: 'Weather Prediction',
  location: 'New York, NY',
  currentOdds: { yes: 0.25, no: 0.75 },
  weatherData: weather
});

// Place order
const order = await client.trading.placeOrder({
  marketID: 'token_123',
  side: 'YES',
  price: 0.25,
  quantity: 100,
  walletAddress: walletAddress
});
```

### React Hooks

```javascript
import { useWeatherData, useMarketAnalysis, useTrading } from '@fourcast/react-hooks';

function MarketAnalysis() {
  const { weather, loading: weatherLoading } = useWeatherData('New York, NY');
  const { analysis, loading: analysisLoading } = useMarketAnalysis(marketData, weather);
  const { placeOrder, loading: tradingLoading } = useTrading();

  return (
    <div>
      <WeatherDisplay weather={weather} />
      <AnalysisDisplay analysis={analysis} />
      <TradingPanel onTrade={placeOrder} />
    </div>
  );
}
```

## Webhooks

### Webhook Events

Fourcast supports webhooks for real-time updates:

```javascript
// Subscribe to market updates
POST /api/webhooks/subscribe
{
  "events": ["market_update", "analysis_complete", "order_filled"],
  "url": "https://your-app.com/webhooks/fourcast",
  "secret": "your-webhook-secret"
}
```

### Webhook Payload Format

```json
{
  "event": "analysis_complete",
  "data": {
    "marketID": "token_123",
    "analysis": { /* analysis object */ },
    "timestamp": "2024-11-18T06:17:51.772Z"
  },
  "signature": "sha256=..."
}
```

## Product Roadmap

### Phase 1: Core Platform (Completed ✅)

**Q4 2024:**
- ✅ Weather data integration
- ✅ Market discovery and analysis
- ✅ Basic AI-powered insights
- ✅ User-friendly interface
- ✅ Trading integration
- ✅ Polymarket aggregation
- ✅ Venue extraction for sports events

### Phase 2: Enhanced Analytics & Platform Integration (In Progress 🚧)

**Q1 2025:**
- 🚧 Kalshi integration with platform badges and filters
- 🚧 Advanced risk assessment tools
- 🚧 Historical performance tracking
- 🚧 Portfolio management features
- 🚧 Enhanced mobile experience
- 🚧 Multi-language support
- 🚧 Cross-platform arbitrage detection

**Features:**
- **Risk Calculator**: Advanced risk assessment with Monte Carlo simulations
- **Performance Analytics**: Track historical performance and optimize strategies
- **Portfolio Manager**: Manage multiple positions and risk exposure
- **Mobile App**: Native iOS and Android applications
- **Advanced Charts**: Interactive price charts with weather overlays
- **Multi-Platform Aggregation**: Polymarket + Kalshi unified feed

### Phase 3: Professional Tools (Planned 📋)

**Q2 2025:**
- 📋 Professional trading interface
- 📋 Advanced order types (limit, stop-loss, conditional)
- 📋 API rate limit increases for professional users
- 📋 White-label solutions
- 📋 Institutional features
- 📋 In-app trading execution

**Features:**
- **Professional Dashboard**: Advanced trading interface for power users
- **Algorithmic Trading**: Support for automated trading strategies
- **Market Making Tools**: Liquidity provision features
- **Institutional API**: Higher limits and advanced features
- **Risk Management**: Advanced position sizing and risk controls

### Phase 4: Ecosystem Expansion (Future 🔮)

**Q3-Q4 2025:**
- 🔮 Cross-chain support (Ethereum, Solana, Polygon)
- 🔮 Derivative markets (options, futures)
- 🔮 Social trading features
- 🔮 Prediction market creation tools
- 🔮 Integration with DeFi protocols
- 🔮 Universal trading across multiple chains

**Features:**
- **Multi-Chain Trading**: Trade across multiple blockchains
- **Derivative Products**: Options and futures on prediction markets
- **Social Features**: Follow successful traders, copy trading
- **Market Creation**: Tools to create custom prediction markets
- **DeFi Integration**: Yield farming and liquidity mining

### Phase 5: AI & Automation (Future 🤖)

**2026:**
- 🤖 Advanced AI models for market prediction
- 🤖 Automated trading strategies
- 🤖 Natural language market analysis
- 🤖 Personalized recommendations
- 🤖 Sentiment analysis integration

## API Versioning

### Current Version: v1

### Version Strategy
- **Minor Updates**: Backward compatible additions
- **Major Updates**: Breaking changes with deprecation period
- **Deprecation Notice**: 90-day notice before breaking changes

### Version Headers
```http
API-Version: v1
Accept: application/vnd.fourcast.v1+json
```

## Monitoring & Analytics

### Health Check
```http
GET /api/predictions/health
```

**Response:**
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "services": {
    "weather": {
      "status": "operational",
      "response_time_ms": 150
    },
    "market": {
      "status": "operational",
      "response_time_ms": 200
    },
    "ai": {
      "status": "operational",
      "response_time_ms": 2500
    },
    "database": {
      "status": "operational",
      "response_time_ms": 50
    }
  },
  "timestamp": "2024-11-18T06:17:51.772Z"
}
```

### Metrics API
```http
GET /api/metrics
```

**Available Metrics:**
- Request counts by endpoint
- Response time percentiles
- Error rates
- Cache hit rates
- User engagement metrics

## Support & Community

### Documentation
- **Primary Docs**: This API reference
- **Integration Guide**: Step-by-step integration instructions
- **Code Examples**: Available in GitHub repository
- **Video Tutorials**: YouTube channel with walkthroughs

### Support Channels
- **GitHub Issues**: Bug reports and feature requests
- **Discord Community**: Real-time support and discussion
- **Email Support**: support@fourcast.com
- **Status Page**: status.fourcast.com

### Contributing
- **Open Source Components**: Core validation framework
- **API Extensions**: Community-developed plugins
- **Documentation**: Contributions welcome
- **Bug Bounty**: Security-focused rewards

## Changelog

### v1.0.0 (November 2024)
- Initial API release
- Weather data integration
- Market analysis features
- Trading functionality
- Validation framework
- Polymarket integration
- Venice AI integration
- Venue extraction system

### Upcoming v1.1.0 (December 2024)
- Enhanced validation endpoints
- Kalshi integration
- Improved error handling
- Performance optimizations
- Additional market data fields

### v1.2.0 (Q1 2025)
- Portfolio management features
- Historical data API
- Webhook improvements
- Mobile SDK release
- Cross-platform arbitrage detection

## Legal & Compliance

### Terms of Service
- API usage terms
- Data licensing agreements
- Liability limitations
- Compliance requirements

### Privacy Policy
- Data collection practices
- User privacy protections
- GDPR compliance
- Data retention policies

### Regulatory Compliance
- Financial services regulations
- Securities law compliance
- International trading regulations
- Anti-money laundering (AML)

---

*API Reference & Product Roadmap - Last updated: November 2024*