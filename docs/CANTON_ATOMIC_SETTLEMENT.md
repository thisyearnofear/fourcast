# Canton v2 — Atomic Settlement Upgrade

## Current implementation status

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

## Feedback → fix mapping

| # | Reviewer feedback | v2 change |
|---|---|---|
| 1 | No value ever moves on-ledger; settlement is a manual wallet transfer | Stakes are locked as **CIP-56 allocations** at position entry, executed/cancelled inside `Settle`/`SettleAsHolder`. `SettlementObligation`, manual transfers, and the dispute flow are **deleted** — there is nothing left to pay out after settlement. |
| 2 | Operator is a trusted oracle (bare `ResolveMarket`) | `ResolveMarket` requires a `ResolutionAttestation` signed by the **attester named at market creation**, records `evidenceHash`/`evidenceUri`, and is gated on the market deadline. DevNet may self-attest; swapping in an independent oracle/attestation service is a *market-creation parameter*, not a code change. This re-anchors the Canton side to the same verify-don't-trust posture TxLINE gives us on Solana. |
| 3 | Non-idiomatic consent (`signatory operator, observer holder`) | Holder-signed `PositionOffer` → operator `AcceptOffer`. The position's signatories are **operator + holder**; a position cannot exist without holder authorization (tested: `submitMustFail` on unilateral creation). No-op `observer operator` removed. Holder can settle own win (`SettleAsHolder`). `ExpirePosition` now enforces `settleBefore`. |
| 4 | Web2 auth on a user-keys chain | Unchanged in this PR (CantonWalletRoadmap Phase 1/3) — but v2 makes holder-side flows *wallet-native in shape*: positions are standard `AllocationRequest`s, stakes are standard allocations, settlement is holder-submittable. Nothing about the v2 model assumes server-held user keys. |
| 5 | "Canton as a checkbox" optics | v2 demos Canton's signature capability (private, atomic multi-party settlement of standard tokens) and survives "why not an EVM + DB" scrutiny: positions private via subtransactions, escrow non-custodial, settlement atomic, resolution evidence-anchored. |

---

## The v2 model (5 pieces)

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

## Verification evidence

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

### Reproducing

```bash
cd canton
# vendor interfaces already built: vendor/cip-0056/*/.daml/dist/*.dar
~/.dpm/bin/dpm build
export JAVA_HOME=~/.local/share/jre21/Contents/Home   # script service needs a JVM
export PATH="$JAVA_HOME/bin:$PATH"
~/.dpm/bin/dpm test
```

---

## Path to production cBTC / cETH (BitSafe / OnRails)

The Daml code **does not change**. The v2 DAR references token contracts only
through `Splice.Api.Token.{HoldingV1, AllocationV1, AllocationInstructionV1}`.

**BitSafe CBTC is proven end-to-end.** `scripts/canton-bitsafe-lifecycle.mjs`
runs the full lifecycle (allocate → settle → verify balances + privacy) against
real BitSafe CBTC on Canton DevNet. See
[`docs/BITSAFE_INTEGRATION.md`](./BITSAFE_INTEGRATION.md) for the full
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

## App-side changes (DELIVERED with the v2 DAR)

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

## Holder-keyed settlement + proof dossier (Grand Final cut)

- `prepareSettleSubmission()` splits payload assembly from submission, so an
  external holder wallet can sign `SettleAsHolder` itself: the server
  assembles the exact payload (resolution cid, both escrow allocation cids,
  CIP-56 choice-context extraArgs, BitSafe disclosed contracts); the holder's
  Console Wallet key authorizes it. The server never signs.
- `POST /api/canton/settle/prepare` serves that unsigned payload (package-name
  template ref `#fourcast:...`, surviving DAR re-uploads); `settlePositionV2`
  still submits the identical payload server-side for the operator lane.
- Holder dashboard: "Settle with my wallet" per open position
  (`useCantonHolderWallet.settleAsHolder`), with busy/error/receipt states.
- Proof dossier: `scripts/canton-bitsafe-lifecycle.mjs` pins
  `public/proof/canton-receipts.json` (all cids, settle update id, receipt
  payload, balance deltas, privacy observation, per-check results); the Proof
  Theatre renders it as the "Pinned settlement receipts" wall. Re-running the
  script refreshes the wall — nothing is mocked.
- Deployment: `docs/CANTON_V2_DEPLOY.md` runbook + `scripts/canton-v2-preflight.mjs`
  (package check/upload attempt → registry provision → mints → full live
  lifecycle with asserts).
- Package-id env var flips via `scripts/canton-v2-preflight.mjs` after upload
  (`NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID=550828d2…`, `CANTON_REFERENCE_RULES_CID=…`).

---

## What is deliberately NOT in v2 (scope honesty)

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
