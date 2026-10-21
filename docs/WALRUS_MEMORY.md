# Walrus Memory — the layer that has to change a decision

Total Recall WP2–WP5. This is the operational doc for Fourcast's append-only
memory: what we write, where it lives, what reads it back, and what it costs to
ask.

The bar this layer is held to is not "we stored something on chain". It is
**`would this decision have been sized differently?`** — and the only answer that
counts is one produced by the same Kelly function the agent actually trades with
(`utils/kellySizing.js`), not a re-derivation in a page.

## What is a memory

Four flat namespaces, one per kind (`services/memory/memoryFormat.js`):

| Kind | Namespace | Key | What it remembers |
|---|---|---|---|
| `analyst` | `fourcast.analyst` | operator id | Mandate-shaped behaviour over time |
| `source` | `fourcast.source` | venue/feed id | How a data source has performed |
| `signal` | `fourcast.signal` | signal id | A published call and its outcome |
| `window` | `fourcast.window` | `YYYY-MM` | Per-bucket hit rates for one calendar month |

MemWal namespaces are exact-match strings with no hierarchy, so the key cannot
live in the namespace — one namespace per analyst would be a namespace explosion.
`window` is the kind that earns its keep: month keys sort chronologically as
strings, so "newest usable rung" is a sort rather than a guess.

Every memory renders as one header line plus fields, all kinds sharing the same
spine (`kind key v as_of …`). Values may not contain whitespace or `=`, and a
metric we genuinely do not have is emitted as `NA` — never `0`. An absent sample
size read as zero is the bug that once plotted every calibration bucket at hit
rate 0.00.

## The ladder

A `window` rung holds `buckets=` (per-bucket hit rate) and `bucket_n=` (per-bucket
sample size). Both travel together or the rung is not evidence:

```
window 2026-10 v=3 as_of=2026-10-20 buckets=HIGH:0.450/MEDIUM:0.520 bucket_n=HIGH:20/MEDIUM:14
```

Rungs are appended when a forecast resolves and the resulting metric clears the
sample floor — never on a timer. `version` increments per key, and the write is
idempotent on `sha256(kind|key|vN|contentHash)`, so a retried append cannot create
a second rung `v3`.

## Where it lives

Writes go through the MemWal relayer (`@mysten-incubation/memwal`) onto Sui; the
payload itself is stored in Walrus and referenced by `blob_id`. Reads use the
public HTTP aggregator, which is where `blobUrl` comes from:

```
https://aggregator.walrus-mainnet.walrus.space/v1/blobs/<blob_id>
```

**A `blob_id` proves an object exists, not that anyone can read its text.**
Memories are SEAL-encrypted and owner-scoped: the public aggregator read returns
ciphertext. The `/arena` Memory lane links the blob and says so in the link's
title rather than letting a public id imply a public ledger.

## Precedence and the evidence floor

```
db → memory
```

Our own scored calibration curve outranks any stored snapshot of itself: it is
fresher, and it is ours. Memory is the **cold-deployment path** — the fallback
that lets a host with no local history size on evidence instead of falling back
to an uncalibrated `1.0×`.

The same floor applies on both paths, from the same function
(`minBucketCount()`, `FOURCAST_CALIBRATION_MIN_BUCKET`, default **5**):

- a bucket whose `n` is under the floor is dropped into `droppedBuckets` and
  sizes at `1.0×`;
- a rung whose `bucket_n` is missing entirely is **refused outright**, even when
  `buckets` parses;
- anything unparseable, unreachable or unconfigured returns `null` and the caller
  keeps deciding. Memory being down must never stop the agent.

## What costs what

Deliberate, and the surfaces inherit it:

| Action | Cost | Where |
|---|---|---|
| Page load of `/arena?lane=memory` | **one local read** — config + `memory_writes` ledger, zero network | `components/MemoryDelta.jsx` |
| "Read the ladder from the relayer" | **two relayer `recall()`** — the ladder, then the rung the sizing reads | `?ladder=1`, then `?memory=1` |
| "Prove on chain via Tatum" | one `sui_getObject` per ledger row | `?proof=1` |
| `readSizingCalibration()` in the loop | one `recall()` **only when the db curve is empty** | `services/memory/calibrationMemory.js` |

A page load never gets to spend a relayer request silently, which is also why the
sizing read is labelled with its cost.

## What we got wrong

Memory and settlement are configured **separately**, and we shipped them
disagreeing:

| | reads | default |
|---|---|---|
| `SUI_NETWORK` | where append-only rungs are written, and the Tatum RPC selection | `mainnet` |
| `SETTLEMENT_NETWORK` | where a paid x402 answer settles | `testnet` |

So `/arena` prints `MEMORY mainnet · SETTLEMENT sui:testnet · ALIGNED no`, and the
paid rail is dark. That is a real defect we chose to surface rather than hide:
the verifier refuses a cross-chain read instead of checking a payment against the
wrong ledger, and `notes` on `/api/memory/status` says exactly that. Nothing has
settled on mainnet yet, so the alignment is unproven in the direction that
matters — it is asserted only from the relayer URL and the two env vars.

The second honest gap: **no rung has been confirmed on chain from this host**
(`ledger.confirmed` is 0 here). The cold-deployment path — memory actually
changing a size — is proven by tests against a mocked relayer, and by a live
`/api/decision/whatif?memory=1` that correctly *refused* with no credentials. It
has not yet been demonstrated end to end against a real stored rung.

## Reading it

| Surface | Purpose |
|---|---|
| `GET /api/memory/status` | config, ledger counts, `chains`; opt-in `ladder`/`reconcile`/`proof` |
| `GET /api/decision/whatif` | one real decision, sized under each calibration source side by side |
| `/arena?lane=memory` | the lane: ladder with blob links, then the size delta |

The Memory lane asks the **route** to read the rung (`?memory=1`) rather than
passing bucket rates as query params. Rates the page typed cannot prove anything
about the blob they name, so `provenance.how` is `relayer-recall`, printed per
column as "fetched by this route, not typed in". A caller may still supply
`buckets=` + `counts=` for a hypothetical, and that is labelled
`supplied-by-caller`.

## Configuration

```bash
FOURCAST_MEMORY_ENABLED=true          # gate: anything at all
SUI_NETWORK=mainnet                   # memory chain: mainnet | testnet
MEMWAL_RELAYER_URL=https://relayer.memory.walrus.xyz
MEMWAL_ACCOUNT_ID=0x…                 # owner scope for reads
MEMWAL_PRIVATE_KEY=0x…                # writer only; never in a client bundle
FOURCAST_MEMORY_MIN_SAMPLES=20        # floor before a metric is memory-worthy
FOURCAST_MEMORY_TIMEOUT_MS=30000      # per-request deadline
SETTLEMENT_NETWORK=testnet            # payment chain — see the misalignment above
```

Writes additionally require `TATUM_API_KEY` for the proof path. Fail-closed by
design: no key, no relayer, no rung — the product degrades to the db curve and
says which one it used.

## Files

```
services/memory/memoryFormat.js        grammar: namespaces, header, NA, hashes
services/memory/memwalClient.js        relayer client, config, network guard, blobReadUrl
services/memory/memoryStore.js         append + recall, ladder, ledger views
services/memory/writeLedger.js         local intent ledger (memory_writes)
services/memory/calibrationMemory.js   db → memory precedence, evidence floor
services/domain/decision/bucketCalibration.js  minBucketCount(), the live curve
utils/kellySizing.js                   the one sizing function everything shares
app/api/memory/status/route.js         status + ladder + proofs
app/api/decision/whatif/route.js       the would-it-have-changed answer
components/MemoryDelta.jsx             the lane
docs/TATUM_SUI.md                      the on-chain proof path
docs/CALIBRATION.md                    the curve memory is a snapshot of
```
