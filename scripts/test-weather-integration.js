/**
 * Comprehensive weather integration test
 * Tests Open-Meteo API integration, data conversion, and fallback mechanisms
 */

import axios from 'axios';
import { convertOpenMeteoToWeatherAPI } from '../services/dataConverter.js';

const OPEN_METEO_API_BASE = 'https://api.open-meteo.com/v1';
const TEST_LOCATIONS = [
  { name: 'London', expected: { lat: 51.5085, lon: -0.1257 } },
  { name: 'New York', expected: { lat: 40.7128, lon: -74.0060 } },
  { name: 'Tokyo', expected: { lat: 35.6762, lon: 139.6503 } },
  { name: 'Sydney', expected: { lat: -33.8688, lon: 151.2093 } },
  { name: 'Nairobi', expected: { lat: -1.2864, lon: 36.8172 } }
];

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(color, ...args) {
  console.log(`${color}${args.join(' ')}${colors.reset}`);
}

async function testOpenMeteoGeocode(locationName) {
  log(colors.blue, `\n📍 Testing geocoding for "${locationName}"...`);
  
  try {
    const response = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
      params: {
        name: locationName,
        count: 1,
        language: 'en'
      },
      timeout: 5000
    });

    if (!response.data.results || response.data.results.length === 0) {
      log(colors.red, `❌ No results found for "${locationName}"`);
      return null;
    }

    const result = response.data.results[0];
    log(colors.green, `✓ Found: ${result.name}${result.admin1 ? ', ' + result.admin1 : ''}${result.country ? ', ' + result.country : ''}`);
    log(colors.cyan, `  Coordinates: (${result.latitude}, ${result.longitude})`);
    
    return {
      name: result.name,
      latitude: result.latitude,
      longitude: result.longitude,
      admin1: result.admin1,
      country: result.country,
      timezone: result.timezone
    };
  } catch (error) {
    log(colors.red, `❌ Geocoding failed: ${error.message}`);
    return null;
  }
}

async function testOpenMeteoWeatherAPI(latitude, longitude, locationName) {
  log(colors.blue, `\n🌤️  Fetching weather data for (${latitude}, ${longitude})...`);
  
  try {
    const response = await axios.get(`${OPEN_METEO_API_BASE}/forecast`, {
      params: {
        latitude,
        longitude,
        hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code,uv_index',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,windspeed_10m_max,relative_humidity_2m_max,uv_index_max',
        timezone: 'auto',
        forecast_days: 7
      },
      timeout: 5000
    });

    const data = response.data;
    log(colors.green, `✓ Weather data received`);
    log(colors.cyan, `  Location: (${data.latitude}, ${data.longitude})`);
    log(colors.cyan, `  Timezone: ${data.timezone}`);
    log(colors.cyan, `  Hourly points: ${data.hourly.time.length}`);
    log(colors.cyan, `  Forecast days: ${data.daily.time.length}`);

    // Show sample current data
    const now = new Date();
    const currentHourIndex = data.hourly.time.findIndex(time => {
      const hourTime = new Date(time);
      return hourTime.getDate() === now.getDate() && hourTime.getHours() === now.getHours();
    }) || 0;

    log(colors.cyan, `  Current hour index: ${currentHourIndex}`);
    log(colors.cyan, `  Current temp: ${data.hourly.temperature_2m[currentHourIndex]}°C`);
    log(colors.cyan, `  Current humidity: ${data.hourly.relative_humidity_2m[currentHourIndex]}%`);
    log(colors.cyan, `  Current wind: ${data.hourly.wind_speed_10m[currentHourIndex]} km/h`);

    return data;
  } catch (error) {
    log(colors.red, `❌ Weather API failed: ${error.message}`);
    return null;
  }
}

async function testDataConversion(openMeteoData, locationName) {
  log(colors.blue, `\n🔄 Testing data conversion...`);
  
  try {
    const converted = convertOpenMeteoToWeatherAPI(openMeteoData, locationName);
    
    // Validate structure
    const requiredFields = ['location', 'current', 'forecast'];
    for (const field of requiredFields) {
      if (!converted[field]) {
        log(colors.red, `❌ Missing field: ${field}`);
        return null;
      }
    }

    // Check current data
    const current = converted.current;
    if (!current.temp_c || current.temp_f === undefined) {
      log(colors.red, `❌ Invalid temperature data`);
      return null;
    }

    // Check forecast
    if (!converted.forecast.forecastday || converted.forecast.forecastday.length === 0) {
      log(colors.red, `❌ No forecast days`);
      return null;
    }

    log(colors.green, `✓ Conversion successful`);
    log(colors.cyan, `  Location: ${converted.location.name}`);
    log(colors.cyan, `  Current: ${current.temp_c}°C (${current.temp_f}°F)`);
    log(colors.cyan, `  Condition: ${current.condition.text}`);
    log(colors.cyan, `  Wind: ${current.wind_kph} km/h (${current.wind_dir})`);
    log(colors.cyan, `  Humidity: ${current.humidity}%`);
    log(colors.cyan, `  Forecast days: ${converted.forecast.forecastday.length}`);
    
    // Show forecast
    converted.forecast.forecastday.forEach((day, index) => {
      log(colors.cyan, `    Day ${index + 1}: ${day.date} - ${day.day.mintemp_c}°C to ${day.day.maxtemp_c}°C (${day.day.condition.text})`);
    });

    return converted;
  } catch (error) {
    log(colors.red, `❌ Conversion failed: ${error.message}`);
    console.error(error);
    return null;
  }
}

async function testFallbackMechanism() {
  log(colors.blue, `\n🔁 Testing fallback mechanism...`);
  
  try {
    // Test invalid location that should fail gracefully
    const response = await axios.get('http://localhost:3000/api/weather', {
      params: { location: 'InvalidLocationXYZ123' },
      timeout: 5000
    });
    
    log(colors.yellow, `⚠️  Fallback response received`);
    log(colors.cyan, `  Service available: ${!response.data.serviceUnavailable}`);
    log(colors.cyan, `  Rate limited: ${response.data.rateLimited}`);
    log(colors.cyan, `  Source: ${response.data.source || 'unknown'}`);
    
  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      log(colors.yellow, `⚠️  Server not running (skip fallback test)`);
    } else {
      log(colors.yellow, `⚠️  Fallback test: ${error.message}`);
    }
  }
}

async function testLocalAPI(location) {
  log(colors.blue, `\n🌐 Testing local API endpoint with "${location}"...`);
  
  try {
    const response = await axios.get('http://localhost:3000/api/weather', {
      params: { location },
      timeout: 10000
    });

    const data = response.data;
    log(colors.green, `✓ API responded successfully`);
    log(colors.cyan, `  Location: ${data.location.name}`);
    log(colors.cyan, `  Current: ${data.current.temp_c}°C`);
    log(colors.cyan, `  Source: ${data.source || 'WeatherAPI'}`);
    log(colors.cyan, `  Cached: ${data.cached}`);
    log(colors.cyan, `  Condition: ${data.current.condition.text}`);
    
    return data;
  } catch (error) {
    if (error.message.includes('ECONNREFUSED')) {
      log(colors.yellow, `⚠️  Server not running (start with: npm run dev)`);
    } else if (error.response?.status === 400) {
      log(colors.red, `❌ Bad request: ${error.response.data?.error}`);
    } else {
      log(colors.red, `❌ API error: ${error.message}`);
    }
    return null;
  }
}

async function runTests() {
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.cyan, 'FOURCAST WEATHER INTEGRATION TEST SUITE');
  log(colors.cyan, '='.repeat(60));

  let successCount = 0;
  let failCount = 0;

  // Test 1: Geocoding
  log(colors.yellow, '\n📊 Test 1: Geocoding');
  for (const location of TEST_LOCATIONS.slice(0, 3)) {
    const geoResult = await testOpenMeteoGeocode(location.name);
    if (geoResult) successCount++;
    else failCount++;
  }

  // Test 2: Weather API
  log(colors.yellow, '\n📊 Test 2: Open-Meteo Weather API');
  const testLocation = 'London';
  const geoData = await testOpenMeteoGeocode(testLocation);
  if (geoData) {
    const weatherData = await testOpenMeteoWeatherAPI(geoData.latitude, geoData.longitude, geoData.name);
    if (weatherData) {
      successCount++;
      
      // Test 3: Data Conversion
      log(colors.yellow, '\n📊 Test 3: Data Conversion');
      const converted = await testDataConversion(weatherData, geoData.name);
      if (converted) successCount++;
      else failCount++;
    } else {
      failCount++;
    }
  } else {
    failCount += 2;
  }

  // Test 4: Local API
  log(colors.yellow, '\n📊 Test 4: Local API Integration');
  const apiResult = await testLocalAPI('London');
  if (apiResult) successCount++;
  else failCount++;

  // Test 5: Fallback
  log(colors.yellow, '\n📊 Test 5: Fallback Mechanism');
  await testFallbackMechanism();

  // Summary
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.cyan, 'TEST SUMMARY');
  log(colors.cyan, '='.repeat(60));
  log(colors.green, `✓ Passed: ${successCount}`);
  log(colors.red, `✗ Failed: ${failCount}`);
  log(colors.cyan, `Total: ${successCount + failCount}`);
  
  if (failCount === 0) {
    log(colors.green, '\n✨ All tests passed!');
  } else {
    log(colors.yellow, `\n⚠️  ${failCount} test(s) failed`);
  }
  
  log(colors.cyan, '='.repeat(60) + '\n');
}

runTests().catch(error => {
  log(colors.red, 'Test suite error:', error.message);
  process.exit(1);
});
