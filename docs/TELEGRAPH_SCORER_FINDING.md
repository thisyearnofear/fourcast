# Telegraph — the agreement gate makes a *corrected* GAME_RESULT scorer structurally unpassable

Season II P3 asked for an Evaluator-track entry: a `GAME_RESULT` attribution
scorer that fixes the Season I champion's blindness. Measured against the
network's own gate, it cannot qualify — and that is a finding about the
gate, not a failed build. Written up instead of shipped as WASM.

---

## The defect the scorer would fix

The Season I champion scorer is **attribution-blind**: it credits the answer
"Boston beat the Knicks 112-108" at **1.0000** even when the Knicks won. It
reads the presence of a result-shaped sentence, not the direction of the
result verb. Our miner already holds the ground truth (TxLINE finals, ESPN
schedules), so a scorer that checks attribution is a small build — that is
not the blocker.

## The gate

A challenger scorer must rank answers the way the incumbent does —
**≥0.60 Spearman rank correlation** — before it may evaluate at all. The
gate exists to stop spam scorers, and on a healthy intent it is a reasonable
proxy for "ranks like the reference".

## The structural problem

Spearman measures agreement *with the incumbent*, not agreement *with the
ground truth*. On `GAME_RESULT` those are opposite directions exactly where
it counts:

- The incumbent inverts ranking on misattributed answers — a wrong-direction
  answer it scores 1.0000 sits *above* a correct terse answer it may score
  lower.
- A corrected scorer must rank those same answers *last*. Every
  misattribution the incumbent rewards is a guaranteed inversion between
  the two rankings.
- The misattribution rate only needs to be large enough to drag ρ below
  0.60 — and the Season I results show misattributed answers were not edge
  cases, they were the winning shape (plain "X beat Y" sentences scored top
  marks regardless of direction).

So the gate does not just penalise the corrected scorer; it **requires the
corrected scorer to reproduce the incumbent's error** to be admitted. A
scorer that passes the gate has, by construction, preserved the defect it
exists to fix. The defect is load-bearing in the gate metric.

## What would have to be true to enter anyway

1. The incumbent's misattribution rate is small enough that ρ stays ≥0.60 —
   i.e. the defect barely matters, making the entry pointless; **or**
2. The gate is measured against a corrected reference, seeded ground-truth
   set, or waived — a rules change, not a build; **or**
3. The corrected scorer *adds* attribution as a secondary signal while
   preserving the incumbent's ordering on everything else — which is
   scorer-laundering: it scores the same as the incumbent and earns nothing.

None of these is a scorer we can build. (3) is a scorer we *could* build and
shouldn't.

## Adjacent gap worth the same line

`EVENT_OUTCOME_RESOLUTION` — the intent closest to our core — has **no
scorer registry entry at all**, so its agreement gate cannot even be
probed (F3 in `docs/TELEGRAPH_FINDINGS.md`). The gate mechanics are
unverifiable on the intent we would most plausibly challenge on.

## The ask

Publish, per intent, the scorer-registry entry and the agreement-gate
reference set. If the gate is intended to admit corrected scorers, its
reference must be ground truth — otherwise the gate selects for fidelity to
the incumbent, and "challenger" is a cosmetic category.

---

*Evidence: Season I scorer behaviour ("Boston/Knicks" 1.0000 on the wrong
direction), the ≥0.60-Spearman gate as documented, and the 2026-09-28 survey
(18 `EVENT_OUTCOME_RESOLUTION` miners, no scorer registry entry). The
handler side of P3 shipped anyway — `src/intents/eventOutcomeResolution.js`,
unregistered, flag-gated — because a correct answer is useful even when a
correct scorer cannot be admitted.*
