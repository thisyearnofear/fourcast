# HackCanton S2 — Fourcast Opportunity

> **Current verified status (2026-08):** Fourcast has a **Canton DevNet** private-settlement prototype. The v2 Daml contracts provide holder-signed offers, CIP-56 escrow, and atomic settlement. The real BitSafe **CBTC** lifecycle has been demonstrated on DevNet; see `scripts/canton-bitsafe-lifecycle.mjs` and `public/proof/canton-receipts.json` (captured 2026-08-04).
>
> **Resolution status:** each market has a configurable designated attester. The current DevNet workflow defaults to the Fourcast operator as attester, so it is **self-attested**. An independent oracle/attester is supported by the contract design but is not yet integrated or deployed. Mainnet is not deployed.
>
> The v2 contract set supersedes the historical v1 IOU-bookkeeping material retained below. `docs/CANTON.md` is the authoritative capability/status document; `docs/CANTON.md` is the DevNet deployment runbook.

**Event**: HackCanton League Season 2 (finished)
**Host**: NODERS & Canton Foundation  
**Duration**: 5 weeks (June 2026)  
**Prize Pool**: Up to $50,000 in cash & credits  
**Settlement**: Canton Network (privacy-enabled institutional L1)  
**Supported Assets**: DevNet CC gas · BitSafe CBTC proven on DevNet · reference CIP-56 registry for local/preflight flows · no external cETH lifecycle verified

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
- Note: Fourcast uses server-side direct ledger API for the operator flow, plus a Console Wallet holder dashboard at `/canton/holder` for end-user wallet connection

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

> A PredictionPosition created on Canton DevNet returns an empty result set when queried by a non-stakeholder, while the same query from a stakeholder returns the full position — and the escrow legs settle atomically through the reference CIP-56 registry.

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

### Post-hackathon idea — optional privacy premium

If later validated with users, settled P&L could be publishable via
`PositionSettled` receipts while entries remain private. This is not implemented
as a current HackCanton product claim and is excluded from the demo.

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
- CIP-56 settlement transfer (v1): `getPendingObligations`, manual transfer via NODERS wallet UI — **superseded in v2** by atomic allocation execute/cancel inside the settlement transaction
- **Verified end-to-end on Devnet**: create market (offset 340860) → query (2 markets) → resolve (offset 340865) → MarketResolution created → resolved market archived
- **Privacy test passed** (July 23, 2026): Created market with 4 positions across 2 parties (Alice, Bob). Operator view shows 6 positions (all), Alice sees 2 (her own), Bob sees 2 (his own). Daml signatory/observer system enforces structural privacy correctly — each party only sees contracts where they are a signatory or observer.
- **Health check API**: `GET /api/canton/health` verifies env vars, OIDC auth, ledger queries, and DAR package — used by the /canton page to show honest outage messaging if Devnet is unreachable.
- **Graceful outage messaging**: If Canton Devnet is unreachable, the /canton page displays a truthful "Devnet currently unavailable" banner with diagnostic check results (env, auth, ledger, package) instead of a broken page. No mock data.

### Connection mode
Server-side direct ledger API for the operator flow. The Next.js API routes authenticate to NODERS Keycloak via OIDC password grant and call the Canton JSON Ledger API directly — all operator credentials stay server-side. The operator (FourcastOperator) is automatically "connected" when the server is configured. A separate Console Wallet holder dashboard (`/canton/holder`) lets end users connect their own wallet to view private positions and dispute unsettled obligations.

### UI Implementation Status (Completed July 22, 2026)

### New Canton Route: `/canton`
Dedicated page demonstrating the privacy model and settlement flow. Three new components:

1. **RoleExplorer** — Visual breakdown of Issuer/Holder/Observer roles
   - Issuer (Operator): Creates markets, resolves outcomes, processes settlement transfers. Sees all markets and positions as counterparty.
   - Holder (Trader): Takes positions, settles after resolution. Sees only their own positions.
   - Observer (Public): Can discover market questions, but not positions. Sees empty result set when querying positions.

2. **PrivacyProof** — Live dual-party ledger query proving the binary privacy guarantee
   - Side-by-side: signatory query returns full position data; non-signatory query returns a real empty result set from the ledger
   - Both cells are live API calls — the observer party ID is resolved from `/api/canton/parties` (or an unallocated fallback), then queried in parallel
   - Stake/side formatted compactly in the Visible pane (trailing zeros trimmed) so long decimals don’t overlap Side
   - Demonstrates structural privacy enforced by Daml signatory/observer system
   - Explains why this matters: whales can take real size without being copied or front-run
   - **Talk to us** under the proof — operator interview intake (`POST /api/talk`)

3. **CantonSettlementHub** — Full market lifecycle UI
   - Create market (question, settlement asset cBTC/cETH, duration)
   - Place position (side YES/NO, stake amount, holder party ID)
   - Resolve outcome (operator chooses YES/NO/Voided)
   - Settle position (references MarketResolution contract as proof of outcome)
   - View active/resolved markets, open/settled positions, pending obligations

### Navigation
- Primary nav: **Markets · Positions · Private** (`/proof?chain=canton`). Overflow: Signals · Mandate · Labs · Alerts
- Landing (`/`) leads with Canton privacy hero + inline privacy check; **Talk to us** under the dual-view proof
- Brand constants (`constants/brand.js`) are venue-first with Canton privacy as the differentiator
- Unified wallet: EVM (trade/publish) + Canton Console Wallet (private settle) + Solana (receipt inspect)

### Design Patterns
- Follows platform design language: open sections, evidence rails, no cards
- Privacy model is the hero — structural privacy via Daml signatory/observer system
- Settlement flow is the protagonist — not just a dashboard, but a workflow
- All operations use server-side ledger client (no browser extension needed)

### Integration
- All API routes wired up: `/api/canton/markets`, `/api/canton/positions`, `/api/canton/settle`, etc.
- PrivacyProof runs live dual-party queries (signatory vs non-signatory) — no simulated or hardcoded results
- CantonSettlementHub connects to live Canton Devnet via NODERS NaaS

---

## Pending Submission Requirements

### Manual Tasks
- [x] Fund `FourcastOperator` with CC (devnet gas) — funded via @mrlp8
- [x] Verify the BitSafe CBTC registry and instrument end-to-end — **proven on Canton DevNet** via `scripts/canton-bitsafe-lifecycle.mjs`; evidence captured in `public/proof/canton-receipts.json` (2026-08-04)
- [x] Run preflight script — market + 4 positions created at ledger offset 401652
- [x] Run actual privacy test on Canton Devnet — **PASSED**: Operator sees 6 positions, Alice sees 2, Bob sees 2. Daml enforces structural privacy correctly.
- [x] TxLINE replay mode verification (July 23, 2026) — Verifier now handles both live API format (hex strings) and cached replay format (byte arrays). All proof checks pass: inputs-present, proof-well-formed (14 hashes), stat-roots-present, stat-proof-count (2 stats). On-chain PDA mismatch is expected for historical data.
- [x] CIP-56 atomic settlement against the reference registry — live-run via `node scripts/canton-v2-preflight.mjs`

### Documentation
- [ ] 1-page business brief (ICP, use case, who pays, why Canton)
- [ ] Pilot plan (2-3 steps + required integrations)
- [ ] 3-minute video pitch w/ demo
- [ ] Presentation deck

### Deployment
- [x] Deploy to Vercel (env vars propagated; health endpoint healthy)
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
1. **Multi-party flow** — Holder dashboard (`/canton/holder`) with Console Wallet connect is live. On-ledger consent is **delivered in v2** (holder-signed PositionOffer → operator AcceptOffer; unilateral creation provably impossible). Remaining: wallet-EXTERNAL signing so holders sign offers with their own keys (roadmap Phase 1)
2. ~~**CIP-56 automation**~~ — **delivered as v2**: no "automated transfer" needed; settlement itself moves the funds atomically (allocations execute/cancel in-transaction). See docs/CANTON.md
3. **Position creation UI** — Currently positions are created via API call. Need a form in the SettlementHub for users to place positions
4. **Settled P&L leaderboard** — Show verified results without leaked entries (whales keep clout, privacy preserved)
5. **Telegram bot integration** — Push private settlement confirmations to whale channels


---

## Canton v2 — Atomic Settlement Upgrade

### Current implementation status

This document is the source of truth for the HackCanton claim set.

| Capability | Status |
|---|---|
| Private Daml positions | Implemented and DevNet-tested |
| Holder-signed consent | Implemented and script-tested |
| CIP-56 atomic escrow/settlement | Implemented with Fourcast's reference registry + real BitSafe CBTC |
| Actual BitSafe CBTC registry settlement | ✅ Proven end-to-end (`canton-bitsafe-lifecycle.mjs`) |
| External holder-wallet signing | Partial; operator flow remains the judge path |
| Independent attestation | Configurable; current DevNet demo is operator-attested |
| Mainnet deployment | Not deployed |

> Responds to reviewer feedback on the v1 integration. The v1 Daml model tracked
> IOUs and required manual wallet payouts. v2 locks real token holdings in
> escrow at position-entry and settles them **atomically** — stake and payout
> move in the *same transaction* that archives the position. Built directly on
> the **CIP-56 token standard V1 interfaces** (the standard that cBTC and cETH
> implement on DevNet), vendored verbatim from `canton-network/splice`.

- **DAR:** `canton/.daml/dist/fourcast-2.0.0.dar` (package name `fourcast`, version 2.0.0,
  main package `550828d2…930a`). Built against the **DevNet's own vetted CIP-56 interface DARs**
  (`vendor/network-cip-0056/`, package IDs verified PRESENT on the participant via
  `scripts/canton-package-check.mjs`) — its `Holding`/`Allocation`/`AllocationRequest` references
  are byte-identical to what the real cBTC/cETH registries implement.
- **Tests:** `dpm test` in `canton/` — 7/7 Daml Scripts pass (balances, conservation of token supply, consent guards, privacy)
- **Feedback addressed:** every structural point raised in the Canton review; see the mapping table below

---

### Feedback → fix mapping

| # | Reviewer feedback | v2 change |
|---|---|---|
| 1 | No value ever moves on-ledger; settlement is a manual wallet transfer | Stakes are locked as **CIP-56 allocations** at position entry, executed/cancelled inside `Settle`/`SettleAsHolder`. `SettlementObligation`, manual transfers, and the dispute flow are **deleted** — there is nothing left to pay out after settlement. |
| 2 | Operator is a trusted oracle (bare `ResolveMarket`) | `ResolveMarket` requires a `ResolutionAttestation` signed by the **attester named at market creation**, records `evidenceHash`/`evidenceUri`, and is gated on the market deadline. DevNet may self-attest; swapping in an independent oracle/attestation service is a *market-creation parameter*, not a code change. This re-anchors the Canton side to the same verify-don't-trust posture TxLINE gives us on Solana. |
| 3 | Non-idiomatic consent (`signatory operator, observer holder`) | Holder-signed `PositionOffer` → operator `AcceptOffer`. The position's signatories are **operator + holder**; a position cannot exist without holder authorization (tested: `submitMustFail` on unilateral creation). No-op `observer operator` removed. Holder can settle own win (`SettleAsHolder`). `ExpirePosition` now enforces `settleBefore`. |
| 4 | Web2 auth on a user-keys chain | Unchanged in this PR (CantonWalletRoadmap Phase 1/3) — but v2 makes holder-side flows *wallet-native in shape*: positions are standard `AllocationRequest`s, stakes are standard allocations, settlement is holder-submittable. Nothing about the v2 model assumes server-held user keys. |
| 5 | "Canton as a checkbox" optics | v2 demos Canton's signature capability (private, atomic multi-party settlement of standard tokens) and survives "why not an EVM + DB" scrutiny: positions private via subtransactions, escrow non-custodial, settlement atomic, resolution evidence-anchored. |

---

### The v2 model (5 pieces)

1. **`PositionOffer`** (signatory: holder) — the consent primitive. The operator
   accepts (position created with both parties as signatories) or rejects.

2. **`PredictionPosition` implements CIP-56 `AllocationRequest`** — declares two
   escrow legs: `stake` (holder → operator, `stake`) and `payout`
   (operator → holder, `stake * (oddsMultiplier - 1)`). Each party locks its own
   side via the registry's `AllocationFactory`. Wallets show these as locked
   holdings.

3. **`Settle` / `SettleAsHolder`** — one choice per settling lane (each party
   can act alone). The choice fetches the attestation-anchored
   `MarketResolution`, validates both allocations byte-for-byte against the
   position's expected `AllocationSpecification`s, then in the same transaction:
   holder wins → cancel stake leg (stake returned) + execute payout leg;
   holder loses → execute stake leg + cancel payout leg; void → cancel both.
   Receipt `PositionSettled` records outcome, payout, and the evidence
   commitment. Economics are fixed by the contract — the settler can't alter
   them, whoever it is.

4. **`ResolutionAttestation`** (signatory: designated attester) — what the
   operator must present to resolve. Carries outcome + `evidenceHash` +
   `evidenceUri`. On DevNet the attester defaults to the operator (self-attested
   — same trust as v1, now explicit); point `PredictionMarket.attester` at an
   independent oracle party and the operator *cannot resolve without that
   oracle's signature*. No contract code changes.

5. **`ExpirePosition` / `ExpirePositionAsHolder`** — after `settleBefore`
   (deadline + 365d grace), either party reclaims the escrow atomically.
   Deadline enforced by the contract.

`Fourcast.Token` is a **reference CIP-56 registry** (admin = `FourcastOperator`)
so the whole lifecycle runs on DevNet without BitSafe/OnRails mint permissions.
The market contracts never touch its concrete templates — they consume only the
standard interfaces. The production swap still requires registry discovery,
instrument configuration, allocation-factory context, funding, and a complete
live lifecycle run against BitSafe's contracts (see below).

---

### Verification evidence

`dpm test` (SDK 3.5.2) — all scripts in `canton/daml/Main.daml`:

```
setup:                              ok
demo:                               ok, 27 transactions   (full lifecycle, holder-settled win)
main:                               ok
test_losingStakeFlowsToOperator:    ok                    (operator-settled loss)
test_consentAndGuardRails:          ok                    (4 negative guards)
test_voidedMarketRefundsEveryone:   ok                    (atomic refund)
test_expireRefundsAfterGrace:       ok                    (deadline-enforced expiry)
```

Asserted in scripts, not narrated:

- **Balances move atomically.** Alice starts with 2,000, locks 500, wins, and
  settles *her own* position → 2,500 (stake returned + 500 payout executed in
  the same transaction). Bob locks 300, loses, operator settles → 700,
  operator 4,800. Total supply 8,000 conserved; nothing remains locked.
- **Holder self-settle works.** The winning `Settle` in the demo is submitted
  by the *holder*.
- **Consent is structural.** `submitMustFail operator (createCmd PredictionPosition …)`
  — operator cannot conjure a position without the holder's signature.
- **Attestation can't be forged.** Market with `attester = bob`:
  `submitMustFail operator (createCmd ResolutionAttestation …)` — the operator
  literally cannot produce the artifact needed to resolve.
- **Deadline enforced.** Early `ResolveMarket` with an otherwise-genuine
  attestation fails; cross-market attestation fails.
- **Privacy unchanged.** Charlie (non-stakeholder) queries return empty for
  positions, allocations *and* receipts — the dual-party privacy demo from v1
  extends to the escrow layer.

The settle transaction for the loser-settle case (extracted from the script's
transaction trace) is one ledger transaction: `Settle` on the position fetches
the resolution + both `TokenAllocation`s → `Allocation_ExecuteTransfer`
creates a 300 cBTC holding for the operator → `Allocation_Cancel` returns the
operator's 300 payout escrow → `PositionSettled` receipt created → position
and both allocations archived. Nothing dangles; there is no step 2.

#### Reproducing

```bash
cd canton
# vendor interfaces already built: vendor/cip-0056/*/.daml/dist/*.dar
~/.dpm/bin/dpm build
export JAVA_HOME=~/.local/share/jre21/Contents/Home   # script service needs a JVM
export PATH="$JAVA_HOME/bin:$PATH"
~/.dpm/bin/dpm test
```

---

### Path to production cBTC / cETH (BitSafe / OnRails)

The Daml code **does not change**. The v2 DAR references token contracts only
through `Splice.Api.Token.{HoldingV1, AllocationV1, AllocationInstructionV1}`.

**BitSafe CBTC is proven end-to-end.** `scripts/canton-bitsafe-lifecycle.mjs`
runs the full lifecycle (allocate → settle → verify balances + privacy) against
real BitSafe CBTC on Canton DevNet. See
`docs/CANTON.md` for the full
integration record.

| Layer | Reference | BitSafe CBTC (proven) |
|---|---|---|
| Interface packages | DONE — built against the DevNet-vetted DALFs (`vendor/network-cip-0056/`, IDs in `manifest.json`) | same |
| Registry contracts | `Fourcast.Token` (`TokenRules`, admin = FourcastOperator) | BitSafe cBTC registry factories (`00d58a5f…`, package `82798df0`) |
| Instrument | `InstrumentId{admin = FourcastOperator, id = "cBTC"}` | `InstrumentId{admin = cbtc-network::…, id = "CBTC"}` |
| Minting | `MintRequest` on the reference registry | faucet-issued holdings (two-phase `TransferInstruction_Accept`) |
| Allocation factory | `toInterfaceCid rulesCid` | registry-provided factory cid; client submits with `expectedAdmin = <BitSafe admin>` |
| Utility DARs | N/A | `utility-registry-app-v0-0.2.0.dar` + `utility-registry-v0-0.4.0.dar` (uploaded by operator) |

Known integration nuances for the client (honest list):

1. **Interface-contract disclosure.** Exercises reference registry contracts
   the caller doesn't see (factory, and — depending on registry — the
   counterparty's allocation). JSON Ledger API v2: attach them under
   `disclosedContracts` in `/v2/commands/submit-and-wait`. (Our reference
   registry observes allocation *receivers* so holder-side settle needs no
   disclosure; TestTokenV1-derived registries may not.)
2. **Allocation discovery.** The app backend queries `Allocation` by
   interface and matches `allocation.settlement.settlementRef` against each
   position, then hands the two cids + `ExtraArgs` to the settle endpoint.
   `ExtraArgs{context, meta}` is plumbed through `SettleParams` already; the
   reference registry ignores it, BitSafe/OnRails may require context provided
   by their app backend.
3. **Wallet UX.** Because positions implement `AllocationRequest`, generic
   CIP-0103 wallets can display and fund the escrow legs. Console Wallet +
   external signing (roadmap Phase 1) turns holder consent into holder keys
   without touching the model.

---

### App-side changes (DELIVERED with the v2 DAR)

- `services/cantonLedgerClient.js` — v2 command surface: `createPositionOffer`/
  `acceptOffer` (holder-signed consent), reference-registry mint,
  `allocateLeg` (CIP-56 AllocationFactory + holding selection),
  `settlePositionV2` (Settle/SettleAsHolder + escrow auto-discovery),
  `expirePosition`, `uploadDar`/`listPackages`. The `SettlementObligation`
  flow is gone.
- API routes: `markets/resolve` issues attestations + computes viewers from
  holders; `positions` gains offers/allocations/expired + POST actions
  (create-offer/accept/reject/allocate); `settle` auto-discovers resolution +
  allocations; `settle-transfer` reports escrow status (obligations gone);
  `balance` reports unlocked vs escrow-locked.
- Components: `CantonSettlementHub` (escrow status panel replaces "pending
  payouts" + the Console-Wallet payment detour); `CantonHolderDashboard`
  (escrowed-funds view replaces obligations + the dispute flow).

### Holder-keyed settlement + proof dossier (Grand Final cut)

- `prepareSettleSubmission()` splits payload assembly from submission, so an
  external holder wallet can sign `SettleAsHolder` itself: the server
  assembles the exact payload (resolution cid, both escrow allocation cids,
  CIP-56 choice-context extraArgs, BitSafe disclosed contracts); the holder's
  Console Wallet key authorizes it. The server never signs.
- `POST /api/canton/settle/prepare` serves that unsigned payload (package-name
  template ref `#fourcast:...`, surviving DAR re-uploads); `settlePositionV2`
  still submits the identical payload server-side for the operator lane.
- Holder dashboard (Positions → Private): "Settle" per resolved open position
  (`useCantonHolderWallet.settleAsHolder`), with busy/error/receipt states.
- Proof dossier: `scripts/canton-bitsafe-lifecycle.mjs` pins
  `public/proof/canton-receipts.json` (all cids, settle update id, receipt
  payload, balance deltas, privacy observation, per-check results); the Proof
  Private proof surface renders it as the "Settled · CBTC" wall. Re-running the
  script refreshes the wall — nothing is mocked.
- Deployment: `docs/CANTON.md` runbook + `scripts/canton-v2-preflight.mjs`
  (package check/upload attempt → registry provision → mints → full live
  lifecycle with asserts).
- Package-id env var flips via `scripts/canton-v2-preflight.mjs` after upload
  (`NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID=550828d2…`, `CANTON_REFERENCE_RULES_CID=…`).

---

### What is deliberately NOT in v2 (scope honesty)

- **Independent attester on DevNet.** The mechanism exists and is tested
  (guards test (b)); wiring a live third-party oracle into the hackathon
  DevNet flow is a deployment task. Today: self-attested, explicitly
  configured at market creation, evidence-committed.
- **External user keys.** Still roadmap Phase 1/3. The model no longer
  *depends* on server-held keys for correctness — escrow and settlement
  execute under contract control — but holder flows are server-brokered until
  CIP-0103 wallet signing lands.
- **Pooled/parimutuel markets.** v2 keeps the house-margin payout model
  (bilateral: holder vs operator, oddsMultiplier). A peer-pooled variant
  (many-to-one legs in one settlement) is the same `AllocationRequest`
  pattern with N legs — an extension, not a redesign.
- **v1 routes still exist.** `SettlementObligation` remains in the deployed
  v1 DAR until DevNet is re-pointed at the 2.0.0 package; then it's dead code.


---

## Canton v2 Deployment Runbook — atomic settlement (fourcast 2.0.0)

Deploys the CIP-56 atomic-settlement contract set and verifies it live on
DevNet. Everything except step 2 is scripted.

> **Package lineage:** v2 ships as a NEW package named `fourcast`, NOT an
> upgrade of the legacy `canton` v1 package. Built with the SAME toolchain and
> LF target as v1 (SDK 3.5.2, LF 2.2) per NODERS's env requirement. The lineage
> split is deliberate: SCU forbids the template/choice restructures v2 makes
> (e.g. SettlementObligation deleted, consent/signatory model changed), so v2
> starts a new lineage instead of pretending to be an upgrade. Legacy v1 stays
> resolvable at `#canton`, v2 at `#fourcast` — neither app's name resolution
> can break the other. Upgrade-check evidence is included in the deploy request.

### Package IDs

| Artifact | Package ID |
|---|---|
| fourcast 2.0.0 (main) | `550828d219effd88bc03fadd856403ab42795e33c185cbea4ff2e055a2ed930a` |
| splice-api-token-metadata-v1 | `4ded6b66…3354f` |
| splice-api-token-holding-v1 | `718a0f77…8d35b` |
| splice-api-token-transfer-instruction-v1 | `55ba4deb…17281` |
| splice-api-token-allocation-v1 | `93c942ae…8cce1d` |
| splice-api-token-allocation-instruction-v1 | `275064aa…bc520` |
| splice-api-token-allocation-request-v1 | `6fe84853…2e193` |

Interface IDs are the **network's own vetted packages** (full values in
`canton/vendor/network-cip-0056/manifest.json`), discovered from the
participant and verified present via `node scripts/canton-package-check.mjs`.
The fourcast DAR bundles them — uploading it requires no other uploads.

### Steps

#### 1. Build + test locally

```bash
export JAVA_HOME=~/.local/share/jre21/Contents/Home   # script service needs a JVM
export PATH="$JAVA_HOME/bin:$PATH"
cd canton
~/.dpm/bin/dpm build && ~/.dpm/bin/dpm test   # expect 7/7 ok
```

#### 2. Upload the DAR (the one manual step)

The NODERS participant denies `POST /v2/packages` to the operator user (403
PERMISSION_DENIED — confirmed). Same process as the v1 DAR:

- Send `canton/.daml/dist/fourcast-2.0.0.dar` to NODERS with the expected
  package id above, or
- Upload via the validator/wallet admin UI if you have that access.

Verify: `node scripts/canton-package-check.mjs` → `canton-2.0.0 (main)` flips
to `PRESENT`.

#### 3. Provision + live-verify (scripted)

```bash
node scripts/canton-v2-preflight.mjs
```

**Status: PASS on live DevNet (2026-07-31).** Full atomic lifecycle on the
real ledger: market → Alice-signed offer → operator accept → both escrow legs
locked (500/500) → attestation → resolve → **Alice settled her own win** via
SettleAsHolder. Assertions passed: stake+500 paid to Alice in the settlement
transaction, operator payout sourced from escrow, both escrows cleared,
receipt `payout=1000` with evidence commitment. Orphaned runs cleanable with
`node scripts/canton-v2-cleanup-orphans.mjs`.

The script will, in order:
1. Detect the uploaded package and patch `.env.local`:
   `NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID=550828d2…`.
2. Create the reference registry (`TokenRules`) and patch
   `CANTON_REFERENCE_RULES_CID=<rules contract id>`.
3. Mint demo balances (operator 5000; Alice 2000; Bob 1000 reference cBTC).
4. Run the full atomic lifecycle on the live ledger: market → Alice-signed
   offer → operator accept → both escrow legs allocated → attestation →
   resolve → **Alice settles her own win** (SettleAsHolder).
5. Assert balances, receipts, conservation (and exit non-zero on failure).

Requires the ledger user to have actAs rights over the Alice/Bob parties
(they were allocated by it). If a holder-submit fails with an authorization
error, ask NODERS to extend the user's rights — the holder lane is
demonstrable with `lane: 'operator'` meanwhile (economics identical, contract-
fixed).

#### 4. Propagate env to deployments

Same values as `.env.local`, on Vercel:

```
NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID=550828d219effd88bc03fadd856403ab42795e33c185cbea4ff2e055a2ed930a
CANTON_REFERENCE_RULES_CID=<rules contract id from preflight step 2>
## optional: CANTON_ATTESTER_PARTY_ID=<independent attester party> (default operator)
```

#### 5. Verify the app

```bash
curl "$APP/api/canton/health"
curl "$APP/api/canton/balance"                      # escrow balances
curl "$APP/api/canton/settle-transfer"              # per-position escrow status
curl "$APP/api/canton/positions?type=allocations"   # locked CIP-56 allocations
```

`/canton` shows escrow status (was "pending payouts"); `/canton/holder` shows
"Escrowed funds" (was "Pending payouts / dispute").

### What changed client-side (inventory)

- `services/cantonLedgerClient.js` — v2 command surface: offers/accept,
  registry mint, `allocateLeg`, `settlePositionV2` (Settle/SettleAsHolder),
  `expirePosition`, allocation discovery, `uploadDar`, `listPackages`.
  Removed: SettlementObligation flow.
- Routes: `markets/resolve` (attestation flow), `positions` (offers /
  allocations / expired types + POST actions), `settle` (auto-discovery),
  `settle-transfer` (deprecated → escrow status), `balance` (escrow balances).
- Components: `CantonSettlementHub` (escrow panel), `CantonHolderDashboard`
  (escrowed funds instead of obligations/dispute).
- `services/cantonPublisher.js` — marked v1-legacy; wallet-side publishing
  (Console Wallet signed offers) is roadmap Phase 1.

### Rollback

The v1 package (`canton` 1.0.0, `1fdf1b33…`) stays on the ledger and stays
resolvable at `#canton:` (v2 is a DIFFERENT package name, so it never
shadow-resolves). Rollback = simply don't point env at fourcast (leave
`NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID` on the v1 id) + redeploy.


---

## Canton Wallet & Settlement UX Roadmap

> **Current status (2026-08):** DevNet prototype. The holder dashboard
> (`/canton/holder`) supports private queries and a **holder-signed settlement
> lane**: `/api/canton/settle/prepare` assembles an unsigned `SettleAsHolder`
> payload and `useCantonHolderWallet.settleAsHolder` signs it with the holder's
> own key. The real BitSafe CBTC lifecycle is verified on DevNet; mainnet is
> not deployed. Remaining product work is holder-signed position creation and
> an independent attester integration. The current DevNet resolver defaults to
> operator self-attestation, and the server-side ledger client remains the
> fallback judge-demo path.

---

### Goals

1. Move from a **server-only operator model** to a **true multi-party Canton dApp** where end users connect their own wallets.
2. Use the v2 atomic allocation flow so the demo does not rely on manual payout transfers.
3. Improve security of operator authentication without risking the live demo.

---

### Phase 1: Prototype Console Wallet connect (CIP-0103 dApp SDK)

**Why first:** highest impact, lowest risk, additive to existing operator hub.

#### Status: Partially implemented
- [x] Holder / Trader view at `/canton/holder` (was `/canton/trader` in the original plan)
- [x] `components/CantonHolderDashboard.js` — wallet connect, private position queries, dispute flow, **"Settle with my wallet" sovereignty lane**
- [x] `hooks/useCantonHolderWallet.js` — Console Wallet connection + contract queries + dispute + `settleAsHolder`
- [x] Connected party sees only contracts they are a signatory/observer on
- [x] Holder-signed `SettleAsHolder`: `services/cantonLedgerClient.prepareSettleSubmission()` builds the exact payload; `POST /api/canton/settle/prepare` serves it unsigned; wallet signs and submits via `prepareExecuteAndWait`
- [ ] "Take position" form (YES/NO, stake, asset) — currently the operator creates positions on behalf of holders
- [ ] `POST /api/canton/positions` (holder takes a position) — not yet wired
- [ ] Update `components/CantonMarkets.js` CTA to route to `/canton/holder`

#### Scope (remaining)
- Leave `CantonSettlementHub` (operator view) unchanged.
- Add a new **Holder / Trader** view (e.g., `/canton/trader`) that uses the Console Wallet browser extension.
- Integrate the Canton dApp SDK (`@canton-network/wallet-adapter`) for:
  - Wallet discovery
  - Connect / disconnect
  - Querying active contracts as the signed-in party
  - Signing `Create` and `Exercise` commands

#### Implementation steps
1. Add `@canton-network/wallet-adapter` (or current equivalent) to dependencies.
2. Create `app/canton/trader/page.js` as a new route.
3. Build `components/CantonTraderHub.js`:
   - Wallet connect button with party/address display
   - List of markets the holder can participate in
   - “Take position” form (YES/NO, stake, asset)
   - “Settle position” button after market resolution
4. Add API routes where needed:
   - `POST /api/canton/positions` (holder takes a position)
   - Reuse `/api/canton/markets` for read-only market discovery
5. Update `components/CantonMarkets.js` CTA to route to `/canton/trader`.

#### Acceptance criteria
- A user with the Console Wallet extension can connect.
- Connected party sees only contracts they are a signatory/observer on.
- Taking a position creates a `PredictionPosition` on Canton Devnet visible to the holder and operator, but not to a non-signatory.

#### Risks & mitigations
- **Risk:** dApp SDK may not support Devnet party creation. **Mitigation:** pre-seed known parties (Alice/Bob) and allow wallet to act as them.
- **Risk:** Browser extension required. **Mitigation:** keep the server-side operator flow as fallback for judges without Console Wallet.

---

### Phase 2: Automate CIP-56 settlement

**Why second:** high demo impact, but touches Daml contracts and working settlement logic.

#### Status: Delivered and verified on DevNet

The v2 contract model and real BitSafe CBTC lifecycle are complete on Canton
DevNet. The recorded lifecycle is `scripts/canton-bitsafe-lifecycle.mjs`, with
captured evidence in `public/proof/canton-receipts.json` (2026-08-04). It uses
real BitSafe CBTC holdings, CIP-56 allocations, and holder-side
`SettleAsHolder`; it is not merely the Fourcast reference-registry flow.

Remaining production work is not a second BitSafe qualification pass. It is:

1. integrate an independent attester instead of the current operator
   self-attestation default;
2. complete holder-signed position creation, rather than only holder-signed
   settlement; and
3. establish the target-network registry, wallet, permissions, and operational
   runbook before any mainnet deployment.

#### Scope
- Keep the DevNet BitSafe lifecycle reproducible as a regression/operational check.
- Retain the server-side operator lane only as a judge/demo fallback; it is not the intended production holder-authority model.
- Do not claim mainnet deployment, independent oracle resolution, or cETH registry integration until each has separate evidence.

#### Acceptance criteria
- The DevNet BitSafe lifecycle continues to pass with real CBTC and recorded evidence.
- A market cannot resolve without an attestation from its designated attester.
- A holder can sign settlement with their own wallet; holder-signed position creation and independent attester operation remain tracked production work.

#### Risks & mitigations
- **Risk:** Target-network token registries, package versions, and party permissions differ from DevNet. **Mitigation:** obtain the production registry configuration and rerun the complete lifecycle before enabling real assets.
- **Risk:** The current self-attested DevNet resolver is mistaken for independent oracle operation. **Mitigation:** state this distinction explicitly in product and partner material; require a distinct attester party for production.

---

### Phase 3: Refactor operator auth to OAuth / Wallet Gateway

**Why third:** important for production security but low hackathon ROI and high risk.

#### Scope
- Replace the server-side OIDC password grant in `services/cantonLedgerClient.js` with a short-lived OAuth flow via a Wallet Gateway.
- Operator credentials should no longer be stored as environment variables accessible to the app runtime.

#### Implementation steps
1. Register the app with the NODERS Wallet Gateway / OAuth provider.
2. Replace `getToken()` with an OAuth2 authorization-code or client-credentials flow.
3. Store tokens in a short-lived cache and refresh as needed.
4. Rotate and remove `CANTON_OIDC_PASSWORD` from Vercel env vars once the Gateway flow works.

#### Acceptance criteria
- No plaintext passwords in environment variables.
- Server can still authenticate and submit operator commands.

#### Risks & mitigations
- **Risk:** High chance of breaking the live demo during the refactor. **Mitigation:** do this only after the hackathon, or run it on a separate preview branch with a full end-to-end test.

---

### Recommended order

| Order | Phase | Effort | Risk | Hackathon Value |
|-------|-------|--------|------|-----------------|
| 1 | Independent attester integration | Medium | Medium | Critical |
| ~~2~~ | ~~Complete external holder signing~~ — **DELIVERED for settlement** (`SettleAsHolder` via `/api/canton/settle/prepare` + dashboard). Position *creation* signing remains open (Phase 1) | Medium | Medium | High |
| 3 | Mainnet / production registry deployment | High | High | Medium |
| 4 | OAuth/Wallet Gateway auth | Medium | High | Low |

---

### Open questions

- Does the current Canton Devnet support Console Wallet extension connections, or do we need a specific NODERS Devnet wallet build?
- Are CIP-56 token DARs available for the HackCanton Devnet, or do we need to request them?
- Should the trader view be public (`/canton/trader`) or gated behind the feature flag (`NEXT_PUBLIC_CANTON_ENABLED`)?

---

### Files likely to change by phase

- **Phase 1:** `app/canton/trader/page.js`, `components/CantonTraderHub.js`, `app/api/canton/positions/route.js`, `components/CantonMarkets.js`
- **Phase 2:** `canton/daml/Fourcast/`, `services/cantonLedgerClient.js`, `components/CantonSettlementHub.js`, `app/api/canton/settle/route.js`
- **Phase 3:** `services/cantonLedgerClient.js`, `.env.local.example`, Vercel env vars


---

## BitSafe CBTC integration — the qualification gate

HackCanton's CBTC challenge requires "integrating CBTC in a meaningful way,
not a passing mention." The reference-registry preflight
(`scripts/canton-v2-preflight.mjs`) settles a token named `cBTC` against
Fourcast's own `Fourcast.Token` registry. That proves the atomic-settlement
model but **does not prove BitSafe CBTC settlement**.

This document tracks the path from reference → real CBTC. **The Daml does not
change** — the market and position contracts reference tokens only through the
CIP-56 interfaces `Splice.Api.Token.{HoldingV1, AllocationV1,
AllocationInstructionV1}`. Swapping in BitSafe is a configuration change, not a
code change. See the path-to-production table in
`CANTON.md`.

### Status — ✅ LIVE: real CBTC settlement proven end-to-end

The `canton-bitsafe-lifecycle.mjs` script passes all checks against real BitSafe
CBTC on Canton DevNet. Alice and the operator each hold faucet-funded CBTC,
escrow both legs of a position, settle atomically, and the receipt shows
`instrument.id = CBTC`. A non-signatory's read is refused by the ledger.

```
✅ BITSAFE LIFECYCLE PASSED — real CBTC settled atomically on Canton DevNet.

   alice:    3 → 3.4 (Δ +0.4 CBTC)
   operator: 2 → 1.6 (Δ -0.4 CBTC)
   escrow:   alice 0.4→0, operator 0.4→0 (both cleared)
   receipt:  payout=0.8 CBTC · instrument=CBTC · evidence=sha256:bitsafe-attestation
   privacy:  non-signatory query: refused

   ✓ alice net += winnings (stake*(mult-1))
   ✓ operator net -= payout (stake*(mult-1))
   ✓ both escrow legs cleared
   ✓ settled receipt exists with payout
   ✓ receipt instrument is the real CBTC id
   ✓ non-signatory cannot read the position
```

All integration parameters are **public and self-service** (BitSafe runs the
Canton DevNet registry openly). No bespoke BitSafe request is needed.

#### What is proven live on Canton DevNet

| Parameter | Value | Source |
|---|---|---|
| CBTC instrument admin | `cbtc-network::12202a83c6f4082217c175e29bc53da5f2703ba2675778ab99217a5a881a949203ff` | `instrument-admin` endpoint |
| CBTC instrument id | `CBTC` | registry metadata |
| Registry (DA Utility) URL | `https://api.utilities.digitalasset-dev.com` | manifest + docs |
| BitSafe API URL | `https://api.devnet.bitsafe.finance` | `docs.bitsafe.finance` |
| Faucet | `https://cbtc-faucet.devnet.bitsafe.finance/api/faucet` (`POST /api/faucet`, `{network:'devnet', recipient_party, amount}`) | faucet API |
| AllocationFactory contract id | `00d58a5f…` (package `82798df0…`) | `/cbtc/v1/token-standard-contracts` |

The CBTC instrument is live and queryable: total supply ≈ 1014, decimals 10,
all CIP-56 interfaces (`HoldingV1`, `AllocationV1`, `AllocationInstructionV1`,
`AllocationRequestV1`, `MetadataV1`, `TransferInstructionV1`) supported.

**Two-phase transfer — proven working.** The faucet issues a `TransferOffer`
that the receiver must accept. Operator + Alice were each funded 1.0 CBTC and
each accepted via the `TransferInstructionV1` interface choice
`TransferInstruction_Accept` (choice-context fetched from the DA Utility
`choice-contexts/accept` endpoint, passed as `extraArgs.context`). Each party
owns a `Utility.Registry.Holding` with `instrument.id = CBTC`, `amount = 1.0`.

**Settlement wiring — complete and proven.** `services/cantonLedgerClient.js`
reads and exercises CBTC entirely through the CIP-56 interfaces +
`disclosedContracts`:

- `getHoldings` / `getBalances` / `getAllocations` — read CBTC via
  `Utility.Registry` `Holding` / `Allocation` templates (discovered through
  `queryAllActiveContracts`). `getAllocations` filters for both `:Allocation`
  and `:DvpLegAllocation` (BitSafe uses the latter).
- `allocateLeg` — builds the full `AllocationFactory_Allocate` choiceArgument,
  fetches per-allocation choice-context from the DA Utility allocation-factory
  endpoint, merges the BitSafe disclosed set (factory + instrument-config +
  issuer credential), fills the real global-domain synchronizer id, and
  exercises via the interface id. **`submitForContractId` forwards
  `disclosedContracts`** (a prior version silently dropped them, causing
  "Contract could not be found").
- `findPositionAllocations` — robust to both the reference (`.allocation`
  nesting) and BitSafe (top-level) allocation payload shapes.
- `settlePositionV2` — fetches per-allocation **execute-transfer**
  choice-contexts (not `withdraw` — the Settle choice internally calls
  `Allocation_ExecuteTransfer`, which requires the
  `utility.digitalasset.com/instrument-configuration` context entry that only
  the `execute-transfer` endpoint returns). Also adds the allocation contracts
  themselves to the `disclosedContracts` set (via
  `queryInterfaceContractsWithBlob`) since the participant needs their
  `createdEventBlob` to deserialize them.
- `expirePosition` — same pattern, but uses the `withdraw` choice-context
  (expire = refund, not transfer).
- `getCbtcHoldings` / `getCbtcSynchronizerId` / `isPackageUploaded` — helpers.
- `queryInterfaceContractsWithBlob` — queries contracts by interface id WITH
  `createdEventBlob: true` (for building `disclosedContracts`).

#### What was needed from the node operator

The participant has the CIP-56 *interface* packages but also needed three
utility **implementation** packages uploaded (our credentials lack
package-upload rights — `POST /v2/packages` returns 403):

| Package | Hash | DAR (devnet bundle 0.12.5) |
|---|---|---|
| `Utility.Registry.App.V0.Service` (AllocationFactory) | `82798df0…` | `utility-registry-app-v0-0.2.0.dar` |
| `Utility.Registry.V0.Configuration` (InstrumentConfiguration) | `ed73d5b9…` | `utility-registry-v0-0.4.0.dar` |
| `Utility.Credential.V0` (issuer credential) | `77df4e7b…` | bundled inside the two above |

Bundle: `https://get.digitalasset.com/utility-dars/canton-network-utility-dars-0.12.5.tar.gz`

**Important:** the factory contract was created under version `0.2.0` of the
registry-app, not the latest (`0.7.0`). The dalf filename inside each DAR
embeds the package hash — match by hash, not by version number.

### Configure and run

Add to `.env.local` (transport + package + party envs are already set by the
reference preflight):

```
CANTON_BTC_REGISTRY_CID=00d58a5f…   # AllocationFactory contract id
CANTON_BTC_INSTRUMENT_ADMIN=cbtc-network::12202a83c6f4082217c175e29bc53da5f2703ba2675778ab99217a5a881a949203ff
CANTON_BTC_INSTRUMENT_ID=CBTC
CANTON_REGISTRY_URL=https://api.utilities.digitalasset-dev.com
CANTON_BITSAFE_API_URL=https://api.devnet.bitsafe.finance
```

Then:

```bash
## 1. fund operator + Alice (1.0 CBTC each):
##    POST https://cbtc-faucet.devnet.bitsafe.finance/api/faucet
##    { "network": "devnet", "recipient_party": "<party>", "amount": "1" }
##    Then accept the pending TransferOffer via acceptTransferOffer().
## 2. run the lifecycle against real CBTC:
node scripts/canton-bitsafe-lifecycle.mjs
```

The script validates the BitSafe envs and exits with the ask above if any are
missing — it never silently falls back to the reference registry. On success it
prints: before/after CBTC balances, the settle `updateId`, the settled receipt
(stake, payout, instrument id, evidence hash), and the privacy contrast
(operator sees the receipt; a non-signatory's read is refused by the ledger).

### Known integration nuances

Honest list (from `CANTON.md`), to expect with BitSafe:

1. **Interface-contract disclosure.** Allocation exercises a registry factory
   contract the caller may not otherwise see. JSON Ledger API v2: attach such
   contracts under `disclosedContracts` in `/v2/commands/submit-and-wait`. The
   reference registry observes allocation *receivers*, so holder-side settle
   needs no disclosure; a BitSafe registry may differ. If the lifecycle fails
   at `allocateLeg` with a contract-not-visible error, this is the cause — add
   the disclosed contract(s).
2. **Allocation discovery.** The backend queries `Allocation` by interface and
   matches `allocation.settlement.settlementRef` to each position, then hands
   the two allocation cids + `ExtraArgs` to the settle endpoint. This is
   registry-agnostic and unchanged.
3. **`expectedAdmin`.** The factory choice takes `expectedAdmin = <BitSafe
   registry admin>` (set via `CANTON_BTC_INSTRUMENT_ADMIN`). The reference path
   uses the Fourcast operator; BitSafe uses BitSafe's admin.
4. **`execute-transfer` vs `withdraw` context.** The Settle choice internally
   calls `Allocation_ExecuteTransfer` (not `Allocation_Withdraw`). The
   `choice-contexts/execute-transfer` endpoint returns the
   `instrument-configuration` context entry that the `withdraw` endpoint does
   not. Using the wrong endpoint produces "Missing context entry for:
   utility.digitalasset.com/transfer-rule".
5. **Allocation template name.** BitSafe uses
   `Utility.Registry.V0.Holding.Allocation:DvpLegAllocation`, not
   `:Allocation`. The `getAllocations` filter matches both suffixes.
6. **Package versions.** The factory contract was created under
   `utility-registry-app-v0-0.2.0` (package hash `82798df0`). Uploading the
   latest version (`0.7.0`) installs a different package hash (`b7356fbb`) and
   the factory blob cannot be deserialized. Match by hash, not version.
7. **Faucet endpoint.** The faucet lives at `cbtc-faucet.devnet.bitsafe.finance`
   (not `cbtc-faucet.bitsafe.finance`) and expects `network: "devnet"`.
