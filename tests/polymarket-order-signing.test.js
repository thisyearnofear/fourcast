// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOrderSigning } from '../hooks/useOrderSigning';

const mockAddress = '0x1234567890123456789012345678901234567890';
const mockSignTypedData = vi.fn();

vi.mock('wagmi', () => ({
  useAccount: vi.fn(() => ({
    address: mockAddress,
    isConnected: true,
  })),
  useWalletClient: vi.fn(() => ({
    data: { signTypedData: mockSignTypedData },
  })),
}));

describe('useOrderSigning with proper EIP-712', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignTypedData.mockResolvedValue('0xmock-signature-123');
  });

  it('should sign an order returning signature and payload', async () => {
    const { result } = renderHook(() => useOrderSigning());

    await act(async () => {
      const signed = await result.current.signOrder({
        tokenID: '123456',
        price: 0.65,
        side: 'YES',
        size: 100,
      });

      expect(signed).toHaveProperty('signature', '0xmock-signature-123');
      expect(signed).toHaveProperty('payload');
      expect(signed.payload.side).toBe('BUY');
      expect(signed.payload.token_id).toBe('123456');
    });
  });

  it('should set BUY side regardless of YES/NO input', async () => {
    const { result } = renderHook(() => useOrderSigning());

    await act(async () => {
      const noSigned = await result.current.signOrder({
        tokenID: '123456', price: 0.35, side: 'NO', size: 50,
      });
      const yesSigned = await result.current.signOrder({
        tokenID: '123456', price: 0.65, side: 'YES', size: 100,
      });

      expect(noSigned.payload.side).toBe('BUY');
      expect(yesSigned.payload.side).toBe('BUY');
    });
  });

  it('should throw when required tokenID is missing', async () => {
    const { result } = renderHook(() => useOrderSigning());

    await act(async () => {
      await expect(
        result.current.signOrder({ price: 0.5, side: 'YES', size: 100 })
      ).rejects.toThrow('Token ID is required');
    });
  });

  it('should call wallet signTypedData with EIP-712 domain/types', async () => {
    const { result } = renderHook(() => useOrderSigning());

    await act(async () => {
      await result.current.signOrder({
        tokenID: '21061307', price: 0.65, side: 'YES', size: 100,
      });
    });

    expect(mockSignTypedData).toHaveBeenCalledTimes(1);
    const callArgs = mockSignTypedData.mock.calls[0][0];
    expect(callArgs.domain.name).toBe('Polymarket CTF Exchange');
    expect(callArgs.primaryType).toBe('Order');
    expect(callArgs.message.tokenId.toString()).toBe('21061307');
  });

  it('should submit signed order to the backend API', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ orderID: 'test-order-123', success: true }),
    });

    const { result } = renderHook(() => useOrderSigning());

    const signedData = {
      order: {},
      signature: '0x...',
      payload: {
        token_id: '123456', price: '0.65', side: 'BUY',
        size: '100', fee_rate_bps: 0, nonce: 123, expiration: 0,
        signature: '0x...',
      },
    };

    await act(async () => {
      const submitResult = await result.current.submitOrder(signedData, 1000);
      expect(submitResult).toHaveProperty('orderID', 'test-order-123');
      expect(submitResult.success).toBe(true);
    });

    expect(global.fetch).toHaveBeenCalledWith('/api/orders', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('"marketID":1000'),
    }));
  });

  it('should complete the full flow via submitOrderFlow', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ orderID: 'flow-order-456', success: true }),
    });

    const { result } = renderHook(() => useOrderSigning());

    await act(async () => {
      const flowResult = await result.current.submitOrderFlow(
        { tokenID: '789', price: 0.5, side: 'YES', size: 50, marketID: 789 },
        1000
      );
      expect(flowResult).toHaveProperty('orderID', 'flow-order-456');
    });

    expect(global.fetch).toHaveBeenCalled();
  });

  it('should set error state when submission fails', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: 'Server rejected order' }),
    });

    const { result } = renderHook(() => useOrderSigning());

    const _signedData = {
      order: {},
      signature: '0x...',
      payload: { token_id: '1', price: '0.5', side: 'BUY', size: '10', signature: '0x...' },
    };

    await act(async () => {
      await result.current.submitOrderFlow(
        { tokenID: '1', price: 0.5, side: 'YES', size: 10, marketID: 1 },
        1000
      );
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.isSubmitting).toBe(false);
  });
});
