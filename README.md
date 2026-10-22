# Fourcast — Autonomous Prediction-Market Operator

Fourcast is a venue-agnostic autonomous agent for prediction markets. It discovers edge, sizes positions under a policy-bound mandate, executes across multiple venues, and produces verifiable decision receipts that prove mandate adherence — before the outcome is known.

> **One agent core. Multiple execution venues. Verifiable decisions.**

Forecasting runs on TxLINE odds, deterministic Monte Carlo, and the configured
LLM router.

## The Wedge

Every AI trading agent claims performance. None prove discipline. Fourcast produces a cryptographic decision receipt before each outcome resolves, then reconciles it against independently verifiable data. Operators get an auditable track record; allocators get mandate assurance without trusting a black box.

## Calibration

**Sized on calibrated confidence, not vibes.**

Every forecast is scored with a Brier point and grouped into HIGH / MEDIUM / LOW confidence buckets. The calibration curve on `/arena` shows whether the agent's stated confidence actually predicts outcomes — a well-calibrated agent's dots fall near the y=x diagonal. Systematic deviations flag over- or under-confidence before they compound into losses.

Read the full methodology → [docs/CALIBRATION.md](docs/CALIBRATION.md)

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     AGENT CORE                          │
│                                                         │
│  Decision Policy (5-gate mandate)                       │
│  Kelly Sizing · Monte Carlo Simulation                  │
│  Pre-outcome Receipt (SHA-256 commitment)               │
│  Reconciliation Engine                                  │
└──────────────────────┬──────────────────────────────────┘
                       │
       ┌───────────────┼───────────────────┐
       │               │                   │
┌──────▼──────┐  ┌─────▼──────┐  ┌────────▼────────┐
│ Polymarket  │  │   Delphi   │  │  Canton Network │
│ Kalshi      │  │   (LMSR)   │  │  (private size) │
│ CLOB exec   │  │   SDK exec │  │  CBTC settle    │
└─────────────┘  └────────────┘  └─────────────────┘
       │               │
┌──────▼───────────────▼──────────────────────────────────┐
│                 INTELLIGENCE LAYER                       │
│                                                         │
│  TxLINE/TxOdds         Venice AI        Bright Data     │
│  Professional odds     LLM reasoning    Web scrape      │
│  Merkle proofs         Forecasting      SERP + social   │
│  MLS + PL (live)                                        │
└─────────────────────────────────────────────────────────┘
```

## What's Live

*Status as of **2026-10-21**, read from the running services — not aspirational.*

| Surface | URL | Status |
|---------|-----|--------|
| Markets (Polymarket + Kalshi aggregation) | `/markets` | Live |
| Arena — proof surface: calibration curve, decision receipts, memory ladder | `/arena` | Live |
| Mandate cockpit (policy, dry-run, run ledger) | `/arena?lane=mandate` | Live — `/agent` redirects here |
| Positions & track record | `/positions` | Live |
| Signals (publish + follow) + paid rail | `/signals` | Live |
| Decision receipts (Solana, independently verifiable) | `/proof` | Live |
| Provider health | `/status` | Live |
| **Telegraph sports miner** (Season II) | `miner.sportwarren.com` | **Live and scoring** — node active, last scored epoch 430 (2026-10-21); 5/14 on `GAME_RESULT` |
| Walrus memory on Sui (Total Recall) | `/arena` memory lane | **In progress** — layer built and tested; ≥10 mainnet writes pending |
| Autonomous VPS worker | headless (PM2) | **Paused by design** (`ARENA_LANE_MODE=paused`) — receipts, ledger and audit trail intact |
| TxLINE MLS / PL odds | credential-gated, replay fallback | **Free tier expires 2026-10-26 — not yet resubscribed.** ESPN fallback covers live scores and recent finals |
| Delphi competition agent | competition completed; worker stopped | Aug 10–24, 2026 |
| Canton private settlement | DevNet-proven CIP-56/BitSafe CBTC prototype; operator-attested by default | Independent attester + mainnet pending |

**Production:** [fourcastapp.vercel.app](https://fourcastapp.vercel.app)

## Execution Venues

### Polymarket & Kalshi (Implemented — execution paused with the agent lane)
The original execution layer. Polymarket CLOB orders via Builder Program (earn USDC per attributed fill). Kalshi as secondary venue. The agent discovers markets, filters by volume/time/category, forecasts, detects edge, and executes autonomously. The code is live and exercised in dry-run; the worker itself is paused, so no new orders are being placed.

### Delphi / Gensyn (Finished — competition Aug 10–24, 2026)
LMSR-based prediction markets on Gensyn Testnet. The same agent core (policy, sizing, forecasting) routes through the Delphi SDK for market discovery, quoting, and execution. TxLINE odds provide intelligence edge on sports markets that other competitors lack.

### Canton Network (DevNet prototype)
Private settlement for operators who need position size hidden from the market. CIP-56 atomic CBTC escrow is implemented and proven on DevNet. Activates when counterparty network or mainnet makes it practical. Code is functional — not the hero, but available.

## Intelligence Layer

### TxLINE / TxOdds (Primary Sports Intelligence)
Professional bookmaker consensus odds, live scores, and cryptographically verifiable Merkle proofs.

- **Connection**: live — the miner reports `connected: true` with a valid token and JWT, and its cached snapshot holds **110,316 fixtures** (read 2026-10-21). The earlier "290 PL fixtures" figure was a single-day check on 2026-08-18, not the feed size.
- **Subscription**: free tier, service level 1, renewed 2026-09-28. **It expires ~2026-10-26 and has not been renewed.** Until it is, `SPORTS_SCORE`/`GAME_RESULT` fall back to ESPN's public scoreboards — signed, but *not* independently verifiable.
- **Merkle proofs**: On-chain verification via Solana `txoracle` CPI — independently verifiable outcomes. `verified: true` is only ever set when a real proof is published.
- **Renewal watch**: the miner's `/health` reports `txline_renewal: null` — the watchdog is not currently tracking the expiry, so nothing will warn us. Treat 2026-10-26 as a hard date, not an alert.

TxLINE provides the sharpest odds data available to any retail or agent participant. This is a concrete intelligence edge: the agent can compare professional consensus pricing against prediction-market prices to find mispricing.

### Venice AI (LLM reasoning)
LLM-based reasoning for non-sports markets (politics, economics, crypto, technology). Deterministic Monte Carlo simulation with persisted seeds for reproducible forecasting.

### Bright Data (Optional Enrichment)
Web intelligence via SERP API, Scraping Browser, and Web Unlocker. Supplements the core intelligence layer when credits are available. Analysis works without it.

## Agent Core

The decision engine is venue-agnostic. It operates identically whether executing on Polymarket, Delphi, or any future venue:

1. **Discover** — scan available markets across connected venues
2. **Forecast** — combine odds intelligence (TxLINE), LLM reasoning (Venice), and web data (Bright Data)
3. **Detect Edge** — fair value vs market price, minimum threshold gate
4. **Size** — Kelly criterion with allocation cap, tail-loss limit, **and calibration-aware shrinkage** when bucket hit-rates are available
5. **Decide** — five-gate policy: min edge, allocation cap, tail-loss probability, simulation validation, mandate bounds
6. **Execute** — route to the appropriate venue SDK
7. **Receipt** — SHA-256 commitment of the full decision payload, timestamped before outcome
8. **Reconcile** — match receipt against independently verified outcome data

### Decision Policy (5 Gates)

Every decision passes through a versioned policy before execution:

| Gate | Function |
|------|----------|
| Minimum Edge | Reject if edge < configured threshold |
| Allocation Cap | Reject if position would exceed % of bankroll |
| Tail-Loss Limit | Reject if P(loss) exceeds tolerance |
| Simulation Validation | Reject if Monte Carlo doesn't confirm edge |
| Mandate Bounds | Reject if outside operator-defined constraints |

The policy is the same object used by the UI (dry-run), the VPS worker (live), and the agent loop. One truth, multiple surfaces.

### Verifiable Receipts

The pre-outcome receipt contains: evidence snapshot, simulation seed + result, policy version, gate verdicts, sizing, and the final ALLOCATE/PASS decision. The SHA-256 hash of this payload is committed before the outcome resolves. Reconciliation later proves the agent followed its mandate.

## Autonomous Operator

The VPS worker (`scripts/fourcast-agent-worker.mjs`) runs headlessly under PM2:

- Discovers markets on configured venues
- Evaluates the canonical decision policy
- Emits pre-outcome receipts
- Posts authenticated heartbeat to `/api/agent/historical-lab`
- Dry-run by default; live execution requires explicit opt-in

**It is currently paused** (`ARENA_LANE_MODE=paused`, since 2026-09-29). The receipts, the ledger and the calibration history are intact and readable; nothing new is being traded. The live product today is the miner plus the proof surfaces — see [docs/HACKATHONS.md](docs/HACKATHONS.md) for why.

## Quick Start

```bash
git clone https://github.com/thisyearnofear/fourcast.git
cd fourcast
npm install
cp .env.local.example .env.local
# Configure venue credentials (see .env.local.example)
npm run dev
```

### TxLINE Onboarding (Sports Intelligence)

```bash
node scripts/txline-generate-wallet.mjs
# Fund with devnet SOL, then:
node scripts/txline-subscribe-and-activate.mjs
```

### Delphi Agent (Competition)

```bash
# Configure .env.local per docs/archive/DELPHI_AGENT.md, then:
npm run delphi:dry   # one simulated cycle — safe
npm run delphi:live  # continuous; respects DELPHI_AGENT_DRY_RUN
```

See [docs/archive/DELPHI_AGENT.md](./docs/archive/DELPHI_AGENT.md) for the full operator guide.

## Project Layout

```
services/
  aiAgentLoop.js              # Core autonomous loop (discover → forecast → size → execute)
  domain/decision/
    decisionPolicy.js         # Five-gate mandate policy (versioned)
    decisionReceipt.js        # Canonical receipt + hash + verify
    simulation.js             # Deterministic Monte Carlo
    historicalLab.js          # Replay-clock phase logic
  txline/
    txlineService.js          # TxLINE/TxOdds adapter (live + replay)
    solanaVerify.js           # On-chain Merkle proof verification
    settlementService.js      # Solana match-escrow CPI settlement
    crossVenueEdge.js         # TxLINE consensus vs venue prices
    reconciliationService.js  # Receipt/proof reconciliation
  delphiService.js            # Delphi SDK wrapper (markets, quotes, execution, redemption)
  delphiAgentLoop.js          # Competition loop (balances → forecast → policy → execute)
  delphiIntelligence.js       # Classification + TxLINE/Venice probability routing
  cantonLedgerClient.js       # Canton DevNet CIP-56 settlement

app/api/
  agent/                      # Agent mandate, runs, scheduling, track record
  analyze/                    # Market analysis + streaming
  canton/                     # Canton health, balances, markets, positions
  worldcup/                   # TxLINE fixtures, verification, settlement

scripts/
  fourcast-agent-worker.mjs   # Headless autonomous VPS worker
  delphi-agent-worker.mjs     # Delphi competition worker (--once, --dry-run)
  txline-*.mjs                # TxLINE onboarding + snapshot tools

deploy/
  delphi-agent.ecosystem.config.cjs  # PM2 config for the Delphi worker

constants/
  brand.js                    # Product positioning (single source of truth)
```

## Documentation

**Full index: [docs/INDEX.md](docs/INDEX.md)** — every document, what it is for,
and whether it is live. The short list:

| Document | Purpose |
|----------|---------|
| [STRATEGY.md](STRATEGY.md) | Multi-venue roadmap, timeline, and the Decision Log |
| [docs/EXECUTION_PLAN.md](docs/EXECUTION_PLAN.md) | The canonical plan: owners, gates, dates, status board |
| [docs/HACKATHONS.md](docs/HACKATHONS.md) | Every hackathon and competition, active and past |
| [docs/TOTAL_RECALL_HACKATHON.md](docs/TOTAL_RECALL_HACKATHON.md) | The live entry: the brief, the track, the deliverables |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | How the system fits together |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | Every API route |
| [docs/CALIBRATION.md](docs/CALIBRATION.md) | Brier scoring, confidence buckets, the calibration curve |
| [docs/WALRUS_MEMORY.md](docs/WALRUS_MEMORY.md) | The memory layer: namespaces, the ladder, precedence |
| [docs/SUI.md](docs/SUI.md) | Tatum Sui JSON-RPC reads + x402 self-settled payments |
| [docs/SURFACES.md](docs/SURFACES.md) | Surface registry (one row per route) + the design contract |
| [docs/CANTON.md](docs/CANTON.md) | Canton v2 atomic settlement, the BitSafe gate, the runbook |
| [docs/TXLINE_INTEGRATION.md](docs/TXLINE_INTEGRATION.md) | Bookmaker odds, Merkle proofs, cross-venue edge |
| [docs/SETUP.md](docs/SETUP.md) | Install, env, wallets, deployment |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | The demo, word for word |

## Tech Stack

- **Runtime:** Node.js 24+, Next.js 16, React 19
- **Execution:** Polymarket CLOB, Delphi SDK (LMSR), Canton DApp SDK
- **Chain:** EVM (wagmi/viem/ethers), Solana (Anchor), Gensyn Testnet
- **Intelligence:** TxLINE/TxOdds, Venice AI, Bright Data
- **Infra:** Vercel (web), VPS + PM2 (agent worker), Redis/Upstash, Turso DB

## License

MIT
