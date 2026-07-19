# Fourcast — 2-Minute Judge Path (Proof of Decision)

The judge should leave able to answer five questions without us saying a word:

1. What did the agent know before it acted?
2. What policy stopped it from overreaching?
3. Can I replay or verify the decision?
4. Was the outcome independently proven?
5. Why would an operator or allocator pay?

Everything below is live UI. No slides.

---

## Beat 1 — The receipt, not the trade · 30s

**Show:** `/agent` → Autonomous decision ledger, latest run expanded.

**Say:** "This agent doesn't just log what it did. It records what it knew, what constrained it, and a hash you can recompute. Watch."

**Point at, in order:**
- The verdict strip: `N observed → M qualified → K scored → A allocations`. A PASS is shown as a successful decision, not a failure.
- One `DecisionCard`: fair probability vs market price, the edge, the simulated return range with its seed, and the five risk gates with pass/fail.
- The `RECEIPT VERIFIED` badge. Click it. "Your browser just recomputed the sha256 over the canonical receipt. Same evidence, same policy version, same seed — same hash. That's replay."

**Judge question answered:** 1, 2, 3.

---

## Beat 2 — The mandate an allocator would check · 30s

**Show:** `/positions` → Allocator mandate view (top of page).

**Say:** "An allocator doesn't read a pitch deck. They check adherence. This panel is computed from the same public receipts you just saw — no private report."

**Point at:**
- Stated policy: min edge, allocation cap, tail-loss limit, simulation runs.
- Policy adherence and discipline rate. "A high pass share is the product working — the gate binds when edge is thin."
- Max allocation cleared, against the cap. "It cannot exceed its mandate, and you can check that."

**Judge question answered:** 5 (allocator side).

---

## Beat 3 — Outcome that doesn't trust us · 45s

**Show:** `/world-cup` → the five-stage strip at top, then a final fixture with a proof.

**Say:** "Decisions are only half the story. The outcome has to be proven independently of us, or the receipt is just our word."

**Do:**
1. Point at the strip: Evidence → Policy-bound decision → Receipt → Proof → Reconciliation.
2. On a final fixture, click **Verify proof of decision**. Show the receipt, check list, reconciliation state, and Merkle root. "TxLINE finalised the stat. The Merkle root is anchored to a Solana PDA. We're verifying our own claim against a chain we don't control."
3. If a receipt-bound fixture is available, click **Replay match** and show the cached TxLINE replay resolve to the same proof.

**Say:** "Web2 can claim an agent made a smart call. We can show what it knew before kickoff, and prove what happened after — without trusting our database."

**Judge question answered:** 4.

---

## Beat 4 — Why anyone pays · 15s

**Say:** "The operator pays to run an agent under a verifiable mandate and build a track record they didn't self-report. The allocator pays to monitor that mandate. Fourcast is the verification and reputation layer between them — we monetise the mandate, the reporting, and the execution, not signal subscriptions."

**Judge question answered:** 5.

---

## Fallbacks

- **No runs in the ledger:** run the agent live from `/agent` (the dashboard triggers a run) and the receipt populates within seconds. The run is rate-limited to 3/hour, so trigger it before judges arrive.
- **TxLINE replay mode:** the banner explains cached, cryptographically-verified snapshots. The Solana verify step still works against the anchored root.
- **Offline:** the receipt-verification beat works entirely client-side; Beat 1 and 2 need no network beyond the local API.

## Pre-demo checklist

- [ ] At least one recent agent run with `proof.decisions` present (`/api/agent/runs`)
- [ ] `RECEIPT VERIFIED` badge renders on the expanded run
- [ ] Mandate panel shows non-zero verdict mix
- [ ] A final fixture with a proof loads on `/world-cup` and Verify on Solana returns checks
- [ ] Deployed URL (not localhost)

## Copy source of truth

All UI strings: `constants/brand.js`
Receipt + policy + simulation contract: `services/domain/decision/`
Ledger API: `/api/agent/runs`
World Cup verification: `/api/worldcup/verify?fixtureId=18175981`
