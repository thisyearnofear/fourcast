# Delphi Agent Arena — Operator Guide

Fourcast's entry in the Gensyn **Delphi: Agent Arena** competition: an
autonomous agent trading LMSR prediction markets on Gensyn testnet, driven by
the same decision core (policy gates, Kelly sizing, forecasting) that runs the
Polymarket agent.

- Competition: https://dorahacks.io/hackathon/delphi-agent-competition/detail
- Leaderboard (official board, judged on P&L only): https://competition.delphi.fyi/ · `agent-competition.gensyn.ai` is SSO-gated
- API key portal: https://delphi-api-access.gensyn.ai/
- Competition wallet (registered on DoraHacks): `0x5c4a7a58989f3efde45f1d9e4cfd1b52488ea33f`
- Competition window: **Aug 10–24, 2026**
- **Last verified**: 2026-08-22 (day 13/14) — **rank 80/159 on the official board**: account **1000.35 TST**, PnL **−0.15 TST**, 86 trades, volume 214.26. See Live trade summary below.

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
| `services/llmRouter.js` | OpenAI-compatible provider chain (**`venice → nvidia → bai → vercel → openrouter`**) with failover, web-search support w/ auto-degrade, 429 backoff for `:free` models. Venice `stealth-ox-alpha` primary (3min timeout); all others fallback. |
| `services/evidenceRetriever.js` | Exa web search → citable snippets injected into forecast prompts (primary grounding; 6h per-question cache, ~$0.005/query) |
| `services/delphiAgentLoop.js` | Async-generator loop: balances → discover → sweep settled → forecast → Kelly size → 5-gate policy → execute (with liveCategories/liveSources gating → paper trades) |
| `scripts/delphi-agent-worker.mjs` | Headless worker (`--once`, `--dry-run`); state in `.delphi-agent/` |
| `deploy/delphi-agent.ecosystem.config.cjs` | PM2 config (3h cycles, **`--aggro --live` baked in**) |

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

## Production deployment (2026-08-12, LIVE; last updated 2026-08-19; **STOPPED 2026-08-25**)

- **Host**: `nuncio-vultr`, user `linuxuser`, repo `/home/linuxuser/fourcast`
- **Process**: PM2 `delphi-agent` (id 29) — **stopped and removed 2026-08-25** after the Aug 24 competition window closed. Last live cycle 2026-08-25 09:07 UTC, 0 trades (LLM provider chain fully degraded). State dir archived to `.delphi-agent-archive-2026-08-25.tar.gz`. Resume with `pm2 start deploy/delphi-agent.ecosystem.config.cjs && pm2 save`.
- **Mode** (when last running): LIVE, `DELPHI_AGENT_LIVE_SOURCES=datafeed,txline,espn,vercel,bai,venice,nvidia,openrouter`
- **First live trade** (laptop-supervised, pre-migration): 5 YES Arctic sea ice <5.88M km² @ 4.3955 TST, settles Aug 13 ~08:00 UTC; sweep+redeem runs automatically on subsequent cycles
- **ESPN sports anchor live** (2026-08-18): `matchEspnOdds()` pulls free ESPN moneyline consensus for EPL/MLS/NFL/La Liga/Bundesliga. **NFL 2-way fix (2026-08-19)**: ESPN publishes NFL as spread/O-U without draw — `extractOdds` now handles 2-way (home+away only), `normalize1x2` synthesizes `draw=0`, `buildOddsEstimate` skips draw mapping. NFL markets no longer fall through to blind LLM.
- **Position safety**: `DELPHI_AGENT_MAX_SHARES_PER_MARKET=50` caps cumulative exposure per market+outcome
- **Deploy mechanics**: code+env sync via rsync/ssh + git push; env lives only in VPS `.env.local`, `chmod 600`
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
`venice → nvidia → bai → vercel → openrouter` (`DELPHI_AGENT_LLM_PROVIDERS`). Only providers
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

TxLINE sports path — fixture discovery re-verified **2026-08-18** (`scripts/verify-mls-fixtures.mjs`):
fixture discovery works (MLS 76 + **PL 290 fixtures**), team aliases and
`matchFixtureToQuestion` resolve cleanly. ESPN free anchor now fully operational
as the live sports odds source (see below), so TxLINE subscription is not required
for the competition window.

## Verified 2026-08-18

### ESPN sports anchor (LIVE, 23/23 tests green)

`matchEspnOdds()` (`services/txline/espnProvider.js` + `tests/espnProvider.test.js`)
is now live and verified end-to-end against the ESPN public API:

- **De-vig math verified**: e.g. Philadelphia Union +140 / +290 / +145 → {home: 0.39, draw: 0.24, away: 0.38}
- **UTC day-boundary fix**: ESPN's `dates=` query for "today" returns zero events
  (their UTC day boundary), while the no-date (current) scoreboard carries the same
  fixtures. Fix: merge both scoreboards (de-dup by id) and match across the union.
- **Call-site fix**: `mergeScoreboardEvents` was previously passed whole response
  objects instead of `.events` arrays, causing a silent `"is not iterable"` error
  that dropped sports markets to the blind LLM. Fixed and tested.
- **Covered leagues**: MLS (15+ live per cycle), EPL, La Liga, Bundesliga, NFL
  (NFL currently falls through to blind LLM — ESPN only publishes spread/O-U for NFL,
  no draw, fails 3-way extraction. NFL 2-way branch is the natural next enhancement).
- **Live verification**: `resolvesAt=today` and `resolvesAt=tomorrow` both return
  de-vigged match odds. Example: `Will Inter Miami beat Philadelphia Union tonight?`
  → `philadelphia union@0.39 vs inter miami cf@0.38 | MLS`
- **Cost**: $0. Free public API, no key required.

### Full test suite

- `tests/espnProvider.test.js`: 11/11 passing
- `tests/delphiIntelligence.test.js`: 12/12 passing
- Full suite: 354 tests passing (9 failures are `better-sqlite3` native build,
  not our code — expected in environments where the native module isn't compiled)

## Verified 2026-08-19

### Agent performance improvements (live on VPS)

- **Cycle interval**: 6h → **3h** (`DELPHI_AGENT_INTERVAL_MS=10800000`). ~40 cycles remaining before Aug 24.
- **Rate limiter**: 6 min → **2 min** between Vercel gateway calls (`VERCEL_GATEWAY_MIN_INTERVAL_MS=120000`). Cycle runtime: ~42 min → ~14 min.
- **Max markets**: 4 → **25** per cycle (`DELPHI_AGENT_MAX_MARKETS=25`).
- **Trade sizing**: `maxSharesPerTrade` 5→**10**, `maxSharesPerMarket` 20→**50**, `maxAllocationPct` 10→**20%**.
- **Kelly fix**: removed hidden `* 0.25` double-penalty in `utils/kellySizing.js`. Fractional Kelly is now `kelly * riskTolerance * confidenceMultiplier` (was `kelly * riskTolerance * 0.25 * confidenceMultiplier`). At MEDIUM confidence a 25% edge → ~7.5% allocation vs ~1.25% before.
- **`riskTolerance`** now reads from `DELPHI_AGENT_RISK_TOLERANCE` env (was hardcoded 0.5). VPS set to **0.75**.
- **LLM provider chain**: added B.AI (`bai`) with `BAI_API_KEY` — DeepSeek-V4-Flash free tier, zero rate limit, fires immediately when Vercel is queued. Chain: `vercel → bai → venice → nvidia → openrouter`.
- **2026-08-22 update**: Venice promoted to **#1 provider** (`venice → nvidia → bai → vercel → openrouter`) with `stealth-ox-alpha` model and 180s timeout. Vercel 402/429 persistent, Bai empty completions; Venice free tier proved faster (82–150s vs 370–870s) and reliable. PM2 ecosystem config now enforces `--aggro --live` via `args` field. Venetce timeout increased from default 60s → 180s for `stealth-ox-alpha`.
- **Evidence retrieval chain**: Vercel Exa → direct Exa → **Parallel AI** (`PARALLEL_API_KEY`) → **Firecrawl** (free, no key needed, `https://api.firecrawl.dev/v1/search`). Four fallbacks; Firecrawl fires when all others are unavailable or rate-limited.
- **NFL 2-way ESPN**: `extractOdds` now handles home+away-only (no draw) responses. `normalize1x2` accepts `drawAmerican=null`. NFL markets anchored at HIGH confidence from ESPN instead of falling through to blind LLM.

### Live trade summary (Aug 12–20)

**Rank 80/159 on the official board (`competition.delphi.fyi`) — account 1000.35 TST, PnL −0.15 TST, 86 trades, volume 214.26.** Official judging is **P&L-only, mark-to-market from a 1,000 TST start**; we sit essentially **breakeven**, lower-middle of the pack (above the negative tail; leader Ramalogy at +8,285).

- **Internal activity** (VPS feed `/api/arena/feed`): 48 cycles, 68 executed fills (86 trades by board count) on **25 markets**; **138.78 TST gross deployed** (Aug 19 → 40.7, Aug 20 → 54.1).
- **Realized (swept): 31.26 TST** (5.0 Aug 16 · 10.0 Aug 18 · 6.26 Aug 19 · 10.0 Aug 20).
- **Not a contradiction — two accounting views.** The internal wallet-balance reading (986.7 → 911.6), the board mark-to-market account (1000.35), and the 1,000 TST start differ because open positions are held at market before resolution. **The official board PnL is the metric that ranks us.**
- **Open exposure ~480 gross shares / 25 markets**; ≈45% of deployed sits in the top-5 and the late window stacked short-dated books (WTI, ECB FX, 10yr, Binance BTC-minute, SOFR, LaLiga) — high variance.

Markets traded: LaLiga Rayo–Alavés, US 10yr yield, Sporting KC MLS, Botafogo–Cienciano, SOFR, BTC/ETH bands, Battery NY water, Binance BTC-minute, Rangers–Jablonec, ECB FX, Trump nominations, WTI, Gemini model, Typhoon Dolphin, SILSO sunspots, NSIDC sea ice, Jaguars NFL, Mississippi River, GB carbon intensity, TSLA, Federal Register, NYC EO, Al Ittihad (Saudi), SpaceX.

⚠️ **Positioning honesty:** at −0.15 essentially flat, the open short-dated book still decides direction. Not in payout contention (leader +8,285 across 159); realistic goal is defending a positive PnL to the close.

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
- **ESPN UTC day-boundary bug (fixed 2026-08-18).** ESPN's `dates=` query for
  "today" returns zero events (their UTC day boundary), while the no-date
  (current) scoreboard carries the same fixtures. The old `dated || default`
  fallback saw a truthy-but-empty response and never reached the working default
  window. Fix: merge both scoreboards, de-dup by id, match across the union.
- **ESPN call-site `mergeScoreboardEvents` defect (fixed 2026-08-18).** The
  function was passed whole response objects (`{events:[...]}`) instead of
  `.events` arrays. The `for...of` threw "is not iterable" which the empty
  catch swallowed into a null return. Sports markets dropped to blind LLM at
  the worst moment — near settlement. Fix: pass `.events` explicitly.
- **Sports Yes/No binary forms now map via predicate parsing.** `Will X beat Y?` /
  `Will X win?` with `[Yes, No]` outcomes are parsed in `delphiIntelligence.js`
  (`mapBinarySportsOutcomes`), anchoring Yes to the subject team's normalized 1X2
  share; unparseable binary forms fall through to the LLM instead of an
  equal-split guess. Team-labelled (multi or binary) forms keep the label mapper.
  ESPN is now the live sports odds anchor — no TxLINE subscription needed for
  the competition window.
- **Tuning via env**: `DELPHI_AGENT_MIN_EDGE` (0.03), `DELPHI_AGENT_MAX_MARKETS` (25), `DELPHI_AGENT_LLM_PROVIDERS` (chain: **`venice,nvidia,bai,vercel,openrouter`**), `OPENROUTER_MODEL`, `NVIDIA_MODEL`, `DELPHI_AGENT_VENICE_MODEL` (**`stealth-ox-alpha`**, Venice primary w/ 180s timeout), `DELPHI_AGENT_LIVE_SOURCES` / `DELPHI_AGENT_LIVE_CATEGORIES` (go-live gates — anything else paper-trades), `DELPHI_AGENT_WEB_SEARCH` (default on; router auto-degrades on 400/402), `DELPHI_AGENT_INTERVAL_MS` (3h).

## Go-live + submission checklist (competition ends Aug 24, 2026)

The remaining window is short — this is the runbook. Steps 1-4 are code-ready
and verified; 5-6 are operator actions that need the host / portal.

**STATUS**: Steps 1-4 all completed 2026-08-18/19. 24/24 tests green. Agent
running live on VPS at 3h cycles. **Official board (2026-08-20): rank 80/159,
account 1000.35 TST, PnL −0.15 TST, 86 trades.** Internal: 68 fills on 25
markets, 138.8 TST deployed, 31.26 TST swept — see Live trade summary above.

1. **Sports odds mapping (✅ DONE 2026-08-18).** `mapBinarySportsOutcomes` +
   `isGenericBinaryOutcomes` shipped in `services/delphiIntelligence.js` with
   unit tests (`tests/delphiIntelligence.test.js`, 12/12 passing). Generic Yes/No
   forms now anchor to the 1X2 consensus or fall through to the LLM — no more
   equal-split guesses.

2. **Zero-cost live gating — no TxLINE subscription needed (✅ DONE 2026-08-18).**
   The VPS `.env.local` should have:
   - `DELPHI_AGENT_DRY_RUN=false` (LIVE)
   - `DELPHI_AGENT_LIVE_SOURCES=datafeed,openrouter,nvidia,venice,gateway,espn`
   - `DELPHI_AGENT_LIVE_CATEGORIES=` (empty = all categories trade live)
   - `DELPHI_AGENT_MAX_SHARES_PER_MARKET=20` (cumulative exposure cap)

3. **ESPN sports anchor — free, no key, no cost (✅ DONE 2026-08-18).**
   `matchEspnOdds()` (`services/txline/espnProvider.js` + `tests/espnProvider.test.js`,
   11/11 tests passing) pulls ESPN's free public moneyline consensus for
   EPL/MLS/NFL/La Liga/Bundesliga, de-vigs into true probabilities, maps to
   market outcomes. Two critical bugs fixed:
   - **UTC day-boundary**: ESPN `dates=` query for "today" returns 0 events;
     fix merges current + dated scoreboards, de-dup by id.
   - **Call-site defect**: `mergeScoreboardEvents` was passed whole response
     objects instead of `.events`; fixed to pass `.events` explicitly.
   Live verified: `Will Inter Miami beat Philadelphia Union tonight?`
   → `philadelphia union@0.39 vs inter miami cf@0.38 | MLS`.

4. **NFL 2-way moneyline (✅ DONE 2026-08-19).** `extractOdds` now handles
   home+away-only responses, `normalize1x2` accepts `drawAmerican=null` and
   returns `draw:0`, `buildOddsEstimate` skips draw-label mapping for `twoWay`
   markets. NFL markets are now ESPN-anchored at HIGH confidence.

5. **Re-verify a live cycle on VPS (⏳ OPERATOR ACTION).** Run
   `node scripts/delphi-agent-worker.mjs --once` and confirm: balances load,
   data feeds + LLM forecasts produce gated decisions, ESPN sports markets
   show up in source tags, no per-cycle errors.

6. **Restart & watch on VPS (⏳ OPERATOR ACTION).**
   `pm2 restart delphi-agent && pm2 logs delphi-agent --lines 40`, then a few
   cycles to confirm sweep/redeem + ESPN-sourced trades appearing.

7. **Submit on DoraHacks before Aug 24 (⏳ OPERATOR ACTION).**
   - https://dorahacks.io/hackathon/delphi-agent-competition/detail
   - Leaderboard reflects live activity: https://agent-competition.gensyn.ai
   - Include: repo link, the operator guide (`docs/DELPHI_AGENT.md`), the
     competition wallet address, run-state summary (dry-run paper validation →
     live datafeed → ESPN sports → any live fills), and the edge examples
     recorded above.

