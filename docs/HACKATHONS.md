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
- **Status:** ✅ DoraHacks submitted 2026-08-19. Agent live since Aug 12, 20
  trades executed, 6.26 TST swept. Plan to update submission with fresh
  activity before Aug 24 deadline.

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

## Participated (finished)

### Arc / Agora Agents Hackathon (Canteen × Circle) — ✅ May 2026
- **What:** Arc-native prediction-market intelligence agent: USDC-denominated
  signals/tips/subscriptions on Arc (Circle L1), Circle Wallets, paymaster,
  CCTP/gateway. RFBs 02/05/06.
- **Status:** shipped live on Arc testnet — real testnet USDC flowed through
  signals, tips, and subscriptions; AI predictions logged a **~68% win rate** in
  that cohort. Retired as an active window 2026-08-18 (no deadline to track).
  Integration lives on in `docs/SETUP.md`, `docs/ARCHITECTURE.md`, and
  `contracts/SubscriptionManager.sol`.

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