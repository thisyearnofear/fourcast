# Product Roadmap - Fourcast

**Status:** Core platform live — Polymarket + Kalshi aggregation, dual wallet, AI analysis, reputation. Aptos devnet module configured; on-chain signal publishing wired via wallet.

## Completed

- Markets page: Consolidated Sports + Discovery tabs
- Kalshi aggregation: Unified `/api/markets` merges Polymarket and Kalshi; platform badges, filter, deep links
- Weather service and Venice AI analysis
- Venue extraction for sports (NFL, EPL, 80+ stadiums)
- Signals + reputation: SQLite persistence, leaderboard, profile drawer
- Dual wallet UX: MetaMask (trading) and Petra (signals)

## In Progress

- Cross-platform arbitrage detection (Polymarket ↔ Kalshi)

## Next

- In-app trading (execute without leaving the app)
- Professional tools and advanced order types
- Mobile experience improvements
- Universal trading (Base/Solana when available)
- SDK + rate limits for power users
- Incentives: Premium signals and referrals

## Notes

- Unified `/api/markets` is category-aware and merges providers; UI uses `platform` to format badges and volume
- See `docs/KALSHI_INTEGRATION.md` for integration details
