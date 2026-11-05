/**
 * Canonical sealed receipt — the France v Sweden fixture whose proof chain is
 * fully auditable on Solana devnet. Used as the fallback proof surface on the
 * landing whenever no live execution exists yet (the product's own receipts
 * are the marketing; an empty feed is not).
 */
export const CANONICAL_RECEIPT = {
  fixtureId: '18175981',
  fixture: 'France v Sweden',
  stage: 'World Cup 2026 · Round of 32',
  score: '3–0',
  escrow: 'AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ',
  tx: '3W6Y7rtQGgcBuD8ih8hUK2pZTSFZM4yDwXRfAudxmhdzDDjDnpNqEN2TZzGBW6F4PEKhmUbfv2NWXWAQf8wwhduB',
};
