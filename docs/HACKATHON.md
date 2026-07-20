# TxLINE Hackathon — Fourcast Strategy

**Hackathon**: TxLINE Hackathon · Solana
**Deadline**: July 19, 2026 23:59 UTC
**Settlement**: Solana devnet (match-escrow program CPI-calls TxLINE `validate_stat`)
**Wallet**: ConnectorKit (@solana/connector) — Phantom, Solflare, Backpack via Wallet Standard
**Submission**: [TXLINE_SUBMISSION.md](../TXLINE_SUBMISSION.md)
**Demo script**: [DEMO_SCRIPT_PROOF.md](./DEMO_SCRIPT_PROOF.md)

---

## What we ship

Fourcast is the **verification and reputation layer for agent-managed prediction-market capital**. It records what an agent knew before an event, which mandate constrained it, why it allocated or passed, and how the outcome later resolved.

The flagship route is one unfolding system: **Mandate Control → Proof Theatre → Diligence**, built on TxLINE as the single primary data layer.

| Route | Purpose |
|-------|---------|
| `/agent` | **Mandate Control** — a live VPS worker operates under a versioned policy, decides from pre-match TxLINE evidence, seals each decision into a SHA-256 receipt |
| `/world-cup` | **Proof Theatre** — 6-stage evidence timeline: pre-match evidence → seeded simulation → versioned policy gates → immutable receipt → TxLINE Merkle proof + Solana PDA verification → reconciliation |
| `/positions` | **Allocator Diligence** — mandate adherence, receipt coverage, discipline rate, calibration from the same public receipts |
| `/markets` | Market edge scanner, sports tabs, cross-venue odds comparison |
| `/signals` | Signal publishing, operator leaderboard, DeFi arbitrage detection |

## TxLINE integration

- **Data ingestion**: fixtures, odds, score snapshots, Merkle proofs directly from TxLINE
- **On-chain settlement**: custom Solana program (`match-escrow` at `AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ`) CPI-calls `txoracle::validate_stat` to trustlessly settle parametric sports policies
- **Proof verification**: `services/txline/solanaVerify.js` fetches the daily-root PDA from Solana devnet, recomputes the Merkle root client-side, and compares against the on-chain value
- **Replay mode**: after the TxLINE data cutoff (July 19), the demo switches to cached replay snapshots so judges can still inspect the same proof data and Solana verification path

## Solana wallet infrastructure

- **ConnectorKit** (`@solana/connector` v0.2.6, Solana Foundation) — Wallet Standard auto-discovery
- Supports Phantom, Solflare, Backpack
- Defaults to devnet (match-escrow cluster)
- Auto-reconnect, SSR-safe
- Unified header dropdown shows EVM (Arc/Polygon) + Solana + Canton

## Technical highlights

- Custom Solana Anchor program (`match-escrow`) with CPI into TxLINE's `txoracle`
- SHA-256 decision receipts reconciled against on-chain Merkle roots
- Deterministic Monte Carlo simulation with persisted seed
- Versioned risk policy gates (Kelly Criterion sizing, edge thresholds)
- Autonomous Historical Lab — replay clock preserves decision-before-outcome ordering

## Key resources

- **Program on Solana devnet**: [`AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ`](https://explorer.solana.com/address/AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ?cluster=devnet)
- **Live demo**: [https://fourcastapp.vercel.app/world-cup](https://fourcastapp.vercel.app/world-cup)
- **Submission doc**: [TXLINE_SUBMISSION.md](../TXLINE_SUBMISSION.md)
