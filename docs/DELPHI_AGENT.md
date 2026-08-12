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
| `services/delphiIntelligence.js` | Market classification and probability routing — data feeds first, then TxLINE odds for sports, LLM router for everything else |
| `services/delphiDataFeeds.js` | Deterministic public-data intelligence — SILSO sunspots, NSIDC sea ice, Open-Meteo weather. Near resolution the answer is often already published at ~0.85. |
| `services/llmRouter.js` | OpenAI-compatible provider chain (openrouter → nvidia → venice) with failover, web-search support w/ auto-degrade, 429 backoff for `:free` models |
| `services/evidenceRetriever.js` | Exa web search → citable snippets injected into forecast prompts (primary grounding; 6h per-question cache, ~$0.005/query) |
| `services/delphiAgentLoop.js` | Async-generator loop: balances → discover → sweep settled → forecast → Kelly size → 5-gate policy → execute (with liveCategories/liveSources gating → paper trades) |
| `scripts/delphi-agent-worker.mjs` | Headless worker (`--once`, `--dry-run`); state in `.delphi-agent/` |
| `deploy/delphi-agent.ecosystem.config.cjs` | PM2 config (5-minute cycles) |

Sports markets are bridged to TxLINE via `matchFixtureToQuestion()` +
`getFixturesByCompetition()` in `services/txline/txlineService.js` — the
intelligence edge most competitors don't have.

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

TxLINE sports path now verified up to the odds call: fixture list is live
(415 fixtures: MLS/NFL/PL/friendlies) and fuzzy question matching works, but
every fixture's odds snapshot currently returns empty — the dev API's odds
feed appears dormant (expected to liven around PL season). Until odds exist,
sports markets fall through to Venice.

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
- **Sports Yes/No outcome forms don't map to TxLINE probabilities.**
  `matchTxLineOdds()` maps team/draw outcome labels; "Will X beat Y?" with
  [Yes, No] outcomes needs predicate parsing — TODO before MLS/PL markets
  hit the board.
- **Tuning via env**: `DELPHI_AGENT_MIN_EDGE` (0.03), `DELPHI_AGENT_MAX_MARKETS`
  (25), `DELPHI_AGENT_LLM_PROVIDERS` (chain order), `OPENROUTER_MODEL`,
  `NVIDIA_MODEL`, `DELPHI_AGENT_VENICE_MODEL` (per-provider model overrides),
  `DELPHI_AGENT_LIVE_SOURCES` / `DELPHI_AGENT_LIVE_CATEGORIES` (go-live gates —
  anything else paper-trades), `DELPHI_AGENT_WEB_SEARCH` (default on; router
  auto-degrades on 400/402), `DELPHI_AGENT_INTERVAL_MS` (1h during paper phase).
