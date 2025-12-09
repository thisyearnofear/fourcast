/**
 * Direct test of the data converter
 * Validates that Open-Meteo data converts correctly to WeatherAPI format
 */

import axios from 'axios';
import { convertOpenMeteoToWeatherAPI } from '../services/dataConverter.js';

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

async function getOpenMeteoData(location) {
  const geocoding = await axios.get('https://geocoding-api.open-meteo.com/v1/search', {
    params: { name: location, count: 1 }
  });

  if (!geocoding.data.results?.length) {
    throw new Error(`Location "${location}" not found`);
  }

  const { latitude, longitude, name } = geocoding.data.results[0];

  const weather = await axios.get('https://api.open-meteo.com/v1/forecast', {
    params: {
      latitude,
      longitude,
      hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,precipitation,weather_code,uv_index',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,snowfall_sum,windspeed_10m_max,relative_humidity_2m_max,uv_index_max',
      timezone: 'auto',
      forecast_days: 7
    }
  });

  return { data: weather.data, locationName: name };
}

function validateConvertedData(converted) {
  const errors = [];
  
  // Location
  if (!converted.location?.name) errors.push('Missing location name');
  if (!converted.location?.lat || !converted.location?.lon) errors.push('Missing location coordinates');
  
  // Current
  if (converted.current?.temp_c === undefined) errors.push('Missing current temp_c');
  if (converted.current?.temp_f === undefined) errors.push('Missing current temp_f');
  if (converted.current?.humidity === undefined) errors.push('Missing current humidity');
  if (converted.current?.wind_kph === undefined) errors.push('Missing current wind_kph');
  if (converted.current?.wind_mph === undefined) errors.push('Missing current wind_mph');
  if (converted.current?.wind_dir === undefined) errors.push('Missing current wind_dir');
  if (!converted.current?.condition?.text) errors.push('Missing current condition text');
  
  // Forecast
  if (!Array.isArray(converted.forecast?.forecastday)) errors.push('Forecast is not an array');
  if (converted.forecast?.forecastday.length < 3) errors.push('Fewer than 3 forecast days');
  
  converted.forecast?.forecastday.forEach((day, i) => {
    if (!day.date) errors.push(`Day ${i} missing date`);
    if (!day.day?.maxtemp_c || !day.day?.mintemp_c) errors.push(`Day ${i} missing temperature`);
    if (day.day?.maxtemp_f === undefined) errors.push(`Day ${i} missing maxtemp_f`);
    if (day.day?.mintemp_f === undefined) errors.push(`Day ${i} missing mintemp_f`);
  });
  
  // Source
  if (converted.source !== 'open-meteo') errors.push('Wrong source attribution');
  
  return errors;
}

async function testConversion(location) {
  log(colors.yellow, `\n🧪 Testing conversion for ${location}`);
  log(colors.cyan, '─'.repeat(50));
  
  try {
    const { data, locationName } = await getOpenMeteoData(location);
    log(colors.green, `✓ Fetched Open-Meteo data for ${locationName}`);
    
    const converted = convertOpenMeteoToWeatherAPI(data, locationName);
    log(colors.green, `✓ Successfully converted to WeatherAPI format`);
    
    const errors = validateConvertedData(converted);
    
    if (errors.length > 0) {
      log(colors.red, `❌ Validation errors:`);
      errors.forEach(err => log(colors.red, `  - ${err}`));
      return false;
    }
    
    log(colors.green, `✓ All validation checks passed`);
    
    // Show details
    log(colors.cyan, `\n📍 Location: ${converted.location.name}`);
    log(colors.cyan, `   Coords: (${converted.location.lat}, ${converted.location.lon})`);
    log(colors.cyan, `   TZ: ${converted.location.tz_id}`);
    
    log(colors.cyan, `\n🌡️  Current Conditions:`);
    log(colors.cyan, `   Temp: ${converted.current.temp_c}°C / ${converted.current.temp_f}°F`);
    log(colors.cyan, `   Feels like: ${converted.current.feelslike_c}°C / ${converted.current.feelslike_f}°F`);
    log(colors.cyan, `   Condition: ${converted.current.condition.text}`);
    log(colors.cyan, `   Humidity: ${converted.current.humidity}%`);
    log(colors.cyan, `   Wind: ${converted.current.wind_kph} km/h (${converted.current.wind_dir}) / ${converted.current.wind_mph} mph`);
    log(colors.cyan, `   Gust: ${converted.current.gust_kph} km/h`);
    log(colors.cyan, `   Precipitation: ${converted.current.precip_mm} mm (${converted.current.precip_in} in)`);
    log(colors.cyan, `   UV Index: ${converted.current.uv}`);
    log(colors.cyan, `   Day/Night: ${converted.current.is_day ? 'Day' : 'Night'}`);
    
    log(colors.cyan, `\n📅 Forecast (3 days):`);
    converted.forecast.forecastday.forEach((day, i) => {
      const d = day.day;
      log(colors.cyan, `   Day ${i + 1} (${day.date}):`);
      log(colors.cyan, `     Temp: ${d.mintemp_c}°C - ${d.maxtemp_c}°C / ${d.mintemp_f}°F - ${d.maxtemp_f}°F`);
      log(colors.cyan, `     Avg: ${d.avgtemp_c}°C / ${d.avgtemp_f}°F`);
      log(colors.cyan, `     Condition: ${d.condition.text}`);
      log(colors.cyan, `     Rain: ${d.daily_will_it_rain ? 'Yes' : 'No'} (${d.daily_chance_of_rain}% chance)`);
      log(colors.cyan, `     Snow: ${d.daily_will_it_snow ? 'Yes' : 'No'}`);
      log(colors.cyan, `     Wind: ${d.maxwind_kph} km/h / ${d.maxwind_mph} mph`);
      log(colors.cyan, `     Humidity: ${d.avghumidity}%`);
      log(colors.cyan, `     UV: ${d.uv}`);
    });
    
    log(colors.green, `\n✅ ${location} conversion test PASSED\n`);
    return true;
  } catch (error) {
    log(colors.red, `❌ Error: ${error.message}`);
    return false;
  }
}

async function main() {
  log(colors.cyan, '\n' + '='.repeat(60));
  log(colors.cyan, 'WEATHER DATA CONVERTER TEST');
  log(colors.cyan, '='.repeat(60));
  
  const testLocations = ['London', 'New York', 'Tokyo', 'Sydney', 'Nairobi'];
  let passed = 0;
  let failed = 0;
  
  for (const location of testLocations) {
    const success = await testConversion(location);
    if (success) passed++;
    else failed++;
  }
  
  log(colors.cyan, '='.repeat(60));
  log(colors.cyan, 'RESULTS');
  log(colors.cyan, '='.repeat(60));
  log(colors.green, `✓ Passed: ${passed}`);
  if (failed > 0) log(colors.red, `✗ Failed: ${failed}`);
  log(colors.cyan, `Total: ${passed + failed}`);
  
  if (failed === 0) {
    log(colors.green, '\n✨ All converter tests passed!\n');
    process.exit(0);
  } else {
    log(colors.red, `\n⚠️  ${failed} test(s) failed\n`);
    process.exit(1);
  }
}

main().catch(err => {
  log(colors.red, 'Fatal error:', err.message);
  process.exit(1);
});
