# Total Recall — Tatum × Walrus Memory Hackathon

> **Status: 🔴 open — build window 20 Oct – 10 Nov 2026.** Submissions close
> **10 Nov 2026, 17:00 UTC**. Judging 11–16 Nov; winners 17 Nov.
> Source: [recall-tatum-walrus.vercel.app](https://recall-tatum-walrus.vercel.app/)
> (fetched 2026-10-20). **Re-verify every number, prize and rule against the
> official page before relying on this plan** — same discipline as the Telegraph
> season above.
>
> **Existing projects:** allowed *"if the submitted work is new progress during
> the build window."* So the memory layer must be built between 20 Oct and
> 10 Nov, and the blog post has to show that progress.

---

## The event (at a glance)

| | |
|---|---|
| **Prize pool** | $4,500 — 3 tracks × $1,000 ($500 / $300 / $200) |
| **Special awards** | 3 × $500 — Best Walrus Memory · Best Tatum AI Builder app · Best Use of Agent Payments (x402 or MPP, **settled on Sui**) |
| **Format** | Fully online, global. Solo or teams. Web2 builders welcome. |
| **Tracks** | 1. Markets & Sports Prediction · 2. Smart Agents for Real Life · 3. Consumer Finance Apps |
| **Chain** | Sui (Walrus Memory on Sui **mainnet**; Tatum Sui RPC + Data APIs) |

**Mandatory deliverables**

- [ ] Walrus Memory integrated and **writing on Mainnet** — integrated (client, ledger,
      store, resolution triggers, tests green); **no mainnet write yet**
- [ ] **At least 10 memories stored on Mainnet** — 0. **The binding constraint.**
- [ ] Tatum RPC used for onchain data *where relevant* — client + proof helper built
      and tested; **no live key, no real read yet**
- [ ] Published blog post — what it does, how it uses Tatum + Walrus, **how it learned
      over time** — not started; it needs the learning curve, which needs real rungs
- [ ] Working demo + public repo — public repo yes; the memory demo lane exists on
      `/arena` but has nothing to show yet
- [ ] Tatum dashboard account ID on the submission form — **account not created**
- [ ] `MEMWAL_AGENT_ID` (the public key under *Delegate keys*) on the form — **agent not
      created**

**Judging:** 30% Walrus + Tatum integration · 30% technical quality (incl.
successful **Tatum Sui RPC** integration) · 20% creativity · 20% presentation.

## Why Fourcast, and why Track 1

The Track 1 brief, verbatim:

> Build a prediction app for sports, elections, culture, or markets. Compare
> bookmaker odds with onchain sources. **Track which voices were right.** Users
> log picks before events. **Memory stores credibility scores so the app learns
> who to trust.**

That is a description of machinery Fourcast already runs:

| Brief clause | What we already have | Where |
|---|---|---|
| "Track which voices were right" | `analyst_address → prediction → outcome → Brier_score`; analyst leaderboard, follow graph, verified public track record | `docs/archive/INSIGHTS_MARKETPLACE.md` |
| "Memory stores credibility scores" | Source-level calibration — per-platform Brier scores; confidence buckets; calibration curve; calibration-aware Kelly sizing | `docs/CALIBRATION.md` |
| "Odds dashboards that flag when sources disagree" | Cross-venue edge detection: TxLINE consensus vs Polymarket/Kalshi price | `docs/TXLINE_INTEGRATION.md`, `STRATEGY.md` |
| "how it learned over time" | The calibration curve is *already* a chart of learning over time; the all-forecasts ledger exists specifically to kill the traded-only selection bias | `docs/CALIBRATION.md` |

**What is missing is the one thing the brief names:** today that credibility and
calibration state is local to a deployment. The brief wants **portable memory**
that persists across sessions, on Sui, and that visibly changes the product.

**Additive, not a migration.** The miner, the receipts and the decision core
stay where they are. Walrus Memory is a new substrate bolted on, not a
re-platform. Nothing moves chain.

### Do not resurrect the paused agent lane

`docs/HACKATHONS.md` records that the agent lane is honestly `PAUSED` and that
the recommended repositioning is **miner-first** (verified sports intelligence as
the live product; agent as an auditable archive). This entry must be built on
the **miner + calibration + credibility** surface. A new agent product on a
paused lane would contradict our own recorded strategy, and the judges read the
demo, not the excuse.

## The plan — three instruments

### 1. Walrus Memory (Sui mainnet) — the memory substrate

- Create the agent at [memory.walrus.xyz/dashboard](https://memory.walrus.xyz/dashboard);
  the public key under *Delegate keys* is `MEMWAL_AGENT_ID`.
- Docs: [docs.wal.app/walrus-memory](https://docs.wal.app/walrus-memory).
- **Memory schema — per-analyst, not per-user.** This is portable, non-PII
  memory, which is what makes it safe to write to a public chain:
  - `analyst:{address}` → calibration summary (Brier, log-loss, hit rate,
    sample size, last updated, confidence bucket distribution)
  - `source:{venue}` → source-level reliability + disagreement events
  - `signal:{id}` → outcome + the factor that drove the winning exit
  - `window:{period}` → the aggregate reliability curve for the period
- **Honesty rule:** never write a claim we cannot trace. A memory without a
  receipt, an address, or a resolved outcome behind it is not written. This is
  the same rule as the miner attestation — *every number sits beside its
  evidence*.

### 2. Tatum Sui RPC — the onchain read path (the weakest link, treat it that way)

**Our onchain state is on Solana (Merkle proofs), Base (miner registration),
Movement and Canton. There is no Sui component today.** So a sprinkled-on Sui
read scores nothing, and 30% of the judging is technical quality with "successful
Tatum Sui RPC integration" named in it.

Three options, in order of honesty:

| Option | Sui read | Cost | Verdict |
|---|---|---|---|
| (a) Port the credibility registry / signal publication to Sui | meaningful | a port — contradicts the additive rule and burns the whole window | **no** |
| (b) Settle premium signals via x402/MPP **on Sui**; Tatum RPC reads the settlement | meaningful — Sui is where money actually settles | the stretch goal; also the route to the $500 agent-payments award | **stretch** |
| (c) Read the Walrus Memory agent's onchain presence via Tatum Sui RPC | thin but real — it is the one thing that ties the two instruments together | hours | **floor** |

**Plan: ship (c) as the floor, attempt (b) as the stretch.** If (b) lands, Sui is
load-bearing rather than decorative, and the special award is in play.

### 3. The blog post — the learning curve

*"How it learned over time"* is a required deliverable, and our calibration
curve is already exactly that chart. The post is therefore not a write-up — it
is the evidence:

- the reliability diagram and the per-analyst credibility re-ranking, week over
  week;
- the memory write log (what was written, when, and what it changed);
- an honest account of what the memory got **wrong** and how the calibration
  curve caught it.

That last one matters: our own season-I post-mortem and the Telegraph section
above show we win credibility by reporting absences as absences. A blog post
that only shows the wins will read as marketing.

## Special awards we should aim at

| Award | Why it is reachable |
|---|---|
| **Best Walrus Memory** ($500) — *"deepest learning loop. Memories that visibly change the product."* | **Our strongest shot.** The loop is literal: credibility scores change who we follow, what we size, and what we surface. The re-ranking is the demo. |
| **Best Use of Agent Payments** ($500) — x402 or MPP settled on Sui | We already run x402 machinery (the Telegraph P4 ladder: ~$0.01 x402 Engine call → ~$1.00 onchain job). Moving the payment leg to Sui is the cheapest route to a $500 award. |
| **Best Tatum AI Builder** ($500) | **Take only as a fallback.** Indie and AI Builder builds compete on the same track prizes, but a generated shell risks the 20% creativity and 20% presentation marks, and hides the "clean code" 30%. The indie path is worth more here. |

## Build plan (3 weeks)

**Week 1 · 20–26 Oct — substrate**
- [x] Tatum Sui JSON-RPC client landed — `services/tatum/tatumSuiClient.js`, with a
      tri-state object-proof helper (`assertMemoryObjectOnChain`) and mocked-fetch
      tests. The deliberate gRPC deviation is documented in
      [`docs/SUI.md`](./SUI.md). **Still needed: a Tatum account + API key, and one
      real mainnet read through it.**
- [ ] Walrus Memory agent created; `MEMWAL_AGENT_ID` captured. The client
      (`services/memory/memwalClient.js`) is built and configured, but no agent
      exists on the dashboard yet, so the public key the form asks for is not yet
      ours to paste.
- [x] Memory schema decided and implemented — four flat namespaces, the append-only
      version ladder, and the `fourcast.memory/v1` text contract
      ([`docs/WALRUS_MEMORY.md`](./WALRUS_MEMORY.md)). **Still needed: the first
      10+ mainnet writes.**
- [x] Prove one meaningful Sui read through Tatum RPC (floor: option c) — the code
      path exists and is tested against mocked responses. **Still needed: one real
      read against a live key.**
- [x] Decide (c) or (b) — written down: **(c) is the floor and ships; (b) is the
      stretch and stays dark unless the `SUI_NETWORK` conflict is resolved
      separately.** See the decision log in [`STRATEGY.md`](../STRATEGY.md).

**Week 2 · 27 Oct – 3 Nov — wiring**
- [x] Memory writes driven by the calibration pipeline (per-analyst + per-source
      on resolution, not on a timer) — `services/memory/{ledgerMemory,writeLedger,
      memoryStore,resolutionTrigger}.js`, with the resolution hooks wired into the
      agent resolve route, the VPS worker and the Delphi sweep.
- [x] Reads that visibly change the product: `readSizingCalibration()` feeds
      `utils/kellySizing.js` on a **db → memory** precedence, and the receipt
      stamps the `blobId`/`textHash` that moved the size. The `/arena` memory lane
      renders the version ladder.
- [ ] Demo route; capture the learning curve as images as they accrue. **Blocked
      on real rungs** — with no confirmed write there is no ladder to photograph.
- [ ] x402-on-Sui spike (stretch, option b) — implemented and tested
      (48 assertions), but inert by construction: settlement defaults to testnet
      while the memory leg is mainnet, and one `SUI_NETWORK` cannot name both
      chains. Decision gate **1 Nov**.

**Week 3 · 4–10 Nov — ship**
- [ ] Blog post (the learning curve + the honest failures).
- [ ] Demo video; public repo clean.
- [ ] **Submit by 9 Nov.** 10 Nov 17:00 UTC is the hard close and submission
      always takes longer than it thinks.

## Judging map

| Criterion | What earns it |
|---|---|
| 30% Walrus + Tatum integration | Real memory schema, real mainnet writes, a Tatum Sui read that is load-bearing rather than decorative |
| 30% Technical quality | Clean code; a *successful* Tatum Sui RPC integration; every claim traceable to a receipt |
| 20% Creativity | The credibility-memory loop applied to cross-venue disagreement — not another TA indicator |
| 20% Presentation | Blog post with the learning curve + a demo that shows the re-ranking happening |

## Risks

- **Sui RPC weight (30%).** Our weakness. Mitigated by making Sui the settlement
  rail (option b) rather than a read we bolted on. If (b) fails, the entry is
  still submittable but should be expected to place below an app that lives on
  Sui.
- **The agent lane is paused.** Build on the miner/calibration surface, not on
  the trading agent.
- **Existing-projects rule.** The memory layer must be new work inside the
  window; the blog must show it. Do not submit a wrapper over 2025 code.
- **Selection bias.** The all-forecasts ledger exists because the traded-only
  ledger overstates us. Memory must be written from the all-forecasts ledger,
  not the traded one.
- **Scope.** Three weeks. One track. No new product surface beyond the memory
  read/write path and the demo route.

## What we are not doing

- Not porting the miner, receipts, or decision core to Sui.
- Not resurrecting the paused agent lane.
- Not writing a claim we cannot trace to a receipt, address, or resolved
  outcome.
- Not shipping an AI Builder shell as the product.
- Not entering more than one track.

---

*Added 2026-10-20 (plan). Updated 2026-10-21 with build state: the memory layer, the
Tatum client and the x402 rail are built and tested; **no memory has been written to
Sui mainnet yet**, and the ≥10-memory deliverable is the binding constraint. The
canonical plan and the status board live in
[`docs/EXECUTION_PLAN.md`](./EXECUTION_PLAN.md).*
