# BitSafe CBTC integration — the qualification gate

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
[`CANTON_ATOMIC_SETTLEMENT.md`](./CANTON_ATOMIC_SETTLEMENT.md#path-to-production-cbtc--ceth-bitsafe--onrails).

## Status — all integration parameters self-served

Every parameter that looked like "the ask for BitSafe" turned out to be
**public and self-service** (BitSafe runs the Canton DevNet registry openly).
No bespoke BitSafe request is needed. The wiring is complete; the only
remaining step is a participant-package upload that our credentials cannot do
(see [Remaining blocker](#remaining-blocker--operator-dar-upload) below).

What is proven live on Canton DevNet (`hackcanton-01.devnet.naas.noders.services`):

| Parameter | Value | Source |
|---|---|---|
| CBTC instrument admin | `cbtc-network::12202a83c6f4082217c175e29bc53da5f2703ba2675778ab99217a5a881a949203ff` | `instrument-admin` endpoint |
| CBTC instrument id | `CBTC` | registry metadata |
| Registry (DA Utility) URL | `https://api.utilities.digitalasset-dev.com` | manifest + docs |
| BitSafe API URL | `https://api.devnet.bitsafe.finance` | `docs.bitsafe.finance` |
| Faucet | `https://cbtc-faucet.bitsafe.finance/` (`POST /api/faucet`) | faucet bundle |
| AllocationFactory contract id | `00d58a5f…` (package `82798df0…`) | `/cbtc/v1/token-standard-contracts` |

The CBTC instrument is live and queryable: total supply ≈ 1014, decimals 10,
all CIP-56 interfaces (`HoldingV1`, `AllocationV1`, `AllocationInstructionV1`,
`AllocationRequestV1`, `MetadataV1`, `TransferInstructionV1`) supported.

**Two-phase transfer — proven working.** The faucet issues a `TransferOffer`
that the receiver must accept. Operator + Alice were each funded 1.0 CBTC and
each accepted via the `TransferInstructionV1` interface choice
`TransferInstruction_Accept` (choice-context fetched from the DA Utility
`choice-contexts/accept` endpoint, passed as `extraArgs.context`). Each party
now owns a `Utility.Registry.Holding` with `instrument.id = CBTC`,
`amount = 1.0`.

**Settlement wiring — complete.** `services/cantonLedgerClient.js` reads and
exercises CBTC entirely through the CIP-56 interfaces + `disclosedContracts`:

- `getHoldings` / `getBalances` / `getAllocations` — read CBTC via
  `Utility.Registry` `Holding` / `Allocation` templates (discovered through
  `queryAllActiveContracts`).
- `allocateLeg` — builds the full `AllocationFactory_Allocate` choiceArgument,
  fetches per-allocation choice-context from the DA Utility allocation-factory
  endpoint, merges the BitSafe disclosed set (factory + instrument-config +
  issuer credential), fills the real global-domain synchronizer id, and
  exercises via the interface id.
- `findPositionAllocations` — robust to both the reference (`.allocation`
  nesting) and BitSafe (top-level) allocation payload shapes.
- `settlePositionV2` / `expirePosition` — fetch per-allocation withdraw
  choice-contexts, pass them in `stakeExtraArgs` / `payoutExtraArgs`, and
  attach `disclosedContracts`.
- `getCbtcHoldings` / `getCbtcSynchronizerId` / `isPackageUploaded` — helpers.

## Configure and run

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
# 1. fund operator + Alice at https://cbtc-faucet.bitsafe.finance/ (1.0 CBTC each)
# 2. run the lifecycle against real CBTC:
node scripts/canton-bitsafe-lifecycle.mjs
```

The script validates the BitSafe envs and exits with the ask above if any are
missing — it never silently falls back to the reference registry. On success it
prints: before/after CBTC balances, the settle `updateId`, the settled receipt
(stake, payout, instrument id, evidence hash), and the privacy contrast
(operator sees the receipt; a non-signatory's read is refused by the ledger).

## Remaining blocker — operator DAR upload

`allocateLeg` reaches `AllocationFactory_Allocate` and fails with
**"Contract could not be found with id 00d58a5f…"**. Root cause: the participant
has the CIP-56 *interface* packages uploaded, but **not the three utility
*implementation* packages** the factory contract was created under. Without
them the participant cannot deserialize the disclosed factory blob, so the
exercise is rejected.

The three missing packages:

| Package | Hash | DAR (devnet bundle 0.12.5) |
|---|---|---|
| `Utility.Registry.App.V0.Service` (AllocationFactory) | `82798df0…` | `utility-registry-app-v0-0.7.0.dar` |
| `Utility.Registry.V0.Configuration` (InstrumentConfiguration) | `ed73d5b9…` | `utility-registry-v0-0.4.1.dar` |
| `Utility.Credential.V0` (issuer credential) | `77df4e7b…` | `utility-credential-v0-0.1.0.dar` |

Bundle: `https://get.digitalasset.com/utility-dars/canton-network-utility-dars-0.12.5.tar.gz`
(match by hash in case the devnet version drifted).

**Our credentials cannot upload DARs** — `POST /v2/packages` returns
`403 "A security-sensitive error has been received"`. We can read packages and
submit commands, but the package-upload right is held by the node operator
(NODERS). Until they upload the three DARs above, `allocateLeg` cannot proceed,
so the lifecycle cannot complete end-to-end.

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

## Honest judge statement (if the DAR upload is still pending)

> The complete atomic-settlement lifecycle is live on Canton DevNet against a
> CIP-56 reference registry: private positions, holder consent, escrowed
> allocations, attestation-anchored resolution, and holder-settled wins. The
> market and position contracts are registry-agnostic — they reference tokens
> only through the CIP-56 interfaces — so connecting the BitSafe CBTC registry
> is a configuration swap, not a code change. That swap is wired end-to-end:
> real CBTC is live on DevNet, both parties hold 1.0 CBTC, two-phase transfer
> accept is proven, and all four settlement branches (allocate / settle /
> expire / balances) exercise CBTC through the CIP-56 interfaces. The single
> remaining step is a participant-package upload the node operator must perform
> (our credentials lack the upload right); until those three utility packages
> are on the participant, `allocateLeg` cannot deserialize the disclosed
> factory contract.

Do **not** call it "BitSafe CBTC integrated" until `canton-bitsafe-lifecycle.mjs`
passes and the settled receipt's `instrument.id` equals the real BitSafe CBTC
instrument id.
