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
| `services/delphiIntelligence.js` | Market classification and probability routing — TxLINE odds for sports, Venice AI for everything else |
| `services/delphiAgentLoop.js` | Async-generator loop: balances → discover → sweep settled → forecast → Kelly size → 5-gate policy → execute |
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

## Verified 2026-08-11

Dry-run green end-to-end: credential gate → balances (1000 TST, 0.05 ETH) →
9 open markets discovered and analyzed → policy declined all (edge below
threshold) → summary written. Zero trades is the mandate working, not a bug.

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
