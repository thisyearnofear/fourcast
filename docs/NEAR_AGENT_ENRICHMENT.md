# NEAR Agent Enrichment — Implementation Plan

**Deadline:** NEAR HACKATHON submission Nov 14 23:59 UTC (build + video + form).
**Thesis:** move the verifiability claim down the stack — app-logged receipts →
TEE-attested, contract-gated, chain-signature-funded, NEAR-anchored receipts.
Same product, different claim. This is what Proximity Labs' Shade-agent bounty
and the judges' rubric ("non-custodial, verifiable, multichain agent") reward.

**Existing assets (verified 2026-11-05):**
- `services/near/` — client, config, Intents quote/status/deposit-submit,
  receipt commitment anchor+verify (social.near `set`/`get`), anchor queue
- `scripts/near-intent-quote.mjs`, `scripts/near-anchor-receipt.mjs`
- `tests/nearAnchorQueue.test.js`, `tests/nearReceiptCommitment.test.js`
- `constants/canonicalReceipt.js` — France v Sweden sealed fixture
- `FORECAST_REPLAY=1` demo feed path

## Phase 0 — Receipt anchoring, end-to-end (½ built, highest signal/effort)

Goal: every agent decision carries a NEAR-anchored commitment a judge can
verify independently. ~2 days.

- [x] 0.1 ~~Wire `anchorReceiptCommitment`~~ — already wired: worker enqueues +
      drains via `nearAnchorQueue` (verified `fourcast-agent-worker.mjs:405-422`).
- [ ] 0.2 Surface verification in `/proof`: "anchored on NEAR" row → explorer
      link + `verifyCommitmentTx` status (anchored / pending / mismatched).
- [x] 0.3 `nearAnchor`/`nearTx` flow through feed; rail shows `⬡ anchored`
      explorer link. (Audit fix: the rail field was dead — the only ingest
      poster never set `nearTx`. `fourcast-agent-worker` now posts
      ingest-shaped run records carrying `nearTx`/`nearExplorer`, and the
      rail links nearblocks.)
- [ ] 0.4 `FORECAST_REPLAY` path carries a pre-anchored canonical receipt so the
      demo shows the verified state cold. (Replay now forwards
      `CANONICAL_RECEIPT.nearTx`/`nearExplorer` — still needs a real anchor
      hash recorded on the fixture.)

## Phase 1 — Contract guardrails (the gates, on-chain)

Goal: the five gates stop being app code and become contract rules — "stops
unauthorized actions even if the runtime is compromised." ~3 days.

- [x] 1.1 `contracts/near/agent-mandate/` — DEPLOYED testnet
      `inexpensive-mother.testnet` (tx J9LzABT…): venues, notional cap,
      liquidity floor, slippage, cooldown + code-hash gate. `get_mandate`
      verified via RPC.
- [x] 1.2 `request_signature` → MPC `sign()` on `v1.signer-prod.testnet`.
      Out-of-policy = refused signature. Unit tests 4/4 (venue/cap/cooldown/
      code-hash).
- [ ] 1.3 Worker refactor: gates check local policy first (UX), then the
      contract re-checks (trust). Failure = rejected signature = no tx.
- [x] 1.4 Unit tests pass (4/4). cargo-near dev-dep via `unit-testing` feature.

## Phase 2 — Chain Signatures funding account

Goal: agent's venue account derived from `agent.fourcast.near` — no key on
the VPS → honestly "non-custodial." ~2 days.

- [x] 2.1 Derived via `v1.signer-prod.testnet` `derived_public_key`
      (path `arena/v1`, predecessor `inexpensive-mother.testnet`) →
      `0x6940B97505567816A75B1A952f234630af81c61F`. No private key exists.
- [x] 2.2 `ChainSignatureSigner` (ethers-compatible, no key) —
      `executeServerOrder` accepts signer objects; `aiAgentLoop` uses it
      when `NEAR_MANDATE_CONTRACT` is set. Digest → contract gates → MPC.
      (Audit fix: three blockers found and repaired — clob-client calls the
      ethers-v5 `signer._signTypedData`, now aliased; the envelope was fixed
      at signer-creation with `liquidity:'0'` and would have been refused
      100% of the time against the live `min_liquidity=5e8` floor — the
      signer is now created per-order with real values; and the 60s
      contract cooldown plus the L1-auth + order two-signature flow meant
      self-DoS — L2 creds are now cached via `POLY_L2_*` envs after a
      one-time bootstrap (`scripts/near-derive-polycreds.mjs`).)
- [x] 2.3 `NearMandateCard` in Arena → Mandate lane shows the derived
      EVM address + contract policy + "no private key exists" (via
      `/api/near/mandate`, read-only RPC).

## Phase 3 — Intents: funding + settlement leg

Goal: one real value movement end-to-end, plus COCA-style onboarding. ~3 days.

- [ ] 3.1 Fund the Intents balance (small mainnet amount — unblocks the
      deposit leg; `getQuote` dry path already proven).
- [ ] 3.2 Real deposit leg: quote → deposit → `getExecutionStatus` → settle.
      Record the whole path for the video.
- [ ] 3.3 Deposit-address onboarding surface: `/markets` (or `/agent`) offers
      "Fund from any chain" → persistent deposit address per connected
      account (COCA pattern — proven at 1M+ user scale).
- [ ] 3.4 Settlement leg: winnings → Intents → any-chain withdrawal (demo
      shows USDC Solana out).

## Phase 4 — Shade agent (claim "verifiable autonomy")

Goal: the worker runs in TEE, code hash registered on the mandate contract —
judges verify *which binary* made decisions. ~3 days; can ship partially.

- [ ] 4.1 `npm i @neardefi/shade-agent-js`, `@neardefi/shade-agent-cli`.
- [ ] 4.2 Port the arena worker's decision loop into a Shade worker (the
      gates already live in-contract from Phase 1, so the worker is thin:
      scan → decide → request_signature → attest).
- [ ] 4.3 `approved_code_hash` on the mandate contract; receipts gain a
      `codeHash` field — SEAL records attest to the binary, not just output.
- [ ] 4.4 Fallback: if TEE (Phala) deploy slips past Nov 10, demo runs
      "local worker, contract-gated" — still non-custodial + contract-verified,
      just not TEE-attested. Ship the contract work regardless.

## Phase 5 — Demo loop + submission (Nov 9–13)

- [x] 5.1 Demo script (90s, shoot order):

      1. (0–8s) `/` — hero: "Every prediction deserves a proof trail."
         TrustStatsStrip shows sealed receipts (replay fills cold state).
      2. (8–22s) `/arena` → Ledger lane — live decision row: verdict,
         gates all green, edge vs market price. Voiceover: "The agent
         scans, sizes under Kelly, and *seals its decision before the
         outcome is known*."
      3. (22–34s) Same row → expand to DecisionDossier — the five gates
         render (slippage/mandate/risk/liquidity/cooldown). "This
         envelope is enforced *on-chain*, not in app code."
      4. (34–46s) `/arena` → Mandate lane — NearMandateCard: contract
         account on nearblocks, derived EVM address, "no private key
         exists." Voiceover: "The agent's key doesn't exist — it's a
         NEAR contract account via Chain Signatures."
      5. (46–62s) THE NEAR LEG: user deposits USDC on Solana → Intents
         converts to venue collateral (COCA pattern) → agent allocates.
         This is the Intents moment the track wants.
      6. (62–76s) `/proof` — walk the canonical receipt: SEAL
         timestamped pre-outcome, anchor on NEAR social.near, verdict
         reconciled. "Every claim independently verifiable."
      7. (76–90s) Settle + withdraw via Intents back to Solana. Close on
         the rail lamp + "⬡ anchored". Title card: "FORECAST — non-
         custodial, contract-gated, NEAR-anchored. Built for the NEAR
         HACKATHON."
- [x] 5.2 `FORECAST_REPLAY=1` covers `/api/arena/feed` (demo cycle) +
      `/api/receipts/stats` (canonical fixture metrics). Markets hit live
      venue APIs — no replay needed.
- [ ] 5.3 X video + post ("built for NEAR HACKATHON"), form (project, 20–2000
      char desc, NEAR payout address, repo + demo links).
- [x] 5.4 `build` script no longer pins `--webpack` — Next 16 defaults to
      Turbopack; `npm run build` verified clean 2026-11-06 (31.7s compile,
      all routes in manifest, `/api/near/*` present).

## Defer

- NEP-770 gasless, follow-as-intent copy-trading, signals-leaderboard
  attestations — post-hackathon.

## Audit — 2026-11-05 (post-"shipped" review)

Verified against live contract + code, not the commit log.

**Broken as shipped (fixed in this pass):**
- `signer._signTypedData` missing — `@polymarket/clob-client@4.x` bundles
  ethers v5 and calls the v5 name for both L1 auth and order signing; the
  path threw before reaching the contract.
- Fixed envelope — the signer was created once per run with
  `notional:'0', liquidity:'0'`; the live `min_liquidity=5e8` floor refused
  every request. Now created per-order with real notional/liquidity.
- Cooldown self-DoS — `last_trade_ns` updates per *signature request*, and
  a Polymarket order needs ≥2 signatures (L1 creds + order). L2 creds are
  now cached (`POLY_L2_API_KEY/SECRET/PASSPHRASE`); bootstrap once via
  `scripts/near-derive-polycreds.mjs`.
- `⬡ anchored` was dead code — `latest.nearTx` was never set by any ingest
  poster. `fourcast-agent-worker` now posts an ingest-shaped run record
  (ARENA_INGEST_URL + ADMIN_SECRET, same contract as the Delphi worker).

**Still open:**
- The derived EOA `0x6940…c61F` has no USDC/POL and no CTF-exchange
  allowances — a working signature is not a working trade. Funding +
  `approve` txs (themselves chain-sig signed) are required before the
  first live order; Intents (Phase 3) is the funding leg.
- The Ledger lane is fed by `delphiAgentLoop` (raw `WALLET_PRIVATE_KEY`),
  NOT the mandate-gated `aiAgentLoop`. The demo must not narrate
  "enforced on-chain" over Delphi-feed rows — show the Autopilot path or
  the TxLINE receipts instead.
- Intents frontend: `GET /api/near/quote` (always dry server-side) +
  `NearIntentsCard` on the Mandate lane now show a live solver quote and
  forward `?status=` to `getExecutionStatus`. Still missing: the persistent
  deposit address (3.3) — mints on the first non-dry quote once funded.
- `NEAR_MANDATE_CONTRACT`, `NEAR_DERIVATION_PATH`, `NEAR_WORKER_CODE_HASH`,
  `POLY_L2_*` were undocumented in env examples — now added.
- `autopilot:true` on `/api/agent` is reachable by any visitor when the
  mandate env is set on the web server; rate limit is IP/UA only.
  **Fixed 2026-11-06**: `autopilot` now requires `x-admin-secret` (same
  gate as `/api/agent/schedule`; dev-only when `ADMIN_SECRET` unset).
  Cron path unaffected — it goes through `CRON_SECRET` + scheduler.
- `NEAR_ACCOUNT_ID` must be the contract owner (`assert_owner`) — i.e. the
  `inexpensive-mother.testnet` key lives on the worker as a full-access
  key until scoped to a function-call key (nearClient.js comment).

## Dependency order

0 (anchor) → 1 (contract) → 2 (chain-sig account) → 3 (intents leg) →
4 (TEE) → 5 (demo). 1+2 are the same contract workstream; 3 needs funding;
4 is the stretch. If 4 slips, 1–3 still ship the "non-custodial,
contract-gated, anchored" claim — already past every landscape comp.
