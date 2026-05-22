import { describe, it, expect } from 'vitest'
import { POST } from '../app/api/predictions/route'

function mockRequest(body) {
  return {
    json: async () => body,
    headers: new Map([
      ['x-forwarded-for', '127.0.0.1'],
      ['user-agent', 'vitest']
    ])
  }
}

describe('/api/predictions POST fee', () => {
  it('serializes fee value correctly for txRequest', { timeout: 15000 }, async () => {
    const req = mockRequest({
      marketID: 456,
      price: 0.5,
      side: 'BUY',
      size: 0.01,
      walletAddress: '0x0000000000000000000000000000000000000002'
    })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.mode).toBe('client_signature_required')
    // Fee = stakeWei * feeBps / 10000
    // stakeWei = parseEther("0.01") = 10000000000000000n
    // feeBps = env PREDICTION_FEE_BPS (default 500) or 100 fallback
    // 10000000000000000n * 500n / 10000n = 500000000000000n
    const feeBps = parseInt(process.env.PREDICTION_FEE_BPS || '100', 10)
    const expectedFee = (10000000000000000n * BigInt(feeBps)) / 10000n
    expect(json.txRequest.value).toBe(expectedFee.toString())
  })
})