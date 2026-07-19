# Fourcast — A flight recorder for autonomous capital

**Fourcast is an agent operating under a mandate — making constrained decisions from pre-match evidence, sealing each one into a hash-bound receipt, and reconciling against an independently verifiable on-chain outcome. The route is one unfolding system: Mandate Control → Proof Theatre → Diligence.**

> **Who this is for.** Prediction-market operators and the allocators assessing them. They need more than a claimed P&L: they need a pre-outcome record of evidence, risk limits, decisions, and results. Retail can audit; we do not optimize for them.
>
> **What it does.**
> 1. **Mandate Control** (`/agent`) — a live VPS worker operates under a versioned policy, decides from pre-match TxLINE evidence alone, and seals each decision into a SHA-256 receipt. The hero shows the current mandate, the proof timeline crossing from "outcome withheld" into "proof available," and the real on-chain Solana verdict.
> 2. **Proof Theatre** (`/world-cup`) — the final act of an autonomous decision: a vertical 6-stage evidence timeline (pre-match evidence → seeded simulation → versioned policy gates → immutable receipt → TxLINE Merkle proof + Solana validation → reconciliation) for any fixture.
> 3. **Allocator Diligence** (`/positions`) — policy adherence, receipt coverage, discipline rate, and calibration after resolution — computed from the same public receipts, not self-reported.
> 4. **On-chain parametric settlement** — a Solana program (`match-escrow`) CPI-calls TxLINE's `txoracle::validate_stat` to verify match outcomes and release locked SOL trustlessly. Verified end-to-end on devnet.

## Surface area

Fourcast's flagship route is one unfolding system — Mandate → Proof Theatre → Diligence — supported by Markets, Signals, and Labs:

- `/agent` — **Mandate Control**: the flagship hero. A live VPS worker's current decision, proof timeline, and on-chain verdict. The manual runner is demoted to an Operator Controls drawer.
- `/world-cup` — **Proof Theatre**: a vertical 6-stage evidence timeline for any fixture, from sealed pre-match evidence to Solana-anchored reconciliation. Cross-venue edge detection and on-chain settlement remain as fixture-card capabilities.
- `/positions` — **Allocator Diligence**: mandate adherence, receipt coverage, discipline rate, and calibration as the hero; positions/P&L demoted to a secondary section.

![Primary Customer](https://img.shields.io/badge/Primary%20Customer-Quant%20Operator-emerald)
![Acquisition](https://img.shields.io/badge/Acquisition-Signal%20Marketplace-emerald)
![TxLINE](https://img.shields.io/badge/TxLINE-Primary%20Data%20Source-emerald)
![Solana](https://img.shields.io/badge/Solana-Verified%20Receipts-purple)
![Status](https://img.shields.io/badge/Status-Live-success)

## Strategic Positioning

| | |
|---|---|
| **Primary customer** | Prediction-market operator plus the allocator who must diligence that operator |
| **Distribution** | Verifiable decision history → allocator trust → operator/allocator concierge conversion |
| **Headline product** | Mandate Control: a flight recorder for autonomous capital — policy-bound decision receipts, risk controls, and reconciled outcomes |
| **Technical highlight** | Custom Solana program CPI-calls TxLINE's `txoracle::validate_stat` for parametric insurance settlement; SHA-256 receipts reconciled against on-chain Merkle roots |
| **Data source** | TxLINE (primary) — fixtures, odds, scores, proofs. Polymarket as secondary comparison venue |

Fourcast implements the full **proof chain** end to end: TxLINE data ingestion → pre-match evidence → seeded simulation → versioned policy gates → decision receipt (SHA-256) → TxLINE Merkle proof → Solana PDA verification → reconciliation → on-chain settlement via `match-escrow` CPI calling `validate_stat`. Every step is deterministic and independently verifiable.

## The Problem

Sports applications rely on opaque feeds and trusted operators for settlement. Even when match data is "live," end users have no way to verify the score happened as reported. Prediction-market traders lack a trusted consensus reference to spot mispricing. And anyone who wants to settle a wager trustlessly needs an oracle — which reintroduces the trust problem.

## The Solution

Fourcast uses **TxLINE as its single primary data layer** and builds the flagship route on top:

1. **Mandate Control** — a headless VPS worker advances a replay clock, decides from pre-match TxLINE evidence, seals each decision into a SHA-256 receipt, withholds final proofs until the replay outcome time, and posts authenticated status to `/agent`. The hero eagerly fetches the canonical verification chain so the proof timeline shows real reconciliation + on-chain Solana verdict.
2. **Proof Theatre** — finalised matches surface a vertical 6-stage evidence timeline: pre-match evidence → seeded simulation → versioned policy gates → immutable receipt → TxLINE Merkle proof + Solana validation → reconciliation. `/api/worldcup/verify` walks the full chain in one call.
3. **Allocator Diligence** — mandate adherence, receipt coverage, discipline rate, and calibration computed from the same public receipts.
4. **Parametric on-chain settlement** — a custom Solana program (`match-escrow`, deployed on devnet at `AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ`) CPI-calls TxLINE's `txoracle::validate_stat` to verify match outcomes and release locked SOL trustlessly. Verified end-to-end: a 0.1 SOL policy on France–Sweden (Round of 32) was settled on-chain via CPI, no intermediary involved.

TxLINE is the exclusive data source for fixtures, odds, scores, and proofs. Polymarket serves as a secondary comparison venue for edge detection only.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       TXLINE DATA LAYER (devnet)                        │
│  fixtures/snapshot  ·  odds/snapshot  ·  scores/snapshot  ·  proofs     │
└───────────────────────────────┬─────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                  FOURCAST WORLD CUP INTELLIGENCE                         │
│  services/txline/txlineService.js                                        │
│  · normalises PascalCase schema -> unified fixture shape                │
│  · auto-refreshes guest JWT on 401                                       │
│  · falls back to cached replays after July 19 cutoff                    │
└───────┬──────────────────┬──────────────────┬───────────────────────────┘
        │                  │                  │
        ▼                  ▼                  ▼
┌──────────────┐  ┌──────────────────┐  ┌──────────────────────────┐
│ Live odds +  │  │ Cross-venue edge │  │ Verifiable receipt        │
│ score panel  │  │ (Polymarket YES) │  │ · Merkle proof integrity  │
│              │  │                  │  │ · PDA derivation & fetch  │
└──────────────┘  └──────────────────┘  │ · On-chain root compare   │
                                        └───────────┬──────────────┘
                                                     │
                        ┌────────────────────────────▼──────────────┐
                        │  Autonomous Historical Lab (VPS)           │
                        │  PM2 worker · replay clock · receipts      │
                        │  signed heartbeat → /api/agent/historical-lab │
                        └────────────────────────────┬──────────────┘
                                                     │
                                        ┌────────────▼──────────────┐
                                        │  Solana Match-Escrow      │
                                        │  CPI → txoracle           │
                                        │  validate_stat            │
                                        │  (settlePolicy flow)      │
                                        └───────────────────────────┘
```

### Tech Stack
- **Primary data**: TxLINE devnet (free World Cup tier, service level 1)
- **Settlement/verification**: Solana devnet, TxLINE `txoracle` program
- **Secondary enrichment**: Polymarket gamma API (cross-venue pricing), Kalshi (optional)
- **Frontend**: Next.js 16, React 19, Tailwind CSS
- **Runtime**: Node.js 20+, standard Next.js webpack build

---

## TxLINE Endpoints Used

| Endpoint | Purpose | Called by |
|----------|---------|------------|
| `POST /auth/guest/start` | Issue renewable guest JWT | `services/txline/txlineService.js`, `scripts/txline-subscribe-and-activate.mjs` |
| `POST /api/token/activate` | Activate API token after on-chain subscribe | `scripts/txline-subscribe-and-activate.mjs` |
| `GET /api/fixtures/snapshot?competitionId=72` | List World Cup fixtures | `getLiveFixtures()` |
| `GET /api/odds/snapshot/{fixtureId}` | Consensus odds snapshot | `getLiveOdds(fixtureId)` |
| `GET /api/scores/snapshot/{fixtureId}` | Score/event snapshot | `getLiveScores(fixtureId)` |
| `GET /api/scores/stat-validation?fixtureId=X&seq=Y&statKeys=1,2` | Merkle proof for stats | `getMerkleProof(fixtureId, seq)` |

All data requests send `Authorization: Bearer ${jwt}` and `X-Api-Token: ${apiToken}` per the [TxLINE Quickstart](https://txline.txodds.com/documentation/quickstart). The service auto-refreshes the guest JWT on 401 and retries once.

---

## Solana Program & Network

| Field | Value |
|-------|-------|
| Network | Devnet |
| TxORACLE Program ID | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` |
| Match-Escrow Program ID | `AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ` |
| TxL Token Mint | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` |
| TxORACLE version | `txoracle` (v1.5.6) |
| Free-tier service level | 1 (sampling interval = 0 — effectively real-time on devnet) |
| Settlement mechanism | CPI from match-escrow → `validate_stat` on txoracle |

The on-chain verification flow:
1. **Proof verification** — `solanaVerify.js` extracts the Merkle proof (`eventStatRoot`, `statProofs`, `mainTreeProof`, `subTreeProof`, `statsToProve`) from a cached fixture replay
2. **PDA derivation** — derives the `daily_scores_roots` PDA from the match timestamp using seeds `[b"daily_scores_roots", epoch_day as u16 LE]` (reverse-engineered from the txoracle program)
3. **On-chain comparison** — fetches the PDA account via Solana JSON-RPC, reads the 32-byte Merkle root, and compares against `eventStatRoot`
4. **Settlement (CPI)** — the match-escrow program (`settlementService.js`) builds and submits `settle_policy` transactions that CPI-call TxLINE's `validate_stat` to trustlessly release escrowed SOL to winners

Verdicts: `verified` (on-chain root matches), `onchain-mismatch` (root differs), `onchain-error` (PDA unreachable), `proof-present` (components valid but no timestamp for PDA derivation).

### Parametric Insurance / Prop Bet Settlement

The match-escrow program at `AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ` implements a parametric sports insurance flow:
- **`createPolicy`** — a user locks SOL in a policy PDA specifying `{fixtureId, minTs, paysRecipientOnHomeWin, amount}`
- **`settlePolicy`** — a keeper bot submits the TxLINE Merkle proof; the program CPI-calls txoracle's `validate_stat`, and if the condition is met, SOL is transferred to the designated recipient; otherwise refunded to the locker

The attestation won the `daily_scores_merkle_roots` seed pattern — it was not present in the published IDL at hackathon start but was obtained through program analysis. See `services/txline/settlementService.js` for the full Borsh-serialised instruction builders.

---

## Replay Mode and Autonomous Historical Lab

TxLINE hackathon access ends July 19, 2026 23:59 UTC. The adapter detects this automatically and switches to **cached replay mode**, serving deterministic snapshots of completed matches so the deployed demo keeps working for judges. The VPS worker runs those snapshots as an **Autonomous Historical Lab**: its replay clock creates a receipt from pre-match evidence first, withholds the final proof, and reconciles only when the simulated outcome time arrives. This preserves the decision-before-outcome ordering without claiming post-cutoff live coverage.

The lab is deliberately scoped as an operator process rather than another dashboard:

- It runs headlessly under PM2 on the VPS with no public port.
- It uses the same `services/domain/decision/` policy, simulation, and receipt hashing modules as the app.
- It posts a bearer-authenticated heartbeat to `POST /api/agent/historical-lab`; the app stores only the latest non-secret status in `historical_lab_status`.
- The Mandate Control hero (`/agent`) polls `GET /api/agent/historical-lab` and eagerly fetches `/api/worldcup/verify` for the latest receipt, rendering the current decision, proof timeline, and on-chain Solana verdict. The supporting HistoricalLabPanel below the hero shows the replay phase, agent clock, and receipt hash.

To snapshot a real fixture (with verifiable Merkle proof):

```bash
# After onboarding (TXLINE_API_TOKEN, TXLINE_GUEST_JWT in .env.local)
node scripts/txline-snapshot-fixture.mjs 18175981 991
```

This writes `cache/txline/replays/18175981.json` containing the fixture, score events, and the full Merkle proof from `/api/scores/stat-validation`. The `/world-cup` UI then surfaces this fixture as `final` with a "Verify on Solana" button.

The demo fixture (`18175981`, France 3-0) is a real World Cup match with a real, verifiable Merkle proof anchored on the TxLINE devnet program.

---

## Quick Start

### 1. Install

```bash
git clone https://github.com/thisyearnofear/fourcast.git
cd fourcast
npm install
```

### 2. TxLINE onboarding (free, ~2 minutes)

Generate a Solana keypair and run the on-chain subscribe + activate flow. Devnet SOL is required for transaction fees.

```bash
# Generate wallet (saves secret key to .env.local, chmod 600)
node scripts/txline-generate-wallet.mjs

# Fund the printed public address with devnet SOL (https://faucet.solana.com),
# then run subscribe + activate in one step:
node scripts/txline-subscribe-and-activate.mjs
```

The script:
1. Submits an on-chain `subscribe` transaction (service level 1, 4 weeks) to the TxLINE devnet program
2. Calls `POST /auth/guest/start` for a guest JWT
3. Signs `${txSig}::${jwt}` with the wallet keypair
4. Calls `POST /api/token/activate` to receive the API token
5. Saves `TXLINE_API_TOKEN`, `TXLINE_GUEST_JWT`, `TXLINE_LAST_TX_SIG` to `.env.local`
6. Smoke-tests `/api/fixtures` and prints the response shape

To renew the JWT later without re-subscribing:
```bash
node scripts/txline-subscribe-and-activate.mjs --reactivate-only
```

### 3. Run

```bash
npm run dev
```

Open `http://localhost:3000/world-cup` — TxLINE is now the primary source for fixtures, consensus odds, and verifiable receipts.

### 4. Build & deploy

```bash
npm run build
```

The `/world-cup` route is statically prerendered; the API routes under `/api/worldcup/*` are server-rendered on demand. Deploy to Vercel as usual — env vars (`TXLINE_API_TOKEN`, `TXLINE_GUEST_JWT`, `TXLINE_API_ORIGIN`) propagate via the Vercel dashboard.

---

## Project Layout

```
services/txline/
  txlineService.js        # Adapter: live + replay modes, auto JWT refresh
  solanaVerify.js        # On-chain Merkle proof verification (PDA derivation + root comparison)
  settlementService.js   # On-chain settlement: createPolicy + settlePolicy (CPI → validate_stat)
  crossVenueEdge.js      # TxLINE consensus vs Polymarket YES prices
  reconciliationService.js # Receipt/proof reconciliation state machine
  receiptAdapter.js      # Canonical decision receipt -> TxLINE reconciliation view

services/domain/decision/
  decisionPolicy.js      # Five-gate mandate policy
  decisionReceipt.js     # Canonical receipt/hash/verify helpers
  simulation.js          # Deterministic Monte Carlo and seed derivation
  historicalLab.js       # Replay-clock phase and no-lookahead checks

scripts/
  txline-generate-wallet.mjs            # Generate Solana keypair
  txline-subscribe-and-activate.mjs     # On-chain subscribe + activate
  txline-snapshot-fixture.mjs            # Snapshot a fixture's proof to cache
  fourcast-agent-worker.mjs              # Headless autonomous worker

app/api/worldcup/
  fixtures/route.js              # GET /api/worldcup/fixtures
  fixtures/[fixtureId]/route.js # GET /api/worldcup/fixtures/{id}
  replay/route.js                # GET /api/worldcup/replay?fixtureId=X
  edge/route.js                  # GET /api/worldcup/edge?fixtureId=X
  verify/route.js                # GET /api/worldcup/verify?fixtureId=X
  status/route.js                # GET /api/worldcup/status

app/api/agent/
  historical-lab/route.js        # GET/POST latest signed VPS worker heartbeat
  runs/route.js                  # GET persisted decision ledger

app/world-cup/
  page.js               # Server entry, metadata
  WorldCupClient.js     # Client UI: cards, replay viewer, verify panel, edge panel

components/
  MandateControl.js       # /agent flagship hero — live worker state, proof timeline, dossier trigger
  DecisionDossier.js      # Right-side drawer — 5 allocator questions from canonical receipt
  ProofTheatre.js         # /world-cup vertical 6-stage evidence timeline
  HistoricalLabPanel.js  # /agent VPS telemetry panel (supporting surface below hero)
  AgentDashboard.js       # Manual runner (demoted to Operator Controls drawer)
  AgentRunLedger.js       # Persisted decision ledger
  MandatePanel.js         # /positions allocator diligence hero

cache/txline/replays/    # Cached fixture snapshots for replay mode

idl/txline/
  txoracle.mainnet.json  # Mainnet IDL (program 9ExbZjAapQ...)
  txoracle.devnet.json   # Devnet IDL (program 6pW64gN1s...)
```

---

## Secondary Enrichment (pre-TxLINE integrations)

Fourcast was originally built on Bright Data + Polymarket/Kalshi aggregation. Those integrations remain and are surfaced as secondary enrichment around the TxLINE-primary World Cup experience:

- **Bright Data** (SERP API, Scraping Browser, Web Unlocker) — web intelligence for the broader `/markets` discovery flow
- **Polymarket CLOB + gamma API** — used by `/api/worldcup/edge` to compute cross-venue discrepancies against TxLINE consensus
- **Kalshi API** — secondary sports markets (optional in the World Cup view)
- **Venice AI** — LLM for evidence synthesis in the broader agent loop

The `/markets` and `/signals` routes continue to provide the original Bright Data-powered experience as supporting capability. The flagship route — Mandate (`/agent`) → Proof Theatre (`/world-cup`) → Diligence (`/positions`) — is the TxLINE-primary surface.

---

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /api/worldcup/fixtures` | World Cup fixtures (live or cached replay) |
| `GET /api/worldcup/fixtures/{id}` | Single fixture with odds + scores merged |
| `GET /api/worldcup/replay?fixtureId=X` | Cached event timeline for replay viewer |
| `GET /api/worldcup/edge?fixtureId=X` | TxLINE vs Polymarket cross-venue edge |
| `GET /api/worldcup/verify?fixtureId=X` | Solana verification result for cached proof |
| `GET /api/worldcup/status` | Adapter mode (live vs replay), cutoff, replay count |
| `GET /api/agent/historical-lab` | Latest VPS historical lab heartbeat for `/agent` |
| `POST /api/agent/historical-lab` | Authenticated worker heartbeat receiver |

---

## Demo Video Outline (≈ 4 minutes)

1. **0:00–0:30 — Problem.** Agent-managed prediction-market capital lacks an audit layer; claimed P&L does not prove mandate discipline.
2. **0:30–1:30 — Mandate Control.** Open `/agent`; show the live VPS worker, current mandate decision, proof timeline crossing from "outcome withheld" to "proof available," and on-chain Solana verdict in the telemetry strip.
3. **1:30–2:45 — Decision dossier.** Click "Inspect decision dossier"; walk the 5 allocator questions: what it knew, what it decided, what prevented overreaching, when the result was unavailable, what later verified it. Show the raw receipt JSON.
4. **2:45–3:30 — Proof Theatre.** Open `/world-cup`; click "Open proof theatre" on a final fixture; walk the vertical 6-stage evidence timeline from pre-match evidence to Solana-anchored reconciliation.
5. **3:30–4:00 — Allocator Diligence.** Open `/positions`; show mandate adherence, discipline rate, and calibration — computed from the same public receipts.
6. **4:00–4:10 — Close.** The route is one system: Mandate → Proof Theatre → Diligence. Verify without trust.

See `docs/DEMO_SCRIPT_PROOF.md` for the full judge-path script with fallbacks and pre-demo checklist.

---

## TxLINE Integration Feedback

**What worked well:**
- The normalised JSON schema across competitions is genuinely pleasant to consume — one normaliser handles fixtures, odds, and scores with no per-league special-casing.
- The free World Cup tier activates cleanly once the on-chain `subscribe` tx confirms; no payment, no KYC.
- Historical replay via `/scores/snapshot/{fixtureId}` returns the full event stream as an ordered array, which makes building a deterministic replay UI trivial.
- The `stat-validation` endpoint returns a complete Merkle proof bundle (`eventStatRoot`, `statProofs`, `mainTreeProof`, `subTreeProof`, `statsToProve`) in a single call — no client-side tree walking required.

**Where we hit friction:**
- The onboarding flow has six steps (wallet, SOL, on-chain subscribe, guest JWT, sign message, activate) — a one-shot CLI helper would reduce setup time from ~15 minutes to ~30 seconds.
- The published IDL does not include the seed pattern for the `daily_scores_merkle_roots` PDA. We reverse-engineered it from the deployed program — `[b"daily_scores_roots", epoch_day as u16 LE]` — but this should be documented upstream.
- Team display names appear in `/fixtures/snapshot` but not in `/scores/snapshot/{fixtureId}` — score records only carry `Participant1Id` / `Participant2Id`. We had to cross-reference against the fixtures list (and older fixtures fall off the list, leaving team names unresolvable).
- The free devnet tier depends on the public Solana devnet RPC for SOL, which is heavily rate-limited. A bundled devnet SOL faucet (or a one-line `requestAirdrop` helper in the SDK) would smooth the very first step.

---

## License

MIT
