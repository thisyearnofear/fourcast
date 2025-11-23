# Product Roadmap - Fourcast

**Status:** Core platform live — Polymarket + Kalshi aggregation, dual wallet, AI analysis, reputation. Pending Aptos Move deploy for on-chain signals.

## Completed
- Markets page: Consolidated Sports + Discovery tabs
- Kalshi aggregation: Unified `/api/markets` merges Polymarket and Kalshi; platform badges, filter, deep links
- Weather service and Venice AI analysis
- Venue extraction for sports (NFL, EPL, 80+ stadiums)
- Signals + reputation: SQLite persistence, leaderboard, profile drawer
- Dual wallet UX: MetaMask (trading) and Petra (signals)

## In Progress
- Aptos Move module deployment and on-chain signal publishing
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
