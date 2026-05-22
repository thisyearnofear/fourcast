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

describe('/api/predictions POST', () => {
  it('builds txRequest when contract address is missing', { timeout: 15000 }, async () => {
    const req = mockRequest({ marketID: 123, price: 0.55, side: 'BUY', size: 0.01, walletAddress: '0x0000000000000000000000000000000000000001' })
    const res = await POST(req)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.mode).toBe('client_signature_required')
    expect(json.txRequest).toBeDefined()
  })
})