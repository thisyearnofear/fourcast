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
| Calibration Tracking | Brier scoring + confidence bucket analysis per forecast | Proves calibrated confidence, not vibes. Overconfidence kills bankrolls under Kelly. |

> **Sized on calibrated confidence, not vibes.** Kelly betting is unforgiving of miscalibration — an 80% model that wins 60% of the time recommends larger positions than justified, compounding losses. The calibration curve on `/arena` tracks hit-rate by confidence bucket (HIGH/MEDIUM/LOW), and the Kelly formula itself is shrunk by the bucket's observed hit-rate ratio (`kelly = kelly_base × observed / nominal`, capped [0.25×, 1.5×]) so the sizing adapts to prove-or-disprove calibration every cycle.

This core is venue-agnostic. It doesn't care whether it's buying YES on Polymarket, shares on Delphi, or escrowing CBTC on Canton. It produces the same auditable decision artifact regardless of where the trade lands.

---

## Additive Layers

### Execution Venues

Each venue is a plugin. The agent core routes decisions to whichever venue offers the best execution for a given market.

| Venue | Market Type | Status | Notes |
|-------|------------|--------|-------|
| **Polymarket** | CLOB (binary/multi) | Live | Builder Program attribution, USDC settlement |
| **Kalshi** | Exchange (regulated) | Live | US-regulated markets, complementary coverage |
| **Delphi** | LMSR (multi-outcome) | Finished | Gensyn Testnet, competition Aug 10–24 |
| **Canton** | Private settlement | Roadmap | CIP-56 escrow, CBTC — for when size must stay hidden |

Adding a venue means implementing: discover markets, get quote, execute trade, track position, redeem settled. The decision logic stays identical.

### Intelligence Sources

Each source strengthens the agent's forecast without coupling to a specific venue.

| Source | What It Provides | Status | Edge |
|--------|-----------------|--------|------|
| **TxLINE / TxOdds** | Professional bookmaker consensus odds, Merkle proofs | Live (MLS, NFL, PL Aug 21) — mainnet free tier | Sharpest odds available — most participants don't have this |
| **Venice AI** | LLM reasoning, evidence synthesis | Live | Handles politics, economics, crypto, tech, current events |
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

Remaining before live: flip `DELPHI_AGENT_DRY_RUN=false` and run under PM2 (see `docs/archive/DELPHI_AGENT.md`).

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

- [x] Adapt fixture discovery for PL competition/league IDs
- [x] Test odds ingestion pipeline with MLS data (live now at 50%)
- [x] Prepare cross-venue edge detection: TxLINE consensus vs Polymarket/Delphi sports markets
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
- ✅ Agent live Aug 12, 68 fills across 25 markets
- ✅ End-to-end on-chain: discovery → quote → execute → sweep → settle
- ⏳ Final P&L pending official board (window closed Aug 24)
- ⏳ Top 3 finish unlikely (leader +8,285 TST; last snapshot rank 80/159, PnL −0.15 TST breakeven)
- Credential earned: shipped a live competition agent with real TST on testnet

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
| TxLINE adapter assumes World Cup fixtures | Needs league-generic discovery | Done (Aug 13) |
| Agent loop coupled to Polymarket execution | Needs venue-agnostic routing | Medium |
| Canton wallet layer feature-flagged but hero-positioned | Reposition to "available" | Low |
| World Cup route is hackathon artifact | Keep functional, deprioritize | Low |

---

## Repositioning plan — miner-first (written 2026-09-29, not yet implemented)

**Situation.** The agent lane is `PAUSED` (no worker cycling, 35-day gap) while
the TxLINE sports miner is the only thing scoring, serving, and renewing. The
hero still promises live agent discipline, so the page argues against itself.
Two honest steady states exist; the plan picks **miner-first** and keeps the
agent surfaces as a verifiable archive.

**Decision (recommended, awaiting go-ahead):** the live product is verified
sports intelligence served by our own miner; the autonomous-trading agent is a
paused lane whose receipts remain auditable history.

**Why miner-first, in one paragraph.** It is the only lane with live data
(TxLINE free bundle: NFL/MLS/English PL/WC, measured 200s), a live consumer
(Telegraph Season II, miner active, renewal regime in place to 2026-10-26),
an honest verification story (Ed25519 attested answers, `verified: true`
only with a real proof, SSE replay for closed fixtures), and a working demo
loop (fixture → score → receipt → reconcile) that needs no venue keys, no
funded wallet, and no TxLINE support reply.

**What changes (bounded, copy-first):**
1. `constants/brand.js` — hero stops promising a cycling agent; the live
   proof becomes the miner + France–Sweden receipt chain:
   - `positioning.headline`: evidence → sealed decisions → verified outcomes,
     **with the live example being TxLINE sports intelligence served by our
     own Season II miner** (scores + receipts + reconciliation), agent lanes
     as auditable archive.
   - `tagline`: keep "Evidence in. Decision sealed. Outcome verified." —
     it already describes the receipt chain, not the agent.
   - `nav.arena`: "The agent archive — every cycle still auditable" (not
     "proving discipline live"); add `nav.sports`: "Verified sports
     intelligence — our live Season II miner".
   - `agent.badge`: "Paused lane — archive" (not "Autonomous operator").
2. IA: one nav slot for the live surface (`/proof` Solana tab =
   "Decision receipts" already exists; promote it rather than building a new
   route). Nothing new to build for v1.
3. Arena/rail: unchanged code — `PAUSED` + sealed amber is already the
   steady state; the plan only changes what the hero claims around it.
4. Strategy log: append the decision + date below when approved.

**What explicitly does NOT change:** no new routes, no worker restart, no
venue keys, no paid TxLINE tier, no claim that Merkle proofs are served
(the 500 exhibit stays attached to the open ask).

**Acceptance:** a first-time visitor can answer "what is live right now?"
(score feed + receipts via our miner) and "what is the agent?" (paused,
auditable archive) without any sentence contradicting `/status` or the rail.

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
| 2026-08-12 | Live on VPS with datafeed-only gate (nuncio-vultr, PM2) | Laptop can't stay open; flip executed with ~0.44% bankroll at risk. First trade: sea-ice YES 5sh @4.40 TST (NSIDC published data), settles Aug 13 |
| 2026-08-12 | Design alignment: nav becomes Markets · Positions · Arena · Private; agent-first hero; beautifului-style reasoning primitives restyled to tokens.css | Review found the site contradicting the strategy doc (Canton-first home, dead /world-cup, two agent surfaces, hollow /positions) while the week's receipts stayed invisible. Plan: docs/archive/DESIGN_ALIGNMENT.md |
| 2026-08-12 | Build `/arena` as the public proof surface + worker→`/api/arena` ingest via Upstash | The receipts, gate refusals, source attribution, and calibration curve ARE the product; surface them or they don't exist commercially |
| 2026-08-13 | TxLINE mainnet free tier activated; MLS/NFL/PL pipeline operational | Subscription confirmed on Solana mainnet (service level 1, no TxL purchase). 415 fixtures flowing across MLS (77), NFL (32), Premier League (280). Competition-specific fixture routing wired into Delphi agent. `DELPHI_AGENT_LIVE_SOURCES=datafeed,txline` — sports markets now trade-eligible when odds populate. |
| 2026-08-22 | LLM router: promote Venice to #1 provider with `stealth-ox-alpha` model, 180s timeout; PM2 ecosystem config enforces `--aggro --live` | Vercel AI Gateway hit persistent 402/429; Bai/DeepSeek returned empty completions. Venice `stealth-ox-alpha` (free tier) faster (82–150s vs 370–870s), reliable. Provider chain: `venice → nvidia → bai → vercel → openrouter`. PM2 config now bakes in `--aggro --live` args. |
| 2026-08-13 | framer-motion override 6.5.1→11.18.2; production build unblocked | connectkit 1.9.2 pinned framer-motion ^6.3.11 whose .mjs imports broke webpack5. npm overrides field resolves cleanly; `npm run build` passes. |
| 2026-10-21 | Calibration output normalized to camelCase as `calibration/v2`, snake_case aliases kept — not a rename | `getCalibrationAnalysis()` returned `hit_rate` while the curve, the agent loop and the worker all read `hitRate`. Nothing threw: the curve plotted every bucket at 0, the Kelly shrinkage never fired, and receipts recorded `sampleSize: 0`. Renaming the fields would have broken `components/CalibrationCurve.jsx`, which reads both conventions; it now reads camelCase first with the alias as fallback, and tests assert the pair is identical. |
| 2026-10-21 | Per-analyst credibility comes from `getAnalystCalibration()` (WIN/LOSS verdicts in `signals` + Brier in `agent_forecasts`), never `getLeaderboard().win_rate` | The leaderboard's "win rate" is `AVG(odds_efficiency = 'EFFICIENT')` — a market-quality label, not "was right". Under the honesty rule an efficiency number cannot be written to Sui as credibility; the new function scores verdicts only, reports market results ('YES'/'NO') as unmapped instead of counting them, and refuses n<3. |
| 2026-10-21 | `resolveForecast()` accepts outcome 1 or 0 only; the calibration backfill no longer writes a neutral 0.5 | The backfill script was seeding the curve with invented outcomes; memory, sizing and the curve all read those rows as evidence. Rows now stay unresolved until a real recorded result exists (worker fixture, or the receipt's reconciliation). |
| 2026-10-21 | Buckets under 5 resolved forecasts are excluded from Kelly shrinkage (`FOURCAST_CALIBRATION_MIN_BUCKET`) | Shrinkage is switching on for the first time with zero prior effect. Applying it to n=1 buckets would let one lucky call boost size by up to 1.5×. Absent bucket = no evidence = factor 1.0, and receipts carry `droppedBuckets`. |
| 2026-10-21 | Sample floors are deliberately uneven per memory kind: analyst/source ≥ 20 (`FOURCAST_MEMORY_MIN_SAMPLES`), window ≥ 1, signal has none | A floor is a statement about the claim, not about the table. `analyst`/`source` memories assert a hit rate that sizing consumes, so a thin one is a lie with consequences; a `window` row prints its own `n` the way the calibration curve already does; and a resolution is an observation, not a claim — refusing it would be hiding a fact. Analyst/source stay on the batch path only, so a resolution handler cannot write a thin claim that sizing then reads. |
| 2026-10-21 | Two planning assumptions about the MemWal SDK corrected against v0.1.9 before writing code: `listMemories()`/`listNamespaces()` DO exist, and `idempotencyKey` is a first-class option | The plan assumed no list-by-namespace API, which would have made "≥10 memories on mainnet" only assertable from our own word. `listMemories` (metadata only, paginate on `has_more`) lets `reconcileLedger()` diff our ledger against the relayer by `blob_id` — the count becomes provable, not claimed. And the SDK's own idempotency key (scoped per owner+namespace, 409 on reuse with different text) means a retry collapses instead of double-appending a version. |
| 2026-10-21 | The cited "latest verdict" and the batch's `LIMIT` window are tie-broken by `id ASC` | Both feed content hashes. If `resolved_at` ties left the engine's order free, two reads of an unchanged ledger could cite different receipts and mint a phantom ladder version — a "it learned" step that learned nothing. Determinism here is an honesty property, not a performance one. |
| 2026-10-21 | Fixed a live SQL defect found through a passing test: per-operator `getCalibrationAnalysis()` was `WHERE operator_id = ?` behind four existing WHEREs | It was a syntax error that the function's own `catch` turned into `{success: false}`, so per-operator calibration — the track-record page and any per-operator memory — silently reported "no calibration" instead of failing loud. `catch`-and-return-error is how a broken query hid for months; the fix is AND-scoping plus a regression test that asserts the scoped numbers, not just `success`. |
| 2026-10-21 | Sizing reads calibration `db → memory`, never memory over the ledger; a stored bucket rate is usable only if its sample size is stored beside it | A snapshot of the ledger cannot be fresher than the ledger, so the live DB always wins — otherwise a planted memory could shrink or inflate a position. And WP1's evidence floor has to survive the round trip: the `window` memory carries `buckets=HIGH:0.900` **and** `bucket_n=HIGH:20`, and `getBucketCalibrationFromMemory()` refuses any rate whose count it cannot see. The receipt then names what moved the size (`calibration.source` plus the memory's `blobId`/`textHash`/`asOf`), so "we sized on a memory on Sui" is an auditable claim rather than a boast. |
| 2026-10-21 | Memory object proofs go through Tatum **JSON-RPC**, not MemWal's recommended `SuiGrpcClient` | MemWal's own docs prefer gRPC for direct reads. We deviate deliberately: Total Recall grades the **Tatum** integration, and a read that proves our owner object exists at a version + digest is only evidence if it is attributable to the sponsor we claim. Deviation is documented in `docs/SUI.md` rather than hidden behind an API that looks like a generic Sui read. |
| 2026-10-21 | x402 is settled on Sui **self-facilitated**; settlement network defaults to **testnet** | The hosted rail is not usable: sui.io/agentpayments says "Live on Sui **Testnet**. Not on Mainnet yet. Paid calls are **invite only**", `suipay.dev/SKILL.md` is empty and `/v1/services` is "Coming soon". So the settlement leg is ours to implement — spend gate before money, transaction re-read on chain through Tatum, `tx_digest` claimed under a UNIQUE constraint, resource produced only after that. Testnet is the default because this leg must never be able to move real money by accident; the ≥10-mainnet-memories deliverable is carried by the memory legs, so WP5 going dark does not sink the entry. |
| 2026-10-21 | Known unresolved conflict, stated rather than patched silently: one `SUI_NETWORK` cannot name both chains | `verifyPayment` refuses to check a testnet payment against a mainnet read (`SETTLEMENT_NETWORK` must equal `SUI_NETWORK`), while the memory writer and the Tatum client both default `SUI_NETWORK` to **mainnet** — which Total Recall requires, since only mainnet memories are counted. With the documented defaults the x402 leg is therefore inert. Settling on mainnet needs a funded mainnet USDC wallet (real money, user's call); keeping testnet needs the payment read to carry its own network/RPC. Tracked in `docs/EXECUTION_PLAN.md`; decision gate Nov 1. |
| 2026-10-21 | Surface quality bar applies to **all 21 routes**, and five of the seven gates are enforced by a script rather than by opinion | An earlier cut scoped the bar to five judged surfaces; widening it only survives with three legs in flight if consistency does not depend on three devs agreeing on the same afternoon. So `check:tokens` **ratchets** — it starts as a report and fails only when raw colour *rises*, so fixes bank permanently and the suite never goes red on legacy debt — `check:surfaces` fails on a route with no registry row, and judgement is spent on one gate only (G7 story legibility, spine routes). `NA` over `0`, `verified:` only with a real Merkle root, and every claim expandable to its evidence are the parts worth making mechanical; a redesign is not. |
