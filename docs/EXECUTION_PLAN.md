# Total Recall + Telegraph Season II — canonical execution plan

**This file is the canonical doc.** Every developer (human or agent) works from it and keeps it
updated. It supersedes the private approval copy at `~/.qoder/plans/final-rock-swan.md`, which is
kept only as the historical record of what was approved.

If you are a dev reading this cold, in order:
1. Read **Ground rules** and **File ownership** — they prevent the merges that would otherwise hurt.
2. Find your leg (**Dev A / B / C**) and work only inside your boundaries.
3. Tick boxes in **your own** Status section as you land things. Never edit another leg's section;
   put cross-leg requests in **Handoffs** instead.
4. Read **Surface quality bar** — every route carries the same seven gates, and the ones that can
   be checked by a script are checked by a script.
5. Run the **Verification** block for your leg before requesting merge.

---

## Execution mode (updated 2026-10-23)

**Single developer now drives this plan.** The three-leg split (Dev A/B/C), the handoff tables, and the merge-protocol sequencing are retained as historical context but no longer gate work — one developer owns all legs and merges directly to `main` after the verification block for the affected surface.

Consolidated critical path:

1. Phase 0 — **DONE 2026-10-23**: TxLINE renewed (to Nov 20), `SUI_NETWORK` split
   into `SUI_MEMORY_NETWORK`/`SETTLEMENT_NETWORK`, MemWal account + delegate key
   created and the writer enabled on the VPS; Tatum mainnet read verified.
2. Phase 1 — **in progress**: migrations 0014→0016 applied; forecast pipeline now
   feeds real resolutions via short-horizon discovery (4×/day cron, one forecast
   per market); first mainnet memory writes expected as forecasts settle
   (~Oct 24 → Nov 4); `memories-to-mainnet.mjs --write` (≥10 real memories) →
   merge 🟡 work → run recall demo.
3. Phase 2: WP8 items 1–3 + `docs/BLOG_TOTAL_RECALL.md` + items 4–5.
4. Phase 3: judge-path walkthrough (Nov 6–8) → submit Total Recall (Nov 10 17:00 UTC).
5. Phase 4 — **Telegraph H2, Nov 1 – Dec 1 23:59 UTC** (rules published 2026-10-22, summarised in
   `docs/HACKATHONS.md`): register; Providers track = `GAME_RESULT` + register
   `EVENT_OUTCOME_RESOLUTION` (Mission 14 mission-critical) via `updateMiner(148, …)`; stretch
   Apps & Agents entry (agent autonomously buys `EVENT_OUTCOME_RESOLUTION` through Telegraph) with
   a first purchase by the Nov 14 milestone. Track choice is pending the user. Only H2-period
   activity counts as evidence. Nov 1–10 overlaps Total Recall, so Total Recall has priority
   until Nov 10.

Baseline verified green on 2026-10-23: 603 tests / 62 files, `tsc --noEmit` clean, `check:runtimes` 100/100, `check:docs` 58/58.

---

## Decisions (2026-10-23)

Three Phase-0 calls, all resolved:

1. **TxLINE resubscription — DONE 2026-10-23, free tier, no real money.** Fresh wallet `CBTbcmw8…2MHv` funded with 0.01 SOL from stoppage's agent wallet; service level 1, 4 weeks, valid until **2026-11-20**. `/health` → `txline_renewal: {until: 2026-11-20, days_left: 28, expired: false}`, and `npm run survey` scores are non-zero (GAME_RESULT rank 5/14). Wallet, tx sigs and key locations: `docs/HACKATHONS.md`. `stat-validation` 500s remain a known free-tier limitation, not a blocker.
2. **`SUI_NETWORK` conflict — split the read var.** MemWal now reads `SUI_MEMORY_NETWORK` first (defaulting to `SUI_NETWORK`, then mainnet), so the memory chain is named independently of the shared Tatum client. The x402 rail keeps its fail-closed cross-chain check against `SETTLEMENT_NETWORK`: memory stays mainnet (Total Recall deliverable), x402 stays testnet (demo rail, no real money), and the rail is dark by default unless `TATUM_SUI_RPC_URL` is configured for the settlement network. No deliverable sacrificed; the refusal is intended, not a bug.
3. **Mainnet memory credentials — DONE 2026-10-23.** MemWal account `0xa65e…893c` + delegate key created; writer enabled on the VPS (`writable true`); migrations 0014→0015→0016 already applied; hourly `--resolve` writes a signal + window memory per settlement. `FOURCAST_MEMORY_MIN_SAMPLES` (default 20) gates thin claims — untouched.

---

## Context

Two live initiatives share one foundation. **Total Recall** (Tatum × Walrus Memory, Track 1:
Markets & Sports Prediction) requires ≥10 memories written to **Sui mainnet** by 10 Nov 2026
17:00 UTC, and rewards a *learning loop that visibly changes the product*. Our credibility /
calibration state exists but is (a) computed with a silent bug and (b) trapped in one
deployment. **Telegraph Season II (H2)** runs Nov 1 – Dec 1 2026 (rules published 2026-10-22).
The network already scores our miner, but only activity from Nov 1 onward counts as H2
evidence. TxLINE was renewed on 2026-10-23 and is valid until 2026-11-20, so it **must be renewed
again before Dec 1**.

Decisions taken (user): cover both in full; commit to the x402-settled-on-Sui leg; ship the
memory writer as a batch script first, then wire it into the resolution pipeline; **no synthetic
data** — fix the bug and write only real, traceable numbers.

### Blocking defects found while planning (all verified in code)

1. `services/db.js getCalibrationAnalysis()` returned snake_case (`hit_rate`, `avg_brier`,
   `total_resolved`) while every consumer read camelCase: `components/CalibrationCurve.js`
   (`(b.hitRate || 0) * plotH` → the curve plotted every bucket at y=0), `services/aiAgentLoop.js`
   and `scripts/fourcast-agent-worker.mjs` (`Number.isFinite(b.hitRate)` → the calibration-aware
   Kelly shrinkage **had never fired**), and `cal.summary?.totalResolved` →
   `calibrationSampleSize` always 0. Fix **added camelCase canonically while keeping snake_case
   aliases** — a rename would have broken the consumers that read snake_case. ✅ fixed in WP1.
2. **No log-loss anywhere** — the hackathon memory schema names it. ✅ added and persisted in WP1.
3. **No per-analyst outcome metric existed.** `getLeaderboard()` computed `win_rate` as
   `AVG(odds_efficiency = 'EFFICIENT')` — an efficiency label, not "was right". Under our own
   honesty rule that number **cannot** be written to mainnet as credibility. ✅ `getAnalystCalibration()`
   is the new source (WP1).

Consequence: the memory layer's content depends on WP1. Memory work could not start before it landed.

---

## Ground rules (non-negotiable, all legs)

- **No synthetic data.** Nothing enters `agent_forecasts`, `signals`, `memory_writes` or a memory
  text that is not traceable to a receipt, an address, or a resolved outcome. `NA` beats `0`;
  refusing and printing why beats inventing.
- **Never write a claim we cannot trace.** If we do not hold the pre-outcome receipt hash, the
  field stays absent — `delphi-sweep.mjs` already demonstrates this (a sweep holds an on-chain
  settlement, not a receipt, so it cites no hash).
- **Opt-in and fail-closed.** New external legs are dark behind `*_ENABLED === 'true'` and a
  missing-credentials reason string, never a silent zero. Adapters return `null`/`{success:false}`
  on failure (the `services/redisService.js` pattern) — a downed dependency must degrade the
  product, not break a decision or a resolution.
- **Signing keys are server-only. Never set them on Vercel.** `.env*` and key files are blocked by
  the pre-commit hook — **never `--no-verify`**.
- **Commit only when the user explicitly asks.** Do not commit another dev's in-flight work: check
  `git status` before staging and stage by path.
- **API routes must export `runtime`** (`npm run check:runtimes` enforces it). Anything importing
  `@mysten/*` is `nodejs`, never Edge.
- Conventional Commits. Migrations are `NNNN_name.sql`, appended, never edited after merge.

---

## Fixed dates

| Date | Gate | Owner |
|---|---|---|
| ~~Oct 26~~ | ~~TxLINE free subscription expires~~ — **renewed early 2026-10-23; next expiry 2026-11-20** | Dev A ✅ |
| Oct 21–23 | WP1 merged, suite green | Dev A ✅ |
| **Oct 23** | `main` green with WP1+WP2 merged → Devs B and C branch | Dev A ✅ — but **the branches never happened**: all three legs worked in one shared tree and committed to `main` directly. The plan's merge protocol below is what *should* have happened; the status board is what actually tracked it. **Nothing is lost (all three legs' work is on `main`), but there was no isolation and no review gate.** Learn from it: one branch per leg, pushed. |
| Oct 24–27 | first ≥10 memories on **mainnet** (never leave this to hour 48) | Dev A |
| Oct 27–30 | WP4 object-proof merged; WP6 registry merged | Dev B |
| Nov 1 | x402 leg in/out decision (WP5) | Dev C |
| Nov 2–6 | Telegraph P3/P5/P6, demo route, blog | B (P3/P5/P6), A (demo/blog) |
| **Nov 9** | submit (Nov 10 17:00 UTC is the hard close; submission always takes longer than it thinks) | Dev A |
| **Nov 1** | Telegraph H2 opens; register, pick tracks, `updateMiner(148, …)` if `EVENT_OUTCOME_RESOLUTION` is approved | lead |
| Nov 14 | Telegraph Apps first-integration milestone (progress check; first Telegraph purchase or a stated blocker) | lead |
| **by Nov 19** | TxLINE renewal #2 (expires 2026-11-20; cron reminders Nov 13/17/19) | lead |
| Nov 20 | Telegraph community showcase | lead |
| **Dec 1 23:59 UTC** | Telegraph H2 submission (all tracks): demo 2–5 min, run steps, evidence, summary | lead |

---

## The split — three legs

Separated on purpose: WP6 lives entirely in `telegraph-miner/` with its own `npm test`; WP5 is a
self-contained payment stack with its own migration and route; WP2→WP3 is one continuous thread
(the write format and the read that consumes it must not be designed twice).

| | Dev A — memory critical path | Dev B — Tatum + Telegraph | Dev C — x402 on Sui |
|---|---|---|---|
| **WPs** | WP2 (finish), WP3, WP7 memory half, WP0 (ops), integration owner | WP4, WP6 | WP5 |
| **Owns** | `services/memory/**`, `scripts/memor*.mjs`, `migrations/0014–0015`, `services/db.js`, `utils/kellySizing.js`, `services/domain/decision/**`, `components/CalibrationCurve.jsx`, `docs/{CALIBRATION,WALRUS_MEMORY}.md` | `services/tatum/**`, `docs/SUI.md`, `telegraph-miner/**`, `docs/TELEGRAPH_*.md` | `services/payments/x402Sui/**`, `migrations/0016`, `app/api/signals/premium/route.js`, `docs/SUI.md` |
| **Must not touch** | — | `services/memory/**`, `services/db.js` | `services/memory/**`, `services/db.js`, `telegraph-miner/**` |
| **Local proof** | mocked-SDK tests + `--dry-run` (mainnet writes are VPS-only) | mocked-`fetch` tests, `telegraph-miner` suite | mocked-`fetch` tests; settlement needs a funded wallet → network-only |
| **Can fail without sinking the entry?** | no — carries the ≥10-mainnet-memories deliverable | WP4 no-decorative rule keeps it honest; WP6 is additive | yes, by design |

### File ownership where a rule is needed

Three legs editing one file is the actual risk, not three legs writing code. So:

- **`package.json`, `package-lock.json`, `STRATEGY.md ## Decision Log`, `.env.local.example`,
  `docs/HACKATHONS.md`, `docs/API_REFERENCE.md` are edited by Dev A only.** B and C do **not**
  touch them; they list the exact lines they need (npm scripts, deps, env keys, decision rows) in
  **Handoffs** and A applies them in the merge commit. `npm install` counts as touching it — if
  you need a new dependency, ask A to add it first.
- **Migration numbers are pre-allocated:** `0014`, `0015` = A (done). `0016` = C (x402). `0017` =
  B (reserved, only if WP4/WP6 need a table). `0018+` unallocated — claim in Handoffs before writing.
- **`services/db.js` is A's.** B and C read through exported functions (`query`, `listResolvedForecasts`,
  `getAnalystCalibration`, `getCalibrationAnalysis`). If a needed read doesn't exist, request it.
- **`services/infra/http.js fetchWithBudget` is frozen.** Everyone consumes
  `fetchWithBudget(url, { provider, headers, timeoutMs })`; nobody edits it.
- **`docs/EXECUTION_PLAN.md` (this file): edit only your own Status section and the Handoffs table.**

---

## Frozen cross-leg contracts

Written here so nobody invents a second shape. If a contract must change, propose it in Handoffs
and get A's ack *before* coding against the new form.

**`fourcast.memory/v1`** — memory text contract, `services/memory/memoryFormat.js` (A owns).
Four namespaces only: `fourcast.analyst`, `fourcast.source`, `fourcast.signal`, `fourcast.window`.
Flat, exact-match, ≤255 bytes, **key lives inside the text** on a machine-parseable first line:
`analyst 0xAB… v=7 as_of=… n=142 brier=0.1871 logloss=0.5123 hit=0.63 buckets=LOW:0.41/MED:0.58/HIGH:0.79 trigger_receipt=<sha256> source=db:agent_forecasts`.
`idempotencyKey = sha256(kind|key|v{version}|contentHash)`. Missing evidence renders `NA`, never `0`.

**`calibration/v2`** — `getCalibrationAnalysis()` emits camelCase canonical **plus** snake_case
aliases (`hitRate` ≡ `hit_rate`) and `schema: 'calibration/v2'`. Consumers may read either; new code
reads camelCase. Buckets carry `avgLogLoss`; absent bucket ⇒ calibration factor `1.0`.

**MemWal SDK (verified facts, `MystenLabs/MemWal` SKILL.md, v0.1.9)** —
`MemWal.create({key, accountId, serverUrl, namespace, requestTimeoutMs, recallTimeoutMs, preflightTimeoutMs})`;
`rememberAndWait(text, namespaceString, {idempotencyKey, pollIntervalMs, timeoutMs})` →
`{id, job_id, blob_id, owner, namespace}`; `recall({query, namespace, limit, topK, maxDistance, sort})`
→ `{results:[{blob_id,text,distance,created_at}], total, meta, dropped_count}`;
**`listMemories({cursor,limit,namespace})` and `listNamespaces()` exist** (metadata only:
memory_id, namespace_id, blob_id, created_at, updated_at, size, status; paginate on `has_more`,
never page length; watch `must_resync`); `destroy()` wipes key material. Peers: `@mysten/sui>=2.5.0`,
`@mysten/seal>=1.1.0`. Mainnet relayer `https://relayer.memory.walrus.xyz`. Memories are
**SEAL-encrypted and owner-scoped** — a reader holding a `blob_id` sees ciphertext.
⚠️ Footgun: passing an *object* in the namespace position is read as options and silently keeps the
client default namespace — namespace is positional.

**`tatumSuiRpc(method, params, opts?)` → `Promise<object>`** (B owns, `services/tatum/tatumSuiClient.js`).
**Update 2026-10-23: the gateway serves GraphQL only.** The signature is unchanged; the
client translates each method to a GraphQL operation on `{gateway}/graphql` and maps
results back to the JSON-RPC shapes below. Methods in scope: `sui_getObject`,
`sui_getTransactionBlock`, `sui_getChainIdentifier`, `sui_getLatestCheckpointSequenceNumber`;
others reject `TATUM_UNSUPPORTED_METHOD`. Rejects with `Error & {code, rpcError}` on transport
failure, non-2xx, GraphQL `errors`, or a malformed envelope. **C codes against this
signature and mocked fetch; it does not wait for B's implementation.** `TATUM_API_KEY`
unset ⇒ `isConfigured()` false ⇒ `null`/reason, never throw.

**`x402` module surface** (C owns): `parsePaymentRequirement(res)`,
`verifyPayment({payment, expectedUsdc, seller, network})` → `{valid, reason?, txDigest?, usdc?}`,
`deliverAfterSettlement(req, resourceFn)`, `settleLedger` gates. `SETTLEMENT_NETWORK` defaults
`testnet` and is printed in every response, on `/arena`, and in the blog.

**`SUI_NETWORK` is read by three legs and means one chain** — this is a live contract violation, not
a style note (raised by A, 2026-10-21):

| Reader | Default | Needs |
|---|---|---|
| A `memwalClient.js` (relayer guard) | `mainnet` | **mainnet** — Total Recall counts mainnet memories only |
| B `tatumSuiClient.js` (`TATUM_NETWORK_MISMATCH` guard) | `mainnet` | whichever chain the memory objects live on → mainnet |
| C `x402Sui/tatumRpc.js` (`networkAlignment`) | — | **`SETTLEMENT_NETWORK` must equal `SUI_NETWORK`**, else every payment read refuses |

C defaults `SETTLEMENT_NETWORK` to `testnet` (correct: this leg must not move real money by
accident). With the three defaults in one process, the x402 rail is **inert by construction** — it
refuses to verify a testnet payment against a mainnet read, and setting `SUI_NETWORK=testnet` to
unblock it makes A's writer throw `MEMORY_NETWORK_MISMATCH` against the mainnet relayer, which would
cost the hackathon's hard ≥10-mainnet-memories requirement. Nobody may "fix" this by making the
memory leg tolerate testnet. Options, for the user to pick at the Nov 1 gate:
**(a)** settle on mainnet — needs a funded Sui mainnet USDC wallet, i.e. real money;
**(b)** give the payment read its own network/RPC (`X402_SUI_RPC_URL` / reuse `SETTLEMENT_NETWORK`
as the read's network) so memory stays mainnet and payments stay testnet in one process — a change
to C's `tatumRpc.js` and B's client, so it needs A's review, not a silent patch;
**(c)** ship x402 dark and tell that story plainly in `docs/SUI.md` + the blog.
Documented meanwhile in `.env.local.example` and the STRATEGY.md Decision Log.

---

## Dev A — memory critical path (WP2 finish → WP3 → WP7 memory)

### WP2 — Walrus Memory write layer (append-only, flat namespaces)

- `services/memory/`: `memwalClient.js` (env header block, `isConfigured()`, `memoryStatus()`,
  `FOURCAST_MEMORY_ENABLED === 'true'` opt-in, staging-creds-vs-mainnet-relayer guard that **throws**
  rather than mixing networks), `memoryFormat.js`, `writeLedger.js`, `ledgerMemory.js`,
  `memoryStore.js`, `resolutionTrigger.js`.
- **`remember()` is append-only (no upsert); removal is relayer `POST /api/forget` (index rows only).**
- **The append-only ladder is the demo, not a bug:** keep the last 3 versions per key (never
  `forget` them). That version ladder *is* "how it learned over time", each step citable by
  `blob_id` in the blog. Prune only superseded idempotency-ledger duplicates.
- `latestMemory(kind, key)` = `recall()` within the type namespace → parse first lines → exact-key
  filter → max by `v`. Semantic search for retrieval, deterministic parse for truth (recall is
  fuzzy: `0xabc` also matches `0xabcdef`).
- Version = `max(ledger version, on-chain version) + 1` — a second machine's writes can't be
  under-counted. `migrations/0015_memory_writes.sql` makes the ≥10 count locally queryable and
  diffable against the relayer via `reconcileLedger()`.
- Triggers: on **resolution**, not on a timer — `app/api/agent/resolve/route.js`,
  `scripts/fourcast-agent-worker.mjs`, `scripts/delphi-sweep.mjs` all call `rememberResolution()`,
  gated by `FOURCAST_MEMORY_MIN_SAMPLES` (default 20). Analyst/source memories stay on the batch
  path where the floor is enforced; a resolution handler must never get to write a thin claim that
  sizing then consumes.
- `scripts/memories-to-mainnet.mjs` — **dry run is the default**, `--write` required to append;
  prints blob_ids, refusal reasons, and a "Next step:" line. Plus `scripts/memory-recall-demo.mjs`.

### WP3 — A read that changes the product (Best Walrus Memory criterion)

`services/memory/calibrationMemory.js` → `getBucketCalibrationFromMemory()` returning
`{buckets:{HIGH,MEDIUM,LOW}, blobId, textHash, asOf} | null`, fail-closed. Replace the bucket read
in `aiAgentLoop.js` / worker with **`db → memory` precedence**, feed
`utils/kellySizing.js calculateKellySizing(..., bucketCalibration)`, and record
`{blobId, textHash, source:'walrus-memory'}` inside `buildDecisionReceipt({calibration})`. A memory
stored on Sui becomes load-bearing on a hashed pre-outcome receipt — that is the story.

### WP0 — TxLINE resubscription (ops, no code) — **DONE 2026-10-23 (valid until 2026-11-20)**

Spends from the `TXLINE_SOLANA_SECRET_KEY` wallet **and** restarts a live scoring miner on shared
infra. Do not run without an explicit go-ahead. Then: `scripts/txline-subscribe-and-activate.mjs`;
on `nuncio-vultr` rewrite exactly three keys in `/home/linuxuser/fourcast/.env.agent`
(`TXLINE_API_TOKEN`, `TXLINE_GUEST_JWT`, `TXLINE_SUBSCRIBED_UNTIL`); `pm2 restart telegraph-miner
--update-env`; verify `GET :8402/health` → `txline_renewal.expired:false` and `npm run survey`
returns non-zero scores. Nothing in this plan may depend on `stat-validation` clearing — the free
tier 500s on both documented request shapes (exhibits: `scripts/proof-probe*.mjs`).

---

## Dev B — Tatum Sui floor + Telegraph Season II

### WP4 — Tatum Sui RPC (floor, ships regardless of WP5)

`services/tatum/tatumSuiClient.js` per the frozen contract above. **Non-decorative use:** for every
memory write, take `owner` from `rememberAndWait()` and assert via `sui_getObject` that the MemWal
account object exists on mainnet at a version + digest; render `object=id@version · digest ·
checkpoint` next to each `blob_id`. `docs/SUI.md` states the transport reality: MemWal's
docs prefer `SuiGrpcClient` for direct reads, but the hackathon grades the **Tatum**
integration, so reads go through Tatum's gateway (GraphQL since 2026-10-23 — the
JSON-RPC endpoint no longer exists). **Verified live on mainnet 2026-10-23.**

Land `tatumSuiClient.js` (the one exported function + `docs` header) **first** and tick it in
Handoffs — C's `verify.js` re-reads the USDC transfer through it.

### WP6 — Telegraph: registry refactor, then P3/P5/P6

- **Single source of truth first:** intents are duplicated in four places today
  (`src/query.js:9 SUPPORTED_INTENTS`, `src/server.js:51 INTENT_HANDLERS`, `src/status.js:19`
  hardcoded list, `telegraph.yaml` L62 + L138-140). New `telegraph-miner/src/intents/index.js`
  exporting `INTENT_REGISTRY = [{name, handler, description, registered}]`; derive the other three,
  render the YAML with `scripts/render-manifest.mjs`, guard with `test/intentRegistry.test.js`
  (drift test). New `src/flags.js isEnabled(name, env)` — no flag mechanism exists.
- **P3:** `src/intents/eventOutcomeResolution.js` behind `TELEGRAPH_INTENT_EVENT_OUTCOME`,
  **default off**, reusing `services/txline/crossVenueEdge.js getCrossVenueEdge()` and
  `reconciliationService` statuses; `verified: true` only with a real Merkle root. The intent set is
  on-chain and closed (changes need `updateMiner(148, …)` via `cast send` on Base Sepolia, **never**
  `registerMiner`), so `/status` advertises **registered** intents only — the handler is demoed by
  direct call. Survey says the intent is measured and alive (18 miners, best 0.727) but has **no
  scorer registry entry**, so the ≥0.60-Spearman agreement gate can't be probed.
- **P3 scorer:** write it up as a finding rather than build WASM — `docs/TELEGRAPH_FINDINGS.md`
  on the agreement gate making a *corrected* `GAME_RESULT` attribution scorer structurally
  unpassable. That is a network finding, worth more than a marginal miner slot.
- **P5:** `telegraph-miner/src/openapi.js` → `GET /openapi.json` + `GET /llms.txt`; social card by
  reusing `app/api/og` (read-only consumption; do not edit `app/api/og`).
- **P6:** `docs/TELEGRAPH_FINDINGS.md` — `stat-validation` 500 on both shapes (SL1/SL12) with probe
  output, and displayed-vs-measured scorer bar drift (0.7150 vs 0.5622).
- After the next scored epoch, read `/api/asked` and `npm run survey` together (what was asked /
  what we answered / what it scored).

---

## Dev C — x402 settled on Sui (self-facilitated; in/out decision Nov 1)

**Reality check:** the official rail is unusable today — sui.io/agentpayments states "Live on Sui
**Testnet**. Not on Mainnet yet. Paid calls are **invite only**", `suipay.dev/SKILL.md` returns empty,
and `/v1/services` is "Coming soon". So "commit to (b)" means **implementing the settlement leg
ourselves**, not wiring a hosted facilitator.

- `services/payments/x402Sui/`: `types.js`, `verify.js` (`parsePaymentRequirement`,
  `verifyPayment({payment, expectedUsdc, seller, network})` — parse `X-PAYMENT`, re-read the USDC
  transfer via `sui_getTransactionBlock` **through Tatum**, require `effects.status === 'success'`,
  bound the amount, replay-check), `settle.js` (`deliverAfterSettlement(req, resourceFn)` — the
  resource is produced **only after** on-chain verification, i.e. real x402 semantics,
  self-facilitated), `spendLedger.js` (per-answer ceiling + per-run cap as additional gates in
  `services/domain/decision/decisionPolicy.js evaluateDecision`, receipt committed before outcome).
- `migrations/0016_x402_payments.sql` (`tx_digest UNIQUE, answer_key, usdc, network, created_at`);
  route `app/api/signals/premium/route.js` (unpaid → `402` + `Payment-Required`; paid+settled →
  signal + its `signal:{id}` `blob_id` — read the blob id via `services/memory/writeLedger.js`
  `listMemoryWrites`, do not re-derive it).
- **Default `SETTLEMENT_NETWORK=testnet`**; mainnet only if a funded Sui mainnet USDC wallet exists
  by Nov 1. The ≥10-mainnet-memories deliverable is carried by WP2/WP3, so **WP5 failing does not
  sink the entry** — say so in the docs rather than implying otherwise.
- Shared surface with Telegraph P4: the same ladder (free feed → cheap per-call paid rail → on-chain
  job) with a hard ceiling. **P4 becomes a consumer of this module, not a second payment stack.**

---

## Surface quality bar (all 21 routes)

**Scope (user decision, 21 Oct):** every route in `app/**/page.js` is held to the same bar — not
"the five that matter". To make that survivable with three legs in flight, the bar is
**mechanical first, taste last**: five of the seven gates are enforced by a script or a test, so
consistency does not depend on three devs having the same opinion on the same afternoon.

An earlier cut proposed a "spine" of five judged surfaces. The scope was widened to all 21
routes; the spine survives only as **G7**, the one gate that is worth spending judgement on and
only worth spending it where there is a story to tell.

### The seven gates

| # | Gate | Rule | Enforced by |
|---|---|---|---|
| G1 | Tokens only | No raw `#hex` / `rgb()` / `hsl()` in `components/` or `app/`. Colour comes from `tokens.css` **by name**. | `scripts/check-design-tokens.mjs` (new, lint) |
| G2 | One job per section | One `<h1>` per route, no duplicate kickers, no nested bordered containers (design.md card policy). | `tests/surfaceContract.test.jsx` (new) + audit |
| G3 | Truthful states | Every data surface renders **loading, empty and error**. The empty state says *why* it is empty — "Waiting for the first cycle from the arena worker…", not "No data". | `tests/surfaceContract.test.jsx` (new, mocked fetch) |
| G4 | Evidence one tap | Every claim row expands to its receipt / hash / raw ledger. A claim you cannot expand is a claim you cannot audit. | `docs/SURFACES.md` row + audit |
| G5 | A11y floor | `:focus-visible` on every control, reduced motion honoured, accessible name on every control, AA contrast on body text. | lint + `axe-core` in vitest (new) |
| G6 | One primary CTA | Exactly one verb-led, square, emerald primary action per route. | `docs/SURFACES.md` row + audit |
| G7 | Story legibility | A non-operator can say what this surface is for within 10 seconds. | audit — **spine only** (`/`, `/arena`, `/signals`, `/markets`, `/proof`) |

### Route classes

Same bar, three weights — no route is exempt, but a lab does not owe a story.

| Class | Routes | Gates |
|---|---|---|
| **A — core** | `/`, `/markets`, `/positions`, `/arena`, `/signals`, `/signal/[id]`, `/proof`, `/status` | G1–G7, 20-minute audit each |
| **B — secondary** | `/labs`, `/labs/autopilot`, `/labs/builder`, `/labs/canton`, `/labs/weather`, `/autopilot`, `/canton`, `/canton/holder`, `/weather`, `/world-cup` | G1, G2, G3, G5, G6 enforced; G4/G7 audited only if the surface makes a claim |
| **C — redirect / detail** | `/agent`, `/agent/[operatorId]`, `/notifications` | G1, G5 + correct redirect behaviour |

### The tooling (the part that makes consistency durable)

| File | What it does |
|---|---|
| `scripts/check-design-tokens.mjs` | G1. Scans `components/` and `app/` for raw colour literals. **Ratchets**: it starts as a report with a baseline count and only *fails* when the count rises, so fixes bank permanently and the suite never goes red on legacy debt. |
| `docs/SURFACES.md` | The registry. One row per route: class, owner, job, primary CTA, states, evidence column, last audit date. G4 and G6 are checked against this file, and a row whose audit date is stale is flagged. |
| `tests/surfaceContract.test.jsx` | G2/G3/G5. Mounts each route with a mocked `fetch` and asserts the loading → empty → error → data sequence, one `h1`, and no accessible-name violations. |
| `scripts/check-surface-registry.mjs` | Every route in `app/**/page.js` has a registry row, and no row points at a route that does not exist. |

Adding a route without a registry row fails CI. That is the whole mechanism: a new surface cannot
quietly arrive below the bar.

### Ownership (signed off by A, 2026-10-21 ~16:45)

Accepted as proposed, with two corrections A is making rather than asking about,
because both are in files A owns and neither changes who does the work:

- `scripts/check-design-tokens.mjs` and `scripts/check-surface-registry.mjs` are
  now npm scripts (`check:tokens`, `check:surfaces`) so they run in the same
  verification block as `check:runtimes`. A ratchet nobody invokes is a report
  nobody reads.
- The four tooling files stay **C's**; `docs/SURFACES.md` rows for `/arena`,
  `/signal/[id]`, `/agent/[operatorId]` and `/positions` are **A's** to fill,
  since A is the one editing those surfaces.

| Surface / artefact | Owner | Why |
|---|---|---|
| The four tooling files above | **C** (me) | I have the cheapest way to keep the gates honest, and it does not touch the memory critical path |
| `/signals` + `/signals/*` + the premium surface (WP5) | **C** | My leg's own surface — I cannot hand my own payment surface to another leg |
| `/arena` + `/signal/[id]` + `components/CalibrationCurve.jsx` + `components/MemoryDelta.js` | **A** | A is already editing these files; the memory lane is A's WP7 |
| `/status` + `/proof` + `telegraph-miner` surfaces | **B** | B owns P5/P6 surfaces and the findings docs |
| `/markets`, `/positions`, `/` | **C** audits, **A** applies (only where A already has a file open) | `/markets` and `/` are large but stable; a sweep here is the cheapest to absorb late |
| Legacy token drift with no owner (`ForecastPortals.js`, `PersonalStatsDashboard.js`, `Scene3D.js`, `HistoricalLabPanel.js`) | **unassigned — offer to C** | Isolated files, no other leg needs them, and the ratchet will list them by name |
| The seven gates themselves, and the Friday 20-minute gate review | **lead** | The bar is a product decision; the legs only comply |

### Schedule

| Date | Quality work |
|---|---|
| Oct 21–23 | Tooling lands in **baseline mode** (report, never fails). `docs/SURFACES.md` written with all 21 rows. |
| Oct 24–27 | Memory lane lands (A) and its registry row is filled with the real `blob_id`/receipt evidence (G4). |
| Oct 27–30 | Ratchet switches to **enforced** (fails on increases only). Premium surface (C) lands with its G3 states. |
| Oct 31–Nov 2 | `surfaceContract` flips from report to enforced, one class at a time, as each class passes. G7 story pass on the five spine surfaces. |
| Nov 3–6 | Class A audit sweep (20 min per route, screenshots). Class B/C fixes as the contract test flags them. |
| Nov 7–8 | Final gate report, fixes, screenshots for the blog and demo video. |
| Nov 9 | Submit. |

### What 8.5 does not mean

It does not mean a redesign, a new token layer, a component kit, Storybook, or a mobile pass on
every route. The visual language is already right — `design.md` and `tokens.css` are good, and
re-dressing them costs days and buys nothing. 8.5 here means: **no broken state, no dead link, no
drifting colour, one clear action per route, and every claim expandable to its evidence.** The
landing page is the strongest surface we have; the instruction for it is *do not touch*.

---

## WP7 — Demo, docs, decision log (split by owner)

| Item | Owner |
|---|---|
| `app/api/memory/status/route.js` (`runtime = 'nodejs'`; `@mysten/*` stays off Edge) | A |
| `app/api/decision/whatif/route.js` — recompute one real receipt's sizing with vs without the memory-derived calibration | A |
| `components/MemoryDelta.js` — **Memory lane on `/arena`**: version ladder with `blob_id` → Walrus links, side-by-side position size, `calibrationFactor`, receipt hash | A |
| `next.config.js/mjs serverExternalPackages` for the Sui deps if they get traced into the bundle | A |
| `docs/WALRUS_MEMORY.md`, `docs/BLOG_TOTAL_RECALL.md` (the ladder + **at least one thing the memory got wrong**) | A |
| `docs/SUI.md` | B |
| `docs/TELEGRAPH_FINDINGS.md`, `docs/TELEGRAPH_FINDINGS.md` | B |
| `docs/SUI.md` | C |
| `docs/HACKATHONS.md` checklist ticks, `STRATEGY.md ## Decision Log` rows, `.env.local.example` blocks | A (applies for everyone) |

---

## WP8 — Product coherence: the 8.5 bar (proposed 2026-10-21, **acked by A** on app/* items)

Design review verdict: the system is 8/10 in craft, ~6/10 in coherence — the
product tells five stories where it should tell one. The gap to 8.5 is
consolidation and evidence plumbing, not more pixels. Five items, in
priority order:

1. **One hero path, navigable blind.** `Landing → Calibration curve → Memory
   ladder → Decision receipt → Tatum object proof`. Moves: memory lane
   becomes an `/arena` tab (`Ledger | Mandate | Memory`), not a buried
   section; a `judge` audience in `AudienceSwitcher.js` reorders surfaces to
   that path (cheap — `constants/brand.js`, no new routes); landing
   "See the proof" CTA retargets to the path, not generic markets.
   **A owns** (`app/*`, nav).
2. **Never show a judge an empty state.** `scripts/demo-seed.mjs` populates
   the arena ledger + calibration + `memory_writes` from **real receipts /
   replay fixtures** (extends `data/txline-replays/` machinery — replay, not
   fabrication; the honesty rule still binds). `MemoryDelta` renders the
   ladder with zero live runs — that's why it's the right WP7 shape and
   outranks the whatif route if time is tight. **A owns.**
3. **One evidence idiom.** Standardize a `<ProofRef>` on the existing
   `EvidenceBlock`/`Stamp` grammar — renders `blob_id → walrus` ·
   `receipt hash` · `object=id@version · digest · checkpoint`
   (`assertMemoryObjectOnChain().render` is built for exactly this). Apply
   in `MemoryDelta`, premium-signal responses, receipts, calibration bucket
   rows. **A owns**; B supplies the render string (already landed).
4. **Consistency sweep (~1 day).** Token audit for off-system
   colors/radius/font sizes across `app/` + `components/` (drift lives in
   the older weather/canton-era surfaces); a11y pass — `--color-ink-faint`
   at 10–11px contrast and mobile tap targets; dead-route quarantine —
   off-story surfaces (weather, labs) behind one link, not parallel pages.
   **B offered; unowned until acked.**
5. **`docs/SURFACES.md` (~20 lines).** Semantic tokens only, zero
   radius, mono numerals for evidence, `NA` over `0`, `verified:` means a
   real Merkle root. New surfaces are built to it once, not retrofitted.
   **B offered.**

Sequencing: items 1–2 Oct 22–27 alongside WP7; items 4–5 Nov 2–5 (deadline
slack); judge-path walkthrough on the VPS deploy Nov 6–8, all three devs.
**Skip:** rebuilding off-story surfaces, more motion, a landing redesign.

Standing risk stated plainly: if WP7's memory lane slips, the entry drops
back to ~7 — that lane is the difference between "nice trading UI" and the
thing the brief asked for. WP8 work must never block it.

| From | To | Need | Status |
|---|---|---|---|
| B | A | Ack WP8: items 1–3 are `app/*` (A's files); B takes items 4–5 if agreed | **acked by A** — items 1–3 are mine and stay scheduled after WP7's memory lane (the lane is the risk, WP8 must not preempt it); items 4–5 are B's, agreed, Nov 2–5. One correction below: the P5 social card had not landed when B reported it |

---

## Status board

Tick only your own section. `✅` merged to `main` · `🟡` done in worktree, unmerged · `⏸` blocked.

### Dev A

- ✅ WP1 calibration foundation (`npm run build` exit 0, suite green)
- ✅ WP2 migration `0015_memory_writes.sql` (applied, 15/15)
- ✅ WP2 `memoryFormat` / `memwalClient` / `writeLedger` / `ledgerMemory` / `memoryStore` / `resolutionTrigger`
- ✅ WP2 `scripts/memories-to-mainnet.mjs`, `scripts/memory-recall-demo.mjs`, 3 resolution hooks
- ✅ WP2 tests — `memoryFormat` 15, `memoryStore` 20, `ledgerMemory` 13, all pass; two defects found
  by them and fixed (a `null` outcome became "resolved NO" via `Number(null) === 0`; an unordered
  "latest verdict" could mint a phantom version). Close-out done: full `npm test` 493 pass,
  `tsc --noEmit` clean, memory files lint-clean, `check:runtimes` 96/96, `.env.local.example`
  MemWal block and 4 Decision Log rows added. `npm run memories` locally prints the honest
  refusal path ("0 memory-worthy, 0 refused", `writable false`). **Superseded count: the
  suite is now 603 tests, 62 files.**
- ⏸ WP2 mainnet run (≥10 memories, Oct 24–27) — **VPS only**, needs `MEMWAL_*` credentials and
  `FOURCAST_MEMORY_ENABLED=true`; migrate 0015 on Turso **before** the writer runs
- ✅ WP3 `calibrationMemory.js` + db→memory precedence + receipt provenance (details below)
- 🟡 WP7 `app/api/memory/status/route.js` — local config + ledger always answer; relayer ladder,
  reconciliation and Tatum proofs are opt-in per query param, so a page load spends zero requests.
  7 tests, and verified over real HTTP on a dev server (`/api/memory/status` and `?proof=1` both
  answer with the honest refusal path). `runtime = 'nodejs'`, `check:runtimes` 98/98.
- 🟡 WP7 integration handoffs applied for B and C: `tatum:sui-check` / `x402:test` /
  `check:tokens` / `check:surfaces` npm scripts, the Tatum + x402 `.env.local.example` blocks,
  5 Decision Log rows, `/api/signals/premium` + `/api/memory/status` + the calibration card in
  `docs/API_REFERENCE.md`, P3/P5 state in `docs/HACKATHONS.md`
- 🟡 `evaluateDecision({…, spendGate})` — the spend ceiling is now a policy check that fails
  closed (see Handoffs); `tests/decisionIntegrity.test.js` 9/9
- ✅ WP7 whatif route (`app/api/decision/whatif/route.js`) + `components/MemoryDelta.jsx`
  (the `/arena` memory lane) + `docs/WALRUS_MEMORY.md` — landed `3ec8a7c` / `233146a`.
  The route recomputes one real receipt's sizing under every calibration source we
  have, and reads the rung server-side rather than trusting a pasted number.
- ⏸ `docs/BLOG_TOTAL_RECALL.md` — the mandatory blog deliverable, **not started**. It
  needs the learning curve, and the learning curve needs real rungs, so it is
  downstream of the mainnet run, not parallel to it.
- ✅ WP0 TxLINE resubscription: done 2026-10-23 (free tier, valid until 2026-11-20). `/health`
  now reports `txline_renewal` with `days_left`, and reminders fire Nov 13/17/19.
- ✅ **Docs consolidated (21 Oct)** — 35 tracked docs → **16 live + 7 archived**, with
  `docs/INDEX.md` as the single table of contents. Merges: `TATUM_SUI` + `X402_SUI`
  → `SUI.md`; the four Canton docs → `CANTON.md`; `DEPLOYMENT` + `GIT_HOOKS` →
  `SETUP.md`; `DESIGN_CONTRACT` → `SURFACES.md`; `DEMO_SCRIPT_PROOF` →
  `DEMO_SCRIPT.md`; `TELEGRAPH_SCORER_FINDING` → `TELEGRAPH_FINDINGS.md`. Archived
  with banners: `NINE_PLAN`, `GO_TO_MARKET`, `INSIGHTS_MARKETPLACE`, `DELPHI_AGENT`,
  `TXLINE_SUBMISSION`, `DESIGN_ALIGNMENT`, `COMMERCIAL`. Every reference updated
  (29 files, docs *and* code comments), and a new gate keeps it that way:
  `scripts/check-doc-links.mjs` → `npm run check:docs`, wired into CI alongside the
  telegraph-miner suite.

**WP3 — memory-derived calibration (code complete, locally proven):**
- ✅ `window` memories now carry `buckets=` **and** `bucket_n=` (`getCalibrationAnalysis()`
  trend rows gained a per-month bucket breakdown; `sourceField()` labels `s.bucket`)
- ✅ `memoryStore`: `recallParsed()` extracted, `listKindMemories()` added (a cold
  deployment has no local `memory_writes` rows to discover keys from)
- ✅ `services/memory/calibrationMemory.js`: `getBucketCalibrationFromMemory()` +
  `readSizingCalibration()` with **db → memory** precedence and the identical
  `FOURCAST_CALIBRATION_MIN_BUCKET` floor; rates without visible counts are refused
- ✅ callers switched: `services/aiAgentLoop.js`, `scripts/fourcast-agent-worker.mjs`;
  receipts now stamp `calibration.source` + `{blobId, textHash, version, asOf, counts}`
- ✅ `tests/calibrationMemory.test.js` (9): real ledger → real memory text → real store →
  sizing read; DB precedence over a planted 0.01 rung; thin-bucket drop; walk-back to an
  older rung; disabled/unreachable ⇒ null, never a throw
- 🟡 Dev B's `assertMemoryObjectOnChain()` is wired as **prove-on-read** in
  `/api/memory/status?proof=1`, not persisted in the write path. A digest and
  checkpoint are perishable — storing them at write time turns a proof into a
  screenshot that goes stale, and the object version moves on its own. The
  ledger stores the `owner` id (which does not change); the version/digest is
  read from the chain each time it is asked for.

### Dev B

- ✅ WP4 `services/tatum/tatumSuiClient.js` + `isConfigured()` + 11 mocked-fetch tests green — **signature live for C**
- ✅ WP4 `assertMemoryObjectOnChain(owner)` tri-state proof helper + `scripts/tatum-sui-check.mjs` + `docs/SUI.md`
- ✅ WP6 `src/intents/index.js` registry + `src/flags.js` + `telegraph.template.yaml` + `render-manifest.mjs` (`manifest:check`) + 14-assertion drift test
- ✅ WP6 P3 `eventOutcomeResolution` (default off, unregistered, `demo:eor` script) · `docs/TELEGRAPH_FINDINGS.md` · P5 `/openapi.json` + `/llms.txt` · `docs/TELEGRAPH_FINDINGS.md` (F1 stat-validation 500, F2 scorer drift, F3 no registry entry)
- ⚠️ P5 **social card**: reported landed on 21 Oct, but `app/api/og/route.js` had no
  `type=calibration` branch and `services/domain/calibration/calibrationCardPayload.js` did not
  exist. **A implemented it** (query-param cards are this route's existing grammar; a card that
  fetched the API itself would add a failure mode rather than evidence) and verified it renders:
  `/api/og?type=calibration&…` → `200 image/png`, plus the no-data path. Recorded here because the
  status board is what the merge order is decided from — a claim that is not in the tree is a bug
  report, not a review note.
- ✅ `telegraph-miner` suite green — **64/64** (was 54; drift test + openapi pins added).
  **Note:** the suite could not run locally until `npm ci` was run in `telegraph-miner/`
  — its deps are a separate install, and the subpackage has no `node_modules` by default.
  It is now wired into CI.
- ✅ P5 social card corrected — `socialCardUrl()` now points at A's real `type=calibration` OG card (was `type=route` fallback)
- ✅ WP8 item 5: the design contract — **folded into `docs/SURFACES.md`** when the docs were
  consolidated (it was 26 lines and the registry is where the quality bar already lives)
- ✅ SURFACES.md rows for `/proof` + `/status` audited (mechanical pass, gates noted); **`/canton` reclassified as redirect** (was wrongly listed as rendering — `check:surfaces` still green)
- ✅ `/labs/canton` G3 finding fixed — the parties fetch swallowed its failure (`console.error` only), rendering error identical to empty; now surfaces `setError`. `surfaceContract` 18/18 green
- ✅ **G3 findings: all banked** — `f852c1a` fixed the last three (`AgentRail` had no error
  state at all; the markets tabs rendered a skeleton forever on a failed first fetch;
  `PositionsDashboard` printed the error bare). Every surface's budget is now **zero**.
- ⏸ WP8 item 4: consistency sweep (token/a11y/dead-route) — now **half mechanical**
  (token ratchet + registry + contract test, all three in CI); the manual remainder is the 70 raw
  colour literals, off-system radius/font sizes and mobile tap targets — Nov 2–5
- ✅ Post-epoch: read `/api/asked` + `npm --prefix telegraph-miner run survey` together —
  **done 2026-10-21**:
  `survey` reports the node active, 11 requests served, last scored epoch **430**
  (was 370 on 2026-09-29), `GAME_RESULT` rank **5/14** at 3.8e-6, `SPORTS_SCORE`
  unmeasured by the network, and `EVENT_OUTCOME_RESOLUTION` still without a scorer
  registry entry (31 miners, best 0.8235) — the P3 finding stands

### Dev C

- ✅ WP5 `x402Sui/{types,tatumRpc,verify,settle,spendLedger}.js` — 5 modules, self-facilitated
  settlement (the hosted rail is invite-only; we are the facilitator) — merged `04ff3f6`
- ✅ `migrations/0016_x402_payments.sql` (`tx_digest UNIQUE`, `answer_key`, `usdc`, `network`,
  `created_at`)
- ✅ `app/api/signals/premium/route.js` — 402 handshake, paid+settled path, `SETTLEMENT_NETWORK`
  echoed in every response — plus `app/api/signals/premium/settlements/route.js` and
  `components/PremiumSettlementStrip.jsx` (the receipt surface on `/signals`), merged `04ff3f6`
- ✅ `tests/x402*.test.js` — **48 assertions green** (`x402Verify` 21, `x402Settle` 13,
  `x402Route` 5, `x402SpendLedger` 9): 402→200 round trip against a mocked
  `sui_getTransactionBlock`, plus every refusal path (failed effect, wrong payee, under/overpayment,
  wrong network, wrong coin, replay, RPC down, cap exceeded, dark).
  **A's 16:00 review notes, answered:** the network-binding and replay properties were real
  defects in my first pass (the test helper nested the network override inside `payload`, and the
  409 body carried no `reasonCode`) — both fixed at 15:58–15:59 and re-verified in a full run
  (21/21 + 13/13). Take them as done.
- ✅ `docs/SUI.md` — includes the honest limitations (no refunds, testnet coin type is
  configured not hardcoded, `blobId` is null until the signal resolves)
- ✅ `spendLedger` gates inside `evaluateDecision` — **closed by A** (the gate is a resolved value
  passed in, appended last so the existing check indices do not move). C's `settle.js` path needed
  no change
- ✅ **Quality contract (per the lead's 21 Oct decision — all 21 routes, same bar)**:
  `scripts/check-design-tokens.mjs` (G1 ratchet — reports 82 raw colour literals across 15 DOM
  files, then only fails when that number *rises*), `scripts/check-surface-registry.mjs` (every
  route has a registry row), `docs/SURFACES.md` (the registry, 21 rows, with the six banked
  findings). Both scripts pass and are proven against a deliberately broken input.
- ✅ **`tests/surfaceContract.test.jsx` — the mechanical half of WP8 item 4** (the sweep becomes a
  ratchet, not a one-day manual audit). Mounts every renderable route in jsdom inside the app's
  own `Providers`, with Next's own `redirect()`/`notFound()` semantics, and drives three states
  (empty → error → loading). Checks G2 (one `h1`), G3 (a failure must be distinguishable from an
  empty result), G5 (accessible names). The budget per surface is frozen in the test: a finding
  count that goes UP fails the suite, a fix banks permanently.
  - **It caught two of my own registry rows being wrong**: `/canton` and `/canton/holder` are
    component-level redirects, not surfaces (the registry now says so, and the test enforces it —
    the registry cannot quietly become a lie).
  - **Four real G3 findings** (a surface rendering byte-identical text on failure and on empty):
    `/` (`components/AgentRail.js`), `/positions` (`components/PositionsDashboard.js`),
    `/markets` (the market-list fetch), `/labs/canton`. Handed over with the one-line fix.
  - **It needs `vitest.config.js`**: vite does not compile JSX inside `.js` files the way Next
    does, so the esbuild `loader: 'jsx'` is now scoped to our own source
    (`app|components|tests|utils|services|hooks`) instead of the whole dependency graph. Without
    it no app page can be mounted in a test at all.
- ⏸ Live settlement (VPS only) — needs a funded Sui testnet wallet + `TATUM_API_KEY`; the
  settlement network and the read network must agree (`SETTLEMENT_NETWORK` = `SUI_NETWORK`)
- ⏸ Nov 1 in/out decision row (below)

---

## Handoffs

Requests to Dev A (integration owner). A applies them in the merge commit — do not edit those files yourself.

| From | To | Need | Status |
|---|---|---|---|
| B | A | `package.json`: `tatum:sui-check` script; deps if any | **closed by A** — `"tatum:sui-check": "node scripts/tatum-sui-check.mjs"` (the script loads its own dotenv, so no `--env-file`); no new deps |
| B | A | `.env.local.example`: `TATUM_API_KEY`, `SUI_NETWORK` block; `TELEGRAPH_INTENT_EVENT_OUTCOME` | **closed by A** — Tatum block added (`TATUM_API_KEY`, `TATUM_SUI_RPC_URL`, `TATUM_TIMEOUT_MS`; `SUI_NETWORK` already lived in the memory block and is now marked shared). ⚠️ `TELEGRAPH_INTENT_EVENT_OUTCOME` was **not** added to the root file: it is read only under `telegraph-miner/`, a separate package with its own env. Document it there (B's file) — say so if you disagree |
| B | A | `STRATEGY.md` Decision Log row: JSON-RPC-over-gRPC deviation is deliberate | **closed by A** |
| C | A | `package.json`: `x402:test` script → `vitest --run tests/x402*.test.js`; confirm `@mysten/sui ^2.37.0` already installed (it is) — no new deps needed | **closed by A** |
| C | A | `package.json`: `design:check` → `node scripts/check-design-tokens.mjs`; `surfaces:check` → `node scripts/check-surface-registry.mjs`. Both scripts exist, both pass, no new deps — only the two npm aliases are missing (package.json is A's file) | **closed by A** — both landed under the house naming: `check:tokens` and `check:surfaces` (the `check:runtimes` precedent), and as of 21 Oct all three run in `.github/workflows/ci.yml` — the token gate with `--enforce`, so a new file cannot bring raw colour in |
| C | A | **G1 fix in a file A already owns**: `components/CalibrationCurve.jsx` hardcodes `#10b981/#f59e0b/#6366f1` — and spends emerald, which this system reserves for *verified*, on a probability bucket. Move to `tokens.css` names. `components/BackdropProvider.js` (30 literals) re-declares the semantic palette as `rgba()` instead of reading the tokens it is supposed to *be*. The lint reports the rest by file | **closed by A (CalibrationCurve, 21 Oct)** — buckets take `evidence`/`sealed`/`review` by name, all 12 literals banked out of `scripts/design-tokens-baseline.json` (82 → 70), and the gate now runs in CI with `--enforce` so new raw colour fails the build. `BackdropProvider.js` (30) is still open |
| C | A | **Footer nav** (`app/layout.js`): the footer carries a second, contradicting link set — it links `/agent` and `/notifications` (both redirects) and omits Arena. `app/components/PageNav.js` already exports `PRIMARY_NAV` / `OVERFLOW_NAV` as the single source of truth, so the footer should follow them | **closed by A (21 Oct)** — the footer now reads Markets · Positions · Arena · Private · Signals · Agent · Labs · Status (`PRIMARY_NAV` then `OVERFLOW_NAV` then Status), and the Agent link points at `/arena?lane=mandate` instead of the `/agent` redirect. It repeats the two arrays rather than importing them: `PageNav.js` is `'use client'` and `app/layout.js` is the server root |
| C | lead | **Five redirect stubs still have live page bodies**: `/weather`, `/autopilot`, `/world-cup`, `/agent`, `/notifications` each have a `page.js` *and* a redirect in `next.config.mjs`, so the page can never render. Decision: delete the page, or drop the redirect. (`app/weather/page.js` is a `router.replace` inside a redirect.) Also `/canton/holder` has zero inbound links | open — needs the lead's call |
| C | A | `.env.local.example`: `X402_ENABLED`, `X402_SELLER_ADDRESS`, `X402_PREMIUM_PRICE_USDC`, `X402_USDC_CEILING`, `X402_RUN_CAP_USDC`, `X402_USDC_COIN_TYPE`, `SETTLEMENT_NETWORK` — **`SETTLEMENT_NETWORK` must equal `SUI_NETWORK`**, or the payment read refuses | **closed by A** — all seven documented, the constraint quoted verbatim, and the three-leg `SUI_NETWORK` collision written into the same block so nobody sets it by accident |
| C | B | `tatumSuiRpc` implementation merged (signature is frozen; mocked tests unblocked now) | **satisfied** — `services/tatum/tatumSuiClient.js` landed 21 Oct 15:49; WP5 codes against it and imports it directly |
| C | A | **WP5 imports `services/tatum/tatumSuiClient.js`** — merge order must be WP4 → WP5 (the documented order already says this; confirmed) | open — recorded; order unchanged |
| C | A | **Wire the spend gates into `evaluateDecision`**: `services/domain/decision/decisionPolicy.js` is A's file, so C did not touch it. One call, fail-closed: `checkSpendGates({answerKey, amountUsdc, runId})` from `services/payments/x402Sui/spendLedger.js` — a missing `X402_USDC_CEILING` must block, not pass. Import from `@/services/payments/x402Sui/spendLedger.js`; it is server-only (no Edge import) | **closed by A** — `evaluateDecision({…, spendGate = null})` appends a `spend-ceiling` check **last**, so index 0/1 stay inputs/edge and everything from 2 on remains the risk group; `spendGate.allowed === true` is required, so a gate object with no verdict fails closed. 4 new tests in `tests/decisionIntegrity.test.js` (9/9). One shape change worth reading: the param is a **resolved value**, not a call — `checkSpendGates` is async and `evaluateDecision` is sync, so the caller resolves it before money moves (`settle.js:166` already does). C's `settle.js` path needs no change |
| C | A | `STRATEGY.md` Decision Log row: "x402 settled on Sui, self-facilitated; settlement network defaults to testnet" | **closed by A** — plus a second row recording the `SUI_NETWORK` conflict as **unresolved**: a row saying "defaults to testnet" without the collision is how we end up demoing a rail that refuses every payment |
| C | lead | **WP8 item 4 (the consistency sweep) is now half mechanical.** The token audit is `scripts/check-design-tokens.mjs` (a ratchet: 82 raw colour literals across 15 DOM files, failing only when that number rises) and the dead-route part is `scripts/check-surface-registry.mjs` + the contract test, which found **7 redirect stubs** (`/weather`, `/autopilot`, `/world-cup`, `/agent`, `/notifications` in `next.config.mjs`; `/canton`, `/canton/holder` at the component level) — five of them still have full page bodies that can never render. The a11y half is `tests/surfaceContract.test.jsx`. What is left for the Nov 2–5 sweep is the manual part: the 82 literals, the off-system radius/font sizes, and the mobile tap targets | open — for the lead's decision on the redirect stubs |
| C | A | **Four G3 findings from the surface contract** — a surface that renders byte-identical text on failure and on empty, so a reader cannot tell "it failed" from "there is nothing here yet": `/` → `components/AgentRail.js` · `/positions` → `components/PositionsDashboard.js` · `/markets` → the market-list fetch in `app/markets/page.js` · `/labs/canton` → its own fetch. The fix is one state + one line of JSX with `role="alert"`; the exact snippet is in `docs/SURFACES.md` → *Mechanical audit*. Fix one and lower that surface's `BUDGET` in `tests/surfaceContract.test.jsx` in the same commit | **closed by A (21 Oct, `f852c1a`)** — all four fixed; the markets case needed two files (`SportsTab.js`/`DiscoveryTab.js` render the failure with a Retry, and `useMarketsData.js` no longer routes an empty result through the error channel, so `error` means failure and nothing else). Every surface's budget is now zero. |
| C | A | **`vitest.config.js`**: vite does not compile JSX inside `.js` files the way Next does, so the esbuild `loader: 'jsx'` is now scoped to our own source (`app|components|tests|utils|services|hooks`) with `exclude: /node_modules/`. Without it no app page can be mounted in a test. FYI, not a request — please do not revert it, and A's own new tests can mount pages now too | informed |
| C | A | `docs/API_REFERENCE.md`: `/api/signals/premium` — the 402 handshake, the `X-PAYMENT` header, the `settlementNetwork` field | **closed by A** — GET (402 vs 503 reasons) and POST (gate → on-chain re-read → UNIQUE claim → produce) documented; `maxAmountRequired` shown as the string the code actually emits |
| C | A | **Print the settlement network on `/arena`** (`sui:testnet` by default) — the paid rail's network has to be visible where the ladder is shown. C does not edit `/arena` (A owns the memory lane there) | open — A's WP7 turn; will read `settlementNetwork(process.env)` rather than hardcode a literal |
| C | B | **Telegraph P4 should consume this module, not build a second payment stack**: `deliverAfterSettlement(req, resourceFn)` + `verifyPayment({payment, expectedUsdc, seller, network})` from `services/payments/x402Sui/`. The same per-answer ceiling / per-run cap then bounds P4 too | open |
| A | C | `signal:{id}` blob ids available from `memory_writes` after the Oct 24–27 mainnet run | open |
| A | B,C | Do not branch for merge until `main` carries WP1+WP2 (Oct 23 gate) | open |
| B | A | `package.json` + `package-lock.json` carry A's lines only — please check the diff before the merge | **closed by A** — confirmed: memwal/seal/sui and the vitest bump all came from A's install; nothing of yours to reconcile. Your `CalibrationCurve.js → .jsx` rename is staged in the shared index, see review notes |
| B | A | FYI: `services/aiAgentLoop.js` imports `../memory/calibrationMemory.js` — resolves outside `services/` and `tests/analysis-flow.test.js` currently fails on it. Likely wants `./memory/calibrationMemory.js` | **closed by A** — fixed to `./memory/…`; `analysis-flow` collects again |
| A | B,C | **`SUI_NETWORK` collision** (memory=mainnet vs settlement=testnet ⇒ x402 refuses every payment) — needs the user's decision at the Nov 1 gate, see *Cross-leg conflict* | open — raised to user 2026-10-21 |

### Integration review notes (Dev A, 2026-10-21 ~16:00)

All three legs are working in **one shared working tree**, not isolated worktrees — so the
shared-file rules are live constraints, not merge-time formalities. Observed state:

- **A → C (money-critical, was blocking — re-checked 16:01):** at 15:59 `tests/x402Verify.test.js`
  *"rejects a payment made on another network"* returned `valid: true` for a cross-network payment,
  and `tests/x402Settle.test.js` *"rejects a replayed transaction without delivering twice"* failed.
  Both properties (network binding, replay) now pass in a full re-run — I read that as C fixing it
  mid-review rather than me approving something I saw broken. Confirm and I'll take it as done.
- **A → C:** your status board still reads ⏸ while `services/payments/x402Sui/*`,
  `migrations/0016_x402_payments.sql` and `app/api/signals/premium/route.js` exist on disk. Keep
  the board honest — I read it to decide merge order.
- **A → B:** `services/payments/x402Sui/tatumRpc.js` imports your client rather than duplicating
  it — the frozen contract held. I will call your `assertMemoryObjectOnChain(objectId)` from
  `writeMemory()` (WP4's non-decorative use lands on A's hook point); reply with the exact return
  shape so `/api/memory/status` and `MemoryDelta` echo it verbatim instead of inventing a field.
- **A → B, C:** `package.json` still carries only A's lines (verified by diff). Send npm-script
  and `.env.local.example` requests above and I apply them — nobody has sent one yet.
- **A → user:** `migrations/0016` is applied to every test temp DB already (16/16), so the number
  reservation held and no renumbering is needed.
- **A → B, C — answered 16:30:** the `../memory/` import is fixed and `analysis-flow` collects again
  (row closed below). Root `package.json` + `package-lock.json` carry **only A's lines**: the
  `@mysten-incubation/memwal`, `@mysten/seal`, `@mysten/sui` entries came from A's
  `npm install @mysten-incubation/memwal`, and `vitest 2.1.3 → 2.1.9` from the same install — B and C
  needed no dep additions, so there is nothing to reconcile. B: your
  `components/CalibrationCurve.js → .jsx` rename is currently **staged in the shared index**, which
  also stages into anyone's next commit — please keep it staged-only-until-we-talk or unstage it;
  the file is A's WP1 surface and I have not reviewed the rename.
- **A → C — re-verified 16:27 after the doc edit:** `tests/x402Verify.test.js` + 
  `tests/x402Settle.test.js` = 34/34 green, including the two money-critical properties that were
  red at 15:59. `evaluateDecision` now takes the resolved `spendGate` (row closed above); your
  `settle.js` path needed no change.
- **A → B, C — blocking-ish, needs the user:** one `SUI_NETWORK` cannot name two chains. See
  **Cross-leg conflict: `SUI_NETWORK`** above. As configured, the x402 rail refuses every payment
  while the memory leg stays on mainnet. I have **not** edited either leg's file to fix it quietly;
  this is a decision, not a typo.

---

## Merge protocol

0. **Start line (as of 2026-10-21):** WP1 is merged-green and WP2 is code-complete (493 tests,
   typecheck, lint, runtimes all clean). B and C may start on their isolated new files immediately —
   `tatumSuiClient.js`, `x402Sui/types.js`, `x402Sui/verify.js` and the whole `telegraph-miner/` tree
   have no dependency on A's uncommitted work. Branching for **merge** waits on the WP1+WP2 commit
   landing on `main` (needs the user's explicit commit approval).
1. A lands WP1+WP2 and asks the user to approve the commit → that commit is the branch point.
2. B and C branch from `main` at that commit, one branch per WP (`feat/tatum-sui-rpc`,
   `feat/telegraph-registry`, `feat/x402-sui`).
3. Each leg runs its own **Verification** block green before requesting review; a red suite is not
   a review request.
4. A reviews the **diff** (not the summary) and merges in dependency order: `WP4 tatumSuiClient.js`
   → `WP6 registry + P3/P5/P6` → `WP3` → `WP5`. Re-apply each leg's Handoffs lines during its merge.
5. Migrations apply in number order on the VPS **before** any writer runs: 0014 → 0015 → 0016.
   Turso must be migrated ahead of the memory writer (A owns).
6. Any leg that changes shared behaviour (`evaluateDecision` gates, receipt fields) gets A's review
   specifically — those paths are calibration-critical and shared with Telegraph.

---

## New interfaces

Deps: `@mysten-incubation/memwal`, `@mysten/sui` (peer for manual flow), `@mysten/seal`,
`@mysten/walrus` — A owns installation. Env (documented in `.env.local.example` blocks, unset by
default, signing keys server-only and never on Vercel): `MEMWAL_PRIVATE_KEY`, `MEMWAL_ACCOUNT_ID`
(= `MEMWAL_AGENT_ID` on the form), `MEMWAL_RELAYER_URL`, `FOURCAST_MEMORY_ENABLED`,
`FOURCAST_MEMORY_MIN_SAMPLES`, `TATUM_API_KEY`, `SUI_NETWORK`, `X402_SELLER_ADDRESS`,
`X402_USDC_CEILING`, `SETTLEMENT_NETWORK`, `TELEGRAPH_INTENT_EVENT_OUTCOME`. Migrations `0014`–`0016`.

## Verification

```
npm run migrate && npm run migrate:status          # 0014/0015/0016 applied
npm test                                           # A's regression guards + all new files
npm run lint && npm run typecheck && npm run check:runtimes
node scripts/check-design-tokens.mjs               # G1 ratchet — raw colour must not go UP
node scripts/check-surface-registry.mjs            # every route has a registry row
node scripts/memories-to-mainnet.mjs --dry-run     # prints exactly the memories it would append
curl -s localhost:3000/api/agent/calibration | jq '.buckets[0]'   # hitRate AND hit_rate present
curl -s localhost:8402/health | jq '.txline_renewal'
node scripts/memories-to-mainnet.mjs --reconcile   # ledger vs relayer blob_id diff
cd telegraph-miner && npm test                     # 49 existing + intentRegistry drift test
```
Per-leg minimum: **A** — `npm test` + `npm run memories` dry run. **B** —
`cd telegraph-miner && npm test` + `tests/tatumSui*.test.js` with mocked fetch. **C** —
`tests/x402*.test.js` green and a `402`-then-`200` round-trip against a mocked transaction block.
**Everyone** — `node scripts/check-design-tokens.mjs` (no regression) and
`node scripts/check-surface-registry.mjs` (every route has a row), and the surface contract:
`npx vitest --run tests/surfaceContract.test.jsx` (the G2/G3/G5 ratchet — a finding count that
goes UP fails; if you fix one, lower that surface's `BUDGET` in the same commit). Then on
`memory.walrus.xyz`: ≥10 entries across the four `fourcast.*` namespaces whose `blob_id`s match
`memory_writes`, each asserted present via Tatum `sui_getObject`.

## Cannot be verified locally

Local `fourcast.db` has **0** `agent_forecasts` and 15 unresolved `signals` (test files create
their own temp DBs); `.fourcast-agent/receipts` exists only on `nuncio-vultr`. So `analyst:*` /
`window:*` memories, the version ladder, mainnet writes, Tatum object checks and x402 settlement
are VPS/network-only; locally only mocked-fetch tests (`global.fetch = vi.fn()`, env set before
dynamic `await import`) and `--dry-run` output are provable. **Every leg states plainly which of
its claims are local-proof and which are VPS-only** — do not report a local green as a mainnet fact.

## Risks / conflicts

- **The `analyst:{address}` memory may have no honest source.** If `getAnalystCalibration()` returns
  `n < 3` for every address on the live ledger, the entry's core memory becomes `source:*`/`window:*`
  only, and the brief's "track which voices were right" weakens. A checks row counts on the VPS
  before anyone commits to per-analyst memories.
- **Memories are SEAL-encrypted and owner-scoped**, so judges cannot independently read them; the
  public verifiability story is `blob_id` + Tatum-confirmed object + our own `/api/memory/status`
  echo. Say this plainly rather than implying a public ledger.
- **Telegraph Track 3 / paid rails** may collide with the same x402 module; WP5 is the single
  payment stack for both.
- Total Recall's doc says decide the x402 option by Oct 31; Nov 1 is used to align with the
  WP1→WP2 critical path. Not a rule change.
- **Three heads on one honesty rule.** The failure mode this split introduces is each leg
  inventing its own contract; that is what the Frozen contracts + Handoffs sections exist to stop.
