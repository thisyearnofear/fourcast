// Polymarket Trading — order validation and execution functions
// Extracted from PolymarketService class methods

import axios from 'axios';
import { Wallet } from 'ethers';
import { cache } from './polymarketCache.js';
import { getMarketDetails } from './polymarketDiscovery.js';
import * as helpers from './polymarketHelpers.js';

/**
 * NEW: Comprehensive market validation for trading operations
 * Used by enhanced tradingService and API routes
 */
export async function validateMarketForTrading(marketID) {
  try {
    const marketData = await getMarketDetails(marketID);
    if (!marketData) {
      return {
        valid: false,
        error: 'Market not found',
        marketData: null
      };
    }

    // Market already includes validation from getMarketDetails
    const marketValidation = marketData.validation?.market;
    const pricingValidation = marketData.validation?.pricing;

    // Additional trading-specific validations
    const tradingIssues = [];
    const tradingWarnings = [];

    // Check if market is closed or resolved
    if (marketData.closed) {
      tradingIssues.push('Market is closed for trading');
    }

    if (marketData.resolved) {
      tradingIssues.push('Market has been resolved');
    }

    // Check resolution date
    if (marketData.endDate) {
      const endDate = new Date(marketData.endDate);
      const now = new Date();
      if (endDate <= now) {
        tradingIssues.push('Market has expired');
      } else if (endDate <= new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
        tradingWarnings.push('Market expires within 24 hours');
      }
    }

    // Check liquidity
    const liquidity = parseFloat(marketData.liquidity || '0');
    if (liquidity < 1000) {
      tradingWarnings.push('Low market liquidity - expect price impact');
    }

    const allErrors = [
      ...(marketValidation?.errors || []),
      ...(pricingValidation?.errors || []),
      ...tradingIssues
    ];

    const allWarnings = [
      ...(marketValidation?.warnings || []),
      ...(pricingValidation?.warnings || []),
      ...tradingWarnings
    ];

    return {
      valid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      marketData,
      validation: {
        market: marketValidation,
        pricing: pricingValidation,
        trading: {
          valid: tradingIssues.length === 0,
          errors: tradingIssues,
          warnings: tradingWarnings
        }
      }
    };
  } catch (error) {
    console.error(`Error validating market ${marketID} for trading:`, error.message);
    return {
      valid: false,
      error: `Market validation failed: ${error.message}`,
      marketData: null
    };
  }
}

/**
 * Get enriched market details with full analytics for edge detection
 * Combines base market data with order book analytics
 */
export async function getEnrichedMarketDetails(marketID) {
  try {
    // Get base market details
    const baseMarketData = await getMarketDetails(marketID);
    if (!baseMarketData) return null;

    // Enrich with order book and analytics
    const enrichedData = await helpers.enrichMarketWithOrderBook(baseMarketData);

    return enrichedData;
  } catch (error) {
    console.error(`Error enriching market details for ${marketID}:`, error.message);
    return null;
  }
}

/**
 * Get market price history (if available via API)
 */
export async function getMarketHistory(marketID) {
  try {
    const response = await axios.get(`${cache.baseURL}/markets/${marketID}/history`, {
      params: { limit: 100 },
      timeout: 10000
    });
    return response.data;
  } catch (error) {
    console.debug('Market history not available:', error.message);
    return null;
  }
}

/**
 * Build order object for CLOB client
 * Validates all required fields before sending to blockchain
 */
export function buildOrderObject(marketData, price, side, size, feeRateBps = 0) {
  try {
    if (!marketData?.id && !marketData?.tokenID) {
      throw new Error('Market ID is required');
    }

    const tokenID = marketData.id || marketData.tokenID;
    const tradingMetadata = marketData.tradingMetadata || {
      tickSize: '0.001',
      negRisk: false,
      chainId: 137
    };

    // Validate price is within tick size precision
    const tickSize = parseFloat(tradingMetadata.tickSize);
    if (price % tickSize !== 0) {
      console.warn(`Price ${price} not aligned with tick size ${tickSize}`);
    }

    return {
      tokenID,
      price: parseFloat(price),
      side: side.toUpperCase(),
      size: parseFloat(size),
      feeRateBps: parseInt(feeRateBps),
      metadata: {
        tickSize: tradingMetadata.tickSize,
        negRisk: tradingMetadata.negRisk
      }
    };
  } catch (error) {
    console.error('Order building error:', error.message);
    throw error;
  }
}

/**
 * Validate order before submission
 * Checks market exists, price in valid range, sufficient size
 */
export async function validateOrder(orderData) {
  try {
    const { marketID, price, side, size } = orderData;

    if (!marketID || price === undefined || !side || !size) {
      throw new Error('Missing required order fields');
    }

    if (price < 0 || price > 1) {
      throw new Error('Price must be between 0 and 1');
    }

    if (size <= 0) {
      throw new Error('Size must be greater than 0');
    }

    // Fetch market details to verify it exists
    const marketData = await getMarketDetails(marketID);
    if (!marketData) {
      throw new Error(`Market ${marketID} not found`);
    }

    return {
      valid: true,
      marketData
    };
  } catch (error) {
    console.error('Order validation error:', error.message);
    return {
      valid: false,
      error: error.message
    };
  }
}

/**
 * Get order metadata for display
 */
export function getOrderMetadata(order, marketData) {
  return {
    market: marketData?.title || 'Unknown Market',
    side: order.side,
    size: order.size,
    price: order.price,
    cost: helpers.calculateOrderCost(order.price, order.size, order.feeRateBps),
    tokenID: order.tokenID,
    tradingMetadata: marketData?.tradingMetadata
  };
}

/**
 * Execute a trade server-side using a private key and the Polymarket Builder SDK
 * Handles EIP-712 order signing and submission with builder attribution
 */
export async function executeServerOrder(orderData, privateKey) {
  try {
    const { tokenID, price, side, size, tickSize } = orderData;
    if (!privateKey) {
      throw new Error('Private key is required for server-side order execution');
    }

    const signer = new Wallet(privateKey);

    // Initialize BuilderConfig if builder credentials are configured
    let builderConfig;
    const { BuilderConfig } = await import('@polymarket/builder-signing-sdk');
    const builderKey = process.env.POLY_BUILDER_API_KEY;
    const builderSecret = process.env.POLY_BUILDER_SECRET;
    const builderPassphrase = process.env.POLY_BUILDER_PASSPHRASE;

    if (builderKey && builderSecret && builderPassphrase) {
      builderConfig = new BuilderConfig({
        localBuilderCreds: {
          key: builderKey,
          secret: builderSecret,
          passphrase: builderPassphrase,
        },
      });
      console.log('Attributing order to Builder Program API Key:', builderKey);
    } else {
      console.warn('Builder credentials not configured. Order will not be attributed.');
    }

    // Import ClobClient dynamically to prevent any initialization race conditions
    const { ClobClient } = await import('@polymarket/clob-client');

    // Initialize temp client without credentials to derive/create them
    const tempClient = new ClobClient(
      cache.clobBaseURL,
      137, // Polygon mainnet
      signer,
      undefined,
      0, // signatureType: EOA
      undefined, // funderAddress
      undefined, // geoBlockToken
      true, // useServerTime
      builderConfig
    );

    console.log('Deriving L1 API credentials for address:', signer.address);
    const creds = await tempClient.createOrDeriveApiKey();

    // Initialize fully-authenticated client
    const client = new ClobClient(
      cache.clobBaseURL,
      137,
      signer,
      creds,
      0,
      undefined,
      undefined,
      true,
      builderConfig
    );

    console.log(`Placing order: ${side} ${size} shares at ${price} for token ${tokenID}`);

    // Create and post the order
    const response = await client.createAndPostOrder(
      {
        tokenID,
        price: parseFloat(price),
        size: parseFloat(size),
        side,
      },
      {
        tickSize: tickSize || '0.01',
        negRisk: false,
      }
    );

    console.log('Order executed successfully:', response);
    return {
      success: true,
      orderID: response.orderID || response.orderId,
      response,
    };
  } catch (error) {
    console.error('Server-side order execution failed:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}


