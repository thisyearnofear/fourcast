# Fourcast — documentation index

Every document in this repo, what it is for, and whether it is live.
**If a doc is not in this table, it is in [`archive/`](./archive/) and is history.**

Live work is tracked in [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md) — that is the
only plan; the others here describe how the system works, not what to do next.

---

## Start here

| Doc | What it is for |
|---|---|
| [`../README.md`](../README.md) | What the product is, how it runs, what is live |
| [`../STRATEGY.md`](../STRATEGY.md) | Positioning, venue roadmap, and the **Decision Log** (why, dated) |
| [`EXECUTION_PLAN.md`](./EXECUTION_PLAN.md) | **The canonical plan** — Total Recall + Telegraph, owners, gates, dates |

## How the system works

| Doc | What it is for |
|---|---|
| [`ARCHITECTURE.md`](./ARCHITECTURE.md) | Fan-out: providers, caches, circuits, chains, agents |
| [`API_REFERENCE.md`](./API_REFERENCE.md) | Every API route: method, body, responses, failure modes |
| [`RUNTIME_POLICY.md`](./RUNTIME_POLICY.md) | Edge vs Node — which route may run where, and why |
| [`CALIBRATION.md`](./CALIBRATION.md) | Brier scoring, confidence buckets, the calibration curve |
| [`SURFACES.md`](./SURFACES.md) | The surface registry (one row per route) + **the design contract** |
| [`WALRUS_MEMORY.md`](./WALRUS_MEMORY.md) | The memory layer: namespaces, the ladder, precedence, cost |
| [`SUI.md`](./SUI.md) | Sui as a chain: Tatum JSON-RPC reads + x402 self-settled payments |
| [`TXLINE_INTEGRATION.md`](./TXLINE_INTEGRATION.md) | Bookmaker consensus odds, Merkle proofs, cross-venue edge |
| [`STRIKE_INTEGRATION.md`](./STRIKE_INTEGRATION.md) | Strike V2 perps as a venue: Ed25519 API-wallet adapter, mandate-mapped gates, receipts reconciled against Strike's own fills record |
| [`CANTON.md`](./CANTON.md) | Canton: v2 atomic settlement, the BitSafe gate, the runbook, the wallet roadmap |
| [`FEATURES.md`](./FEATURES.md) | What the product can do, surface by surface |

## Doing work

| Doc | What it is for |
|---|---|
| [`SETUP.md`](./SETUP.md) | Install, env, wallets, deployment, git hooks |
| [`HACKATHONS.md`](./HACKATHONS.md) | **Every** hackathon and competition, with what we learned |
| [`TOTAL_RECALL_HACKATHON.md`](./TOTAL_RECALL_HACKATHON.md) | The live entry: the brief, the track, the deliverables |
| [`TELEGRAPH_FINDINGS.md`](./TELEGRAPH_FINDINGS.md) | Telegraph Season II: what the network does, what it refuses |
| [`DEMO_SCRIPT.md`](./DEMO_SCRIPT.md) | The demo, word for word — and the 4-minute judge path |
| [`../design.md`](../design.md) | Visual language: tokens, type, spacing, colour |
| [`../SECURITY.md`](../SECURITY.md) | Key handling, signing, and the rules that are not negotiable |

## Archive

Superseded, kept for the record. Each carries a banner saying why.

| Doc | Why it is here |
|---|---|
| [`archive/NINE_PLAN.md`](./archive/NINE_PLAN.md) | The 6-week product/architecture plan (paused 2026-08) |
| [`archive/GO_TO_MARKET.md`](./archive/GO_TO_MARKET.md) | Operator-first acquisition plan (dormant) |
| [`archive/INSIGHTS_MARKETPLACE.md`](./archive/INSIGHTS_MARKETPLACE.md) | Original design note for the signals/follow layer |
| [`archive/DELPHI_AGENT.md`](./archive/DELPHI_AGENT.md) | Operator guide for the finished Delphi competition |
| [`archive/TXLINE_SUBMISSION.md`](./archive/TXLINE_SUBMISSION.md) | The TxLINE hackathon submission, as submitted |
| [`archive/DESIGN_ALIGNMENT.md`](./archive/DESIGN_ALIGNMENT.md) | The 12 Aug 2026 design review (implemented) |
| [`archive/COMMERCIAL.md`](./archive/COMMERCIAL.md) | One-pager from an inactive fundraising conversation |

---

## Rules for writing docs here

1. **One document per subject.** If a new doc overlaps an existing one, merge
   into it. A doc that exists because it was written is a doc nobody reads.
2. **A plan lives in `EXECUTION_PLAN.md`.** Everything else describes the
   system as it is. A new plan file is a new source of truth, and two sources
   of truth is zero.
3. **Say what is true, and when.** Status claims carry a date. "Live" without
   a date is a claim; "live as of 2026-10-21" is a fact.
4. **Link, don't restate.** One copy of a fact, linked from everywhere.
5. **Archive, don't delete.** A banner saying *why* it is superseded is worth
   more than the file it replaces.
6. **Links are checked in CI.** `npm run check:docs` fails on a broken local
   link or a dead anchor, so a moved doc cannot rot quietly.
