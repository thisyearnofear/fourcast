# Hackathons & Competitions

Single home for every hackathon / competition Fourcast participates in (past and
active). Created 2026-08-18 by consolidating the retired per-event docs
(`HACKATHON.md` for TxLINE, `HACKCANTON_VALIDATION.md` for HackCanton).

Status legend: 🔴 active now · ⏸️ between tracks · ✅ participated (finished).
Deadlines are as recorded in-repo; verify against the official event page before
relying on them.

## Active

### Telegraph Protocol Hackathon Season II — ⏸️ preparing
30 days, $10,000 prize pool. Season I closed without a Fourcast placement. This
section is the plan for Season II so we enter instrumented instead of blind.
Registration is through the Season II page at
[telegraphprotocol.com](https://telegraphprotocol.com); exact prize split,
judging criteria, and qualification requirements publish with the final rules —
**re-verify all of it before relying on this plan.**

#### Why we did not win Season I (root cause, not vibes)
Our Season I entry was `fourcast-sports-intelligence` (Track 1 miner,
`SPORTS_SCORE` / `GAME_RESULT`, `registrationId` 148, live at
`miner.sportwarren.com/query`). The Aug 25 epoch scored it **0** — "evaluator
had no matching ground-truth for the free-tier leagues during the current
epoch" (see the Season I record below). Three compounding causes:

1. **We shipped into an intent family the network scores near zero.** Telegraph
   scores by *answer shape*: prose intents (TASK_COMPLETION, URL_SCAN) top out
   near 1.0; deterministic/quantity intents (scores, prices) top out near 0.
   `SPORTS_SCORE` / `GAME_RESULT` return quantities — the dead half of the
   network — so our score was structural, not quality.
2. **Ground truth was gated behind a paid TxLINE tier**, so the evaluator had
   nothing to grade the free-tier leagues against.
3. **We had no instrumentation to detect any of this until after the epoch.** We
   could not tell "wrong answer" from "nothing to compare against" from "scored
   on the wrong axis."

The strongest Season I entry (`amanat`, a weather miner + evaluation WASM +
on-chain app in one repo, [github.com/PugarHuda/amanat](https://github.com/PugarHuda/amanat))
won on **epistemic honesty as a product**: it measured the network before
optimizing, proved every number, and reported absences as absences. That is
Fourcast's own stated thesis ("none prove discipline… verifiable mandate
adherence"). Season I we pointed it at markets; Season II we point it at
Telegraph itself.

#### Season II plan — priority order

**P0 · Instrument before optimizing (the direct cause of the 0).**
Port the survey + asked pattern into `telegraph-miner/`:
- `agent/survey` equivalent: read live per-intent scores across the network and
  print *measured champion bar* vs *displayed eval_score* (they drift badly —
  the displayed number is the margin achieved on the winning day, frozen). Never
  register into a zero-scored intent again; read the live bar before spending a
  registration.
- `/api/asked`: record the last ~50 questions the node actually sent this miner
  (with the field they arrived in). The tournament question and the docs did not
  agree in Season I; without this we are guessing what the scorer sees.
- Distinguish, in our own scoring log, "answer wrong" vs "answer never arrived"
  vs "nothing to compare against."

**P1 · Make verification a one-command independent check.**
Today `GET /` advertises `verification: 'solana-merkle-proof'` and the miner
returns `proof_available: true` — a claim, not a check. Replace with:
- `/.well-known/fourcast.json` publishing the signing key + the exact verify
  snippet so anyone can confirm a signature without trusting us.
- A `verify` script that re-derives the Solana Merkle proof and **reports
  honestly when it cannot confirm** rather than printing a tick.
- Product rule: every number sits beside an address, tx, signal hash, or
  signature; a figure without one is not shown.

**P2 · Answer in two shapes on `GAME_RESULT`.**
Return a prose sentence a text scorer can grade *and* clean scalars a contract
settles on (`winner`, `home_score`, `away_score`), with the TxLINE Merkle root
as the evidence field. Report absence as absence — never a confident zero /
Null-Island answer for a missing fixture (return an explicit "no result" state).

**P3 · Enter the Evaluator track with a `GAME_RESULT` attribution scorer.**
The Season I champion scorer is blind to attribution — it scores "Boston beat
the Knicks 112-108" at 1.0000 when the Knicks won. We serve `GAME_RESULT` and
already have the ground truth. A `no_std` WASM scorer that reads the direction
of the result verb is a research narrative we can actually win, aligned with our
"provable discipline" thesis. Note the network's **agreement gate** (a
challenger must rank answers the way the incumbent does, ≥0.60 Spearman) can
make a scorer that *fixes* a broken intent structurally unpassable — document
that as a finding either way.

**P4 · Wire Telegraph's paid rails into the existing decision core (Track 3 app).**
Cheapest-first cost discipline maps directly onto our 5-gate policy + pre-outcome
receipt (`services/domain/decision/`): free daemon feed → ~$0.01 x402 Engine
call → ~$1.00 ERC-8183 on-chain job, with a hard per-answer ceiling and per-run
spend cap. "A prediction-market agent that buys ranked Telegraph intelligence
before sizing, and commits a receipt before the outcome" is a stronger Track 3
app than any Season I winner and reuses machinery we already ship.

**P5 · Package for a judge with 3 minutes and an agent with 0 patience.**
`/openapi.json`, `/llms.txt`, `/.well-known/`, a generated social card (X
engagement was ~25% of Season I score), a short demo film cut from real
sessions, and one link-to-chain per claim.

**P6 · Publish our own bug report.**
We already found real network issues (the `new Date.now()` crash in the
graceful-degradation path; the free-tier-ground-truth gap; the PM2 v7 listen
gate). Per Season I results, a measured, reproducible findings report is worth
more than a marginal miner slot — and it is exactly the credibility our
positioning claims.

#### Live survey, 2026-09-28 (`npm run survey` in `telegraph-miner/`)
- Our miner: `active`, 10 requests served, epoch 368. `SPORTS_SCORE` 0 (rank
  14/15), `GAME_RESULT` 0 (rank 15/15).
- `SPORTS_SCORE` is **unmeasured network-wide**: the best of 15 miners scores
  7.5e-12. Don't optimise for it. Keep serving it, but don't count on it.
- `GAME_RESULT` **is measured**: best 0.1197 (`game-mlb-schedule`), then
  `game-football-data` 0.0786 and `game-nhl-score` 0.0471. All three answer
  from free official feeds, which is the gap v1.1 closes. Scorer bar: displayed
  0.7150, measured 0.5622.
- Network: 118 intents scored, 88 measured (best ≥ 0.05), 30 effectively
  unmeasured. The commercial intents are live, e.g. `EVENT_OUTCOME_RESOLUTION`
  (18 miners, best 0.727), which is close to our prediction-market core and
  worth a look for Season II.

#### Season II readiness checklist
- [ ] Confirm Season II rules, tracks, prize split, and qualification on the
      official page (do not trust this plan's numbers).
- [x] P0 instrumentation: `npm run survey`, `GET /api/asked`, outcome counters,
      upstream ledger, and `degraded` `/health` (telegraph-miner v1.1). Its
      first local run caught ESPN answering 403 to custom User-Agents, and
      that got fixed.
- [x] P1 `/.well-known/fourcast-miner.json` + Ed25519 attestation on every
      answer + `npm run verify` (reports each check separately, never a blanket
      tick). `verified: true` only when a TxLINE proof exists.
- [x] P2 attributed `reason` sentences ("X beat Y 24-16 (final)"), explicit
      `no_result`, no invented names or pre-game 0-0, and an ESPN free-finals
      fallback for `GAME_RESULT` / `SPORTS_SCORE`.
- [x] Deployed v1.1 to `nuncio-vultr` 2026-09-28 (commit `735808b`), with a
      persistent signing key (public
      `szo7NI2P1gmMW9iY0LGKLPN1EvVzNgHpm9RNKJWxS7M=`). Verified from outside:
      `npm run verify -- --team "Buffalo Bills"` passes attestation and
      consistency. `.env.agent` backup is `.env.agent.bak-*` on the VPS.
- [ ] **Renew the TxLINE token. Blocked on the wallet secret.** `/health`
      shows TxLINE answering 403 "API Token is invalid or expired". I checked
      on 2026-09-28 with a fresh guest JWT, so the API token itself is dead,
      not just the JWT. The subscription (4 weeks from ~Aug 13) has lapsed.
      Renewing needs a new on-chain `subscribe` tx signed by the subscribing
      wallet (`9k5PTr…`, holds 0.0179 SOL, enough for fees). Its
      `TXLINE_SOLANA_SECRET_KEY` is neither on the laptop nor on the VPS.
      Options: restore that key into `.env.local` and run
      `node scripts/txline-subscribe-and-activate.mjs`, or generate a new
      wallet (`scripts/txline-generate-wallet.mjs`), fund it with ~0.01 SOL,
      and subscribe from that. Then copy `TXLINE_API_TOKEN` into `.env.agent`
      and restart. Until then every answer is ESPN and carries no Merkle proof.
      **2026-09-28: new wallet generated** →
      `8eEsu1AtLkrR1SuzA5nAgXr1v8RZ6yERF6Rmy6eiUz7g` (mainnet). Its secret is
      at `nuncio-vultr:/home/linuxuser/.secrets/txline-wallet-2026-09.env`
      (dir 700, file 600, outside the repo) as
      `TXLINE_WALLET_2026_09_SECRET_KEY`. Nothing existing was overwritten.
      Waiting on ~0.02 SOL funding, then subscribe (free tier, service
      level 1). **Back this file up off-box**: losing the last wallet key is
      why we're here.
- [x] **Premier League coverage fixed without a new source.** ESPN's dated
      `eng.1` scoreboards return nothing, but each team's ESPN schedule has
      its whole season. The miner now resolves the team and reads its
      schedule after today's boards (commit `307e41e`). Live: "Who won the
      Arsenal game?" → "Brighton & Hove Albion beat Arsenal 3-0 (final)",
      which matches the schedule. football-data.org was the alternative, but
      it needs an API key (403 without one), so it wasn't worth adding.
- [ ] After a scored epoch, read `/api/asked` + `npm run survey` together:
      what the tournament asked, what we answered, what it scored.
- [ ] Decide intent targeting from live scores (consider
      `EVENT_OUTCOME_RESOLUTION`). Don't re-register into an unmeasured intent.
- [ ] P3 evaluator WASM decision: a `GAME_RESULT` attribution scorer. Build it,
      or write it up as a finding.
- [ ] P4 Track 3 app decision (paid-rail buyer on top of the decision core).
- [ ] P5 judge/agent packaging: `/openapi.json`, `/llms.txt`, a social card,
      a demo.
- [ ] P6 bug report drafted from measured findings.

---

### Telegraph Protocol Miner (Track 1: Miner) — 🔴 extended to Sep 2, 2026 11:59:59 UTC
- **What:** serve verified sports intelligence (live scores + final results with
  Solana Merkle proofs) to the Telegraph network. Judging: 75% normalized
  performance (accuracy vs ground truth), 25% X engagement.
- **Timeline (verified on the official page 2026-09-01):** Track 1 (Miner) and
  Track 2 (WASM) were extended past Aug 31 — submission closes **Wed, 02 Sep
  2026 11:59:59 UTC**. Track 3 (apps consume miners) is **coming soon**; the
  earlier Sep 1–7 window no longer applies.
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
  Sep 1 hardening before the extended deadline: fixed a crash in the
  graceful-degradation path (`new Date.now()` typo took the whole process down
  on any unsupported-intent query) and a PM2 v7 listen-gate bug (process
  "online" but never binding 8402); redeployed and re-verified health,
  graceful 200s, and live TxLINE queries.
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
- **🛑 Agent stopped 2026-08-25.** Competition window closed Aug 24; PM2
  `delphi-agent` (id 29) was stopped, deleted, and `pm2 save`d clear of the
  worker. Last live cycle 2026-08-25 09:07 UTC, 0 trades (LLM chain had degraded
  to all-ERR by then). Final state dir archived to
  `/home/linuxuser/fourcast/.delphi-agent-archive-2026-08-25.tar.gz` (56 KB,
  `status.json` + `runs.jsonl` + pm2 logs). To resume: `pm2 start
  deploy/delphi-agent.ecosystem.config.cjs && pm2 save`.
- **What it proved:** the Delphi agent loop, ESPN sports-odds routing, Kelly sizing,
  and policy gates all functioned end-to-end on-chain. Not in payout contention
  (leader +8,285 TST); credential is shipping a live competition agent with real
  TST on testnet. Delphi-specific code lives in `services/delphiService.js`,
  `services/delphiAgentLoop.js`, `services/delphiIntelligence.js`,
  `services/delphiDataFeeds.js`, and `deploy/delphi-agent.ecosystem.config.cjs`.
