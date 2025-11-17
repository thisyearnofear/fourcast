# API Reference

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

#### WeatherAPI Setup

##### Get API Key
1. Visit [WeatherAPI](https://www.weatherapi.com/)
2. Sign up for free account
3. Get API key from dashboard

##### Environment Variables
```bash
NEXT_PUBLIC_WEATHER_API_KEY=your_weather_api_key_here
# Or WEATHER_API_KEY for server-side only
```

##### Data Structure
WeatherAPI returns comprehensive data:
- Location info
- Current conditions (temp, wind, humidity, etc.)
- 3-day forecast with hourly details
- Astro data (sunrise/sunset, moon phases)
- Weather alerts (future use)

##### Implementation Details

###### Caching Strategy
- 10-minute cache with automatic cleanup
- Cache keys based on location (case-insensitive)

###### Rate Limiting
- 15 requests/hour per IP
- Demo data fallback prevents blocking

###### Error Handling
- Invalid location: 400 with error message
- API key issues: 500 with generic error
- Network failures: 500 with retry suggestion

###### Demo Data
When rate limited, serves plausible weather conditions for testing without API calls.

##### Limits
**Free Tier:**
- 1,000,000 calls/month
- 10,000 calls/day
- Current weather + 3-day forecast

##### Testing
Use locations like `London`, `New York`, `Tokyo`, `Chicago` for testing.

##### Troubleshooting
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

Theme Filtering
- `theme` (optional): one of `all`, `sports`, `outdoor`, `aviation`, `energy`, `agriculture`, `weather_explicit`
- The server applies theme filters after edge scoring using Gamma tags/categories and keyword heuristics for implicit weather sensitivity.

**Key Improvements (Nov 14):**
- Uses optimized `/events` endpoint (1 API call instead of 3)
- Filters by $50k+ volume minimum (eliminates thin markets)
- Real weather data used for relevance scoring (not mock)
- Market details pre-cached for top 5 (eliminates analysis latency)
- Returns weather context for AI analysis pipeline
- Faster response time, better data quality

### POST /api/analyze

Purpose: return a structured assessment of a market with Basic or Deep mode

Request fields
- `mode`: `basic` or `deep`
- `eventType`: market type (e.g., NFL, Weather)
- `location`: city or region (string)
- `weatherData`: current conditions payload used throughout the app
- `currentOdds`: `{ yes: number, no: number }` in 0–1 range
- `participants`: optional participants metadata (e.g., teams)
- `marketID`: identifier used in Polymarket catalog
- `eventDate`: optional ISO date for the event

Responses
- Success (Basic): `assessment`, `reasoning`, `key_factors`, `recommended_action`, `cached`, `source`, `timestamp`
- Success (Deep): adds `citations[]` (title, url, snippet) and `limitations`
- Error (400): missing required fields listed with an actionable hint
- Error (429): rate-limit exceeded; includes `retryAfter` seconds

### POST /api/analyze/stream

Purpose: Enhanced mode streaming via NDJSON for faster perceived response

Request fields
- Same as `/api/analyze`, typically `mode: 'deep'`

Response format: `Content-Type: application/x-ndjson`
- `{"type":"meta", "assessment":{...}, "cached":false, "source":"venice_ai", "web_search":true, "timestamp":"..."}`
- `{"type":"chunk", "text":"Sentence of reasoning..."}` repeated
- `{"type":"complete", "assessment":{...}, "analysis":"...", "key_factors":[...], "recommended_action":"...", "citations":[...], "limitations":null, "web_search":true, "timestamp":"..."}`

Notes
- Rate limiting: 10/hour per client
- Odds required: UI and `/api/markets` ensure `currentOdds` normalization to prevent 400s

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

## General API Notes

### Rate Limiting
- Weather API: 15/hour per IP (demo fallback)
- Market/Analysis APIs: Monitor for rate limits

### CORS
All endpoints support cross-origin requests.

### Authentication
Future APIs may require API keys for external access.

## Recent Improvements (Nov 14, 2025)

- ✅ **Optimized market discovery** with `/events` endpoint
  - Reduced from 3 sequential API calls to 1 efficient call
  - Added $50k volume minimum filter
  - Top 20 markets instead of top 10

- ✅ **Real weather data integration** in discovery
  - Weather data used for relevance scoring (not mock)
  - Weather context returned with each market
  - Actual temperature/precipitation/wind conditions factored in

- ✅ **Pre-caching optimization** for top 5 markets
  - Market details fetched immediately to warm cache
  - Eliminates delay when user clicks "Analyze"
  - ~40% reduction in repeat API calls

- ✅ **Enhanced error messaging** with recovery guidance
  - Error responses include `action` field
  - Added `recoverable` boolean
  - Maps Polymarket errors to user-friendly messages

## Troubleshooting

### "Signature verification failed"

**Causes:**
- POLYMARKET_PRIVATE_KEY invalid or empty
- Private key format incorrect
- Funder address mismatch

**Fix:**
```bash
# Verify key valid
node -e "require('ethers').Wallet.createRandom(); console.log('Valid')"
echo $POLYMARKET_PRIVATE_KEY
```

### "Invalid NegRisk flag"

**Cause:** Market has `negRisk: true` but order doesn't

**Fix:** Check market details and pass correct flag

### "Insufficient Balance"

**Cause:** Not enough USDC

**Fix:** Deposit USDC or show funding instructions

### "Rate limit exceeded"

**Cause:** 20 orders/hour exceeded

**Fix:** Display remaining quota and wait time

## Debug Commands

```bash
# Test weather API
curl "http://localhost:3000/api/weather?location=New%20York"

# Test market API directly
curl -X POST http://localhost:3001/api/markets \
  -H "Content-Type: application/json" \
  -d '{"location":"Chicago","weatherData":{...}}'

# Test analysis API
curl -X POST http://localhost:3001/api/analyze \
  -H "Content-Type: application/json" \
  -d '{...analysis data...}'

# Test wallet API
curl -X POST http://localhost:3001/api/wallet \
  -H "Content-Type: application/json" \
  -d '{"walletAddress":"0x..."}'

# Check Polymarket directly
curl https://gamma-api.polymarket.com/markets
```

## User Flow

1. **User views analysis** → AI provides edge assessment
2. **Clicks "Trade This Edge"** → Order modal opens
3. **System checks wallet** → Shows USDC balance
4. **User inputs order** details (side, price, size)
5. **Cost preview** → Real-time calculation
6. **Confirm & submit** → CLOB client executes order
7. **Confirmation** → Order ID shown or error with guidance
## Predictions API (Multi-Chain)

### POST /api/predictions

Submit a prediction receipt on-chain. Returns a transaction request for client signature or a server-submitted transaction when a signer is configured.

Request body:
```javascript
{
  marketID: "string",        // Market identifier used in UI context
  price: 0.55,                // 0-1 odds (e.g., 55% → 0.55)
  side: "BUY" | "SELL",      // Semantic label
  size: 0.20,                 // Stake units; used to compute fee
  walletAddress: "0x...",    // Connected wallet
  chainId: 42161,             // Arbitrum (42161), BNB (56)
  metadataUri: "ipfs://..."   // Optional extra context
}
```

Response (client signature required):
```javascript
{
  success: true,
  mode: "client_signature_required",
  txRequest: {
    to: "0x...",
    data: "0x...",      // ABI-encoded placePrediction(...)
    value: "0x..."      // fee-only msg.value (stakeWei * feeBps / 10000)
  }
}
```

Response (server submitted):
```javascript
{
  success: true,
  txHash: "0x...",
  order: { marketID, side, price, size },
  timestamp: "ISO-8601"
}
```

Rate Limiting: 50 requests/hour per client (429 when exceeded)

Chain Mapping:
- Arbitrum (42161): `PREDICTION_CONTRACT_ADDRESS_ARBITRUM`, `PREDICTION_FEE_BPS_ARBITRUM`, `ARB_RPC_URL`
- BNB (56): `PREDICTION_CONTRACT_ADDRESS_BNB`, `PREDICTION_FEE_BPS_BNB`, `NEXT_PUBLIC_BNB_RPC_URL`
- Optional Polygon (137): ERC20 variant via `PredictionReceiptERC20.sol`
