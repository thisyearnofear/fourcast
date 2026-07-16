# Fourcast — 3-Minute Demo Script (HackCanton S2)

The judge watches a position exist and not exist simultaneously, from two perspectives, on the same ledger. That contrast is the entire pitch in one frame.

## Opening (15s)

> "A whale can take a massive position without exposing it to the market. On Polymarket, that position is public within seconds — copied, front-run, front-paged on tracker sites. On Canton, it doesn't exist for anyone but the holder. Watch."

**Show:** Markets page — AI signal with edge detection and confidence score. Settlement-layer selector visible (Arc vs Canton).

---

## Act 1 — Take a private position · 60s

1. **Select a signal** on the markets page (e.g. "Will BTC exceed $150K by end of 2026?").
2. **Click publish** → settlement-layer modal appears.
3. **Select Canton** (private settlement).
4. **Confirm position** — the app calls `/api/canton/markets` (POST), which submits a Daml `CreateCommand` to Canton Devnet via the server-side ledger client.

**Say:** "This position is now on-ledger. The stake, the side, the entry — visible only to the operator and this holder. No other party, no tracker, no explorer can see it."

**Show:** Holder's view — `/api/canton/positions` returns the full position (side: YES, stake: 500 cBTC, marketId, status: Open).

---

## Act 2 — The absence · 45s

1. **Switch to a second browser** (or incognito) — a competing trader, a tracker bot, any non-signatory.
2. **Query the same ledger** for `PredictionPosition` contracts on the same market — from a party that is not a signatory.

**Show:** Empty result set. The position does not exist from this party's view.

**Say:** "Same ledger, same market, same contract ID space. This trader sees nothing. The position is structurally invisible — not hidden by a frontend, not obfuscated by a mixer, enforced by Daml's signatory/observer model at the protocol level."

---

## Act 3 — Settle and payout · 45s

1. **Switch back to the holder's browser.**
2. **Operator resolves the market** — exercise `ResolveMarket` with outcome `ResolvedYes`.
3. **Holder exercises Settle** — the choice fetches `MarketResolution` by contract ID, verifies `marketId` matches, calculates payout.
4. **Show:** `PositionSettled` receipt — winner: holder, payout: 1000 cBTC.
5. **Show:** `SettlementObligation` created — instructs operator to transfer winnings via CIP-56.

**Say:** "The Settle choice fetches the resolution contract by ID — no party can settle with a fabricated outcome. The payout is derived from the on-ledger resolution, not from caller input."

---

## Act 4 — The leaderboard that can't be copied · 15s

1. **Show:** Fourcast leaderboard — settled P&L ranked, verified by on-ledger `PositionSettled` receipts.
2. **Note:** entries are private, results are public. No tracker can reproduce this because the entries never existed publicly.

**Say:** "Whales get verified track records without leaking entries. That's the privacy premium — and it only works on Canton."

---

## Close (15s)

> "Live on Canton Devnet. Repo on GitHub. The position you just saw exist and not exist at the same time — that's the demo. No public-chain venue can reproduce it."

---

## Pre-demo checklist

- [x] DAR built and uploaded to NODERS Devnet (package ID confirmed)
- [x] `NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID` set in `.env.local.example`
- [x] `CANTON_OPERATOR_PARTY_ID` set — `FourcastOperator::122003aa7c...`
- [x] Server-side direct ledger API access (OIDC password grant)
- [x] Daml commands formatted to JSON Ledger API spec (`CreateCommand` / `ExerciseCommand` with `choiceArgument`)
- [x] Contract queries use `eventFormat` + `activeAtOffset` + `#canton:` package name format
- [x] Market + position lifecycle functions implemented (`services/cantonLedgerClient.js`)
- [x] API routes: `/api/canton/markets`, `/api/canton/markets/resolve`, `/api/canton/positions`, `/api/canton/settle`
- [x] End-to-end verified on Devnet: create market → query → resolve → query resolutions
- [ ] CC funded via NODERS wallet tap
- [ ] cBTC funded via https://cbtc-faucet.bitsafe.finance/
- [ ] Two-view privacy test (holder sees position, observer sees empty result set)
- [ ] Deployed URL loads (not localhost)
- [ ] Venice API key for live AI analysis
- [ ] Form: GitHub URL, video link, demo URL

## Copy source of truth

All UI strings: `constants/brand.js`
Daml contracts: `canton/daml/Fourcast/`
Server-side ledger client: `services/cantonLedgerClient.js`
Legacy publisher (reference): `services/cantonPublisher.js`
Wallet context: `app/CantonWalletLayer.js`
Wallet hook: `hooks/useCantonWallet.js`
