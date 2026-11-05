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

- [ ] 0.1 Wire `anchorReceiptCommitment` into the arena worker pipeline at the
      SEAL step (decision hash → social.near `set`, async via `nearAnchorQueue`).
      Non-blocking: queue retries, worker never blocks on NEAR RPC.
- [ ] 0.2 Surface verification in `/proof`: "anchored on NEAR" row → explorer
      link + `verifyCommitmentTx` status (anchored / pending / mismatched).
- [ ] 0.3 `/api/arena/feed`: include `nearAnchor: { txHash, status }` on runs
      that anchored; AgentRail shows the lamp.
- [ ] 0.4 `FORECAST_REPLAY` path carries a pre-anchored canonical receipt so the
      demo shows the verified state cold.

## Phase 1 — Contract guardrails (the gates, on-chain)

Goal: the five gates stop being app code and become contract rules — "stops
unauthorized actions even if the runtime is compromised." ~3 days.

- [ ] 1.1 `contracts/near/agent-mandate/` — NEAR contract (Rust) storing the
      mandate: allowed venues, max notional, min liquidity, cooldown. Mirrors
      `lib/gates/*` semantics; the contract is the source of truth.
- [ ] 1.2 `request_signature(payload)` method: validates payload against
      mandate, calls `sign()` via Chain Signatures MPC — refuses out-of-policy
      requests. This IS the gate engine, on-chain.
- [ ] 1.3 Worker refactor: gates check local policy first (UX), then the
      contract re-checks (trust). Failure = rejected signature = no tx.
- [ ] 1.4 Tests: contract unit tests mirroring existing gate cases.

## Phase 2 — Chain Signatures funding account

Goal: agent's venue account derived from `agent.fourcast.near` — no key on
the VPS → honestly "non-custodial." ~2 days.

- [ ] 2.1 Derive EVM address: path `arena/v1` on the MPC contract
      (`v1.signer` testnet). Store derivation in `nearConfig`.
- [ ] 2.2 Worker signs venue txns through the mandate contract's
      `request_signature` (Phase 1) instead of a local key.
- [ ] 2.3 `/agent` surface shows the derived address + "controlled by
      fourcast-agent.near via chain signatures" — judges can verify the
      account↔contract link.

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

- [ ] 5.1 Demo script (90s): deposit on Solana → Intent converts →
      contract-gated agent allocates → receipt anchored pre-outcome →
      settles → withdraws via Intents. "Do X, see Y" end-to-end.
- [ ] 5.2 Extend `FORECAST_REPLAY` to markets/receipts endpoints so the
      walkthrough records without full infra.
- [ ] 5.3 X video + post ("built for NEAR HACKATHON"), form (project, 20–2000
      char desc, NEAR payout address, repo + demo links).
- [ ] 5.4 Switch `build` script to Turbopack (webpack build is flaky on
      API-route manifest collection — verified: `next build` passes).

## Defer

- NEP-770 gasless, follow-as-intent copy-trading, signals-leaderboard
  attestations — post-hackathon.

## Dependency order

0 (anchor) → 1 (contract) → 2 (chain-sig account) → 3 (intents leg) →
4 (TEE) → 5 (demo). 1+2 are the same contract workstream; 3 needs funding;
4 is the stretch. If 4 slips, 1–3 still ship the "non-custodial,
contract-gated, anchored" claim — already past every landscape comp.
