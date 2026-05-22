import { WeatherDataValidator } from '@/services/validators/index.js';

/**
 * Weather Data Validation API Endpoint
 * 
 * POST /api/validate/weather
 * Validates weather data quality and completeness
 */

export const runtime = 'edge';

export async function POST(request) {
  try {
    const { weatherData, dataType = 'current', analysisType } = await request.json();

    // Validate required fields
    if (!weatherData) {
      return Response.json({
        valid: false,
        errors: ['weatherData is required'],
        warnings: [],
        category: 'weather-data'
      }, { status: 400 });
    }

    // Run weather data validation
    const validation = WeatherDataValidator.validateWeatherData(dataType, weatherData);

    // Add analysis capability assessment if analysisType provided
    let capabilities = null;
    if (analysisType) {
      capabilities = WeatherDataValidator.checkWeatherDataCapabilities(weatherData, analysisType);
    }

    return Response.json({
      ...validation,
      capabilities,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Weather validation API error:', error);
    return Response.json({
      valid: false,
      errors: [`Weather validation failed: ${error.message}`],
      warnings: [],
      category: 'weather-data'
    }, { status: 500 });
  }
}

export async function GET(request) {
  return Response.json({
    endpoint: '/api/validate/weather',
    method: 'POST',
    description: 'Validates weather data quality and completeness',
    requiredFields: ['weatherData'],
    optionalFields: ['dataType', 'analysisType'],
    supportedDataTypes: ['current', 'forecast', 'historical', 'location'],
    supportedAnalysisTypes: ['temperature-analysis', 'precipitation-analysis', 'wind-analysis', 'outdoor-sports', 'aviation', 'agriculture']
  });
}