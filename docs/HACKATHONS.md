# Hackathons & Competitions

Single home for every hackathon / competition Fourcast participates in (past and
active). Created 2026-08-18 by consolidating the retired per-event docs
(`HACKATHON.md` for TxLINE, `HACKCANTON_VALIDATION.md` for HackCanton).

Status legend: 🔴 active now · ⏸️ between tracks · ✅ participated (finished).
Deadlines are as recorded in-repo; verify against the official event page before
relying on them.

## Active

### Telegraph Protocol Miner (Track 1: Miner) — 🔴 Aug 17–31, 2026
- **What:** serve verified sports intelligence (live scores + final results with
  Solana Merkle proofs) to the Telegraph network. Judging: 75% normalized
  performance (accuracy vs ground truth), 25% X engagement.
- **Track 3 (apps consume miners):** Sep 1–7.
- **Guardrail (as recorded; re-check the official page before relying on it):**
  ≥3 active miners in the same intent **and** ≥100 real requests from Track 3
  apps. `SPORTS_SCORE` / `GAME_RESULT` each have **2** miners (scorewire +
  fourcast). `WEB_SEARCH` has 7 — that was the wrong product for us.
- **Runs:** `telegraph-miner/` — process live at
  `https://miner.sportwarren.com/query` (PM2, Traefik SSL). Operator runbook:
  `telegraph-miner/README.md`.
- **Data tier:** free TxLINE tier covers MLS + future PL fixtures. Historical
  game results for GAME_RESULT queries require a paid TxLINE tier. Aug 25 epoch
  scores: both miners scored 0 (evaluator had no matching ground-truth for the
  free-tier leagues during the current epoch). Aug 25 code update added natural
  language query handling and graceful degradation for unsupported intents.
- **Registered:** ✅ 2026-08-19 first pin (tx
  [0xf8b206cb...445140d8](https://sepolia.basescan.org/tx/0xf8b206cb3b5968dce042171e4f735cb8a305376209ba7e049ffddf3f445140d8))
  wrote `WEB_SEARCH` / `FACT_CHECK` as **`registrationId` 128**. Corrected
  2026-08-20 via `updateMiner` — tx
  [0xbc89aed7...e4e608](https://sepolia.basescan.org/tx/0xbc89aed7f52fe0c292c5e1ce3209af914aeb0988ec9c315c5be4e385dde4e608)
  on Base Sepolia, diamond `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8`.
  Live **`registrationId` 148** (YAML `id` stays 1). Slug
  `fourcast-sports-intelligence`, fee
  `0x55A5705453Ee82c742274154136Fce8149597058`. Node:
  **`active`**, intents `SPORTS_SCORE` / `GAME_RESULT`, YAML
  `https://raw.githubusercontent.com/thisyearnofear/fourcast/main/telegraph-miner/telegraph.yaml`
  (hash `0x608b7dd0…0927`). 128 is **deregistered**. **Do not `registerMiner`
  again** — further YAML/intent changes use `updateMiner(148, …)`. Operator
  notes: `telegraph-miner/README.md`.
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

### Gensyn Delphi: Agent Arena — ✅ Aug 10–24, 2026
- **What:** autonomous agent trading LMSR prediction markets on Gensyn testnet
  (chain 685685), driven by the same decision core as the Polymarket agent.
- **Submission:** [DoraHacks](https://dorahacks.io/hackathon/delphi-agent-competition/detail) —
  submitted 2026-08-19. Operator guide: `docs/DELPHI_AGENT.md`.
- **Agent:** live since Aug 12, 68 fills on 25 markets, 138.8 TST gross deployed,
  31.26 TST swept to date.
- **Last board (2026-08-20):** rank 80/159, account 1,000.35 TST, PnL −0.15 TST,
  86 trades — essentially breakeven, lower-middle. Final official standings pending
  on [competition.delphi.fyi](https://competition.delphi.fyi/).
- **What it proved:** the Delphi agent loop, ESPN sports-odds routing, Kelly sizing,
  and policy gates all functioned end-to-end on-chain. Not in payout contention
  (leader +8,285 TST); credential is shipping a live competition agent with real
  TST on testnet. Delphi-specific code lives in `services/delphiService.js`,
  `services/delphiAgentLoop.js`, `services/delphiIntelligence.js`,
  `services/delphiDataFeeds.js`, and `deploy/delphi-agent.ecosystem.config.cjs`.
