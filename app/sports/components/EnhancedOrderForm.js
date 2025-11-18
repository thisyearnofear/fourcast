'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { tradingService } from '@/services/tradingService';
import { 
  ValidationAlert, 
  ValidationSummary, 
  useValidationFeedback 
} from './ValidationDisplay';

/**
 * EnhancedOrderForm - User-friendly order form with comprehensive validation
 * 
 * ENHANCEMENTS:
 * - Real-time validation feedback
 * - Progressive validation disclosure
 * - Performance optimized with debouncing
 * - Intuitive error/warning display
 */

export default function EnhancedOrderForm({
  market,
  walletAddress,
  isConnected,
  onSuccess,
  isNight,
  chainId
}) {
  const [orderForm, setOrderForm] = useState({
    side: 'BUY',
    price: market?.currentOdds?.yes || null,
    size: 1
  });
  
  const [walletStatus, setWalletStatus] = useState(null);
  const [marketData, setMarketData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [feeBps, setFeeBps] = useState(null);

  // Real-time order validation
  const orderValidator = useMemo(() => {
    return async (orderData) => {
      if (!walletStatus || !marketData) return null;
      
      const validation = await tradingService.validateOrder(
        {
          ...orderData,
          marketID: market.tokenID || market.id,
          walletAddress
        },
        walletStatus,
        marketData
      );
      
      return validation.details || validation;
    };
  }, [walletStatus, marketData, market, walletAddress]);

  const { validation: orderValidation, isValidating } = useValidationFeedback(
    orderForm,
    orderValidator,
    [walletStatus, marketData]
  );

  // Load wallet status and market data
  useEffect(() => {
    if (isConnected && walletAddress) {
      loadWalletStatus();
    }
  }, [walletAddress, isConnected]);

  useEffect(() => {
    if (market?.tokenID || market?.id) {
      loadMarketData();
    }
  }, [market]);

  useEffect(() => {
    loadFeeInfo();
  }, [chainId]);

  const loadWalletStatus = async () => {
    try {
      const result = await tradingService.checkWalletStatus(walletAddress, chainId);
      if (result.success) {
        setWalletStatus({
          balance: result.balance,
          approved: result.approved
        });
      }
    } catch (error) {
      console.error('Failed to load wallet status:', error);
    }
  };

  const loadMarketData = async () => {
    try {
      const marketId = market.tokenID || market.id;
      const response = await fetch(`/api/markets/${marketId}`);
      const data = await response.json();
      
      if (data.success) {
        setMarketData(data.marketData);
      }
    } catch (error) {
      console.error('Failed to load market data:', error);
    }
  };

  const loadFeeInfo = async () => {
    try {
      const cid = chainId || 56;
      const res = await fetch(`/api/predictions/health?chainId=${cid}`);
      const json = await res.json();
      if (json?.success) {
        setFeeBps(json.feeBps);
      }
    } catch (error) {
      console.error('Failed to load fee info:', error);
    }
  };

  const handleInputChange = (field, value) => {
    setOrderForm(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear submit errors on input change
    if (submitError) {
      setSubmitError(null);
    }
  };

  const calculateOrderCost = () => {
    if (!orderForm.price || !orderForm.size || !feeBps) return null;
    return tradingService.calculateOrderCost(orderForm.price, orderForm.size, feeBps);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!isConnected) {
      setSubmitError('Please connect your wallet first');
      return;
    }

    if (orderValidation && !orderValidation.valid) {
      setSubmitError('Please fix the validation errors before submitting');
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const orderData = {
        ...orderForm,
        marketID: market.tokenID || market.id,
        walletAddress
      };

      const result = await tradingService.submitOrder(orderData, walletStatus, marketData);

      if (result.success) {
        onSuccess?.({
          orderID: result.orderID,
          ...result
        });
        
        // Reset form
        setOrderForm({
          side: 'BUY',
          price: market?.currentOdds?.yes || null,
          size: 1
        });
      } else {
        setSubmitError(result.error || 'Order submission failed');
      }
    } catch (error) {
      console.error('Order submission error:', error);
      setSubmitError('Failed to submit order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const orderCost = calculateOrderCost();
  const canSubmit = isConnected && 
                   orderForm.price && 
                   orderForm.size && 
                   !isValidating && 
                   (!orderValidation || orderValidation.valid) &&
                   !isSubmitting;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6 space-y-6">
      <div className="border-b border-gray-200 pb-4">
        <h3 className="text-xl font-semibold text-gray-900">
          Place Order
        </h3>
        {market && (
          <p className="text-sm text-gray-600 mt-1">
            {market.title || market.question}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Order Side */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Order Type
          </label>
          <div className="flex space-x-2">
            {['BUY', 'SELL'].map((side) => (
              <button
                key={side}
                type="button"
                onClick={() => handleInputChange('side', side)}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  orderForm.side === side
                    ? side === 'BUY' 
                      ? 'bg-green-100 text-green-700 border-green-300'
                      : 'bg-red-100 text-red-700 border-red-300'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                } border`}
              >
                {side} {side === 'BUY' ? 'YES' : 'NO'}
              </button>
            ))}
          </div>
        </div>

        {/* Price Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Price (per share)
          </label>
          <div className="relative">
            <input
              type="number"
              min="0"
              max="1"
              step="0.001"
              value={orderForm.price || ''}
              onChange={(e) => handleInputChange('price', parseFloat(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="0.000"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-3">
              <span className="text-gray-500 text-sm">USDC</span>
            </div>
          </div>
          
          {/* Current market price hint */}
          {market?.currentOdds && (
            <div className="text-xs text-gray-500">
              Current: YES {market.currentOdds.yes} / NO {market.currentOdds.no}
            </div>
          )}
        </div>

        {/* Size Input */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">
            Shares
          </label>
          <input
            type="number"
            min="1"
            value={orderForm.size || ''}
            onChange={(e) => handleInputChange('size', parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="1"
          />
        </div>

        {/* Order Cost Display */}
        {orderCost && (
          <div className="bg-gray-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Base Cost:</span>
              <span className="font-medium">{orderCost.baseCost} USDC</span>
            </div>
            {orderCost.fee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Fee:</span>
                <span className="font-medium">{orderCost.fee} USDC</span>
              </div>
            )}
            <div className="flex justify-between font-medium border-t border-gray-200 pt-2">
              <span>Total Cost:</span>
              <span>{orderCost.total} USDC</span>
            </div>
          </div>
        )}

        {/* Real-time Validation Display */}
        {isValidating && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
            <span>Validating order...</span>
          </div>
        )}

        {orderValidation && (
          <ValidationSummary 
            validation={orderValidation}
            className="border border-gray-200 rounded-lg p-4"
          />
        )}

        {/* Submit Error */}
        {submitError && (
          <ValidationAlert 
            validation={{ valid: false, errors: [submitError] }}
          />
        )}

        {/* Wallet Status Check */}
        {!isConnected && (
          <ValidationAlert 
            validation={{ 
              valid: false, 
              errors: ['Please connect your wallet to place orders'] 
            }}
          />
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={!canSubmit}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            canSubmit
              ? orderForm.side === 'BUY'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
              <span>Submitting...</span>
            </div>
          ) : (
            `${orderForm.side} ${orderForm.side === 'BUY' ? 'YES' : 'NO'} Shares`
          )}
        </button>
      </form>

      {/* Order Summary */}
      {orderForm.price && orderForm.size && (
        <div className="text-xs text-gray-500 space-y-1">
          <p>• Orders are submitted to the blockchain and may take time to confirm</p>
          <p>• Prices may change before your order is filled</p>
          <p>• You can cancel unfilled orders at any time</p>
        </div>
      )}
    </div>
  );
}