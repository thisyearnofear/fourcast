# Fourcast Strategy

## Core Thesis

Prediction markets are growing fast. Autonomous agents will trade them. The missing layer is **verifiable mandate adherence** — proving an agent followed its policy before anyone knows the outcome.

Fourcast is the operator layer: one agent core executing across multiple venues, with cryptographic decision receipts that make discipline provable and track records auditable.

The wedge is not a single venue or a single chain. It's the agent + policy + receipt system that sits above all of them.

---

## The Constant: Agent Core

Everything else is additive. The core never changes:

| Component | What It Does | Why It Matters |
|-----------|-------------|----------------|
| Decision Policy | Five-gate mandate (edge, allocation, tail-loss, simulation, bounds) | Operators define risk tolerance; the agent obeys |
| Kelly Sizing | Optimal position sizing given edge and bankroll | No oversized bets, no ruin |
| Monte Carlo Simulation | Deterministic with persisted seed | Reproducible forecasts, auditable logic |
| Pre-outcome Receipt | SHA-256 hash of full decision payload | Proves what the agent knew and decided before resolution |
| Reconciliation | Match receipt against verified outcome | Closes the loop — mandate adherence is fact, not claim |

This core is venue-agnostic. It doesn't care whether it's buying YES on Polymarket, shares on Delphi, or escrowing CBTC on Canton. It produces the same auditable decision artifact regardless of where the trade lands.

---

## Additive Layers

### Execution Venues

Each venue is a plugin. The agent core routes decisions to whichever venue offers the best execution for a given market.

| Venue | Market Type | Status | Notes |
|-------|------------|--------|-------|
| **Polymarket** | CLOB (binary/multi) | Live | Builder Program attribution, USDC settlement |
| **Kalshi** | Exchange (regulated) | Live | US-regulated markets, complementary coverage |
| **Delphi** | LMSR (multi-outcome) | Active | Gensyn Testnet, competition Aug 10–24 |
| **Canton** | Private settlement | Roadmap | CIP-56 escrow, CBTC — for when size must stay hidden |

Adding a venue means implementing: discover markets, get quote, execute trade, track position, redeem settled. The decision logic stays identical.

### Intelligence Sources

Each source strengthens the agent's forecast without coupling to a specific venue.

| Source | What It Provides | Status | Edge |
|--------|-----------------|--------|------|
| **TxLINE / TxOdds** | Professional bookmaker consensus odds, Merkle proofs | Live (MLS 50%, PL Aug 21) | Sharpest odds available — most participants don't have this |
| **Venice AI** | LLM reasoning, evidence synthesis | Live | Handles politics, economics, crypto, tech, current events |
| **SynthData** | ML forecasting models | Live | Quantitative probability estimates |
| **Bright Data** | SERP, web scrape, social | Optional | Supplementary web intelligence when available |

The intelligence layer is the agent's information advantage. TxLINE odds in particular represent alpha that most retail participants and competing agents cannot access — professional-grade consensus pricing from the sharpest books in the world.

---

## Timeline & Priorities

### Now — August 10 (Today)

**Delphi Agent Arena begins.**

- [x] Install Delphi SDK v2.1.0
- [x] Configure `.env.local` for `competition-testnet`
- [x] Register wallet on DoraHacks
- [x] Get funded (1000 TST + testnet ETH for gas) — confirmed on-chain Aug 11
- [x] Wire agent core → Delphi SDK (market discovery, quoting, execution)
- [x] Deploy competition agent loop — dry-run verified Aug 11 (9 markets scanned, policy held)

Remaining before live: flip `DELPHI_AGENT_DRY_RUN=false` and run under PM2 (see `docs/DELPHI_AGENT.md`).

**Intelligence for Delphi:**
- TxLINE odds as input signal for any sports-related Delphi markets
- Venice AI for politics/economics/crypto/tech markets
- Same Kelly sizing and policy gates — no new risk logic needed

### August 10–24: Competition Trading Window

- Agent trades autonomously on official competition markets
- Monitor P&L on public leaderboard
- Tune strategy: adjust edge thresholds, rebalance across market categories
- Redeem settled positions to free capital for redeployment
- Track which intelligence sources correlate with P&L

### By August 21: Premier League Preparation

TxLINE/TxOdds delivers full Premier League coverage from August 21.

- [ ] Adapt fixture discovery for PL competition/league IDs
- [ ] Test odds ingestion pipeline with MLS data (live now at 50%)
- [ ] Prepare cross-venue edge detection: TxLINE consensus vs Polymarket/Delphi sports markets
- [ ] Verify Merkle proof pipeline works with new season's fixture IDs
- [ ] Build PL-specific forecasting context for Venice AI

This is significant: the 2025–26 Premier League season provides a continuous, high-volume stream of verifiable sports events with professional odds — the ideal substrate for demonstrating the agent's mandate adherence at scale.

### August 24: Competition Closes

- Final P&L calculated after all markets settle
- Win/place/show → $10K prize pool
- Regardless of prize: "ranked in Delphi Agent Arena" is a credential
- Agent continues operating on other venues uninterrupted

### September–October: Premier League Season In Full Swing

- Agent operating across Polymarket + Kalshi + Delphi (if mainnet) with TxLINE intelligence
- Full PL fixture coverage generating continuous decision receipts
- Track record builds week over week — auditable, verifiable
- Canton private settlement activates when a real counterparty or mainnet exists

---

## How Each Layer Reinforces the Others

```
TxLINE odds ──→ Better forecasts ──→ Higher P&L on Delphi leaderboard
                                          │
Delphi competition ──→ Public credential ──→ Credibility for Polymarket operators
                                                    │
Polymarket track record ──→ Signal marketplace ──→ Follower acquisition
                                                            │
Canton private settle ──→ Large operators who found us via signals
```

Nothing is wasted. The Delphi competition proves the agent works. TxLINE data makes it work better. The track record across venues builds the reputation that attracts operators who need private settlement. Canton is the monetization layer for operators at scale — but only after the trust is established through verifiable public performance.

---

## What We're Not Doing

Clarity on scope prevents drift:

- **Not building a prediction market** — we trade on other people's markets
- **Not building a UI-first consumer app** — the operator cockpit exists to configure and audit the agent, not to be a "better Polymarket"
- **Not leading with Canton privacy** — it's available, not the hero. The hero is verifiable autonomous operation.
- **Not competing on model sophistication** — the edge is in the combination of professional odds (TxLINE) + LLM reasoning + policy discipline, not a single clever model
- **Not requiring complex infrastructure** — the agent runs from a laptop, VPS, or any Node.js environment

---

## Success Metrics

### Delphi Competition (Aug 10–24)
- Positive P&L across competition markets
- Top 3 finish → $10K share (stretch)
- Minimum: demonstrate venue-agnostic execution works on a third protocol

### TxLINE/PL Season (Aug 21+)
- Continuous decision receipts across PL fixtures
- Measurable edge from TxLINE consensus vs market prices
- Receipt coverage > 90% of fixtures in configured leagues

### Product (Ongoing)
- Operator acquisition via verifiable track record
- Signal marketplace engagement (publish → follow → delegate)
- Canton settlement activated by at least one real-capital operator

---

## Technical Debt to Address

| Item | Why | Priority |
|------|-----|----------|
| README led with Canton | Misrepresented what's live | Done |
| Brand.js led with "private size" | Same | Done |
| No Delphi integration | Competition starts today | High |
| TxLINE adapter assumes World Cup fixtures | Needs league-generic discovery | High (before Aug 21) |
| Agent loop coupled to Polymarket execution | Needs venue-agnostic routing | Medium |
| Canton wallet layer feature-flagged but hero-positioned | Reposition to "available" | Low |
| World Cup route is hackathon artifact | Keep functional, deprioritize | Low |

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-08-10 | Lead with agent core, not Canton privacy | Canton isn't live at scale; the agent + receipts are the real differentiator |
| 2026-08-10 | Enter Delphi Agent Arena | Proves venue-agnostic claim, generates credential, potential $10K |
| 2026-08-10 | Prepare for TxLINE PL coverage (Aug 21) | Continuous high-volume sports data for the agent; intelligence edge |
| 2026-08-10 | Retain Canton code, reposition to roadmap | Working code is an asset; leading with it when it's not live is misleading |
| 2026-08-10 | Keep TxLINE/Solana integration functional | Proof-of-decision via Merkle proofs remains novel; PL season makes it current |
| 2026-08-12 | Rebuild Delphi pipeline after dry-run audit found 7 silent failure modes (anchored LLM, hidden Kelly gate, one-sided scan, broken TxLINE import/odds parsing, market truncation, dry-run sweep txs) | "Dry-run green" meant nothing; harness-verified mechanics now back the claim |
| 2026-08-12 | Multi-provider LLM router (openrouter → nvidia → venice), Venice demoted to fallback | Venice had no web search, a single 402 killed all intelligence; OpenRouter gives free-tier models + future :online web models, NVIDIA free tier adds resilience |
| 2026-08-12 | Deterministic data feeds (SILSO/NSIDC/Open-Meteo) as the primary intelligence layer; phase-1 live stance = `LIVE_SOURCES=datafeed` | Data-verifiable markets resolve to published numbers — lookups beat models, free, and provably honest; LLM edges on these markets measured as phantoms in supervised dry runs (up to 54pt divergences from settled-data truth) |
| 2026-08-12 | Evidence-required web prompts for LLM categories + source-gated go-live | Blind llama estimated CRS-35 at 60% vs market 10%; with forced search+citations it answered 0% with NASA source. Web plugins + models need paid credits (~$10 deposit queued) — free-tier 429s make zero-cost LLM unreliable |
