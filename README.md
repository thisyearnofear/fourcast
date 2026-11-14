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

## Solana integration

Fourcast settles on Solana in three independent ways — each one verifiable
read-only on a public explorer, no keys, no trust:

1. **Parametric escrow (`match-escrow` program, devnet)** — an Anchor program
   that locks SOL in a PDA against a sports fixture, then settles in a single
   transaction that CPIs into TxLINE's `txoracle` v4 flow
   (`validate_fixture_for_tree` → `validate_stat_v4` → `close_worker_ticket`)
   with an API-signed Merkle proof of the verified score. Payout or refund
   happens entirely on-chain; there is no oracle operator and no trusted
   party. Program:
   [`AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ`](https://explorer.solana.com/address/AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ?cluster=devnet),
   source in [`onchain/match-escrow/`](onchain/match-escrow).
2. **Receipt commitment (Memo program)** — each decision receipt's
   `contentHash` can be committed on-chain via the canonical Memo program
   *before* the outcome resolves; `/api/worldcup/verify?commitmentTx=<sig>`
   proves the commitment predated the result.
3. **x402 payments (self-facilitated)** — `POST /api/signals/premium-solana`
   quotes a 402, accepts a buyer-signed `transferChecked` transaction, and
   only delivers the paid resource after verifying the instruction,
   simulating, broadcasting, confirming, and re-reading the on-chain
   balance delta. Devnet USDC by default; enable with
   `X402_SOLANA_ENABLED=true` (+ `X402_USDC_CEILING`, `X402_SOLANA_PAY_TO`).
   Buyer client: `scripts/x402-solana-demo.mjs` — against production:
   `X402_DEMO_URL=https://fourcastapp.vercel.app/api/signals/premium-solana X402_BUYER_KEYPAIR=<key> node scripts/x402-solana-demo.mjs`.

### Check the gates yourself (judge verify-path)

- **Program + oracle live on devnet** —
  `curl https://fourcastapp.vercel.app/api/worldcup/settle/status` returns
  the program id and RPC; both programs resolve on
  [explorer.solana.com](https://explorer.solana.com?cluster=devnet).
- **On-chain proof verification** —
  `GET /api/worldcup/verify?fixtureId=18175981` walks the full chain:
  pre-event receipt → optional on-chain commitment → TxLINE Merkle proof →
  Solana daily-root verification → reconciliation.
- **Full escrow round-trip** —
  `node scripts/solana-escrow-v4-roundtrip.mjs`
  books the fixture (once), creates a policy (locks SOL), then settles it in
  one transaction via the TxLINE v4 oracle CPI chain — printing explorer
  links for every transaction. Last verified run:
  [create_policy](https://explorer.solana.com/tx/5BEpKYaZR6icGwwxc6zwb43EX4CDM23PM9gcsGwn6aHaW1GaWF7cM4DRJqDbLE9Lv2CJF4dYio4dBiMAQVKqaBSF?cluster=devnet) →
  [settle_policy_v4](https://explorer.solana.com/tx/4UE3YM9xQHVRSxfGecAfs82h56k4hH6LevHCM5KMygJ2Vd4apzACSByPJfyUt6LaqtUgUZR7L96wntrGwSJYTPzX?cluster=devnet)
  (0.05 SOL paid to the recipient, policy account closed).
- **x402 quote** — `GET /api/signals/premium-solana` returns 402 +
  `Payment-Required` header with price, payee, mint and network.

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
- **The refusal (on-chain)** — tx
  [`J829ptPZ…F4e`](https://testnet.nearblocks.io/txns/J829ptPZYTopk2n8Nh4KGxE8MAe2JEwyfdRT12ngF4e):
  a `rogue-exchange` request panics `mandate: venue not allowed` — the gate
  refuses **before** the MPC call is even made.
- **The approval (on-chain)** — tx
  [`7BTL3w3o…KUVM`](https://testnet.nearblocks.io/txns/7BTL3w3ojztn76k98oS1BQ9rJkr6JJewQhy5CVCVKUVM):
  an in-policy request passes all five gates, `v1.signer-prod.testnet`
  executes `sign` on path `arena/v1`, and a secp256k1 signature is returned
  in the tx's final `SuccessValue` (visible in the receipt chain).
- **Live API** — `GET /api/near/mandate` on the deployed app returns the same
  contract state (read-only, no secrets).
- **Anchored receipts** — `GET /api/txline/verify?fixtureId=18175981` returns
  `nearCommitment.state: "anchored"`: hash committed on `v1.social08.testnet`
  by `fourcast-agent.testnet`, tx
  [`DH1WvxiT…CGVwt`](https://testnet.nearblocks.io/txns/DH1WvxiTxDvCiDARTkLs3EwLJJFZSTr8TKQ3uw9CGVwt).

Receipts are anchored on NEAR (`fourcast:receipt-v1:<fixtureId>:<hash>`
via NEAR Social `set`) — the agent rail shows `⬡ anchored` with an
explorer link per anchored cycle.

## NEAR HACKATHON

Fourcast is an existing multi-chain product adapted for the NEAR HACKATHON
(Nov 1–14, 2026), entered across **Unstoppable DeFi**, **Agent Economy**, and
**AI Security** tracks. See [`HACKATHON.md`](./HACKATHON.md) and
[`docs/NEAR_HACKATHON.md`](./docs/NEAR_HACKATHON.md) for the NEAR
integration plan, tools, demo script, and submission checklist.

**Baseline vs in-window (Q-002).** Fourcast predates the hackathon on other
chains — the venue integrations, decision receipts, Solana escrow, Telegraph
miner, and calibration curve are **baseline**. Built in the Nov 1–14 window:
the `agent-mandate` contract on NEAR testnet (policy gates + MPC
`request_signature`), the chain-signatures derived-account path
(`ChainSignatureSigner`, keyless Polygon account `0x6940…c61F`), the
on-chain refusal/approval loop above, receipt anchoring via NEAR Social
(`fourcast-agent.testnet`), `GET /api/near/mandate`, the `nearCommitment`
verify block, and the Intents funding-quote leg (dry-quote only — Intents
has no testnet, per official Q-007).
