# Canton v2 Deployment Runbook — atomic settlement (fourcast 2.0.0)

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

## Package IDs

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

## Steps

### 1. Build + test locally

```bash
export JAVA_HOME=~/.local/share/jre21/Contents/Home   # script service needs a JVM
export PATH="$JAVA_HOME/bin:$PATH"
cd canton
~/.dpm/bin/dpm build && ~/.dpm/bin/dpm test   # expect 7/7 ok
```

### 2. Upload the DAR (the one manual step)

The NODERS participant denies `POST /v2/packages` to the operator user (403
PERMISSION_DENIED — confirmed). Same process as the v1 DAR:

- Send `canton/.daml/dist/fourcast-2.0.0.dar` to NODERS with the expected
  package id above, or
- Upload via the validator/wallet admin UI if you have that access.

Verify: `node scripts/canton-package-check.mjs` → `canton-2.0.0 (main)` flips
to `PRESENT`.

### 3. Provision + live-verify (scripted)

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

### 4. Propagate env to deployments

Same values as `.env.local`, on Vercel:

```
NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID=550828d219effd88bc03fadd856403ab42795e33c185cbea4ff2e055a2ed930a
CANTON_REFERENCE_RULES_CID=<rules contract id from preflight step 2>
# optional: CANTON_ATTESTER_PARTY_ID=<independent attester party> (default operator)
```

### 5. Verify the app

```bash
curl "$APP/api/canton/health"
curl "$APP/api/canton/balance"                      # escrow balances
curl "$APP/api/canton/settle-transfer"              # per-position escrow status
curl "$APP/api/canton/positions?type=allocations"   # locked CIP-56 allocations
```

`/canton` shows escrow status (was "pending payouts"); `/canton/holder` shows
"Escrowed funds" (was "Pending payouts / dispute").

## What changed client-side (inventory)

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

## Rollback

The v1 package (`canton` 1.0.0, `1fdf1b33…`) stays on the ledger and stays
resolvable at `#canton:` (v2 is a DIFFERENT package name, so it never
shadow-resolves). Rollback = simply don't point env at fourcast (leave
`NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID` on the v1 id) + redeploy.
