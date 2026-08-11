# Fourcast — Autonomous Prediction-Market Operator

Fourcast is a venue-agnostic autonomous agent for prediction markets. It discovers edge, sizes positions under a policy-bound mandate, executes across multiple venues, and produces verifiable decision receipts that prove mandate adherence — before the outcome is known.

> **One agent core. Multiple execution venues. Verifiable decisions.**

## The Wedge

Every AI trading agent claims performance. None prove discipline. Fourcast produces a cryptographic decision receipt before each outcome resolves, then reconciles it against independently verifiable data. Operators get an auditable track record; allocators get mandate assurance without trusting a black box.

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
│  MLS (live) · PL (Aug 21)              SynthData ML     │
└─────────────────────────────────────────────────────────┘
```

## What's Live

| Surface | URL | Status |
|---------|-----|--------|
| Markets (Polymarket + Kalshi aggregation) | `/markets` | Live |
| Agent Mandate (policy cockpit, dry-run, run ledger) | `/agent` | Live |
| Positions & Track Record | `/positions` | Live |
| Signals (publish + follow) | `/signals` | Live |
| Autonomous VPS Worker | Headless (PM2) | Live |
| Delphi Competition Agent | Dry-run verified, ready for live | Aug 10–24 |
| TxLINE MLS Odds | Integration in progress | Live at 50% |
| TxLINE Premier League | Preparing | Full coverage Aug 21 |
| Canton Private Settlement | Functional on DevNet | Roadmap |

**Production:** [fourcastapp.vercel.app](https://fourcastapp.vercel.app)

## Execution Venues

### Polymarket & Kalshi (Live)
The original execution layer. Polymarket CLOB orders via Builder Program (earn USDC per attributed fill). Kalshi as secondary venue. The agent discovers markets, filters by volume/time/category, forecasts, detects edge, and executes autonomously.

### Delphi / Gensyn (Active — Competition Aug 10–24)
LMSR-based prediction markets on Gensyn Testnet. The same agent core (policy, sizing, forecasting) routes through the Delphi SDK for market discovery, quoting, and execution. TxLINE odds provide intelligence edge on sports markets that other competitors lack.

### Canton Network (Roadmap)
Private settlement for operators who need position size hidden from the market. CIP-56 atomic CBTC escrow is implemented and proven on DevNet. Activates when counterparty network or mainnet makes it practical. Code is functional — not the hero, but available.

## Intelligence Layer

### TxLINE / TxOdds (Primary Sports Intelligence)
Professional bookmaker consensus odds, live scores, and cryptographically verifiable Merkle proofs.

- **MLS**: Live now at 50% coverage
- **Premier League**: Full coverage from August 21, 2025
- **Merkle proofs**: On-chain verification via Solana `txoracle` CPI — independently verifiable outcomes
- **Free data access** continues into the season

TxLINE provides the sharpest odds data available to any retail or agent participant. This is a concrete intelligence edge: the agent can compare professional consensus pricing against prediction-market prices to find mispricing.

### Venice AI + SynthData ML
LLM-based reasoning for non-sports markets (politics, economics, crypto, technology). Deterministic Monte Carlo simulation with persisted seeds for reproducible forecasting.

### Bright Data (Optional Enrichment)
Web intelligence via SERP API, Scraping Browser, and Web Unlocker. Supplements the core intelligence layer when credits are available. Analysis works without it.

## Agent Core

The decision engine is venue-agnostic. It operates identically whether executing on Polymarket, Delphi, or any future venue:

1. **Discover** — scan available markets across connected venues
2. **Forecast** — combine odds intelligence (TxLINE), LLM reasoning (Venice), ML models (SynthData), and web data (Bright Data)
3. **Detect Edge** — fair value vs market price, minimum threshold gate
4. **Size** — Kelly criterion with allocation cap and tail-loss limit
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

See [OPS.md](OPS.md) for deployment details.

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
# Configure .env.local per docs/DELPHI_AGENT.md, then:
npm run delphi:dry   # one simulated cycle — safe
npm run delphi:live  # continuous; respects DELPHI_AGENT_DRY_RUN
```

See [docs/DELPHI_AGENT.md](docs/DELPHI_AGENT.md) for the full operator guide.

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

| Document | Purpose |
|----------|---------|
| [STRATEGY.md](STRATEGY.md) | Multi-venue roadmap, timeline, and competition plan |
| [OPS.md](OPS.md) | VPS autonomous worker deployment |
| [docs/CANTON_ATOMIC_SETTLEMENT.md](docs/CANTON_ATOMIC_SETTLEMENT.md) | Canton CIP-56 contract model |
| [docs/DELPHI_AGENT.md](docs/DELPHI_AGENT.md) | Delphi Agent Arena operator guide |
| [docs/TXLINE_INTEGRATION.md](docs/TXLINE_INTEGRATION.md) | TxLINE/Solana proof chain (hackathon reference) |
| [docs/DEMO_SCRIPT.md](docs/DEMO_SCRIPT.md) | Product demo walkthrough |

## Tech Stack

- **Runtime:** Node.js 20+, Next.js 16, React 19
- **Execution:** Polymarket CLOB, Delphi SDK (LMSR), Canton DApp SDK
- **Chain:** EVM (wagmi/viem/ethers), Solana (Anchor), Gensyn Testnet
- **Intelligence:** TxLINE/TxOdds, Venice AI, Bright Data, SynthData
- **Infra:** Vercel (web), VPS + PM2 (agent worker), Redis/Upstash, Turso DB

## License

MIT
