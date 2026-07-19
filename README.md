# Fourcast — Verification and reputation for agent-managed prediction-market capital

**Fourcast records what an agent knew, which policy constrained it, and why it allocated or passed—so operators and capital allocators can audit performance without trusting a black box.**

> **Who this is for.** Prediction-market operators and the allocators assessing them. They need more than a claimed P&L: they need a pre-outcome record of evidence, risk limits, decisions, and results. Retail can audit; we do not optimize for them.
>
> **How we acquire them.** Public, inspectable decision histories. A strong operator's verified mandate adherence and resolved outcomes become the proof that earns the next allocator conversation.
>
> **Headline loop.** Evidence → policy-bound simulation and risk checks → allocate / pass / review → decision receipt → execution and outcome reconciliation → verified reputation.

## Surface area

Fourcast has two product surfaces; both are quantized around the same operator:

- `/world-cup` — the **TxLINE-powered World Cup intelligence terminal**: live consensus odds, score replay, cross-venue edge detection, and Solana-verified match receipts.

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
| **Headline product** | Verification and reputation layer: policy-bound decision receipts, risk controls, and reconciled outcomes |
| **Second-best customer** | Signal Analyst (Reputation Climber) |
| **Commercial wedge** | Auditable mandates and track records for agent-managed capital—not a generic retail alpha feed |

The current product now implements **Proof of Decision** end to end: deterministic simulation inputs, versioned policy checks, receipt hashing, optional on-chain commitment, and proof-backed reconciliation. `/agent` records the receipts, `/positions` reports mandate adherence, and `/world-cup` demonstrates TxLINE/Solana outcome proof against a receipt-bound fixture.

## The Problem

Sports applications rely on opaque feeds and trusted operators for settlement. Even when match data is "live," end users have no way to verify that the score they see is the score that actually happened — and no way to compare trusted consensus against peer-to-peer market pricing in a single view.

## The Solution

Fourcast uses **TxLINE as its primary sports data layer** and adds the agent-verification layer on top:

1. **Consensus intelligence** — normalized World Cup fixtures, live consensus odds, score/event timelines
2. **Policy-bound decision receipts** — deterministic simulation, five risk gates, allocation/pass/review verdicts, and canonical SHA-256 hashes
3. **Proof-backed reconciliation** — finalised matches surface TxLINE Merkle proofs, Solana root verification, and receipt-vs-outcome reconciliation

Polymarket and Kalshi remain as secondary comparison venues. TxLINE is the source of truth for fixtures, scores, and outcomes.

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

## Replay Mode (post-July 19 cutoff)

TxLINE hackathon access ends July 19, 2026 23:59 UTC. The adapter detects this automatically and switches to **cached replay mode**, serving deterministic snapshots of completed matches so the deployed demo keeps working for judges. The VPS worker runs those snapshots as an **Autonomous Historical Lab**: its replay clock creates a receipt from pre-match evidence first, withholds the final proof, and reconciles only when the simulated outcome time arrives. This preserves the decision-before-outcome ordering without claiming post-cutoff live coverage.

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

scripts/
  txline-generate-wallet.mjs            # Generate Solana keypair
  txline-subscribe-and-activate.mjs     # On-chain subscribe + activate
  txline-snapshot-fixture.mjs            # Snapshot a fixture's proof to cache

app/api/worldcup/
  fixtures/route.js              # GET /api/worldcup/fixtures
  fixtures/[fixtureId]/route.js # GET /api/worldcup/fixtures/{id}
  replay/route.js                # GET /api/worldcup/replay?fixtureId=X
  edge/route.js                  # GET /api/worldcup/edge?fixtureId=X
  verify/route.js                # GET /api/worldcup/verify?fixtureId=X
  status/route.js                # GET /api/worldcup/status

app/world-cup/
  page.js               # Server entry, metadata
  WorldCupClient.js     # Client UI: cards, replay viewer, verify panel, edge panel

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

The `/markets` route and `/agent` route continue to provide the original Bright Data-powered experience. The `/world-cup` route is the TxLINE-primary surface.

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

---

## Demo Video Outline (≈ 4 minutes)

1. **0:00–0:25 — Problem.** Sports apps depend on opaque feeds; users can't verify outcomes.
2. **0:25–0:55 — Product overview.** Show `/world-cup` populated from TxLINE fixtures and consensus odds.
3. **0:55–1:45 — Cross-venue edge.** Pick a fixture, click "Edge vs Polymarket," show the discrepancy callout.
4. **1:45–2:35 — Historical replay.** Replay the France 3-0 fixture, show score/event updates and probability movement.
5. **2:35–3:25 — Verification.** Click "Verify on Solana," show the Merkle root, proof components, and verdict.
6. **3:25–3:50 — Architecture.** TxLINE is primary; Fourcast adds interpretation and transparent verification UX.
7. **3:50–4:10 — Feedback.** Praise the normalised schema and replay/verification support; surface onboarding friction honestly.

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
