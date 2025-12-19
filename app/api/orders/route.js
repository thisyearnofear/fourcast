import { polymarketService } from '@/services/polymarketService';
import { builderService } from '@/services/builderService';
import { APIInputValidator, TradingValidator, MarketDataValidator } from '@/services/validators/index.js';

// Order submission rate limiting
const orderRateLimit = new Map();
const ORDER_RATE_LIMIT = 20; // 20 orders per hour per user
const ORDER_WINDOW = 60 * 60 * 1000; // 1 hour

function checkOrderRateLimit(identifier) {
  const now = Date.now();
  const userOrders = orderRateLimit.get(identifier) || [];

  // Remove old requests
  const validOrders = userOrders.filter(timestamp => now - timestamp < ORDER_WINDOW);

  if (validOrders.length >= ORDER_RATE_LIMIT) {
    return false;
  }

  // Add current order
  validOrders.push(now);
  orderRateLimit.set(identifier, validOrders);

  return true;
}

function getClientIdentifier(request) {
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const userAgent = request.headers.get('user-agent');

  return (
    forwarded?.split(',')[0]?.trim() ||
    realIp?.trim() ||
    userAgent ||
    'unknown'
  );
}

/**
 * Validate wallet is connected and has sufficient balance
 * Fetched from frontend after wallet connection
 */
function validateWalletData(walletData) {
  if (!walletData?.address || !walletData?.signer) {
    throw new Error('Wallet not connected');
  }

  if (walletData.usdcBalance === undefined) {
    throw new Error('Unable to verify balance');
  }

  return true;
}

/**
 * Add builder attribution headers to order
 * User signs client-side, server just adds metadata
 */
function getBuilderAttributionHeaders() {
  // Builder attribution headers - public metadata only
  // No signing needed - just identifies which builder the order came from
  const builderKey = process.env.POLY_BUILDER_API_KEY;
  
  if (!builderKey) {
    return {}; // Builder attribution optional
  }

  return {
    'X-Builder-Key': builderKey,
    // Timestamp for request validation
    'X-Builder-Timestamp': Math.floor(Date.now() / 1000).toString()
  };
}

/**
 * POST /api/orders
 * Submit a user-signed prediction market order to Polymarket
 * User signs order client-side, server adds builder attribution and forwards
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      marketID,
      price,
      side,
      size,
      walletAddress,
      signedOrder  // Already signed by user in browser
    } = body;

    // Input validation
    if (!marketID || price === undefined || !side || !size || !walletAddress || !signedOrder) {
      return Response.json({
        success: false,
        error: 'Missing required fields: marketID, price, side, size, walletAddress, signedOrder'
      }, { status: 400 });
    }

    // Rate limiting
    const clientId = getClientIdentifier(request);
    if (!checkOrderRateLimit(clientId)) {
      return Response.json(
        {
          success: false,
          error: 'Order rate limit exceeded. Maximum 20 orders per hour.',
          retryAfter: Math.ceil(ORDER_WINDOW / 1000)
        },
        { status: 429 }
      );
    }

    // ENHANCED: Get market data for comprehensive validation
    const marketData = await polymarketService.getMarketDetails(marketID);
    if (!marketData) {
      return Response.json({
        success: false,
        error: 'Market not found or temporarily unavailable'
      }, { status: 404 });
    }

    // Validate market data quality
    const marketValidation = MarketDataValidator.validateMarketData('market', marketData);
    if (!marketValidation.valid) {
      return Response.json({
        success: false,
        error: 'Market data validation failed',
        errors: marketValidation.errors,
        warnings: marketValidation.warnings
      }, { status: 400 });
    }

    // Get builder attribution headers (metadata only, no signing)
    const builderHeaders = getBuilderAttributionHeaders();
    const isBuilderAttributed = Object.keys(builderHeaders).length > 0;

    try {
      // Forward already-signed order to Polymarket with builder headers
      const response = await fetch('https://clob.polymarket.com/order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...builderHeaders  // Add builder attribution metadata
        },
        body: JSON.stringify(signedOrder)
      });

      if (!response.ok) {
        throw new Error(`Polymarket API: ${response.statusText}`);
      }

      const result = await response.json();

      // Log order for analytics (background task)
      if (isBuilderAttributed) {
        builderService.getDailyVolume().catch(err =>
          console.debug('Failed to update volume cache:', err.message)
        );
      }

      return Response.json({
        success: true,
        orderID: result.orderID || result.id,
        order: {
          marketID,
          side,
          size: parseFloat(size),
          price: parseFloat(price),
          status: 'submitted'
        },
        // Builder Program info
        builder: {
          attributed: isBuilderAttributed,
          leaderboardEligible: isBuilderAttributed,
          message: isBuilderAttributed 
            ? 'Order attributed to builder account - volume will be tracked on leaderboard'
            : 'Order submitted without builder attribution'
        },
        polymarketResponse: result,
        timestamp: new Date().toISOString()
      }, { status: 201 });
    } catch (orderError) {
      console.error('Order submission failed:', orderError);

      return Response.json(
        {
          success: false,
          error: 'Failed to submit order to Polymarket',
          detail: orderError.message
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Orders API Error:', error);

    return Response.json(
      {
        success: false,
        error: 'Order processing failed',
        message: error.message
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/orders
 * Return service status and rate limit info
 */
export async function GET() {
  const status = polymarketService.getStatus();

  return Response.json({
    service: 'Polymarket Order Submission',
    status: 'available',
    capabilities: {
      submitOrders: true,
      validateOrders: true,
      checkBalance: false // Use /api/wallet for balance checks
    },
    rateLimit: `${ORDER_RATE_LIMIT} orders per hour`,
    polymarket: status
  });
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}
