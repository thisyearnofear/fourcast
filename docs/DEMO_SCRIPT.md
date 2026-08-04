# Fourcast — 3-Minute Demo Script (HackCanton S2)

The judge watches a position exist and not exist simultaneously, from two perspectives, on the same ledger. That contrast is the entire pitch in one frame.

## Opening (15s)

> "A large position can leak strategy as soon as it is placed on a public venue. On Canton, the position is visible to its stakeholders but not to unrelated parties. Watch."

**Show:** Canton proof surface — the private-position demo, not the earlier AI/Arc market flow.

---

## Act 1 — Take a private position · 60s

1. Open the prepared DevNet market and position.
2. Show the holder/operator view of the position.
3. Explain that the current judge flow is an operator console; external holder signing is still partial.

**Say:** "This position is now on-ledger. The stake, the side, the entry — visible only to the operator and this holder. No other party, no tracker, no explorer can see it."

**Show:** Holder's view — `/api/canton/positions` returns the full position (side: YES, stake: 500 cBTC, marketId, status: Open).

---

## Act 2 — The absence · 45s

1. Open the PrivacyProof section and click "Run privacy test."
2. The component fires **two live ledger queries in parallel** — one as the operator (signatory), one as a non-signatory party — and renders both results side-by-side.

**Show:** Signatory cell returns full position data. Non-signatory cell returns a real empty result set from the ledger — not simulated, not hardcoded.

**Say:** "Same ledger, same market, same contract ID space. This trader sees nothing. The position is structurally invisible — not hidden by a frontend, not obfuscated by a mixer, enforced by Daml's signatory/observer model at the protocol level. Both cells are live API calls."

---

## Act 3 — Settle and payout · 45s

1. **Switch back to the holder's browser.**
2. **Operator resolves the market** — exercise `ResolveMarket` with outcome `ResolvedYes`.
3. **Holder or operator exercises Settle** — the choice fetches `MarketResolution`, verifies the market, and validates both allocation legs.
4. **Show:** `PositionSettled` receipt — winner: holder, payout: 1000 reference-token units.
5. **Show:** both escrow allocations are archived by the same settlement transaction.

**Say:** "The Settle choice fetches the attestation-backed resolution and executes or cancels both escrow legs atomically. There is no manual payout or outstanding obligation."

---

## Act 4 — Why CBTC and Canton · 15s

1. **Show:** the implementation status: private positions, CIP-56 escrow, atomic settlement.
2. **Show:** `canton-bitsafe-lifecycle.mjs` output — real CBTC settled atomically, receipt shows `instrument.id = CBTC`.

**Say:** "Canton keeps position details visible only to stakeholders, while CIP-56 gives us an atomic settlement primitive. Real BitSafe CBTC settlement is proven end-to-end on DevNet."

---

## Close (15s)

> "This DevNet prototype proves private positions and atomic token settlement on Canton — against both a reference registry and real BitSafe CBTC. The remaining path is external holder signing, independent attestation, and mainnet hardening."

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
- [x] End-to-end v2 lifecycle verified on DevNet: offer → accept → escrow → resolve → atomic settle
- [x] Deployed URL loads (not localhost) — verified live after env fix & redeploy
- [x] Two-view privacy test (holder sees position, observer sees empty result set) — live in-page PrivacyProof component, both cells are real ledger queries
- [ ] CC funded via NODERS wallet tap — reported done by operator, not re-tested this session
- [x] Real BitSafe CBTC registry/instrument settlement verified — `canton-bitsafe-lifecycle.mjs` passes end-to-end (receipt `instrument.id = CBTC`)
- [ ] Venice API key for live AI analysis — reported done by operator, not re-tested this session
- [ ] Form: GitHub URL, video link, demo URL — reported submitted by operator, not verified

## Copy source of truth

All UI strings: `constants/brand.js`
Daml contracts: `canton/daml/Fourcast/`
Server-side ledger client: `services/cantonLedgerClient.js`
Legacy publisher (reference): `services/cantonPublisher.js`
Wallet context: `app/CantonWalletLayer.js`
Wallet hook: `hooks/useCantonWallet.js`
Holder wallet hook: `hooks/useCantonHolderWallet.js`
Holder dashboard: `components/CantonHolderDashboard.js`
