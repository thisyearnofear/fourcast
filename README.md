# Fourcast — Autonomous Prediction-Market Operator

Fourcast is a venue-agnostic autonomous agent for prediction markets. It discovers edge, sizes positions under a policy-bound mandate, executes across multiple venues, and produces verifiable decision receipts that prove mandate adherence — before the outcome is known.

> **One agent core. Multiple execution venues. Verifiable decisions.**

**The wedge:** every AI trading agent claims performance; none prove discipline. Fourcast commits a cryptographic decision receipt before each outcome resolves, then reconciles it against independently verifiable data. Operators get an auditable track record; allocators get mandate assurance without trusting a black box.

## Learn the core concepts

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the system fits together
- [docs/CALIBRATION.md](docs/CALIBRATION.md) — Brier scoring, confidence buckets, the calibration curve
- [docs/WALRUS_MEMORY.md](docs/WALRUS_MEMORY.md) — the memory layer: namespaces, ladder, precedence
- [STRATEGY.md](STRATEGY.md) — positioning, venue roadmap, the Decision Log
- [docs/INDEX.md](docs/INDEX.md) — full documentation index (every doc, live status)

## Run it

- [docs/SETUP.md](docs/SETUP.md) — install, env, wallets, deployment
- Production: [fourcastapp.vercel.app](https://fourcastapp.vercel.app)

## What's live

Status is tracked in [docs/EXECUTION_PLAN.md](docs/EXECUTION_PLAN.md) and [docs/SURFACES.md](docs/SURFACES.md) (dated, read from running services — not aspirational).

## Tech stack

Node.js 24+, Next.js 16, React 19 · Polymarket CLOB, Delphi (LMSR), Canton DApp SDK · EVM, Solana (Anchor), Gensyn · TxLINE/TxOdds, Venice AI, Bright Data · Vercel, VPS+PM2, Redis/Upstash, Turso

## License

MIT

## NEAR integration

The agent's trading account is a NEAR contract account — no private key
exists. The `agent-mandate` contract enforces venue/risk/liquidity/
slippage/cooldown policy on-chain and only asks the MPC signer for a
signature when a trade is in-policy.

```bash
# do X, see Y — read the live mandate + derived agent account (testnet, read-only)
node scripts/near-derive-address.mjs
# → contract policy, MPC pubkey, derived EVM address (0x6940…c61F)

# demo cold state (no worker/Redis needed)
FORECAST_REPLAY=1 npm run dev
```

### Check the gates yourself (judge verify-path)

Everything below is read-only or viewable on a public explorer — no keys, no trust:

- **The mandate** — `get_mandate` on
  [`inexpensive-mother.testnet`](https://testnet.nearblocks.io/address/inexpensive-mother.testnet)
  (venues, notional cap, liquidity floor, slippage, cooldown): `node scripts/near-mandate-gates.mjs --view`
- **The agent account** —
  [`0x6940…c61F`](https://polygonscan.com/address/0x6940B97505567816A75B1A952f234630af81c61F)
  on Polygon. No private key exists — `node scripts/near-derive-address.mjs`
  re-derives it from the MPC pubkey + path `arena/v1`.
- **The envelope** — `node scripts/near-first-order.mjs --dry` picks a live
  market and shows the trade envelope passing each gate locally; the same
  checks run on-chain inside `request_signature`.
- **Live API** — `GET /api/near/mandate` on the deployed app returns the same
  contract state (read-only, no secrets).
- **Anchored receipts** — `GET /api/txline/verify?fixtureId=<id>` returns the
  `nearCommitment` block: anchored hash, social.near key, explorer link.

Receipts are anchored on NEAR (`fourcast:receipt-v1:<fixtureId>:<hash>`
via NEAR Social `set`) — the agent rail shows `⬡ anchored` with an
explorer link per anchored cycle.

## NEAR HACKATHON

Fourcast is being adapted for the NEAR HACKATHON (Nov 1–14, 2026) under the **Unstoppable DeFi** track. See [`HACKATHON.md`](./HACKATHON.md) and [`docs/NEAR_HACKATHON.md`](./docs/NEAR_HACKATHON.md) for the NEAR integration plan, tools, demo script, and submission checklist.
