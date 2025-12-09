#!/usr/bin/env node

// Integration test script for Open-Meteo with Fourcast
import axios from 'axios';

async function testOpenMeteoIntegration() {
  console.log('Testing Open-Meteo integration with Fourcast...\n');
  
  try {
    // Test the updated weather service with a few locations
    const locations = ['New York', 'London', 'Tokyo'];
    
    for (const location of locations) {
      console.log(`Testing location: ${location}`);
      
      try {
        // Call our updated weather API route
        const response = await axios.get(`http://localhost:3000/api/weather?location=${encodeURIComponent(location)}`);
        
        console.log(`✅ Success for ${location}:`);
        console.log(`   Temperature: ${response.data.current.temp_f}°F (${response.data.current.temp_c}°C)`);
        console.log(`   Condition: ${response.data.current.condition.text}`);
        console.log(`   Source: ${response.data.source || 'weatherapi'}`);
        console.log(`   Forecast days: ${response.data.forecast.forecastday.length}\n`);
      } catch (error) {
        console.log(`❌ Error for ${location}:`, error.message);
        if (error.response) {
          console.log(`   Status: ${error.response.status}`);
        }
      }
    }
    
    console.log('Integration test completed!');
  } catch (error) {
    console.error('❌ Error during integration test:', error.message);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  testOpenMeteoIntegration();
}

export { testOpenMeteoIntegration };