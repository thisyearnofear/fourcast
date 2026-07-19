# Fourcast — Commercial One-Pager

The buyer-facing story, the concierge path, and the interview script. Strategy and the 14-day test live in `docs/GO_TO_MARKET.md`; this document is what we say to a customer.

Related: `constants/brand.js` (copy source of truth) · `docs/DEMO_SCRIPT_PROOF.md` (the 2-minute proof) · `docs/HACKATHON.md` (judge narrative)

---

## The problem

Capital is starting to run through agents on prediction markets, and neither side of that capital can verify the other.

- **Operators** run bots on Polymarket and Kalshi but cannot prove their process to anyone else. A track record screenshot is self-reported. A good month looks identical to luck.
- **Allocators** (funds, syndicates, prop desks) want exposure to agent-managed prediction-market capital but have no way to diligence it. They cannot tell a disciplined agent from a lucky one, or a policy-bound agent from one that overrode its own rules.

The missing layer is not another signal or another execution bot. It is **verification**.

## What Fourcast is

> Fourcast is the verification and reputation layer for agent-managed prediction-market capital.

The agent records, for every decision: the evidence it saw, the versioned risk policy that constrained it, a seeded Monte Carlo of the position, and the verdict — allocate, pass, or review. That record is bound into a single hash. The outcome is then reconciled against an independent proof (TxLINE finalised stats anchored to Solana), not against our database.

The result: a decision history that is **replayed, not retold**. Same evidence + same policy version + same seed = same hash. A refusal is as auditable as a trade.

## The loop a buyer sees

```
Evidence → policy-bound decision → decision receipt → proof → reconciliation
```

1. **Evidence** — TxLINE consensus and cross-venue prices, recorded pre-event.
2. **Decision** — the agent allocates or passes under a stated policy (min edge, allocation cap, tail-loss limit). A pass is a first-class outcome.
3. **Receipt** — evidence + policy + simulation bound into one sha256. Anyone can recompute it.
4. **Proof** — the outcome is finalised by TxLINE and anchored on Solana.
5. **Reconciliation** — the receipt's claim is checked against the on-chain proof.

## Who pays, and for what

| Buyer | Pain | Pays for |
|-------|------|----------|
| **Operator** | Cannot prove process; track record is self-reported | Policy-bound autonomous execution + a credible, replayable track record |
| **Allocator** | Cannot diligence agent-managed capital | Mandate monitoring: stated policy, adherence rate, verdict mix, verified-receipt ratio |

Fourcast monetises the **mandate, the reporting, and the execution** — not generic signal subscriptions. The immediate wedge is the operator; the durable business is the allocator relationship the operator's receipts create.

## Why now

- Agents are already trading prediction markets; the tooling is one-sided (execution exists, verification doesn't).
- Polymarket's Builder Program created attributed execution — fills that can be tied to an operator. Attribution is the raw material of a reputation layer.
- TxLINE + Solana made outcome proof cheap enough to be a product feature instead of an audit.

---

## Concierge sales workflow (operator)

Aligned with `docs/GO_TO_MARKET.md` §2 — this is the conversation, not a funnel.

1. **Prospect** from the channels in GO_TO_MARKET §2.1 (Builder leaderboard, Polymarket Discord, Warpcast, X bot operators).
2. **Open with the audit, not the product.** "Run your next ten decisions through Fourcast in advisory mode. You keep your keys and your venue accounts. We just produce the receipts."
3. **First value moment:** the operator expands a run in the decision ledger and recomputes a hash in their own browser. Do not pitch before this happens.
4. **Second value moment:** the mandate view. "This is what an allocator would see if you showed them your book." Adherence rate, discipline rate, max allocation vs cap.
5. **Convert:** advisory → Autopilot (safety-gated execution) only after the operator has read their own receipts. The paid tier is the execution rail plus the hosted, proof-backed track record.
6. **Land the allocator:** the operator's verified track record becomes the asset we introduce to allocators. We do not invent traction — we broker diligence on receipts that already exist.

## Buyer interview script

Goal: test whether verification is the wedge, not whether the UI is nice. Five questions, ~15 minutes. Do not demo first.

**To operators:**
1. "When you tell someone your bot is good, what do you show them? What do they push back on?"
2. "Have you ever tried to raise money or get backing for your strategy? What did diligence look like?"
3. "If a third party recomputed every decision your bot made and published the hash, what would that be worth to you? What would it cost you?"
4. "What would make you *not* want your decisions independently verified?"
5. "What's the schlep in your current loop you'd pay to delete — and is proving-your-process on that list?"

**To allocators:**
1. "What would it take for you to allocate to an agent-managed prediction-market strategy today?"
2. "How do you currently diligence a trader you've never met? What do you not trust?"
3. "If you could see a strategy's stated risk policy and its adherence rate, replayable, before a dollar moved — how does that change your answer to #1?"
4. "What adherence number would make you walk away? What pass rate reads as discipline versus cowardice?"
5. "Who else has this problem, and what would you pay to monitor a mandate monthly?"

**Signal to listen for:** if either side describes verification as a "nice to have" but execution as the pain, the wedge is wrong. If the allocator asks "can I get this for strategies I already back," the wedge is right.

## What we do not claim

- No traction we don't have. Receipts, not user counts.
- No "AI trading with blockchain." The chain is settlement and proof plumbing; the product is the verifiable decision.
- No alpha claims. We verify process and outcome; we do not promise returns.
