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


---

## x402 settled on Sui (WP5)

The paid half of the Fourcast signal feed. A client asks for a premium signal,
gets a `402` with a machine-readable requirement, pays USDC **on Sui**, and
gets the signal — but only after we have re-read their transaction on chain
through the Tatum Sui RPC and checked it against the requirement.

This is the route to the *Best Use of Agent Payments* award, and it is the
option (b) of the Total Recall brief: Sui is where the money actually settles,
not just where the memories live.

---

### Why this is self-facilitated

The hosted rail is not usable today. `sui.io/agentpayments` states "Live on Sui
**Testnet**. Not on Mainnet yet. Paid calls are **invite only**", `suipay.dev`'s
skill returns empty, and `/v1/services` is "Coming soon". So "commit to (b)"
means **implementing the settlement leg ourselves**: we are the facilitator.

That is also why this leg is a *stretch* and not the deliverable. The
"≥10 memories on Sui mainnet" requirement is carried by WP2/WP3, so **WP5
failing does not sink the entry**. It is written here plainly rather than
implied otherwise.

### The flow

```
client ──POST /api/signals/premium──▶ us
       ◀──402 + Payment-Required────  requirement: price, payTo, network
client ──transfers USDC on Sui──▶ chain
client ──POST + X-PAYMENT: <txDigest>──▶ us
                                      ├─ 1. spend gates (ceiling, run cap) — BEFORE we take money
                                      ├─ 2. re-read the tx through Tatum Sui RPC
                                      │      effects.status === success
                                      │      seller credited ≥ price, in USDC, on our network
                                      │      digest not already used
                                      ├─ 3. claim the digest (UNIQUE) — one tx, one delivery
                                      └─ 4. produce the signal
       ◀──200 + signal + settlement──  txDigest, usdc, network
```

The ordering is the product. The resource is produced **after** settlement, and
the digest is claimed **before** the resource is built, so a duplicate request
can never produce a second delivery.

### Module map

| File | Owns |
|---|---|
| `services/payments/x402Sui/types.js` | constants, env parsing, USDC base-unit arithmetic, the reason codes |
| `services/payments/x402Sui/tatumRpc.js` | the Sui read: `sui_getTransactionBlock` through Dev B's shared Tatum client, plus the settlement/read network alignment check |
| `services/payments/x402Sui/verify.js` | requirement parsing, `X-PAYMENT` parsing, on-chain verification |
| `services/payments/x402Sui/spendLedger.js` | the `x402_payments` ledger, the per-answer ceiling and the per-run cap |
| `services/payments/x402Sui/settle.js` | `deliverAfterSettlement(req, resourceFn)` — the seller-side flow |
| `app/api/signals/premium/route.js` | the endpoint: unpaid → 402, paid+settled → signal |
| `migrations/0016_x402_payments.sql` | the `x402_payments` table |

Telegraph P4 consumes **this** module. There is no second payment stack.

### Wire contract

The 402 body is the x402 v1 shape; the `Payment-Required` header is the v2
base64 form of the same object. Both are produced, so either client style works.

```jsonc
{
  "x402Version": 1,
  "error": "Payment required for this resource.",
  "accepts": [{
    "scheme": "exact",
    "network": "sui:testnet",
    "maxAmountRequired": "10000",          // USDC base units (micro-USDC)
    "resource": "/api/signals/premium",
    "description": "Fourcast premium signal",
    "mimeType": "application/json",
    "payTo": "0x…",                         // X402_SELLER_ADDRESS
    "maxTimeoutSeconds": 60,
    "asset": "0x…::usdc::USDC",
    "extra": { "name": "USDC", "version": "1", "coinType": "0x…::usdc::USDC" }
  }]
}
```

The client answers with `X-PAYMENT` (raw JSON or base64 JSON):

```jsonc
{
  "x402Version": 1,
  "scheme": "exact",
  "network": "sui:testnet",
  "payload": { "txDigest": "…", "payer": "0x…", "signature": "0x…" }
}
```

`payload.txDigest` (also accepted: `transactionDigest`, `digest`, and a flat
top-level `txDigest`) is the only thing we need from the client. Everything
that matters — success, amount, payee, coin, network — is re-read from the
chain.

### Environment

| Variable | Meaning | Default |
|---|---|---|
| `X402_ENABLED` | opt-in switch; the leg is dark until this is `true` | unset (dark) |
| `X402_SELLER_ADDRESS` | the payee we quote and verify against | unset → we refuse to quote |
| `X402_PREMIUM_PRICE_USDC` | quoted price, human USDC | `0.01` |
| `X402_USDC_CEILING` | per-answer spend ceiling, human USDC | unset → **no spend is allowed** |
| `X402_RUN_CAP_USDC` | per-run spend cap, human USDC | unset → no run cap |
| `X402_USDC_COIN_TYPE` | exact USDC coin type to accept | mainnet type known; testnet must be set |
| `SETTLEMENT_NETWORK` | `testnet` \| `mainnet` | `testnet` |
| `SUI_NETWORK` | the network the Tatum read points at (Dev B's variable) | `mainnet` |
| `TATUM_API_KEY` | Tatum dashboard key — server only, never on Vercel | unset → the read path is off |

`SETTLEMENT_NETWORK` and `SUI_NETWORK` must agree. If they do not, the
verification refuses rather than checking a testnet payment against a mainnet
read. The settlement network is printed in **every** response.

Amounts are integers of USDC base units everywhere in code. Human amounts exist
only in the environment and in the rendered API.

### The spend gates

Two caps, both opt-in, both fail-closed:

- **per-answer ceiling** (`X402_USDC_CEILING`) — summed over every payment made
  for one `answer_key` (the premium route uses `signal:{eventId}:{snapshotHash}`).
- **per-run cap** (`X402_RUN_CAP_USDC`) — summed over one `run_id`.

They are evaluated **before** the payment is accepted, so a refused spend never
touches the buyer's wallet. A missing ceiling is *not* "unlimited" — it is "no
spend", because the ledger is the only thing that makes a budget real.

Every row in `x402_payments` counts toward the caps, including a `failed`
delivery: the money left the buyer either way, and the row says so.

### The ledger

`migrations/0016_x402_payments.sql` — `tx_digest UNIQUE` is the replay
protection; a transaction can settle exactly one request, ever. Statuses:
`claimed` → `delivered` | `failed`.

### What is proven locally, and what is not

**Proven locally** (`tests/x402*.test.js`, mocked `fetch` — the Sui RPC never
leaves the machine):

- the 402 handshake and the requirement shape (v1 body and v2 header);
- the `X-PAYMENT` parser, including malformed headers;
- verification against a mocked transaction block: success, failed effect,
  wrong payee, under- and over-payment, wrong network, wrong coin, replay,
  and "the RPC could not be reached";
- the ordering guarantee — the resource is not produced unless every check
  passes;
- the spend gates, the per-run cap, and the UNIQUE digest.

**Not provable locally** (VPS / network only):

- that a real USDC transfer exists — a real settlement needs a funded Sui
  wallet, and on mainnet that is a decision, not a default;
- the behaviour of the live Tatum gateway;
- the mainnet USDC coin type for the *testnet* network (hence
  `X402_USDC_COIN_TYPE`).

**Honest limitations, stated rather than hidden:**

- We cannot refund. If the resource fails to build after the money moved, the
  row records `failed` and the reason. There is no clawback.
- The mainnet USDC coin type is the one canonical type; the testnet type is
  not hardcoded because a wrong coin type is a lost payment, not a typo. The
  structural fallback is the `::usdc::USDC` package suffix.
- `blobId` on a paid signal is usually `null` at first: memories are written
  on **resolution**, not on publication. The route reads the blob id from
  `memory_writes` and reports `memoryStatus: 'not-yet-written'` when there is
  none. It never re-derives a blob id.

### The Nov 1 decision

The in/out decision date is **1 Nov 2026** (the brief says 31 Oct; 1 Nov
aligns with the WP1→WP2 critical path — not a rule change).

**Ship it if**: a funded Sui testnet wallet exists, the Tatum read is green
against the live gateway, and the round trip (402 → pay → 200) has been
observed end to end. **Ship it on mainnet only if** a funded mainnet USDC
wallet exists *and* `SETTLEMENT_NETWORK=mainnet` is set deliberately.

**Drop it if** the settlement leg cannot be demonstrated end to end by 1 Nov.
The fallback position is the free feed, which still scores Track 1.

### Environment setup

```bash
## .env.local (server only — never Vercel)
X402_ENABLED=true
X402_SELLER_ADDRESS=0x…
X402_PREMIUM_PRICE_USDC=0.01
X402_USDC_CEILING=0.05
X402_RUN_CAP_USDC=0.20
X402_USDC_COIN_TYPE=0x…::usdc::USDC   # testnet
SETTLEMENT_NETWORK=testnet
SUI_NETWORK=testnet
TATUM_API_KEY=…
```
