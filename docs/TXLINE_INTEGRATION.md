# TxLINE / TxOdds Integration

## Role in Fourcast

TxLINE is Fourcast's **primary sports intelligence layer** — professional bookmaker consensus odds, live scores, and cryptographically verifiable Merkle proofs for on-chain settlement.

It is not a venue (we don't trade on TxLINE). It's the data source that gives the agent an information edge when trading sports markets on Polymarket, Kalshi, Delphi, or any future venue.

## Current Coverage

| League | Status | Notes |
|--------|--------|-------|
| MLS | Live (50% coverage) | Active now |
| Premier League | Full coverage Aug 21 | 2025–26 season start |

Free data access continues into the season.

## What TxLINE Provides

### 1. Professional Consensus Odds
Sharp bookmaker pricing aggregated across top-tier sportsbooks. This is the closest available proxy for "true probability" in sports markets. When a prediction market prices an outcome differently from TxLINE consensus, that's a quantifiable edge signal.

### 2. Live Score Streaming
Real-time score and event data keyed by fixture and period. Enables in-play strategy and immediate reconciliation.

### 3. Merkle Proofs (On-Chain Verification)
TxLINE publishes outcome data as Merkle trees on Solana. A single API call returns the full proof bundle:
- `eventStatRoot` — the tree root
- `statProofs` / `mainTreeProof` / `subTreeProof` — sibling hashes with `isRightSibling` bits
- `statsToProve` — the verified stat values

This enables:
- **Trustless outcome verification** — CPI into `txoracle::validate_stat` on Solana
- **Decision receipt reconciliation** — independently verify what happened, match against what the agent decided

### 4. Cross-Venue Edge Detection
`services/txline/crossVenueEdge.js` computes the spread between TxLINE consensus and prediction-market prices (Polymarket YES, Delphi shares, etc.). Persistent mispricing = trading opportunity.

## Integration Points

| File | Purpose |
|------|---------|
| `services/txline/txlineService.js` | Core adapter — live + replay modes, JWT auto-refresh |
| `services/txline/solanaVerify.js` | On-chain Merkle proof verification (PDA derivation) |
| `services/txline/settlementService.js` | Solana match-escrow CPI settlement |
| `services/txline/crossVenueEdge.js` | TxLINE consensus vs venue prices |
| `services/txline/reconciliationService.js` | Receipt/proof reconciliation engine |

### Delphi Competition Bridge

`txlineService.js` also exposes helpers added for the Delphi Agent Arena so
the competition agent can attach professional odds to sports markets:

| Helper | Purpose |
|--------|---------|
| `KNOWN_COMPETITIONS` | Registry of league/competition IDs (MLS live, PL placeholders) |
| `isConfigured()` | True when TxLINE credentials are present |
| `getFixturesByCompetition(competitionId)` | Generic per-league fixture fetch |
| `matchFixtureToQuestion(question, fixtures)` | Fuzzy team-name match from a Delphi market question to a fixture |

`services/delphiIntelligence.js` consumes these: sports-classified Delphi
markets route to TxLINE consensus odds; everything else routes to Venice AI.

## API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `POST /auth/guest/start` | Issue renewable guest JWT |
| `GET /api/fixtures/snapshot?competitionId=X` | Fixtures for a league/competition |
| `GET /api/odds/snapshot/{fixtureId}` | Consensus odds |
| `GET /api/scores/snapshot/{fixtureId}` | Live scores |
| `GET /api/scores/stat-validation` | Merkle proof for on-chain verification |

## Onboarding

```bash
# Generate Solana keypair for TxLINE subscription
node scripts/txline-generate-wallet.mjs

# Fund with devnet SOL, then subscribe + activate
node scripts/txline-subscribe-and-activate.mjs
```

Environment variables needed:
- `TXLINE_API_TOKEN` — issued during activation
- `TXLINE_GUEST_JWT` — renewable bearer token
- `TXLINE_API_ORIGIN` — defaults to `https://txline.txodds.com`

## Premier League Preparation (Aug 21)

To prepare for full PL coverage:

1. **Identify PL competition ID** in TxLINE's fixture schema
2. **Extend fixture discovery** in `txlineService.js` to query PL fixtures
3. **Test odds pipeline** with MLS data (live now)
4. **Verify proof pipeline** works with new season fixture IDs
5. **Build PL context** for Venice AI forecasting prompts

## On-Chain Settlement (Solana)

The `match-escrow` program at `AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ` on Solana devnet demonstrates trustless settlement via CPI into TxLINE's `txoracle::validate_stat`. This is a working proof that sports outcomes can settle programmatically without trusting an intermediary.

## Historical Reference

The original TxLINE hackathon submission (World Cup 2026 scope, Autonomous Historical Lab, replay mode) is preserved at [`docs/TXLINE_SUBMISSION.md`](TXLINE_SUBMISSION.md). That document captures the proof-of-concept work that established the integration. The ongoing integration described above builds on that foundation for live season coverage.
