# Tatum Sui RPC

## The Claim

**Every Sui read in this repo goes through Tatum's JSON-RPC gateway — not the
Sui SDK, not gRPC.**

That is a deliberate deviation, and it is worth stating because both MemWal's
docs and Sui itself point the other way: Sui has formally deprecated JSON-RPC
in favour of gRPC, and the MemWal SKILL.md recommends `SuiGrpcClient` for
direct reads. We still read through Tatum because the hackathon grades the
**Tatum** integration — a Sui read that does not go through Tatum scores
nothing, no matter how idiomatic it is. When the constraint lifts, the swap is
one module (`services/tatum/tatumSuiClient.js`), not a refactor.

## What's Live

| Component | Status | Details |
|-----------|--------|---------|
| `tatumSuiRpc(method, params, opts?)` | **Live** | JSON-RPC 2.0 POST over the shared `fetchWithBudget` primitive — timeout, retries, circuit breaker. Resolves the envelope's `result`; rejects `Error & {code, rpcError}` on transport failure, non-2xx, JSON-RPC `error`, or malformed envelope. |
| `assertMemoryObjectOnChain(objectId)` | **Live** | Proof-of-existence for a memory write's `owner` object: `sui_getObject` + latest-checkpoint anchor, rendered `object=id@version · digest · checkpoint · network`. |
| `scripts/tatum-sui-check.mjs` | **Live** | CLI: selftest (chain id + latest checkpoint), per-object proof, `--tx=<digest>` re-read. |
| x402 settlement read | **Planned (Dev C)** | `verify.js` re-reads the USDC transfer via `sui_getTransactionBlock` through this client — the same read path, a second consumer. |
| `/api/memory/status` Tatum block | **Planned (Dev A)** | `tatumStatus()` is already shaped for it. |

## Non-decorative use

"Used Tatum RPC where relevant" is a judged criterion, so the read is wired
where it is *load-bearing*, not sprinkled:

- **Memory writes** — `rememberAndWait()` returns `owner`; for each write,
  `assertMemoryObjectOnChain` confirms the MemWal object exists on
  `SUI_NETWORK` at a version + digest and renders it next to the `blob_id`.
  The public-verifiability story is `blob_id` + this Tatum-confirmed object +
  the `/api/memory/status` echo (memories are SEAL-encrypted and owner-scoped —
  a judge holding a blob_id sees ciphertext; the object proof is what anyone
  can check).
- **x402 settlement** — Dev C's `verifyPayment` re-reads the settling
  transaction through `sui_getTransactionBlock` on this client before the
  resource is produced. Sui is where money settles; Tatum is how we see it.

## Contract (frozen — Dev C codes against it)

```js
import { tatumSuiRpc, isConfigured, assertMemoryObjectOnChain } from '@/services/tatum/tatumSuiClient.js';

await tatumSuiRpc('sui_getObject', [objectId, { showType: true }]);
// -> the envelope's `result` object
// -> null when TATUM_API_KEY is unset (fail-closed; never throws for config)
// -> throws Error & {code, rpcError} on transport failure / non-2xx /
//    JSON-RPC error / malformed envelope
```

In-scope methods: `sui_getObject`, `sui_getTransactionBlock`, `sui_getEvents`,
`suix_getBalance` — the signature is generic; nothing else is allow-listed.

Tri-state everywhere it matters: `assertMemoryObjectOnChain` returns
`exists: true | false | null`. `false` means the chain said no; `null` means
we could not ask (unconfigured or RPC down) — an unknown is reported as
unknown, never guessed.

## Failure semantics

- **Unconfigured** (`TATUM_API_KEY` unset): `tatumSuiRpc` resolves `null`,
  helpers report `reason`. A missing key degrades the product, it does not
  break a write.
- **Incoherent** (`TATUM_SUI_RPC_URL` on a different network than
  `SUI_NETWORK`): throws `TATUM_NETWORK_MISMATCH`. A wrong-network read
  produces a wrong claim — worse than down.
- **Down**: rejects with `Error & {code, rpcError}`; circuit breaker per
  provider (`'tatum'`) via `fetchWithBudget`.

## Environment

| Var | Default | Notes |
|---|---|---|
| `TATUM_API_KEY` | — | Tatum dashboard key. **Server only, never on Vercel.** |
| `SUI_NETWORK` | `mainnet` | Shared with the memory layer — unset means mainnet because the deliverable is mainnet memories. |
| `TATUM_SUI_RPC_URL` | `https://sui-{network}.gateway.tatum.io` | Override for a self-hosted or paid-tier endpoint. |
| `TATUM_TIMEOUT_MS` | `10000` | Per-request deadline. |

## Verification

Local-proof (mocked `fetch`, no network): `npx vitest --run
tests/tatumSuiClient.test.js` — 11 tests covering the null-without-key path,
header + URL selection per network, all four rejection shapes, the object-proof
render, and the no-key-leak status block.

Network-only (VPS / anywhere with a key): `node scripts/tatum-sui-check.mjs
<objectId>` prints the `object=id@version · digest · checkpoint` line quoted
next to each `blob_id` in the submission.
