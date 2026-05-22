import { FuturesBetValidator, MarketDataValidator } from '@/services/validators/index.js';

/**
 * Market Compatibility Validation API Endpoint
 * 
 * POST /api/validate/market-compatibility
 * Validates market compatibility with weather analysis and data quality
 */

export const runtime = 'edge';

export async function POST(request) {
  try {
    const { market, location, weatherData, requestedAnalysis = 'weather' } = await request.json();

    // Validate required fields
    if (!market) {
      return Response.json({
        valid: false,
        errors: ['market is required'],
        warnings: [],
        category: 'market-compatibility'
      }, { status: 400 });
    }

    const validationResults = {};

    // Market data structure validation
    const marketValidation = MarketDataValidator.validateMarketData('market', market);
    validationResults.marketData = marketValidation;

    // Market pricing validation if odds available
    if (market.currentOdds || market.outcomePrices) {
      const pricingValidation = MarketDataValidator.validateMarketData('pricing', {
        currentOdds: market.currentOdds,
        outcomePrices: market.outcomePrices,
        lastPrice: market.lastPrice
      });
      validationResults.pricing = pricingValidation;
    }

    // Weather compatibility validation
    const weatherCompatibilityValidation = FuturesBetValidator.validateMarketType(
      'weather-compatibility',
      market,
      { requestedAnalysis, location, weatherData }
    );
    validationResults.weatherCompatibility = weatherCompatibilityValidation;

    // Temporal consistency validation
    const temporalValidation = FuturesBetValidator.validateMarketType('temporal', market, {
      requestedAnalysis
    });
    validationResults.temporal = temporalValidation;

    // Risk profile validation
    const riskValidation = FuturesBetValidator.validateMarketType('risk-assessment', market, {
      hasWeatherDependency: weatherCompatibilityValidation.weatherCompatible
    });
    validationResults.risk = riskValidation;

    // Aggregate results
    const allErrors = Object.values(validationResults)
      .flatMap(result => result.errors || [])
      .filter(Boolean);

    const allWarnings = Object.values(validationResults)
      .flatMap(result => result.warnings || [])
      .filter(Boolean);

    const isValid = allErrors.length === 0;

    // Market quality score
    const qualityFactors = {
      dataCompleteness: marketValidation.valid ? 25 : 0,
      pricingIntegrity: validationResults.pricing?.valid !== false ? 25 : 0,
      weatherCompatibility: weatherCompatibilityValidation.weatherCompatible ? 25 : 0,
      temporalConsistency: temporalValidation.valid ? 25 : 0
    };

    const qualityScore = Object.values(qualityFactors).reduce((sum, score) => sum + score, 0);
    const qualityLevel = qualityScore >= 90 ? 'EXCELLENT' :
                        qualityScore >= 75 ? 'GOOD' :
                        qualityScore >= 60 ? 'FAIR' : 'POOR';

    return Response.json({
      valid: isValid,
      errors: allErrors,
      warnings: allWarnings,
      category: 'market-compatibility',
      details: validationResults,
      marketQuality: {
        score: qualityScore,
        level: qualityLevel,
        factors: qualityFactors
      },
      weatherCompatible: weatherCompatibilityValidation.weatherCompatible,
      riskLevel: riskValidation.riskLevel,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Market compatibility validation API error:', error);
    return Response.json({
      valid: false,
      errors: [`Market compatibility validation failed: ${error.message}`],
      warnings: [],
      category: 'market-compatibility'
    }, { status: 500 });
  }
}

export async function GET(request) {
  return Response.json({
    endpoint: '/api/validate/market-compatibility',
    method: 'POST',
    description: 'Validates market compatibility with weather analysis and data quality',
    requiredFields: ['market'],
    optionalFields: ['location', 'weatherData', 'requestedAnalysis'],
    qualityLevels: ['EXCELLENT', 'GOOD', 'FAIR', 'POOR'],
    riskLevels: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']
  });
}