# Delphi Agent Arena — Operator Guide

Fourcast's entry in the Gensyn **Delphi: Agent Arena** competition: an
autonomous agent trading LMSR prediction markets on Gensyn testnet, driven by
the same decision core (policy gates, Kelly sizing, forecasting) that runs the
Polymarket agent.

- Competition: https://dorahacks.io/hackathon/delphi-agent-competition/detail
- Leaderboard: https://agent-competition.gensyn.ai
- API key portal: https://delphi-api-access.gensyn.ai/
- Competition window: **Aug 10–24, 2026**

## Network Facts

| Item | Value |
|------|-------|
| Network | `competition-testnet` (single oracle-settled deployment) |
| Chain / RPC | Gensyn testnet, chain ID `685685`, `https://gensyn-testnet.g.alchemy.com/public` |
| LMSR gateway | `0x097599c9D966fF496284b892A8F13BF885b258ef` |
| Factory | `0xEa9D0a78d0209916e88e363B8FDa3e23206Ff49b` |
| Collateral (TST) | Resolve via `TOKEN()` on the gateway — see Setup step 5 |

LMSR means prices sum to 1 across outcomes — price IS implied probability,
and a winning share pays exactly 1 TST. Edge = your probability − market
price, directly comparable to EV per share.

## Architecture

| File | Role |
|------|------|
| `services/delphiService.js` | Delphi SDK wrapper — discovery, quoting, execution, positions, redemption, edge math |
| `services/delphiIntelligence.js` | Market classification and probability routing — data feeds first, then sports odds (paid TxLINE → free ESPN anchor) for sports, LLM router for everything else |
| `services/delphiDataFeeds.js` | Deterministic public-data intelligence — SILSO sunspots, NSIDC sea ice, Open-Meteo weather. Near resolution the answer is often already published at ~0.85. |
| `services/llmRouter.js` | OpenAI-compatible provider chain (openrouter → nvidia → venice) with failover, web-search support w/ auto-degrade, 429 backoff for `:free` models |
| `services/evidenceRetriever.js` | Exa web search → citable snippets injected into forecast prompts (primary grounding; 6h per-question cache, ~$0.005/query) |
| `services/delphiAgentLoop.js` | Async-generator loop: balances → discover → sweep settled → forecast → Kelly size → 5-gate policy → execute (with liveCategories/liveSources gating → paper trades) |
| `scripts/delphi-agent-worker.mjs` | Headless worker (`--once`, `--dry-run`); state in `.delphi-agent/` |
| `deploy/delphi-agent.ecosystem.config.cjs` | PM2 config (5-minute cycles) |

Sports markets are budgeted by `matchEspnOdds()` — the free ESPN public
consensus-odds anchor (`services/txline/espnProvider.js`) — falling through to
the blind LLM when no line is posted. Paid TxLINE (`services/txline/txlineService.js`,
`matchFixtureToQuestion()` + `getFixturesByCompetition()`) only engages if a
mainnet subscription is configured; under the current cost-constrained stance it
is deliberately **not** in `DELPHI_AGENT_LIVE_SOURCES`, so ESPN is the live
sports anchor.

## Setup

1. **Generate a fresh wallet** dedicated to the competition (never reuse a
   funded wallet) and record its address.
2. **Register on DoraHacks** with that address. TST (1000) is airdropped by
   the organizers after registration — it may lag.
3. **Fund gas**: testnet ETH via https://www.alchemy.com/faucets/gensyn-testnet
   (0.05 ETH is plenty).
4. **Generate the API key** at https://delphi-api-access.gensyn.ai/.
5. Populate `.env.local` (never commit it):

   ```bash
   DELPHI_NETWORK=competition-testnet
   DELPHI_SIGNER_TYPE=private_key
   WALLET_PRIVATE_KEY=0x<registered wallet key>   # no DELPHI_ prefix — the SDK reads this name
   DELPHI_API_ACCESS_KEY=<key from portal>
   # SDK ships the collateral address redacted — resolve it on-chain:
   #   cast call 0x097599c9D966fF496284b892A8F13BF885b258ef "TOKEN()(address)" \
   #     --rpc-url https://gensyn-testnet.g.alchemy.com/public
   DELPHI_TOKEN_ADDRESS=<resolved_TST_address>
   DELPHI_AGENT_DRY_RUN=true
   # Optional tuning: DELPHI_AGENT_INTERVAL_MS, DELPHI_AGENT_MIN_EDGE,
   # DELPHI_AGENT_MAX_ALLOCATION_PCT, DELPHI_AGENT_MAX_SHARES_PER_TRADE,
   # DELPHI_AGENT_SLIPPAGE_PCT, DELPHI_COMPETITION_ID
   ```

## Running

```bash
npm run delphi:dry    # one cycle, forced simulation — safe to run anytime
npm run delphi:once   # one cycle (live if DELPHI_AGENT_DRY_RUN=false)
npm run delphi:live   # continuous loop (respects DELPHI_AGENT_DRY_RUN)

# Production (starts in dry-run by config):
pm2 start deploy/delphi-agent.ecosystem.config.cjs   # run from repo root
pm2 logs delphi-agent
```

Flip `DELPHI_AGENT_DRY_RUN=false` in the ecosystem config (and `.env.local`)
only after dry-run cycles look sane.

State and history land in `.delphi-agent/` (`status.json` per run, `runs.jsonl`
append-only log; both gitignored).

## Production deployment (2026-08-12, LIVE)

- **Host**: `nuncio-vultr`, user `linuxuser`, repo `/home/linuxuser/fourcast`
- **Process**: PM2 `delphi-agent` (id 19), hourly cycles (`DELPHI_AGENT_INTERVAL_MS=3600000`), `pm2 save` persisted
- **Mode**: LIVE, gated `DELPHI_AGENT_LIVE_SOURCES=datafeed`
- **First live trade** (laptop-supervised, pre-migration): 5 YES Arctic sea ice <5.88M km² @ 4.3955 TST, settles Aug 13 ~08:00 UTC; sweep+redeem runs automatically on subsequent cycles
- **Position safety**: `DELPHI_AGENT_MAX_SHARES_PER_MARKET` (default 20) caps cumulative exposure per market+outcome — without it an hourly loop would stack the same edge every cycle
- **Deploy mechanics**: code+env sync via rsync/ssh (GitHub push pending auth fix on the laptop); env lives only in VPS `.env.local`, `chmod 600`
- **Known live constraint**: nvidia NIM free tier intermittently 503s / >120s queues; router retries 429/503 with backoff then degrades (LLM lane slow some cycles — data feeds are unaffected and still trade)

## Verified 2026-08-12

Pipeline rebuilt and harness-tested after finding several silent failure
modes that the original dry-run had masked (Venice estimates anchored to
market prices, a hardcoded 5% Kelly gate overriding DELPHI_AGENT_MIN_EDGE,
best-outcome-only scanning that could never buy an underpriced "No", a
broken default-export import that disabled the TxLINE matcher entirely, a
World-Cup-only fixture lookup, maxMarkets=10 silently skipping markets, and
dry runs actually sending redemption transactions). Mock-forecaster harness:
14/14 markets analyzed → 12 decisions evaluated → 9 cleared policy → 9 dry-run
trades simulated with 5-share caps. Decide→execute path confirmed end-to-end.

INFERENCE: forecasts run through a multi-provider LLM router
(`services/llmRouter.js`) — ordered failover, default chain
`openrouter → nvidia → venice` (`DELPHI_AGENT_LLM_PROVIDERS`). Only providers
with configured keys are attempted; auth/billing/rate-limit failures roll over
automatically, and the winning provider+model is recorded in each forecast's
`source` for audit. Failover verified 2026-08-12 (openrouter 401 → nvidia 403
→ venice 401 → null; chain mechanics correct).

ACTION REQUIRED (2026-08-12 evening): inference budget status —
- Inference is HEALTHY: nvidia llama-3.3-70b (free) answers every forecast,
  grounded by Exa citations (`[exa:N/ev:M]` in source tags). An OpenRouter
  deposit would now only buy stronger models (better source discernment) —
  nice-to-have, not a blocker. Coasty was evaluated for retrieval and
  rejected: computer-use agents are ~$0.10-0.40/investigation with minutes of
  latency; Exa covers the same grounding at ~$0.005/query (docs also carry an
  agent-targeted injection prompt — noted and ignored during integration).
- Zero-cost interim: `OPENROUTER_MODEL=google/gemma-4-31b-it:free` is
  configured — works, but free-tier 429s are aggressive and many cycles only
  partially forecast (router retries 10s/20s then degrades to skip).
- Venice still 401s (credits+key need attention at venice.ai/settings/api).
- The data feeds are free, deterministic, and drive the phase-1 live stance
  (`DELPHI_AGENT_LIVE_SOURCES=datafeed` — verified edges vs market on
  2026-08-12: sunspot 74-vs-≥40 at mkt 0.92; sea ice 5.829-vs-<5.88 at mkt
  0.90; Wellington HS temp model 13.8°C-vs-exactly-15 at mkt 0.28).

TxLINE sports path re-verified live **2026-08-18** (`scripts/verify-mls-fixtures.mjs`):
fixture discovery works (MLS 76 + **PL 290 fixtures**), team aliases and
`matchFixtureToQuestion` resolve cleanly (e.g. "Will Arsenal win...?" → Arsenal vs
Chelsea @ 1.00). The **remaining blocker was odds**: the devnet token returns
fixtures but odds hashes stay pending, and live odds need a **paid mainnet
subscription**. Cost-constrained decision (2026-08-18): we skip the subscription —
sports edge runs on the free **deterministic data feeds** + the free **blind
LLM**, which are both allow-listed in the go-live checklist below. TxLINE odds
remain an optional future upgrade, not a dependency.

## Gotchas (learned the hard way)

- **The worker must read `.env.local`, not `.env`.** `dotenv/config` only
  loads `.env`; the npm scripts and PM2 config pass `node --env-file=.env.local`
  instead. Running the worker file directly without that flag will fail
  preflight even with a perfect `.env.local`.
- **`DELPHI_TOKEN_ADDRESS` must be set.** The published SDK redacts the
  collateral token address; without the env override, balance/approval/trade
  calls fail against a masked placeholder.
- **The positions API requires an explicit `wallet` query param.**
  `delphiService.listPositions()` derives it from `WALLET_PRIVATE_KEY` when
  the caller doesn't pass one.
- **Kelly rounding zeroes small edges at LOW confidence.** sizePct is rounded
  to whole percents after confidence haircuts; a ≤4% edge at LOW/MEDIUM
  confidence sizes to 0. Small-edge trades realistically need HIGH-confidence
  sources (TxLINE, data feeds) or ≥6–8% blind disagreement.
- **Sports Yes/No binary forms now map via predicate parsing.** `Will X beat Y?` /
  `Will X win?` with `[Yes, No]` outcomes are parsed in `delphiIntelligence.js`
  (`mapBinarySportsOutcomes`), anchoring Yes to the subject team's normalized 1X2
  share; unparseable binary forms fall through to the LLM instead of an
  equal-split guess. Team-labelled (multi or binary) forms keep the label mapper.
  The remaining blocker was the **fixture odds feed**: odds hashes returned
  empty on the dev API. TxLINE announced PL coverage arrived 2026-08-18 — re-verify
  odds hashes populate (see the go-live checklist below); if they do, enable
  `sports` in `DELPHI_AGENT_LIVE_SOURCES`.
- **Tuning via env**: `DELPHI_AGENT_MIN_EDGE` (0.03), `DELPHI_AGENT_MAX_MARKETS`
  (25), `DELPHI_AGENT_LLM_PROVIDERS` (chain order), `OPENROUTER_MODEL`,
  `NVIDIA_MODEL`, `DELPHI_AGENT_VENICE_MODEL` (per-provider model overrides),
  `DELPHI_AGENT_LIVE_SOURCES` / `DELPHI_AGENT_LIVE_CATEGORIES` (go-live gates —
  anything else paper-trades), `DELPHI_AGENT_WEB_SEARCH` (default on; router
  auto-degrades on 400/402), `DELPHI_AGENT_INTERVAL_MS` (1h during paper phase).

## Go-live + submission checklist (competition ends Aug 24, 2026)

The remaining window is short — this is the runbook. Steps 1-2 are code-ready
(2026-08-18); 3-6 are operator actions that need the host / portal.

1. **Sports odds mapping (done 2026-08-18).** `mapBinarySportsOutcomes` +
   `isGenericBinaryOutcomes` shipped in `services/delphiIntelligence.js` with
   unit tests (`tests/delphiIntelligence.test.js`, 8 passing). Generic Yes/No
   forms now anchor to the 1X2 consensus or fall through to the LLM — no more
   equal-split guesses.

2. **Zero-cost live gating — no TxLINE subscription needed.** On the VPS
   `.env.local` (and the PM2 ecosystem config):
   - `DELPHI_AGENT_DRY_RUN=false` (LIVE — already the live stance, keep)
   - `DELPHI_AGENT_LIVE_SOURCES=datafeed,openrouter,nvidia,venice,gateway,espn`
     — allow the free deterministic **datafeed** plus the free **LLM providers**
     (openrouter `:free`, nvidia free tier, venice, Vercel AI Gateway free Exa)
     plus the **free ESPN sports-odds anchor** (no key, no cost). The anchoring
     precedent (`estimateSportsProbabilities`) is TxLINE → ESPN → blind LLM, so
     `txline` only trades if a paid mainnet subscription is configured.
     **Deliberately do NOT list `txline` under the free plan** — its mainnet odds
     need a paid subscription (cost-constrained decision).
   - `DELPHI_AGENT_LIVE_CATEGORIES=` (empty = every category trades live) or
     `sports,crypto,politics,economics,miscellaneous`.
   - Keep `DELPHI_AGENT_MAX_SHARES_PER_MARKET` and the daily spend cap in place.

3. **Re-verify a live cycle before switching.** Run
   `node scripts/delphi-agent-worker.mjs --once` and confirm: balances load,
   data feeds + LLM forecasts produce gated decisions, and no per-cycle errors.

4. **Zero-cost sports odds — ESPN free anchor (shipped 2026-08-18).** TxLINE
   mainnet odds require a paid subscription; we don't pay. Instead `matchEspnOdds()`
   (`services/txline/espnProvider.js` + `tests/espnProvider.test.js`) pulls ESPN's
   free public moneyline consensus (`site.api.espn.com`, no key, no cost) for
   EPL/MLS/NFL/La Liga/Bundesliga, de-vigs it into true probabilities, and maps
   it to the market's outcomes — so sports edges are **anchored to real
   bookmaker consensus**, not the blind LLM. When no ESPN line is posted the
   provider returns null and the callers fall gracefully to the blind LLM
   (`estimateWithLLM` — market-price-free, Exa-grounded). ESPN is a free
   convenience, never a hard dependency. Paid TxLINE remains the drop-in
   professional-odds upgrade if a subscription is ever justified.

5. **Restart & watch.**
   `pm2 restart delphi-agent && pm2 logs delphi-agent --lines 40`, then a few
   cycles to confirm sweep/redeem + no per-cycle errors.

6. **Submit on DoraHacks before Aug 24.**
   - https://dorahacks.io/hackathon/delphi-agent-competition/detail
   - Leaderboard reflects live activity: https://agent-competition.gensyn.ai
   - Include: repo link, the operator guide (`docs/DELPHI_AGENT.md`), the
     competition wallet address, run-state summary (dry-run paper validation →
     live datafeed → any live fills), and the edge examples recorded above.

