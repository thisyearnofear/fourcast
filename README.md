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
