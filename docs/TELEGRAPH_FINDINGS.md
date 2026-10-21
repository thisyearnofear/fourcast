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
direction — see `docs/TELEGRAPH_SCORER_FINDING.md` for the gate mechanics.

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
`updateMiner(148, …)` on Base Sepolia — never `registerMiner` — and waits on
Season II rules confirming multi-intent miners score per-intent.

---

## Standing rules these findings sit under

- **Absent is never zero.** A missing proof is `verified:false` with the
  failure reason, not a quiet omission.
- **Every number sits beside its evidence.** Probe scripts, survey output,
  and tx links are the exhibits — this report paraphrases none of them.
- **Ask the network, don't assume.** Every "measured" date above is a
  re-probe, not a doc citation.
