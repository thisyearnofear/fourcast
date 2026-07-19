# Fourcast — 4-Minute Judge Path (Mandate Control)

The judge should leave able to answer five questions without us saying a word:

1. What did the agent know before it acted?
2. What policy stopped it from overreaching?
3. Can I replay or verify the decision?
4. Was the outcome independently proven?
5. Why would an operator or allocator pay?

Everything below is live UI. No slides. The route is one unfolding system — **Mandate → Proof Theatre → Diligence** — not five peer products.

---

## Beat 1 — Mandate Control · the agent is alive · 60s

**Show:** `/agent` — the Mandate Control hero.

**Say:** "This is not a dashboard for a human pressing buttons. An agent is alive on a VPS, operating under a mandate, making constrained decisions, and leaving behind evidence nobody — including its operator — can rewrite."

**Point at, in order:**
- The **live worker lamp** (pulsing green): "Real VPS heartbeat, not a simulation. The agent checks in every cycle."
- The **current mandate headline**: fixture name, verdict stamp (ALLOCATE / PASS / REVIEW), and capital posture against the policy ceiling. "One decision at a time. The agent either allocates a bounded fraction or passes — a PASS is a successful decision, not a failure."
- The **claim of restraint**: "Outcome inaccessible when the receipt was sealed. The agent decided from pre-match evidence alone."
- The **proof timeline** (5-stage horizontal rail): Evidence sealed → Simulation → Policy gate → Receipt → TxLINE proof. "The one animated detail is the crossing — the timeline visibly moves from *outcome withheld* into *proof available*. That crossing is the product."
- The **operator telemetry strip**: worker host, last check-in, receipt hash, on-chain Solana verdict.

**Judge question answered:** 1 (what it knew), 2 (policy constraints visible inline).

---

## Beat 2 — The decision dossier · 75s

**Do:** Click **"Inspect decision dossier"** on the Mandate Control hero.

**Say:** "Five questions an allocator would ask, answered in order from the canonical receipt."

**Walk through the drawer, top to bottom:**

1. **What did the agent know?** — evidence sources, snapshot timestamp, consensus odds (home/draw/away), fair probability vs market odds. "Pre-match TxLINE consensus, demargined. This is what the agent saw."
2. **What did it decide?** — verdict, allocation %, edge, simulation range (p05 / median / p95 with seed and run count). "A seeded Monte Carlo. You can replay it — same seed, same distribution."
3. **What prevented it from overreaching?** — versioned policy gates, each with a pass/fail stamp. "Every gate must clear before capital moves. The policy version is on the receipt."
4. **When was the result unavailable?** — receipt sealed timestamp vs outcome-available timestamp. "The agent could not read the final score when it decided. A lookahead guard asserts this on every receipt."
5. **What later verified the decision?** — outcome, reconciliation status, policy adherence, calibration error, TxLINE Merkle root, Solana PDA verdict, receipt hash. "The same transaction that proves the score also proves whether the agent's allocation was correct."

**Do:** Click **"View raw receipt"** at the bottom. "The full JSON — recompute the SHA-256 yourself. Same bytes, same hash."

**Judge question answered:** 1, 2, 3 (replay/verify), 4 (independently proven).

---

## Beat 3 — Proof Theatre · the outcome doesn't trust us · 60s

**Show:** Navigate to **Proof Theatre** (the `/world-cup` route, second item in the nav).

**Say:** "Decisions are only half the story. The outcome has to be proven independently of us, or the receipt is just our word. Proof Theatre is the final act of an autonomous decision."

**Do:** Click **"Open proof theatre"** on a final fixture with a proof badge.

**Walk through the vertical 6-stage timeline:**

1. **Pre-match evidence** — TxLINE consensus odds, snapshot timestamp, sources.
2. **Seeded simulation** — run count, seed, win/loss probability, fair probability, edge, p05/median/p95 range.
3. **Versioned policy gates** — each gate with pass/fail, policy version and constraints.
4. **Immutable decision receipt** — verdict stamp, allocation, rationale, sealed timestamp, outcome-lock timestamp, SHA-256 receipt hash.
5. **TxLINE Merkle proof + Solana validation** — Merkle root, sequence number, on-chain Solana verdict stamp, PDA explorer link, individual verification checks.
6. **Reconciliation** — outcome score, reconciliation status, policy adherence, calibration error, decision-vs-outcome notes, receipt integrity check.

**Say:** "This is the full proof chain: TxLINE data → agent decision → receipt hash → Merkle proof → Solana anchor → reconciliation. Every step is deterministic and independently verifiable. We don't ask you to trust a chart — we ask you to recompute the receipt."

**Judge question answered:** 4 (outcome independently proven).

---

## Beat 4 — Allocator Diligence · why anyone pays · 30s

**Show:** Navigate to **Diligence** (the `/positions` route, third item in the nav).

**Say:** "An allocator doesn't read a pitch deck. They check adherence. This panel is computed from the same public receipts you just saw — no private report."

**Point at:**
- Stated policy: min edge, allocation cap, tail-loss limit, simulation runs.
- Policy adherence and discipline rate. "A high pass share is the product working — the gate binds when edge is thin."
- Max allocation cleared, against the cap. "It cannot exceed its mandate, and you can check that."
- Receipt coverage and calibration after resolution.

**Say:** "The operator pays to run an agent under a verifiable mandate and build a track record they didn't self-report. The allocator pays to monitor that mandate. Fourcast is the verification and reputation layer between them — we monetise the mandate, the reporting, and the execution, not signal subscriptions."

**Judge question answered:** 5.

---

## Beat 5 — Close · 15s

**Say:** "The route is one system: Mandate Control shows the agent deciding under constraint, Proof Theatre shows the outcome proven independently on Solana, Diligence shows the adherence that earns capital. Fourcast is live. The repo is public. The Solana program is on devnet. Verify without trust."

---

## Fallbacks

- **No receipts in the heartbeat:** the Mandate Control hero shows "Agent offline" with a sealed-lock state. Trigger a manual run from the Operator Controls drawer on `/agent` (collapsible section below the hero) and the receipt populates within seconds.
- **TxLINE replay mode:** the banner explains cached, cryptographically-verified snapshots. The Solana verify step still works against the anchored root — replay mode preserves the full proof chain.
- **Verification fetch fails:** the Mandate Control hero degrades gracefully — the proof timeline shows stages from the heartbeat's self-reported phase, and the dossier drawer shows the error inline. The receipt hash is still verifiable client-side.
- **No Solana wallet?** The dossier and proof theatre work without one. The on-chain settlement panel (on `/world-cup` fixture cards) needs a Phantom/Solflare wallet.

## Pre-demo checklist

- [ ] `/agent` loads with the Mandate Control hero showing a live worker lamp
- [ ] At least one receipt with a verdict (ALLOCATE or PASS) visible in the hero
- [ ] Proof timeline shows the crossing from "outcome withheld" to "proof available"
- [ ] "Inspect decision dossier" opens the drawer with all 5 sections populated
- [ ] On-chain Solana verdict shows in the telemetry strip (not "awaiting proof")
- [ ] `/world-cup` loads with fixture grid; at least one final fixture has a proof badge
- [ ] "Open proof theatre" renders the 6-stage vertical timeline with real data
- [ ] `/positions` loads with the Mandate Panel showing non-zero verdict mix
- [ ] Deployed URL (not localhost)
- [ ] GitHub repo is public

## Copy source of truth

All UI strings: `constants/brand.js`
Mandate Control hero: `components/MandateControl.js`
Decision dossier drawer: `components/DecisionDossier.js`
Proof Theatre timeline: `components/ProofTheatre.js`
Receipt + policy + simulation contract: `services/domain/decision/`
Ledger API: `/api/agent/runs`
Worker heartbeat: `/api/agent/historical-lab`
World Cup verification: `/api/worldcup/verify?fixtureId=18175981`
Nav order: Mandate (`/agent`) → Proof Theatre (`/world-cup`) → Diligence (`/positions`)
