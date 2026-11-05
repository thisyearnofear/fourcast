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
      explorer link.
- [ ] 0.4 `FORECAST_REPLAY` path carries a pre-anchored canonical receipt so the
      demo shows the verified state cold.

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

- [ ] 5.1 Demo script (90s): deposit on Solana → Intent converts →
      contract-gated agent allocates → receipt anchored pre-outcome →
      settles → withdraws via Intents. "Do X, see Y" end-to-end.
- [ ] 5.2 Extend `FORECAST_REPLAY` to markets/receipts endpoints so the
      walkthrough records without full infra.
- [ ] 5.3 X video + post ("built for NEAR HACKATHON"), form (project, 20–2000
      char desc, NEAR payout address, repo + demo links).
- [x] 5.4 `build` script now `next build` (Turbopack, verified).

## Defer

- NEP-770 gasless, follow-as-intent copy-trading, signals-leaderboard
  attestations — post-hackathon.

## Dependency order

0 (anchor) → 1 (contract) → 2 (chain-sig account) → 3 (intents leg) →
4 (TEE) → 5 (demo). 1+2 are the same contract workstream; 3 needs funding;
4 is the stretch. If 4 slips, 1–3 still ship the "non-custodial,
contract-gated, anchored" claim — already past every landscape comp.
