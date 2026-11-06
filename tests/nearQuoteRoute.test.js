import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../services/near/nearIntents.js', () => ({
  getQuote: vi.fn(async () => ({
    quote: {
      amountIn: '1000000000000000000000000',
      amountInFormatted: '1 NEAR',
      amountOut: '2500000',
      amountOutFormatted: '2.50 USDC',
      minAmountOut: '2475000',
      depositAddress: null,
      deadline: '2026-11-05T14:00:00Z',
      timeEstimate: 25,
    },
  })),
  getExecutionStatus: vi.fn(async () => ({ status: 'SUCCESS', depositAddress: 'dep-addr-1' })),
}));

import { GET } from '../app/api/near/quote/route';
import { getQuote, getExecutionStatus } from '../services/near/nearIntents.js';

const req = (qs = '') => ({ url: `http://localhost/api/near/quote${qs}` });

describe('GET /api/near/quote', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns a dry quote normalized for the frontend', async () => {
    const res = await GET(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.dry).toBe(true);
    expect(body.quote.amountOutFormatted).toBe('2.50 USDC');
    expect(body.quote.timeEstimate).toBe(25);
  });

  it('always requests a dry quote — never mints a deposit address', async () => {
    await GET(req('?amount=5000000&origin=solana:usdc&dest=nep141:usdc'));
    expect(getQuote).toHaveBeenCalledTimes(1);
    const args = getQuote.mock.calls[0][0];
    expect(args.dry).toBe(true);
    expect(args.amount).toBe('5000000');
    expect(args.originAsset).toBe('solana:usdc');
    expect(args.destinationAsset).toBe('nep141:usdc');
    expect(args.recipient).toBeTruthy();
    expect(args.refundTo).toBe(args.recipient);
  });

  it('forwards to execution status when ?status= is present', async () => {
    const res = await GET(req('?status=dep-addr-1'));
    const body = await res.json();
    expect(getExecutionStatus).toHaveBeenCalledWith({ depositAddress: 'dep-addr-1' });
    expect(body.status.status).toBe('SUCCESS');
  });

  it('degrades to 502, never an exception, when the solver API fails', async () => {
    getQuote.mockRejectedValueOnce(new Error('1-Click POST /v0/quote → 503'));
    const res = await GET(req());
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toContain('503');
  });
});
