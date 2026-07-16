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
Fourcast AI → Canton Daml Contracts (market logic, settlement)
            → Console Wallet (user signing, balance, tx review)
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
- Frontend wired to Console Wallet SDK (`@console-wallet/dapp-sdk` 2.2.5)
- Daml commands formatted to JSON Ledger API spec (`CreateCommand` / `ExerciseCommand`)
- Market lifecycle functions: `createMarketOnCanton`, `resolveMarketOnCanton`, `getOpenMarkets`
- Position lifecycle functions: `publishPositionOnCanton`, `settlePositionOnCanton`, `getOpenPositions`
- CIP-56 settlement transfer: `executeSettlementTransfer`, `processPendingObligations`

### Connection mode
Console Wallet extension (default). Users install the extension, connect to the NODERS validator, and authenticate via Keycloak OIDC. No server-side client credentials needed — the extension handles auth, signing, and ledger communication.

Wallet SDK direct mode (via `@canton-network/wallet-sdk` 1.4.0) is available as a fallback for server-side automation. Requires OIDC `client_credentials` from NODERS (not yet provisioned). To enable, uncomment `NEXT_PUBLIC_CANTON_LEDGER_URL` in `.env.local`.

### Pending (manual)
- [ ] Install Console Wallet browser extension
- [ ] Configure extension to connect to NODERS validator URL
- [ ] Log in via Keycloak (your NODERS account)
- [ ] Fund `FourcastOperator` with CC (tap in wallet UI)
- [ ] Fund `FourcastOperator` with cBTC (https://cbtc-faucet.bitsafe.finance/)
- [ ] Test: create market → take position → resolve → settle → CIP-56 transfer
- [ ] Two-view privacy test (holder sees position, observer sees empty result set)

---

## Submission Requirements

- Public repository
- Presentation deck
- 3 minute video pitch w/ demo
- Link to live product
- **Deployed live on Canton Devnet** (not LocalNet/sandbox)
- Daml contracts running on-ledger
