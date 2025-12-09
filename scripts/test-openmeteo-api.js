#!/usr/bin/env node

// Test script to validate Open-Meteo API data quality and format
import axios from 'axios';

async function testOpenMeteo() {
  console.log('Testing Open-Meteo API...');
  
  try {
    // Test with New York coordinates
    const response = await axios.get('https://api.open-meteo.com/v1/forecast', {
      params: {
        latitude: 40.7128,
        longitude: -74.0060,
        hourly: 'temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation',
        daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
        timezone: 'America/New_York',
        forecast_days: 7
      }
    });

    console.log('API Response:');
    console.log('Location:', response.data.latitude, response.data.longitude);
    console.log('Timezone:', response.data.timezone);
    console.log('Current hourly data points:', response.data.hourly.time.length);
    console.log('Current daily data points:', response.data.daily.time.length);
    
    // Show sample data
    console.log('\nSample Hourly Data (first 3 hours):');
    for (let i = 0; i < 3; i++) {
      console.log(`  ${response.data.hourly.time[i]}: ${response.data.hourly.temperature_2m[i]}°C, ${response.data.hourly.wind_speed_10m[i]} km/h`);
    }
    
    console.log('\nSample Daily Data:');
    for (let i = 0; i < 3; i++) {
      console.log(`  ${response.data.daily.time[i]}: Max ${response.data.daily.temperature_2m_max[i]}°C, Min ${response.data.daily.temperature_2m_min[i]}°C, Precip ${response.data.daily.precipitation_sum[i]}mm`);
    }
    
    console.log('\n✅ Open-Meteo API test successful!');
    return response.data;
  } catch (error) {
    console.error('❌ Error testing Open-Meteo API:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
    process.exit(1);
  }
}

// Compare with current WeatherAPI format
function compareDataFormats(openMeteoData) {
  console.log('\n--- Format Comparison ---');
  console.log('Open-Meteo provides:');
  console.log('- Hourly data with temperature, humidity, wind speed, precipitation');
  console.log('- Daily forecast with min/max temperatures and precipitation sum');
  console.log('- Direct JSON response with standardized units');
  console.log('- No API key required');
  console.log('- Up to 16-day forecasts available');
  
  console.log('\nCurrent WeatherAPI provides:');
  console.log('- Current weather conditions');
  console.log('- 3-day forecast with detailed hourly data');
  console.log('- Additional data like UV index, visibility, etc.');
  console.log('- Requires API key');
  console.log('- Rate limiting concerns');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testOpenMeteo().then(data => {
    compareDataFormats(data);
  });
}

export { testOpenMeteo };