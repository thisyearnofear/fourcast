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

## Submission Requirements

- Public repository
- Presentation deck
- 3 minute video pitch w/ demo
- Link to live product
- **Deployed live on Canton Devnet** (not LocalNet/sandbox)
- Daml contracts running on-ledger
