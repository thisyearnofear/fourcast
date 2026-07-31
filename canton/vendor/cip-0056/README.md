# Vendored CIP-56 (Canton Network Token Standard) V1 interface packages

Source: `canton-network/splice` (formerly hyperledger-labs/splice), path `token-standard/`, Apache-2.0.
Pinned at fetch time (2026-07-31); re-fetch from the upstream repo to update.
These are INTERFACE packages only (no registry implementation) — the same
packages that cBTC (BitSafe) and cETH (OnRails) implement on Canton Network.

Packages (build order):

1. `splice-api-token-metadata-v1` — `Metadata`, `ExtraArgs`, `ChoiceExecutionMetadata`, `AnyContract`
2. `splice-api-token-holding-v1` — `Holding`, `HoldingView`, `InstrumentId`, `Lock`
3. `splice-api-token-transfer-instruction-v1` — `TransferInstruction`, `TransferFactory`, `Transfer`
4. `splice-api-token-allocation-v1` — `Allocation`, `AllocationSpecification`, `SettlementInfo`, `TransferLeg`
5. `splice-api-token-allocation-instruction-v1` — `AllocationFactory`, `AllocationInstruction`
6. `splice-api-token-allocation-request-v1` — `AllocationRequest` (what `PredictionPosition` implements)

## Build

```bash
DPM=~/.dpm/bin/dpm
for pkg in splice-api-token-metadata-v1 splice-api-token-holding-v1 \
           splice-api-token-transfer-instruction-v1 splice-api-token-allocation-v1 \
           splice-api-token-allocation-instruction-v1 splice-api-token-allocation-request-v1; do
  (cd $pkg && $DPM build)
  (cd $pkg/.daml/dist && ln -sf ${pkg}-1.0.0.dar ${pkg}-current.dar)
done
```

The `-current.dar` symlinks keep the upstream `data-dependencies` relative
paths valid. The main package (`canton/daml.yaml`) consumes them.

## Production note

For mainnet-parity builds, replace these `data-dependencies` with the exact
package versions vetted on the target network (see
`docs/CANTON_ATOMIC_SETTLEMENT.md` → "Path to production cBTC / cETH" — the
Daml code does not change, only which compiled interface DARs it is built
against).
