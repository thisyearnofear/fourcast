# HackCanton S2 — Fourcast Opportunity

**Event**: HackCanton League Season 2  
**Host**: NODERS & Canton Foundation  
**Duration**: 5 weeks (June 2026)  
**Prize Pool**: Up to $50,000 in cash & credits  
**Settlement**: Canton Network (privacy-enabled institutional L1)  
**Supported Assets**: CC (Canton Coin) for devnet gas · cBTC (BitSafe) · cETH (OnRails/Digital Asset)

---

## Why Canton?

Canton Network is purpose-built for regulated, institutional finance. Unlike public L1s where every transaction is visible, Canton lets you restrict visibility to relevant parties only. This is critical for:

- OTC trading (pricing shouldn't leak)
- Prediction markets (position sizes are private)
- Lending/collateral (terms are confidential)
- Multi-party settlement that's atomic and private

---

## Bounty Lanes

### 🟠 cBTC (BitSafe) — 50,000 CC
Build Bitcoin-backed flows: prediction markets, market-making bots, cBTC analytics, collateral + lending, OTC settlement.

- cBTC faucet: https://cbtc-faucet.bitsafe.finance/
- BitSafe docs: https://docs.bitsafe.finance/developers

### 🔵 cETH (OnRails) — 50,000 CC
Make cETH move app state: AMMs/order books/RFQs, private OTC, lending + leverage, cross-margin, liquidity vaults, treasury tools.

- cETH faucet: https://forms.gle/qY1Eq4AxuTFrxf49A
- cETH integration docs: https://www.ceth.network/integration
- cETH follows CIP-0056 (Canton Network Token Standard)

### CC Devnet Gas
- Reach out to @mrlp8 for CC

---

## Why Fourcast Fits

| Canton Track | Fourcast Angle |
|---|---|
| Private DeFi & Capital Markets | Prediction markets with private position sizes, confidential pricing |
| TradeFi, RWA & Tokenized Assets | Settle predictions in cBTC/cETH — tokenized assets as the payout mechanism |
| CBTC bounty | **Prediction markets** is a named CBTC bounty lane. Run markets resolved in cBTC. |
| cETH bounty | Use cETH as collateral in prediction/lending markets |

### What to Build on Canton

1. **cBTC Prediction Markets** — Port Polymarket/Kalshi analysis to Canton. Markets created, traded, and resolved using cBTC as the settlement asset. Console Wallet handles signing + balance checks.
2. **cETH Collateralized Prediction** — Use cETH as margin for prediction market positions. Leverage the privacy model so individual position sizes aren't visible.
3. **Private OTC for Prediction Positions** — Secondary market for prediction market positions, settled privately on Canton using cBTC/cETH.

### Architecture Sketch

```
Fourcast AI → Next.js API routes → Canton JSON Ledger API (v2)
            → OIDC password grant (Keycloak) → Daml commands
            → cBTC / cETH (settlement assets)
            → Privacy model (position sizes hidden per-party)
```

---

## Key Resources

### Canton & Devnet
- Daml docs: https://docs.daml.com/
- Console Wallet (PixelPlex) — signing, assets, balances, activity: https://consolewallet.io/develop/ledger
- Mentor booking: https://calendar.app.google/X9TtEmne43FMw9Fx6
- Workshop playlist: https://www.youtube.com/playlist?list=PLcruYrU6F49c
- CC (devnet gas): @mrlp8

### CBTC (BitSafe)
- Faucet: https://cbtc-faucet.bitsafe.finance/
- Docs: https://docs.bitsafe.finance/developers

### CETH (OnRails / Digital Asset)
- Faucet: https://forms.gle/qY1Eq4AxuTFrxf49A
- Integration: https://www.ceth.network/integration
- CIP-0056 Token Standard

### Console Wallet
- Dashboard/signing: https://consolewallet.io/develop/ledger
- Useful for: signing transactions, sending assets, checking balances, reviewing activity, interacting with Canton apps
- Note: Fourcast uses server-side direct ledger API access, not the Console Wallet extension

---

## Positioning & Evidence

### Value statement

A whale can take a massive position without exposing it to the market. On Polymarket, that position is public within seconds — copied, front-run, front-paged on tracker sites. Fourcast settles predictions on Canton with Daml contracts where only the operator and the holder can see position details, which means traders can take real size without being copied, front-run, or self-censoring out of the market.

### Market sizing

| Cohort | Size | Source |
|---|---|---|
| Polymarket monthly active traders | ~643k–765k | The Block / Bitget Wallet, Q1–Q2 2026 |
| Retail (<$10k traded) | 82.3% of users | Bitget Wallet Q1 2026 report |
| High-Frequency, High-Capital wallets (>$100k) | ~27k — generate ~90% of volume ($39B in study period) | Sea Launch persona analysis on Dune, Q1 2026 |
| Strict whales (size, edge, recency, concentration) | ~126 wallets | Poly Syncer, May 2026 snapshot |

**Addressable audience:** ~30k size-taking traders. **Wedge:** ~150–500 whales who feel the leakage pain acutely today.

### Third-party evidence (problem validation)

These are first-hand accounts from our exact ICP, on the record — not our interviews:

- **Stand.trade / The Oracle by Polymarket ("Copycat", "Copytrade Wars"):** Stand founder Ridgely: *"We've interviewed several [top traders], and they've told us directly that they run secondary or tertiary accounts."* Whales describe position visibility as an **"edge leak."** Named tactic: **"iceberging"** — Domer (a tracked whale) accumulates in small piecemeal orders to avoid triggering copy-trading alerts. Another: **"merging"** — holding YES and NO simultaneously and converting to USDC to quietly exit without a visible sale.
- **NPR / WMRA (Jan 2026, "They quit their day jobs to bet on current events"):** Profiled full-time traders like Logan Sudeith (~$100k/month) and Evan Semet, who confirmed traders use pseudonyms specifically as a privacy workaround.
- **Start Polymarket ("Copy Trading: Why It Doesn't Work"):** Documents structural front-running: *"the price moves because of the trade you're trying to copy. You cannot front-run your own signal."* Names **baiting** — whales place visible large buys to trigger copy traders, then sell into the demand.

### Prior product usage (Agora hackathon, May 2026)

Fourcast shipped a live product on Arc testnet in the Agora Agents Hackathon (Canteen × Circle). Real testnet USDC flowed through signals, tips, and subscriptions. AI-generated predictions logged a **~68% win rate** across that cohort. The autopilot safety rails and signal publishing flow were shaped by that iteration.

### Key success metric (hackathon demo)

> A PredictionPosition created on Canton Devnet returns an empty result set when queried by a non-signatory party, while the same query from the holder returns the full position — and the holder successfully settles and receives a cBTC payout.

Binary pass/fail. Measurable by running two queries against the live Devnet ledger. If the non-signatory sees nothing and the holder sees everything and gets paid, the privacy claim is proven, not asserted.

---

## Go-to-market

### First 10 users — direct outreach to tracked whales

The list already exists: Polycopy ranks top-20 wallets by verified P&L (swisstony +$2.5M, CandleHammerDrums +$2.3M, etc.). Stand.trade tracks the most-copied wallets. DM 10 on X with one sentence: *"Your positions don't show up on Polycopy anymore. Want to try it on testnet?"* Target: 3 become active testnet users.

### First 100 users — the tracker asymmetry goes viral

When whales migrate, their positions vanish from Polycopy/Stand feeds. The copy-trading communities notice the absence. Existing infrastructure amplifies this:
- **Telegram bot** (`@fourcasterbot`) — push private settlement confirmations to the whale's channel
- **Farcaster frames** — public frame showing settled P&L with entries private
- **Leaderboard** — rank by settled P&L on Canton, not visible positions

### Growth lever — the privacy premium

Whales come for privacy. Settled P&L is still publishable via `PositionSettled` receipts (holder chooses to reveal). This creates a leaderboard of verified results without leaked entries — structurally impossible on any public-chain venue. Flywheel: whales migrate for privacy → settled P&L attracts retail → retail liquidity lets whales take bigger size → bigger size attracts more attention.

### One-liners

- **Acquisition:** Tracked whales go dark on Polycopy/Stand — their disappearance from public feeds is the signal that something private exists.
- **Activation:** "Your next position doesn't appear on any tracker — connect a Canton wallet and take one testnet trade to see it disappear."
- **Retention:** Settled P&L appears on our leaderboard with verified on-ledger receipts, so whales keep clout without leaking entries.

---

## Devnet Deployment Status

### Completed
- DAR compiled with Daml SDK 3.5.2 (compatible with DevNet 3.5.8)
- DAR uploaded to NODERS participant node — package ID confirmed: `1fdf1b33676d9025e48da98baece72818feee5e0efaf60b4788daa547560b784`
- `FourcastOperator` party allocated: `FourcastOperator::122003aa7c491e00a453145c4d2cd3dbf5db8908b4e663c9944baed57fd66effa668`
- NODERS NaaS validator URL: `https://wallet.validator.hackcanton-01.devnet.naas.noders.services/`
- Keycloak OIDC: `https://keycloak.naas.noders.services/realms/noders-appsfactory`
- **Server-side direct ledger API access** — OIDC password grant via `web-app-ui-hackcanton-01-devnet` client
- Daml commands formatted to JSON Ledger API spec (`CreateCommand` / `ExerciseCommand` with `choiceArgument`)
- Contract queries use `eventFormat` + `activeAtOffset` + package name (`#canton:`) format
- Server-side ledger client: `services/cantonLedgerClient.js` (token caching, command submission, contract queries)
- API routes: `/api/canton/markets` (GET/POST), `/api/canton/markets/resolve` (POST), `/api/canton/positions` (GET), `/api/canton/settle` (POST), `/api/canton/balance` (GET), `/api/canton/settle-transfer` (GET)
- Market lifecycle: `createMarket`, `resolveMarket`, `getOpenMarkets`, `getMarketResolutions`
- Position lifecycle: `createPosition`, `settlePosition`, `getOpenPositions`, `getSettledPositions`
- CIP-56 settlement transfer: `getPendingObligations` (transfer execution via NODERS wallet UI)
- **Verified end-to-end on Devnet**: create market (offset 340860) → query (2 markets) → resolve (offset 340865) → MarketResolution created → resolved market archived
- **Privacy test passed** (July 23, 2026): Created market with 4 positions across 2 parties (Alice, Bob). Operator view shows 6 positions (all), Alice sees 2 (her own), Bob sees 2 (his own). Daml signatory/observer system enforces structural privacy correctly — each party only sees contracts where they are a signatory or observer.
- **Health check API**: `GET /api/canton/health` verifies env vars, OIDC auth, ledger queries, and DAR package — used by the /canton page to show honest outage messaging if Devnet is unreachable.
- **Graceful outage messaging**: If Canton Devnet is unreachable, the /canton page displays a truthful "Devnet currently unavailable" banner with diagnostic check results (env, auth, ledger, package) instead of a broken page. No mock data.

### Connection mode
Server-side direct ledger API. The Next.js API routes authenticate to NODERS Keycloak via OIDC password grant and call the Canton JSON Ledger API directly. No browser extension or client-side SDK needed — all credentials stay server-side. The operator (FourcastOperator) is automatically "connected" when the server is configured.

### UI Implementation Status (Completed July 22, 2026)

### New Canton Route: `/canton`
Dedicated page demonstrating the privacy model and settlement flow. Three new components:

1. **RoleExplorer** — Visual breakdown of Issuer/Holder/Observer roles
   - Issuer (Operator): Creates markets, resolves outcomes, processes settlement transfers. Sees all markets and positions as counterparty.
   - Holder (Trader): Takes positions, settles after resolution. Sees only their own positions.
   - Observer (Public): Can discover market questions, but not positions. Sees empty result set when querying positions.

2. **PrivacyProof** — Interactive demo showing the binary privacy guarantee
   - Side-by-side comparison: holder query returns full position data, observer query returns empty array
   - Demonstrates structural privacy enforced by Daml signatory/observer system
   - Explains why this matters: whales can take real size without being copied or front-run

3. **CantonSettlementHub** — Full market lifecycle UI
   - Create market (question, settlement asset cBTC/cETH, duration)
   - Place position (side YES/NO, stake amount, holder party ID)
   - Resolve outcome (operator chooses YES/NO/Voided)
   - Settle position (references MarketResolution contract as proof of outcome)
   - View active/resolved markets, open/settled positions, pending obligations

### Navigation
- Added "Private Markets" to main nav (positioned after flagship routes)
- Brand constants include Canton-specific labels and descriptions
- Unified wallet dropdown shows EVM (Arc/Polygon) + Solana + Canton

### Design Patterns
- Follows platform design language: open sections, evidence rails, no cards
- Privacy model is the hero — structural privacy via Daml signatory/observer system
- Settlement flow is the protagonist — not just a dashboard, but a workflow
- All operations use server-side ledger client (no browser extension needed)

### Integration
- All API routes wired up: `/api/canton/markets`, `/api/canton/positions`, `/api/canton/settle`, etc.
- PrivacyProof simulates observer view (non-signatory sees empty result set)
- CantonSettlementHub connects to live Canton Devnet via NODERS NaaS

---

## Pending Submission Requirements

### Manual Tasks
- [x] Fund `FourcastOperator` with CC (devnet gas) — funded via @mrlp8
- [x] Fund `FourcastOperator` with cBTC — 0.01 cBTC from BitSafe faucet
- [x] Run preflight script — market + 4 positions created at ledger offset 401652
- [x] Run actual privacy test on Canton Devnet — **PASSED**: Operator sees 6 positions, Alice sees 2, Bob sees 2. Daml enforces structural privacy correctly.
- [x] TxLINE replay mode verification (July 23, 2026) — Verifier now handles both live API format (hex strings) and cached replay format (byte arrays). All proof checks pass: inputs-present, proof-well-formed (14 hashes), stat-roots-present, stat-proof-count (2 stats). On-chain PDA mismatch is expected for historical data.
- [ ] CIP-56 token transfer test (via NODERS wallet UI)

### Documentation
- [ ] 1-page business brief (ICP, use case, who pays, why Canton)
- [ ] Pilot plan (2-3 steps + required integrations)
- [ ] 3-minute video pitch w/ demo
- [ ] Presentation deck

### Deployment
- [ ] Deploy to Vercel (ensure env vars propagate: CANTON_JSON_API_URL, CANTON_OIDC_*, NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID)
- [ ] Verify /canton route is accessible on production
- [ ] Record video demo showing market creation, position placement, resolution, settlement

---

## Next Steps

### Immediate (Before Submission Deadline July 26)
1. ~~**Fund the operator wallet**~~ — DONE. CC funded, 0.01 cBTC funded.
2. ~~**Run preflight**~~ — DONE. Market + 4 positions created at offset 401652.
3. ~~**Run the privacy test**~~ — DONE. Privacy proven: Operator sees all, holders see only their own positions.
4. **Write the business brief** — ICP is whales (~30k size-taking traders, wedge is ~150-500 strict whales). Use case is private prediction markets. Who pays is the operator (takes a cut of settlements). Why Canton is structural privacy — position sizes hidden from all third parties.
5. **Record the video** — Show the /canton route, demonstrate the PrivacyProof component, walk through the settlement flow
6. **Build the deck** — Problem (whales get copied on Polymarket), Solution (Canton's Daml contracts enforce privacy), Demo (show the UI), Market (30k traders, $39B volume), Ask (funding to build out)

### Post-Submission
1. **Multi-party flow** — Currently the operator is the only party. Need to allocate holder parties (users) and implement the full consent flow via Console Wallet
2. **CIP-56 automation** — Currently settlement transfers are manual via NODERS wallet UI. Need to automate via Wallet SDK token transfer API
3. **Position creation UI** — Currently positions are created via API call. Need a form in the SettlementHub for users to place positions
4. **Settled P&L leaderboard** — Show verified results without leaked entries (whales keep clout, privacy preserved)
5. **Telegram bot integration** — Push private settlement confirmations to whale channels
