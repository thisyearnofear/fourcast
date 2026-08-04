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

## Status — ✅ LIVE: real CBTC settlement proven end-to-end

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

### What is proven live on Canton DevNet

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

### What was needed from the node operator

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
# 1. fund operator + Alice (1.0 CBTC each):
#    POST https://cbtc-faucet.devnet.bitsafe.finance/api/faucet
#    { "network": "devnet", "recipient_party": "<party>", "amount": "1" }
#    Then accept the pending TransferOffer via acceptTransferOffer().
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
