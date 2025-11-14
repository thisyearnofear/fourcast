/**
 * Trading Service - Handles wallet operations and order submission
 * Single source of truth for trading-related API calls
 */

export const tradingService = {
  /**
   * Check wallet USDC balance and trading approval status
   */
  async checkWalletStatus(walletAddress) {
    if (!walletAddress) return null;

    try {
      const response = await fetch('/api/wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress })
      });

      const data = await response.json();
      if (data.success) {
        return { success: true, wallet: data.wallet };
      }
      return { success: false, error: data.error || 'Unable to check wallet status' };
    } catch (err) {
      console.error('Wallet check failed:', err);
      return { success: false, error: 'Failed to check wallet status' };
    }
  },

  /**
   * Calculate order cost (base cost + fees)
   */
  calculateOrderCost(price, size) {
    if (!price || !size) return null;
    const baseCost = price * size;
    return {
      baseCost: baseCost.toFixed(2),
      total: baseCost.toFixed(2) // Fee would be added here in full version
    };
  },

  /**
   * Validate order before submission
   */
  validateOrder(order, walletStatus) {
    const { price, size, walletAddress } = order;
    const orderCost = this.calculateOrderCost(price, size);

    if (!walletAddress) {
      return { valid: false, error: 'Wallet not connected' };
    }

    if (!price || !size) {
      return { valid: false, error: 'Missing price or size' };
    }

    if (walletStatus && parseFloat(walletStatus.balance.formatted) < parseFloat(orderCost.total)) {
      return {
        valid: false,
        error: `Insufficient balance. Need ${orderCost.total} USDC, have ${walletStatus.balance.formatted} USDC`
      };
    }

    return { valid: true };
  },

  /**
   * Submit order to Polymarket
   */
  async submitOrder(order, walletStatus) {
    const validation = this.validateOrder(order, walletStatus);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          marketID: order.marketID,
          price: parseFloat(order.price),
          side: order.side,
          size: parseFloat(order.size),
          feeRateBps: 0,
          walletData: {
            address: order.walletAddress,
            signer: 'wagmi',
            usdcBalance: walletStatus?.balance?.formatted || '0'
          }
        })
      });

      const data = await response.json();
      if (data.success) {
        return {
          success: true,
          orderID: data.orderID,
          order: data.order
        };
      }
      return { success: false, error: data.error || 'Order submission failed' };
    } catch (err) {
      console.error('Order submission error:', err);
      return { success: false, error: 'Failed to submit order' };
    }
  }
};
