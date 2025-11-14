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
