import { polymarketService } from '@/services/polymarketService';
import { ClobClient, OrderType, Side } from '@polymarket/clob-client';
import { Wallet } from '@ethersproject/wallet';

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
 * Initialize CLOB Client server-side
 * Credentials MUST come from environment, not frontend
 */
function initializeClobClient() {
  const privateKey = process.env.POLYMARKET_PRIVATE_KEY;
  const builderKey = process.env.POLY_BUILDER_API_KEY;

  if (!privateKey && !builderKey) {
    console.warn(
      'No Polymarket credentials found. Orders will fail. Set POLYMARKET_PRIVATE_KEY or POLY_BUILDER_API_KEY in .env'
    );
    return null;
  }

  try {
    // Create signer from private key
    const wallet = new Wallet(privateKey);

    // Initialize CLOB client (credentials from env)
    const clobClient = new ClobClient(
      'https://clob.polymarket.com',
      137, // Polygon
      wallet,
      undefined,
      0, // EOA signature type
      wallet.address
    );

    return clobClient;
  } catch (error) {
    console.error('Failed to initialize CLOB client:', error.message);
    return null;
  }
}

/**
 * POST /api/orders
 * Submit a prediction market order to Polymarket
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      marketID,
      price,
      side,
      size,
      feeRateBps = 0,
      walletData
    } = body;

    // Validate required fields
    if (!marketID || price === undefined || !side || !size) {
      return Response.json(
        {
          success: false,
          error: 'Missing required fields: marketID, price, side, size'
        },
        { status: 400 }
      );
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

    // Validate wallet data
    try {
      validateWalletData(walletData);
    } catch (err) {
      return Response.json(
        {
          success: false,
          error: err.message
        },
        { status: 401 }
      );
    }

    // Validate order against market data
    const validation = await polymarketService.validateOrder({
      marketID,
      price: parseFloat(price),
      side,
      size: parseFloat(size)
    });

    if (!validation.valid) {
      return Response.json(
        {
          success: false,
          error: validation.error
        },
        { status: 400 }
      );
    }

    // Check sufficient balance
    const orderCost = polymarketService.calculateOrderCost(
      parseFloat(price),
      parseFloat(size),
      parseInt(feeRateBps)
    );

    if (parseFloat(walletData.usdcBalance) < parseFloat(orderCost.total)) {
      return Response.json(
        {
          success: false,
          error: `Insufficient balance. Need ${orderCost.total} USDC, have ${walletData.usdcBalance} USDC`
        },
        { status: 400 }
      );
    }

    // Initialize CLOB client (server-side only)
    const clobClient = initializeClobClient();
    if (!clobClient) {
      return Response.json(
        {
          success: false,
          error: 'Server configuration error. Polymarket credentials not set.'
        },
        { status: 500 }
      );
    }

    // Build order object
    const orderObject = polymarketService.buildOrderObject(
      validation.marketData,
      parseFloat(price),
      side,
      parseFloat(size),
      parseInt(feeRateBps)
    );

    // Submit to Polymarket
    // NOTE: In production with Builder API, use createAndPostOrder instead
    // For MVP with EOA, we create the order and post it separately
    try {
      const response = await clobClient.createAndPostOrder(
        {
          tokenID: orderObject.tokenID,
          price: orderObject.price,
          side: side.toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
          size: orderObject.size,
          feeRateBps: orderObject.feeRateBps
        },
        orderObject.metadata, // { tickSize, negRisk }
        OrderType.GTC // Good Till Cancelled
      );

      return Response.json(
        {
          success: true,
          orderID: response.orderID || response.id,
          order: {
            marketID,
            side,
            size,
            price,
            cost: orderCost.total,
            status: 'submitted'
          },
          marketData: validation.marketData,
          timestamp: new Date().toISOString()
        },
        { status: 201 }
      );
    } catch (orderError) {
      console.error('Order submission failed:', orderError);

      // IMPROVED: Parse Polymarket-specific errors with recovery guidance
      const errorMap = {
        insufficient: {
          message: 'Insufficient balance or allowance',
          action: 'Deposit USDC to your wallet or approve token spending',
          recoverable: true
        },
        signature: {
          message: 'Signature verification failed',
          action: 'Ensure wallet is properly connected and POLYMARKET_PRIVATE_KEY is set in environment',
          recoverable: true
        },
        nonce: {
          message: 'Transaction nonce error',
          action: 'Wait 30 seconds and try again',
          recoverable: true
        },
        'market not found': {
          message: 'Market no longer exists or is inactive',
          action: 'Select a different market and try again',
          recoverable: true
        },
        'invalid price': {
          message: 'Price outside valid range',
          action: 'Price must be between 0 and 1 (0% to 100%)',
          recoverable: false
        },
        'invalid size': {
          message: 'Order size invalid',
          action: 'Size must be greater than 0',
          recoverable: false
        }
      };

      let errorInfo = {
        message: 'Order submission failed',
        action: 'Check that all order details are correct and try again',
        recoverable: true
      };

      // Check error message against known patterns
      const errorMsg = (orderError.message || '').toLowerCase();
      for (const [key, info] of Object.entries(errorMap)) {
        if (errorMsg.includes(key)) {
          errorInfo = info;
          break;
        }
      }

      return Response.json(
        {
          success: false,
          error: errorInfo.message,
          action: errorInfo.action,
          recoverable: errorInfo.recoverable,
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
