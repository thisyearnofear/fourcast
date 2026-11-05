# NEAR HACKATHON integration plan — Fourcast

This document is the build frame of reference for adapting Fourcast to the NEAR HACKATHON. It complements `HACKATHON.md` at repo root.

## Goal
Show an autonomous trading agent moving value across chains via NEAR and committing verifiable decision receipts, with a clear “do X, see Y” demo.

## Track
- Primary: **Unstoppable DeFi**
- Secondary: **Agent Economy**

## Current relevant surfaces
- Architecture: `docs/ARCHITECTURE.md`
- Setup: `docs/SETUP.md`
- Execution plan: `docs/EXECUTION_PLAN.md`
- Surfaces: `docs/SURFACES.md`
- Strike integration pattern: `docs/STRIKE_INTEGRATION.md`
- Canton integration: `docs/CANTON.md`

## NEAR integration architecture

### Agent treasury
- Create a NEAR named account for the Fourcast agent (e.g. `agent.fourcast.near`).
- Use sub-accounts for separate strategies/mandates.
- Use function-call keys scoped to trading/payment methods.

### Value movement
- Use **NEAR Intents** to move value into a position across chains.
- Use **Chain Signatures** if the agent must sign on another chain.
- Use **1-Click Swap SDK** for asset conversion where needed.

### Decision receipts
- Keep existing receipt generation.
- Anchor receipt hash on NEAR.
- Reconcile against outcome data and show mandate adherence.

### AI layer
- Keep existing edge discovery/sizing.
- Optionally use **NEAR AI Cloud** for signal reasoning and document it.

## Week 1 plan (integration)
- [x] Add NEAR env vars (account IDs, RPC, keys).
- [x] Create NEAR client helper.
- [~] Implement one NEAR Intent value movement for a demo trade. *(dry quote path proven 2026-11-02; real deposit leg needs a funded Intents balance)*
- [~] Anchor decision receipt hash on NEAR. *(service implemented + unit-tested; needs `NEAR_ACCOUNT_ID`/`NEAR_PRIVATE_KEY` on testnet for the on-chain leg)*
- [x] Keep existing venues as context; do not port all of them.

### Verified API facts (2026-11-02, probed live)
- **1-Click Intents API** (`https://1click.chaindefuser.com`): `/v0/tokens`, `/v0/quote`,
  `/v0/status`, `/v0/deposit/submit`. Works **without** auth but adds a 0.25% platform
  fee on non-ANY_INPUT quotes; `NEAR_ONECLICK_JWT` (sent as `X-API-Key`) gets partner fees.
  **There is no Intents testnet — demo uses small mainnet amounts.**
- For a NEAR recipient use `recipientType: INTENTS` + `refundType: INTENTS`
  (value lands in the agent's Intents balance; DESTINATION_CHAIN for a NEAR
  account returned a bare 400). Proven: 1 wNEAR → 3.86 USDC dry quote, ~20s estimate.
- **Receipt anchoring**: NEAR has no memo program; we publish the same
  `fourcast:receipt-v1:<fixtureId>:<contentHash>` memo via NEAR Social `set`
  (`v1.social08.testnet` — confirmed live on testnet RPC) under
  `<account>/fourcast/receipts/<fixtureId>`. Verifiable by any explorer or a
  `get` view call — no tx hash needed.
- near-api-js v7 API: `new Account(id, new JsonRpcProvider({url}), 'ed25519:…')`,
  `account.callFunction`, `provider.viewTransactionStatus`.

### Module layout (services/near/)
- `nearConfig.js` — network/env resolution, explorer URLs, `isNearConfigured()`
- `nearClient.js` — `getProvider()` (read-only) / `getSignerAccount()` (treasury key)
- `nearReceiptCommitment.js` — `anchorReceiptCommitment`, `verifyCommitmentTx`,
  `readAnchoredCommitment` (mirrors the Solana memo adapter)
- `nearIntents.js` — 1-Click `listTokens` / `getQuote` / `getExecutionStatus` / `submitDepositTx`
- `nearAnchorQueue.js` — durable pending-anchor queue (`<stateDir>/near-anchors.json`); the worker enqueues every receipt it writes
- Demo scripts: `npm run near:anchor -- --fixture <id> | --queue | --drain`, `npm run near:intents`

### App surfaces (wired 2026-11-02)
- **`/api/txline/verify`** returns `nearCommitment` in the same custody
  envelope as the Solana commitment — precedence: `?nearTx=` param →
  `integrity.onchainCommitments.near` on the receipt → live contract-state
  check (`readAnchoredCommitment`, needs only `NEAR_ACCOUNT_ID`, no key).
  `not-anchored` is the honest pre-anchor state.
- **DecisionDossier §05** renders a "Chain anchors" block (Solana memo +
  NEAR anchor rows, nearblocks link on expand) — evidence one tap away.
- **`/api/meta/health` → `/status`** lists "NEAR rail" as a provider
  (`disabled` when unconfigured, RPC probe when keys exist), Anchor icon.
- `status.json` from the worker already carries `nearAnchor`/`nearTx` per receipt.

### To-do: accounts & credentials (do once the rail is built out further)
- [ ] Generate a testnet account for the anchor (e.g. `fourcast-agent.testnet`)
  and set `NEAR_ACCOUNT_ID` + `NEAR_PRIVATE_KEY` (ed25519:…) in `.env.local`.
  Once set, `npm run near:anchor -- --drain` anchors every queued receipt —
  the worker enqueues them automatically (see "Anchor queue" below), nothing
  else needs to change.
- [ ] Create the mainnet NEAR treasury account + fund ~1 NEAR for the real
  Intents deposit leg (Intents has no testnet).
- [ ] Request `NEAR_ONECLICK_JWT` from the Partner Dashboard for partner fees
  (optional — quotes work without it, +0.25% fee).
- [ ] Later hardening: move the treasury to a sub-account + function-call key
  scoped to the social contract, per the "Agent treasury" section.

### Anchor queue
The worker enqueues `{ fixtureId, contentHash, receiptFile }` into
`<stateDir>/near-anchors.json` for every receipt it writes
(`services/near/nearAnchorQueue.js`). `drainNearAnchors()` runs each cycle and
no-ops until `NEAR_ACCOUNT_ID`/`NEAR_PRIVATE_KEY` are set; anchored receipts get
`proof.integrity.onchainCommitments.near = { txHash, explorerUrl, socialKey }`
written back into the receipt file. Opt out per-run with
`NEAR_ANCHOR_ENABLED=false`.

## Week 2 plan (demo + submission)
- [ ] Polish one end-to-end trade + receipt verification.
- [ ] Add README “do X, see Y” steps.
- [ ] Record X demo video.
- [ ] Publish repo and post demo.
- [ ] Submit form.

## Demo script
1. Agent detects edge → see mandate and policy gates.
2. Agent moves value via NEAR Intent → see transaction.
3. Agent commits receipt → see receipt hash on NEAR.
4. Outcome resolves → see reconciliation + mandate adherence.

## Risks and fallbacks
- If multi-venue complexity slows integration, simulate/record one successful NEAR Intent trade and anchor receipts.
- If receipt verification is complex, show hash anchoring + reconciliation against cached outcome data.

## Submission checklist
- [ ] Repo public by Nov 14 23:59 UTC
- [ ] X demo post with video/screenshots and “built for NEAR HACKATHON”
- [ ] README setup + “do X, see Y”
- [ ] HACKATHON.md present
- [ ] NEAR account address for payout
- [ ] Form submitted once
