# API Documentation

## Base URL

All API endpoints are relative to the application base URL (e.g., `http://localhost:3000` in development).

## Weather API

### GET `/api/weather`

Fetches weather forecast data for a given location using WeatherAPI.

#### Parameters
- `location` (required): The location to get weather for (city name, zip code, coordinates, etc.)

#### Response
Returns weather data in the format provided by WeatherAPI, including:
- Current weather conditions
- 3-day forecast
- Location information
- Temperature, precipitation, wind, humidity data

#### Example Request
```bash
GET /api/weather?location=New%20York
```

#### Example Response
```json
{
  "location": {
    "name": "New York",
    "region": "New York",
    "country": "USA",
    "lat": 40.71,
    "lon": -74.01
  },
  "current": {
    "temp_c": 10.0,
    "temp_f": 50.0,
    "condition": {
      "text": "Partly cloudy",
      "icon": "//cdn.weatherapi.com/weather/64x64/day/116.png",
      "code": 1003
    },
    "wind_mph": 8.5,
    "precip_mm": 0.0,
    "humidity": 65
  },
  "forecast": {
    "forecastday": [
      {
        "date": "2021-12-01",
        "day": {
          "maxtemp_c": 12.0,
          "mintemp_c": 8.0,
          "condition": {
            "text": "Partly cloudy"
          },
          "daily_chance_of_rain": 10
        }
      }
    ]
  }
}
```

#### Features
- **Caching**: Responses cached for 10 minutes
- **Rate Limiting**: Limited to 15 requests per hour per IP
- **Fallback**: Demo data served when rate limited
- **Error Handling**: Appropriate error messages for invalid locations

#### Error Responses
- `400 Bad Request`: Missing location parameter
- `500 Internal Server Error`: API key not configured or WeatherAPI failure

## WeatherAPI Setup

### Get API Key
1. Visit [WeatherAPI](https://www.weatherapi.com/)
2. Sign up for free account
3. Get API key from dashboard

### Environment Variables
```bash
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key_here
# Or WEATHER_API_KEY for server-side only
```

### Data Structure
WeatherAPI returns comprehensive data:
- Location info
- Current conditions (temp, wind, humidity, etc.)
- 3-day forecast with hourly details
- Astro data (sunrise/sunset, moon phases)
- Weather alerts (future use)

### Implementation Details

#### Caching Strategy
- 10-minute cache with automatic cleanup
- Cache keys based on location (case-insensitive)

#### Rate Limiting
- 15 requests/hour per IP
- Demo data fallback prevents blocking

#### Error Handling
- Invalid location: 400 with error message
- API key issues: 500 with generic error
- Network failures: 500 with retry suggestion

#### Demo Data
When rate limited, serves plausible weather conditions for testing without API calls.

### Limits
**Free Tier:**
- 1,000,000 calls/month
- 10,000 calls/day
- Current weather + 3-day forecast

### Testing
Use locations like `London`, `New York`, `Tokyo`, `Chicago` for testing.

### Troubleshooting
- **API Key Invalid**: Check for typos in env vars
- **Rate Limited**: Wait or upgrade plan
- **Location Not Found**: Try coordinates or different spelling
- **Timezone Issues**: API respects local timezone automatically

## Polymarket Integration

### POST /api/orders

**Submit a prediction market order**

Request body:
```javascript
{
  marketID: "string",           // Market ID from Polymarket
  price: 0.35,                  // Price 0-1 (35% probability)
  side: "BUY" | "SELL",
  size: 5,                       // Number of tokens
  feeRateBps: 0,                // Basis points (optional)
  walletData: {
    address: "0x...",           // Connected wallet
    signer: "wagmi",            // Indicator only
    usdcBalance: "100.00"       // From /api/wallet
  }
}
```

Response (success):
```javascript
{
  success: true,
  orderID: "0x...",
  order: {
    marketID,
    side,
    size,
    price,
    cost: "17.50", // price * size
    status: "submitted"
  },
  timestamp: "ISO-8601"
}
```

Response (error):
```javascript
{
  success: false,
  error: "User-friendly error message",
  action: "What the user should do to recover",
  recoverable: true|false,
  detail: "Technical details if available"
}
```

**Rate Limiting:** 20 orders per hour per user (429 error if exceeded)

### POST /api/markets

**Purpose:** Discover weather-sensitive markets for a location (IMPROVED Nov 14)

Request body:
```javascript
{
  "location": "Chicago",
  "weatherData": {
    "current": {
      "temp_f": 45,
      "condition": { "text": "Rainy" },
      "precip_chance": 75,
      "wind_mph": 12,
      "humidity": 85
    }
  }
}
```

Response (success):
```javascript
{
  "success": true,
  "markets": [
    {
      "marketID": "market_123",
      "title": "Will it rain at Chicago Marathon?",
      "location": "Chicago",
      "currentOdds": { "yes": 0.72, "no": 0.28 },
      "volume24h": 125000,
      "liquidity": 45000,
      "weatherRelevance": 8.5,
      "weatherContext": {
        "temp": 45,
        "condition": "rainy",
        "precipChance": 75,
        "windSpeed": 12,
        "hasData": true
      },
      "eventType": "Sports",
      "teams": []
    }
  ],
  "totalFound": 15,
  "cached": false,
  "timestamp": "2025-11-14T12:00:00Z"
}
```

**Key Improvements (Nov 14):**
- Uses optimized `/events` endpoint (1 API call instead of 3)
- Filters by $50k+ volume minimum (eliminates thin markets)
- Real weather data used for relevance scoring (not mock)
- Market details pre-cached for top 5 (eliminates analysis latency)
- Returns weather context for AI analysis pipeline
- Faster response time, better data quality

### POST /api/analyze

**Run Venice AI edge analysis for a market (with Redis caching)**

Request:
```javascript
{
  "marketId": "market_123",
  "eventType": "Chicago Marathon",
  "location": "Chicago",
  "weatherData": { ... },
  "currentOdds": { "yes": 0.35, "no": 0.65 }
}
```

Response:
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

### POST /api/wallet

**Check wallet balance and USDC allowance**

Request body:
```javascript
{
  walletAddress: "0x..."  // Connected wallet address
}
```

Response:
```javascript
{
  success: true,
  wallet: {
    address: "0x...",
    balance: {
      raw: "1000000000",     // Raw units (6 decimals for USDC)
      formatted: "1000.00",  // User-readable
      symbol: "USDC"
    },
    allowance: {
      raw: "5000000000",
      formatted: "5000.00",
      symbol: "USDC",
      spender: "0x4d97..."   // Polymarket CLOB contract
    },
    canTrade: true,          // Has balance AND allowance
    needsApproval: false     // Requires approval transaction
  },
  timestamp: "ISO-8601"
}
```

**GET /api/wallet** (info):
```
GET /api/wallet
Returns service status and capabilities
```

**GET /api/wallet?address=0x...** (quick check):
```
GET /api/wallet?address=0x...
Returns balance for an address without approval check
```

## Market Integration Architecture

### Data Flow
```
Weather Location → Polymarket API → Filter Weather Markets
                         ↓
                    Venice AI Analysis
                         ↓
                  Edge Detection Scoring
                         ↓
                   User Recommendations
```

### Core Components

#### Polymarket Service (`services/polymarketService.js`)
- Fetches market data from Polymarket API
- Filters for weather-sensitive events
- Ranks markets by weather relevance and volume
- Implements 5-minute caching to reduce API calls

**Key Methods:**
- `searchMarketsByLocation()` - Searches for markets in area
- `getWeatherAdjustedOpportunities()` - Ranks by relevance
- `assessWeatherRelevance()` - Scores weather impact

#### Markets API (`app/api/markets/route.js`)
- Backend endpoint coordinating market fetching
- Accepts location + weather data
- Returns top 10 filtered markets with odds and volume

**Request:**
```json
{
  "location": "Chicago, Illinois",
  "weatherData": { "temp": 45, "condition": "Rainy", "wind": 12 }
}
```

**Response:**
```json
{
  "success": true,
  "opportunities": [
    {
      "marketID": "token123",
      "title": "Will Chicago Cubs win today?",
      "currentOdds": { "yes": 0.55, "no": 0.45 },
      "volume24h": 125000,
      "weatherRelevance": { "score": 7, "isWeatherSensitive": true }
    }
  ],
  "location": "Chicago, Illinois"
}
```

#### Venice AI Integration
- Uses `qwen3-235b` for complex reasoning
- Analyzes market odds vs weather impact
- Returns structured assessment with confidence levels

**Analysis Output:**
```json
{
  "assessment": {
    "weather_impact": "HIGH",
    "odds_efficiency": "INEFFICIENT",
    "confidence": "MEDIUM"
  },
  "analysis": "Detailed 2-3 paragraph analysis...",
  "key_factors": ["Factor 1", "Factor 2", "Factor 3"],
  "recommended_action": "Consider backing YES"
}
```

#### Frontend Panel (`AIInsightsPanel.js`)
- Fetches and displays market lists
- Allows user market selection
- Shows AI analysis with loading states
- Handles errors and retries

### Performance Optimizations
- **Caching**: 5-minute market data cache
- **Filtering**: Server-side weather relevance scoring
- **Batching**: Parallel API calls
- **Limits**: Top 10 results to reduce load

## Market Filtering Logic

### Markets That Show
- ✓ Sports: Baseball, football, golf, tennis, soccer, cricket
- ✓ Weather-specific: Temperature, precipitation, snow
- ✓ Outdoor events: Marathons, concerts, parades
- ✓ Political rallies with weather impact

### Markets That Don't Show
- ✗ Politics (unless weather-sensitive)
- ✗ Finance and crypto markets
- ✗ Indoor sports (basketball, hockey)
- ✗ Entertainment (movies, awards)

## Client Service Layer

### polymarketService

Handles market data, order validation, and cost calculation.

**Key Methods:**

```javascript
// Get market details with trading metadata
const market = await polymarketService.getMarketDetails(marketID);
// Returns: { ...marketData, tradingMetadata: { tickSize, negRisk, chainId } }

// Validate order before submission
const validation = await polymarketService.validateOrder({
  marketID, price, side, size
});
// Returns: { valid: true/false, marketData, error? }

// Build order object for CLOB
const order = polymarketService.buildOrderObject(
  marketData, price, side, size, feeRateBps
);

// Calculate cost breakdown
const cost = polymarketService.calculateOrderCost(price, size, feeRateBps);
// Returns: { baseCost: "17.50", fee: "0.00", total: "17.50" }
```

## Order Lifecycle

### On `/api/orders` POST:

1. **Validate Input** - Check all fields present and valid
2. **Rate Limit** - Enforce per-user rate limits
3. **Verify Wallet** - Check wallet connected with valid signer
4. **Validate Order** - Check market exists, price range, sufficient size
5. **Check Balance** - Ensure USDC balance > order cost
6. **Initialize CLOB** - Create signer from POLYMARKET_PRIVATE_KEY
7. **Build Order** - Construct order with market metadata (tick size, negRisk)
8. **Submit to Polymarket** - Call `clobClient.createAndPostOrder()`
9. **Return Result** - Order ID on success or error message

### Key Validations:

| Field | Range | Error |
|-------|-------|-------|
| price | 0-1 | "Price must be between 0 and 1" |
| size | > 0 | "Size must be greater than 0" |
| marketID | Exists on Polymarket | "Market not found" |
| balance | ≥ cost | "Insufficient balance" |
| wallet | Connected | "Wallet not connected" |

## Error Handling

**Frontend** (in AIInsightsPanel):
- Wallet not connected → Show "Connect wallet to trade"
- Insufficient balance → Show required vs available
- Network error → Show retry button
- Order failed → Display error message with details

**Backend** (in /api/orders):
- Missing fields → 400 Bad Request
- Rate limit exceeded → 429 Too Many Requests
- Wallet validation → 401 Unauthorized
- Network/signature error → 400 Bad Request
- Server configuration → 500 Internal Server Error

## Future APIs

### Markets API
**POST `/api/markets`**
- Fetches weather-adjusted Polymarket opportunities
- Filters for weather-sensitive events
- Returns top markets with odds, volume, relevance scores

### Analysis API
**POST `/api/analyze`**
- Analyzes weather impact on prediction market odds
- Uses Venice AI for deep reasoning
- Returns assessment, confidence, recommendation

Example request:
```json
{
  "location": "Chicago",
  "eventType": "Baseball Game",
  "weatherData": {...},
  "marketID": "token123"
}
```

Example response:
```json
{
  "assessment": {
    "weather_impact": "HIGH",
    "odds_efficiency": "INEFFICIENT",
    "confidence": "MEDIUM"
  },
  "analysis": "Detailed analysis...",
  "key_factors": ["Factor 1", "Factor 2"],
  "recommended_action": "Buy YES at current odds"
}
```

## General API Notes

### Rate Limiting
- Weather API: 15/hour per IP (demo fallback)
- Market/Analysis APIs: Monitor for rate limits

### CORS
All endpoints support cross-origin requests.

### Authentication
Future APIs may require API keys for external access.

## Resources

- [WeatherAPI Documentation](https://www.weatherapi.com/docs/)
- [WeatherAPI Status Page](https://status.weatherapi.com/)
- [WeatherAI Pricing](https://www.weatherapi.com/pricing.aspx)
- [Polymarket CLOB Docs](https://docs.polymarket.com/developers)
- [CLOB Client Library](https://github.com/polymarket/clob-client)
- [Ethers.js Documentation](https://docs.ethers.org/v6/)
