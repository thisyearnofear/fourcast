# BitSafe CBTC integration — the qualification gate

HackCanton's CBTC challenge requires "integrating CBTC in a meaningful way,
not a passing mention." The reference-registry preflight
(`scripts/canton-v2-preflight.mjs`) settles a token named `cBTC` against
Fourcast's own `Fourcast.Token` registry. That proves the atomic-settlement
model but **does not prove BitSafe CBTC settlement**.

This document is the one-step path from reference → real CBTC. **The Daml does
not change** — the market and position contracts reference tokens only through
the CIP-56 interfaces `Splice.Api.Token.{HoldingV1, AllocationV1,
AllocationInstructionV1}`. Swapping in BitSafe is a configuration change, not a
code change. See the path-to-production table in
[`CANTON_ATOMIC_SETTLEMENT.md`](./CANTON_ATOMIC_SETTLEMENT.md#path-to-production-cbtc--ceth-bitsafe--onrails).

## The ask for BitSafe

Request four things from BitSafe (docs: https://docs.bitsafe.finance/developers):

1. **The CBTC `AllocationFactory` contract id** — the registry factory contract
   the app exercises to lock escrow allocations. → `CANTON_BTC_REGISTRY_CID`
2. **The BitSafe registry admin party** — the `expectedAdmin` the factory
   requires. → `CANTON_BTC_INSTRUMENT_ADMIN`
3. **The real CBTC `InstrumentId`** — `{admin, id}` as returned by BitSafe's
   registry (not the placeholder `"cBTC"` string). → `CANTON_BTC_INSTRUMENT_ID`
4. **Faucet CBTC** for the operator and a holder party — fund both at
   https://cbtc-faucet.bitsafe.finance/ so the lifecycle has real collateral
   to escrow and settle.

Also confirm whether the factory / counterparty allocation contracts must be
attached as `disclosedContracts` on `/v2/commands/submit-and-wait` (the
reference registry does not require this; a BitSafe registry may — see nuances
below).

## Configure and run

Add to `.env.local` (transport + package + party envs are already set by the
reference preflight):

```
CANTON_BTC_REGISTRY_CID=<BitSafe AllocationFactory contract id>
CANTON_BTC_INSTRUMENT_ADMIN=<BitSafe registry admin party>
CANTON_BTC_INSTRUMENT_ID=<real CBTC instrument id>
# optional, strengthens the resolution story:
CANTON_ATTESTER_PARTY_ID=<an independent attester party>
# optional demo sizing:
BITSAFE_DEMO_STAKE=500
BITSAFE_DEMO_MULT=2
```

Then:

```bash
# 1. fund operator + Alice at https://cbtc-faucet.bitsafe.finance/
# 2. run the lifecycle against real CBTC:
node scripts/canton-bitsafe-lifecycle.mjs
```

The script validates the BitSafe envs and exits with the ask above if any are
missing — it never silently falls back to the reference registry. On success it
prints: before/after CBTC balances, the settle `updateId`, the settled receipt
(stake, payout, instrument id, evidence hash), and the privacy contrast
(operator sees the receipt; a non-signatory's read is refused by the ledger).

## Known integration nuances

Honest list (from `CANTON_ATOMIC_SETTLEMENT.md`), to expect with BitSafe:

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

## Honest judge statement (if BitSafe is not yet integrated)

> The complete atomic-settlement lifecycle is live on Canton DevNet against a
> CIP-56 reference registry: private positions, holder consent, escrowed
> allocations, attestation-anchored resolution, and holder-settled wins. The
> market and position contracts are registry-agnostic — they reference tokens
> only through the CIP-56 interfaces — so connecting the BitSafe CBTC registry
> is a configuration swap, not a code change. That swap is the remaining CBTC
> integration step.

Do **not** call it "BitSafe CBTC integrated" until `canton-bitsafe-lifecycle.mjs`
passes and the settled receipt's `instrument.id` equals the real BitSafe CBTC
instrument id.
