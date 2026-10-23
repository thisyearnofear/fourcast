# Telegraph Season II — findings report

Measured, reproducible network issues found while running miner
`fourcast-sports-intelligence` (Base Sepolia id 148, slug
`fourcast-sports-intelligence`). Per Season I, a measured findings report is
worth more than a marginal miner slot — each item below carries its probe
exhibit, not a paraphrase.

---

## F1 — `/scores/stat-validation` answers 500 on both documented request shapes, all stat keys (SL1/SL12)

**Claim.** The free tier's documented proof surface is unreachable: every
`stat-validation` call for a finalised fixture returns HTTP 500 "Stat
validation failed".

**Evidence.** `telegraph-miner/scripts/proof-probe*.mjs`, run
2026-09-28 on the finalised Broncos–Rams NFL fixture (fixture `18041502`,
`game_finalised` Seq read live, not hard-coded):

- The endpoint serves **two shapes on one path**: multi-stat
  `statKeys=1,2,…` (validateStatV2) and legacy `statKey=[&statKey2=]`
  (validateStat). Sending neither/ambiguously answers **400 "Must provide
  strictly either…"** — the request parser demonstrably works.
- Both shapes answer **500 "Stat validation failed"** for every real statKey
  present on the event record (1–16 per the football-feed encoding page).
- `stat-multiproof` is **not** an endpoint — an earlier version of our own
  client invented it and only ever measured its own 404. Removed; the
  correction is part of the finding.
- Service levels 1 and 12 (both free; 60 s delay vs real-time) cover scores
  and StablePrice odds for NFL / MLS / EPL / World Cup & Int. Friendlies —
  measured 200s on exact fixtures. Only the proof endpoint fails.

**What works instead.** `/scores/historical/{fixtureId}` replays the full
score-event stream (SSE-style `data:` frames; 2,063 events incl.
`game_finalised` on the probe fixture) even after `/scores/sequence` 404s —
but the payload contains **no Merkle roots**, so it proves the outcome was
published, not the outcome itself.

**Product consequence.** `verified: true` is gated on a real Merkle root, so
every answer we serve currently reports `verified: false` — said plainly in
`answer.proof.reason`, `/health` (`txline-proofs` ledger, kept separate from
the score feed so a dead proof endpoint never reads as a dead feed), and
this document. Nothing in the Season II plan may depend on stat-validation
clearing.

**Ask.** Why does `stat-validation` 500 on SL1/SL12 — tier restriction, or a
broken validator? The probe output is the exhibit.

---

## F2 — Displayed-vs-measured scorer bar drift on `GAME_RESULT` (0.7150 vs 0.5622)

**Claim.** The scorer bar shown for `GAME_RESULT` in the network UI does not
match what the scorer actually measured: **displayed 0.7150, measured
0.5622** (live survey 2026-09-28, `npm run survey` in `telegraph-miner/`).

**Why it matters.** Operators tune answers against the displayed bar. A
displayed-measured gap of 0.15 means a miner can ship an answer the UI
implies is comfortably above the bar while scoring materially under it. It
also makes the ≥0.60-Spearman agreement gate unreadable in the other
direction — see `docs/TELEGRAPH_FINDINGS.md` for the gate mechanics.

**Ask.** Which number does the scorer registry record — and which should a
challenger treat as the gate's reference?

---

## F3 — `EVENT_OUTCOME_RESOLUTION` has no scorer registry entry, so its agreement gate can't be probed

**Claim.** The intent is measured and alive (18 miners, best 0.727
`txlens` with 3,523 requests, `chainsight-oracle` 0.671, the
`event-poly-search` trio 0.452) but has **no scorer registry entry** — the
≥0.60-Spearman agreement gate cannot be read for it at all. A challenger
registering `EVENT_OUTCOME_RESOLUTION` is registering blind on the scorer
axis.

**Our response.** We built the handler
(`src/intents/eventOutcomeResolution.js`, flag
`TELEGRAPH_INTENT_EVENT_OUTCOME`, default off) but ship it **unregistered**
— it is not in telegraph.yaml, /status, or /.well-known, and /query cannot
reach it. It is exercised by direct call
(`scripts/demo-event-outcome.mjs`). Adding it to the on-chain set takes
`updateMiner(148, …)` on Base Sepolia, never `registerMiner`. The H2 rules
(published 2026-10-22) settle the per-intent question: "Each Miner–Intent pair
is tested for its specific task and against relevant same-Intent competition."
The missing scorer registry entry is still a finding. Mission 14 lists this
Intent as mission-critical (the self-settling conditional escrow), which is
the case for registering it; see `docs/HACKATHONS.md` → *What the rules mean
for us*.

---

## Standing rules these findings sit under

- **Absent is never zero.** A missing proof is `verified:false` with the
  failure reason, not a quiet omission.
- **Every number sits beside its evidence.** Probe scripts, survey output,
  and tx links are the exhibits — this report paraphrases none of them.
- **Ask the network, don't assume.** Every "measured" date above is a
  re-probe, not a doc citation.


---

## Telegraph — the agreement gate makes a *corrected* GAME_RESULT scorer structurally unpassable

Season II P3 asked for an Evaluator-track entry: a `GAME_RESULT` attribution
scorer that fixes the Season I champion's blindness. Measured against the
network's own gate, it cannot qualify — and that is a finding about the
gate, not a failed build. Written up instead of shipped as WASM.

---

### The defect the scorer would fix

The Season I champion scorer is **attribution-blind**: it credits the answer
"Boston beat the Knicks 112-108" at **1.0000** even when the Knicks won. It
reads the presence of a result-shaped sentence, not the direction of the
result verb. Our miner already holds the ground truth (TxLINE finals, ESPN
schedules), so a scorer that checks attribution is a small build — that is
not the blocker.

### The gate

A challenger scorer must rank answers the way the incumbent does —
**≥0.60 Spearman rank correlation** — before it may evaluate at all. The
gate exists to stop spam scorers, and on a healthy intent it is a reasonable
proxy for "ranks like the reference".

### The structural problem

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

### What would have to be true to enter anyway

1. The incumbent's misattribution rate is small enough that ρ stays ≥0.60 —
   i.e. the defect barely matters, making the entry pointless; **or**
2. The gate is measured against a corrected reference, seeded ground-truth
   set, or waived — a rules change, not a build; **or**
3. The corrected scorer *adds* attribution as a secondary signal while
   preserving the incumbent's ordering on everything else — which is
   scorer-laundering: it scores the same as the incumbent and earns nothing.

None of these is a scorer we can build. (3) is a scorer we *could* build and
shouldn't.

### Adjacent gap worth the same line

`EVENT_OUTCOME_RESOLUTION` — the intent closest to our core — has **no
scorer registry entry at all**, so its agreement gate cannot even be
probed (F3 in `docs/TELEGRAPH_FINDINGS.md`). The gate mechanics are
unverifiable on the intent we would most plausibly challenge on.

### The ask

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
