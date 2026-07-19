# Go-To-Market — Quant Operator First

This is the document that turns the strategic decision into a 30-day plan. It is the authoritative reference for who we acquire, how we acquire them, and the tests we will *not* use to validate product-market fit.

Related docs:

- `README.md` — Strategic Positioning table (summary)
- `docs/HACKATHON.md` — Why this is the primary RFB
- `docs/INSIGHTS_MARKETPLACE.md` — How this drives the acquisition loop
- `docs/NINE_PLAN.md` P3.1 — Why the IA commits to it
- `constants/brand.js` — The narrative single source of truth

---

## 1. The commitment, in one paragraph

**Primary customer: the Polymarket / Kalshi operator running real capital.** They have a Polymarket private key (or are willing to make one), they execute at least a few fills a week, and they resent the operational schlep of cron reliability, cross-venue fee math, Kelly calibration, and "did the order actually fill" reconciliation. They will hand us their private key the moment our **dry-run audit** is provable. Everything else we build — marketplaces, social follow graphs, retail free tier — exists to get more of them in the door.

**Distribution:** The signal marketplace. Every dry-run and live fill publishes a verifiable card. One operator's verified win trace recruits the next operator's concierge prospect. We don't pay to acquire; the OG share card on Warpcast / X is our growth channel.

**Acquisition funnel:**

```
Quant Operator
        ▲
        │
Warpcast / X  ──►  Verified fill card (OG)
        ▲                   │
        │                   ▼
Follower / Analyst     Operator-attributed tip
        ▲                   │
        │                   ▼
Retail discoverer ──► Free tier public Track Records  ──► Concierge DM
```

The free tier is **acquisition only**. Its job is to (a) show public Track Records that look real to an operator's eye, and (b) generate follower-Analyst accounts who surface operators to their networks. Retail conversion to paid is acceptable but never the goal.

---

## 2. The 14-day concierge test (single source of truth on validation)

This is the **only** experiment that validates the strategy. We do not trust free-tier A/B tests for this customer — they have different incentives.

### 2.1 Pre-step: build (or rebuild) the prospect list (Day 0 → Day 7)

If you don't have 5 named candidates by Day 7, the strategy is **not yet testable** — keep prospecting, do not start the concierge test.

**Honest starting state for most founders:** zero operators in your network. The pre-step is therefore not "find 5 DMs to send" — it is "build the system that produces 5 named DMs by Day 7." Plan for that.

**Channels (do them in parallel, do not skip):**

1. **Polymarket Builder Program Leaderboard** — sort by attributed volume, take the top 20 names, check for public contact (X / Farcaster / Discord).
2. **Polymarket Discord `general-trader` channel** — read the last 30 days of messages for anyone complaining about execution schlep. DM them.
3. **Warpcast / Farcaster `predictions` channel** — find accounts that post verified fills with reasoning. DM the top 10 by post engagement.
4. **X / Twitter** — search `"polymarket autopilot"` and `"kalshi bot"`. DM anyone running a public bot with intent to scale.
5. **The Fourcast waitlist / existing Telegram bot** — outbound to anyone who already voted with their attention.

**Day-by-day deliverable for the zero-pipeline case:**

| Day | Outcome |
|---|---|
| 0 | Build a prospect-list spreadsheet (5 channels × 20 candidate rows = ~100 empty rows). Draft a concierge DM template (see §2.4) and a daily Telegram report template (see §2.5). Do not personalize yet. |
| 1–3 | Send the **same** un-personalized DM to 25 candidates (5 per channel). Track: opened, replied, moved-to-handroll. Variation kills the experiment. |
| 4–5 | If reply rate < 8%, rewrite the DM — common failures: too long, sounds sales-y, asks for the private key upfront. If > 8%, you're ready to hand-roll configs for the responders. |
| 6–7 | Convert respondents into named candidates. **Only count someone who has at least one public fill or reasoned signal in the last 30 days.** If you have < 5 by Day 7, extend the pre-step. Do not start the test with < 5. |

**Optimistic case (skip the work above):** if you DO have 5 named candidates queued at Day 0, skip to §2.3. Re-validate the pipeline in 30 days.

**Goal when pre-step completes:** 5 named individuals with contact + at least one public fill or reasoned signal in the last 30 days.

### 2.2 The 14-day dry-run test (Day 7 → Day 21)

For each of the 5 operators:

1. Hand-roll their `agentConfig`: risk tolerance, market universe, execution cadence, dry-run only.
2. Wire a daily Telegram DM with a 4-line summary:
   > *"Yesterday your agent scanned N markets. Spotted X edges ≥5%. Sized at Y% Kelly per your risk tolerance. Dry-run P&L if live: +$Z."*
3. Send one human-led message per day, hand-tuned. Do not automate it. (PG: "do things that don't scale.")
4. After 7 days, send the live-execution offer with a public Track Record URL.
5. Stop the test if the operator goes silent for 3 consecutive days.

**Conversion rule:** **3 of 5 must opt into live execution with their private key by Day 21.** Anything less and the strategy is wrong. Anything more and we hire a concierge specialist.

**The single decisive question each operator is implicitly answering:** *"Will I trust this team with my private key to execute fills automatically?"* If the answer is yes, the strategy is right. If the answer is no on grounds of trust/custody, we pivot (see §5).

### 2.3 What we do not use as a test

These are explicitly **not** evidence of product-market fit for the Operator strategy:

- Free-tier sign-ups
- Landing-page bounce rate
- Telegram bot `/start` commands
- Number of signals published by users with no capital exposure
- Brier scores of signals published by casual users

These matter for the acquisition layer, never for the headline.

---

## 3. Pricing — committed

| Tier | Price | For whom | What they get |
|---|---|---|---|
| Free | $0 | Discovery + audit | 3 analyses/day, public Track Records, signal marketplace |
| Pro | $9.99/mo USDC | Casual operator lite | Unlimited analyses, weather + web scrape enrichment, no Autopilot |
| **Premium** | **$19.99/mo USDC** | **The Quant Operator — primary customer** | Everything in Pro + Autopilot + Kelly + Builder attribution + private Track Record |
| Builder-attributed fills | Net of Builder program | Live Autopilot users | Real per-fill USDC revenue |

Premium is the headline tier. The Operator math is: if Premium pays for itself in fewer than 3 attributed fills, it's a no-brainer. That math is the landing-page headline for Operators.

---

## 4. The 30-day rolling plan

| Day | Outcome |
|---|---|
| 0 | (Pre-step) Build prospect-list spreadsheet, draft DM + Telegram templates |
| 1–3 | (Pre-step) Send the same DM to 25 candidates; track response rate |
| 4–5 | (Pre-step) Iterate on DM if reply rate < 8% |
| 6–7 | (Pre-step) Gate: **stop here unless you have ≥ 5 named candidates** |
| 8–9 | Hand-roll config for each candidate; wire daily Telegram summary |
| 10 | First daily reports go out |
| 11–17 | Daily reports continue; track responsiveness |
| 18 | Mid-test pivot decision if any operator has gone silent |
| 19–23 | Push live-execution offers, public Track Record URLs |
| 24 | Test end — go/no-go on retention + scaling |
| 25–30 | Convert 3-of-5 → onboard as paying Premium → start outreach for the next 5 |

---

## 5. The pivot trigger — when to switch to the fallback customer

Switch primary customer from **Quant Operator** to **Signal Analyst (Reputation Climber)** if and only if:

> **The 14-day test returns <3/5 conversions to live execution AND the reason is "I won't give you my private key to a SaaS"** (not "your edges are wrong," "your UX is bad," or "your markets are wrong").

The custody barrier is the only pivot trigger that *preserves* the strategy's distribution loop. Other failure modes require product work, not a customer pivot.

When pivoting, ship the same product, change the positioning:

| | Operator pivot (continue) | Analyst pivot (fallback) |
|---|---|---|
| Primary surface | `/autopilot` | `/signals` |
| Primary revenue | Premium $19.99/mo + Builder USDC | Tips USDC + Pro $9.99/mo |
| What changes | None | Disable private-key storage; emphasize provenance and follow graph |
| What doesn't change | Signal marketplace, follow graph, on-chain Track Record | Same |

---

## 6. The 30-day kill criteria (what would make us shut it down)

We stop and re-strategize if *all three* of these are true at Day 30:

1. <3/5 conversions to live execution in the concierge test
2. <50 organic follower-Analyst accounts in the acquisition marketplace
3. <1 paying Premium user

If only one or two of these fail, we keep iterating on product. If all three fail, the customer is wrong or the product is wrong; either way we don't paper over it.

---

## 7. What we explicitly do NOT do

- **No retail-facing ad spend.** Retail is acquisition only.
- **No "AI finds you edges" marketing headline.** We don't make that claim; it's a credibility liability.
- **No cross-chain or multi-venue feature work without an Operator-thread attached.** Canton / Arc / cross-chain features are plumbing; they ship when the Operator loop needs them.
- **No A/B testing against casual free-tier behavior to validate the Operator strategy.** Free-tier A/B tests measure the acquisition funnel, not the headline product.
- **No raising capital on a "we have X free-tier users" story.** Operators are the only metric that matters for fundraising.

---

## 8. Definition of done — end of month 1

- [ ] 5 operators prospect-listed
- [ ] 3 converted to live Autopilot
- [ ] Public Track Record URL for each, with their consent
- [ ] At least 1 attributing Builder fill on Polymarket attributed to Fourcast
- [ ] Warpcast / X OG share cards live, with at least 3 organic reposts
- [ ] Daily Telegram summary template reproducible for the next 5 prospects
- [ ] Day 14 retro published internally with a kill / scale / pivot decision

When this is done, we have evidence to hire a full-time concierge specialist and start the next 5.

---

*This document is canonical. If a feature, design choice, or pricing change contradicts it, update this first.*
