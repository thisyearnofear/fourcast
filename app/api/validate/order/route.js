import { TradingValidator } from '@/services/validators/index.js';

/**
 * Order Validation API Endpoint
 * 
 * POST /api/validate/order
 * Comprehensive order validation with risk assessment
 */

export const runtime = 'edge';

export async function POST(request) {
  try {
    const { orderData, walletStatus, marketData, userPreferences } = await request.json();

    // Validate required fields
    if (!orderData) {
      return Response.json({
        valid: false,
        errors: ['orderData is required'],
        warnings: [],
        category: 'trading'
      }, { status: 400 });
    }

    // Run comprehensive order validation
    const validation = TradingValidator.validateTradingOperation('order', orderData, {
      walletStatus,
      marketData,
      userPreferences: userPreferences || {}
    });

    // Add price impact estimation if market data available
    let priceImpact = null;
    if (marketData) {
      const priceImpactValidation = TradingValidator.validateTradingOperation('price-impact', orderData, {
        marketData
      });
      priceImpact = {
        estimatedImpact: priceImpactValidation.estimatedPriceImpact,
        warnings: priceImpactValidation.warnings
      };
    }

    return Response.json({
      ...validation,
      priceImpact,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Order validation API error:', error);
    return Response.json({
      valid: false,
      errors: [`Order validation failed: ${error.message}`],
      warnings: [],
      category: 'trading'
    }, { status: 500 });
  }
}

export async function GET(request) {
  return Response.json({
    endpoint: '/api/validate/order',
    method: 'POST',
    description: 'Comprehensive order validation with risk assessment',
    requiredFields: ['orderData'],
    optionalFields: ['walletStatus', 'marketData', 'userPreferences'],
    orderDataFields: ['price', 'size', 'side', 'marketID', 'walletAddress'],
    riskLevels: ['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH']
  });
}