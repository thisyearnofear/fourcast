# Hackathons & Competitions

Single home for every hackathon / competition Fourcast participates in (past and
active). Created 2026-08-18 by consolidating the retired per-event docs
(`HACKATHON.md` for TxLINE, `HACKCANTON_VALIDATION.md` for HackCanton).

Status legend: 🔴 active now · ⏸️ between tracks · ✅ participated (finished).
Deadlines are as recorded in-repo; verify against the official event page before
relying on them.

## Active

### Gensyn Delphi: Agent Arena — 🔴 Aug 10–24, 2026
- **What:** autonomous agent trading LMSR prediction markets on Gensyn testnet
  (chain 685685), driven by the same decision core as the Polymarket agent.
- **Places:** [competition](https://dorahacks.io/hackathon/delphi-agent-competition/detail) ·
  [leaderboard](https://agent-competition.gensyn.ai) ·
  [API keys](https://delphi-api-access.gensyn.ai/)
- **Runs:** `docs/DELPHI_AGENT.md` (operator guide)
- **Status:** data-feed live proved; full live execution + DoraHacks submission
  are the remaining deliverables before Aug 24.

### Telegraph Protocol Miner (Track 1: Miner) — 🔴 Aug 17–31, 2026
- **What:** serve verified sports intelligence (live scores + final results with
  Solana Merkle proofs) to the Telegraph network. Judging: 75% normalized
  performance (accuracy vs ground truth), 25% X engagement.
- **Track 3 (apps consume miners):** Sep 1–7.
- **Guardrail:** need ≥3 active miners in the same intent **and** ≥100 real
  requests from Track 3 apps.
- **Runs:** `telegraph-miner/` (committed 2026-08-18; deploy/register at
  integrate.telegraphprotocol.com — endpoint `miner.sportwarren.com/query`).
- **Tag** [@Telegraphprotoc](https://x.com/Telegraphprotoc) in progress posts.

## Arc / Circle (the Canteen agora) — status unconfirmed
- **What:** USDC-native signals/tips settlement on Arc (Circle L1); on-chain
  `SubscriptionManager` subscription contracts.
- **Places:** [agora](https://agora.thecanteenapp.com/) ·
  [Arc docs](https://rpc.testnet.arc.network/)
- **Status:** no deadline is recorded in the repo — verify against the agora
  before treating this as a live submission window.

## Participated (finished)

### TxLINE Hackathon · Solana — ✅ Jul 19, 2026
- **Submission:** `docs/TXLINE_SUBMISSION.md` (live yet kept) — "Verifiable Agent
  Mandates with TxLINE Outcome Proofs". Live demo
  [fourcastapp.vercel.app/world-cup](https://fourcastapp.vercel.app/world-cup),
  Solana program on devnet
  `AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ`.
- Fourcast landed as the verification/reputation layer for agent-managed
  prediction-market capital, with proof-of-decision receipts reconciled against
  TxLINE/Solana Merkle roots. Retired strategy doc `HACKATHON.md` 2026-08-18.

### HackCanton (private CBTC settlement) — ✅ finished
- **What:** private-size position settlement on Canton DevNet: hidden-size Daml
  positions, CIP-56 escrow, BitSafe CBTC atomic settlement (`scripts/canton-bitsafe-lifecycle.mjs`).
- **Status:** validation interviews were never logged (all "Pending" in the
  retired `HACKCANTON_VALIDATION.md`). Capability is functional on DevNet;
  mainnet external-wallet gateway is still roadmap. Do not present user
  validation as achieved.
- **Intake pipeline retained:** Privacy check → **Talk to us**
  (`POST /api/talk` → `operator_leads`).
```