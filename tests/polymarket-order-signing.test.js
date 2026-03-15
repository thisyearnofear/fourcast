import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrderSigning } from '../hooks/useOrderSigning';

const mockAddress = '0x1234567890123456789012345678901234567890';
const mockWalletClient = {
  signTypedData: vi.fn(),
};

// Mock wagmi hooks - set up return values in factory
vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: mockAddress,
    isConnected: true,
  })),
  useWalletClient: vi.fn(() => ({
    data: mockWalletClient,
  })),
}));

// Mock Polymarket CLOB client
vi.mock('@polymarket/clob-client', () => ({
  ClobClient: vi.fn().mockImplementation(() => ({
    createOrder: vi.fn().mockResolvedValue({
      orderID: 'test-order-123',
      signature: '0x123...',
    }),
    postOrder: vi.fn().mockResolvedValue({
      orderID: 'test-order-123',
      success: true,
    }),
  })),
}));

describe('useOrderSigning with proper EIP-712', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should build order with correct Polymarket format', () => {
    const { result } = renderHook(() => useOrderSigning());

    const orderParams = {
      marketID: '123456',
      price: 0.65,
      side: 'YES',
      size: 100,
    };

    const order = result.current.buildOrder(orderParams);

    expect(order).toMatchObject({
      tokenID: '123456',
      price: '0.65',
      size: '100',
      side: 'BUY', // YES maps to BUY
      maker: mockAddress.toLowerCase(),
      makerAssetId: '21061307', // USDC token ID
    });
  });

  it('should handle NO side correctly', () => {
    const { result } = renderHook(() => useOrderSigning());

    const orderParams = {
      marketID: '123456',
      price: 0.35,
      side: 'NO',
      size: 50,
    };

    const order = result.current.buildOrder(orderParams);

    expect(order.side).toBe('SELL'); // NO maps to SELL
  });

  it('should validate required fields', () => {
    const { result } = renderHook(() => useOrderSigning());

    expect(() => {
      result.current.buildOrder({
        marketID: '123456',
        // missing price, side, size
      });
    }).toThrow('Missing required order fields');
  });

  it('should validate side values', () => {
    const { result } = renderHook(() => useOrderSigning());

    expect(() => {
      result.current.buildOrder({
        marketID: '123456',
        price: 0.5,
        side: 'INVALID',
        size: 100,
      });
    }).toThrow('Side must be YES or NO');
  });

  it('should sign order using CLOB client', async () => {
    const { result } = renderHook(() => useOrderSigning());

    const orderData = {
      tokenID: '123456',
      price: '0.65',
      size: '100',
      side: 'BUY',
      maker: mockAddress.toLowerCase(),
    };

    await act(async () => {
      const signedOrder = await result.current.signOrder(orderData);
      expect(signedOrder).toHaveProperty('orderID');
      expect(signedOrder).toHaveProperty('signature');
    });
  });

  it('should submit order directly to Polymarket', async () => {
    const { result } = renderHook(() => useOrderSigning());

    const signedOrder = {
      orderID: 'test-order-123',
      makerAssetAmount: '65', // 100 * 0.65
    };

    await act(async () => {
      const submitResult = await result.current.submitOrder(signedOrder, 1000);
      expect(submitResult).toHaveProperty('orderID');
      expect(submitResult.success).toBe(true);
    });
  });

  it('should validate user balance before submission', async () => {
    const { result } = renderHook(() => useOrderSigning());

    const signedOrder = {
      makerAssetAmount: '1000', // Cost more than balance
    };

    await act(async () => {
      await expect(
        result.current.submitOrder(signedOrder, 500) // Only 500 balance
      ).rejects.toThrow('Insufficient balance');
    });
  });
});