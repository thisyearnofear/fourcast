# Blog post draft — Total Recall submission

> Working title: **"The agent that remembers being wrong"**
> Mandatory coverage: what it does · how it uses Tatum + Walrus · how it learned
> over time. Publish target: dev.to / Medium. Draft 2026-11-02 — numbers verified
> against the mainnet relayer on that date. [TODO] marks what still needs filling.

---

## 1. Hook

Every AI prediction app shows you a leaderboard of wins. Almost none will show
you its calibration curve the week it was overconfident and wrong.

Fourcast is an autonomous prediction-market operator. Its decision receipts
were already auditable — every call sealed before the outcome existed. For
Total Recall we gave it the missing half: **memory**. Credibility state that
persists on-chain on Sui mainnet via Walrus Memory, written only from evidence
it can trace, and fed back into the decisions it makes next.

## 2. What's new (built inside the build window)

The receipts, the miner, the decision core — those predate the hackathon.
What's new:

- A Walrus Memory substrate (`services/memory/`): per-signal, per-window,
  per-analyst, per-source namespaces under a `fourcast.memory/v1` text contract,
  versioned append-only so each update is a new rung, not an overwrite.
- Resolution-triggered writes: every settled forecast calls `rememberResolution`
  — memory is a consequence of evidence, never a timer.
- A Tatum Sui read path (`services/tatum/`): Tatum's GraphQL gateway re-reads
  the MemWal account object on mainnet — proof the memory actually landed.
- Reads that change the product: `readSizingCalibration()` feeds Kelly sizing
  on a **db → memory** precedence, and each receipt stamps the `blobId`/`textHash`
  that moved the size.

## 3. The memory schema — and the honesty rule

Four flat namespaces:

- `signal:{id}` — outcome + the factor that drove the winning exit
- `window:{period}` — the aggregate reliability curve for the period
- `analyst:{address}` — calibration summary (Brier, hit rate, bucket mix)
- `source:{venue}` — source-level reliability + disagreement events

**Honesty rule:** a memory without a receipt, an address, or a resolved outcome
behind it is not written. Every number sits beside its evidence — the same rule
as our miner attestation.

## 4. How Tatum and Walrus divide the work

- **Walrus Memory (write):** the relayer accepts append-only memories against
  our delegate key. Writes return blob ids, so every claim is citable.
- **Tatum Sui RPC (read):** through the GraphQL gateway (`sui-mainnet.gateway.tatum.io`)
  — chain id, latest checkpoint, and the MemWal account object re-read as an
  onchain proof. Not decorative: the read is how a reader confirms the write
  happened without trusting our API.

## 5. How it learned over time — the ladder, not the highlight reel

This is the required section and the honest one.

**As of 2026-11-02: 598 confirmed writes on mainnet** — `fourcast.signal` and
`fourcast.window` across 92 distinct rungs of the `window:2026-11` key alone
(v1 → v92): each resolution appends a new rung to the same key, so the version
ladder is a literal record of the model updating. 359 forecasts logged, 309
resolved and scored.

Banked captures (2026-11-02, `media/`):
- `media/recall-arena-memory.png` — the `/arena?lane=memory` lane in full:
  "598 memory rungs confirmed on mainnet" banner, the version ladder, the
  calibration reliability diagram (309 resolved, Brier 0.1833), and the
  "what the memory did to the size" comparison.
- `media/recall-memory-status.png` — `/api/memory/status` raw JSON.
Note: the ladder shows TWO windows — `window:2026-10` reached ~v217 and
`window:2026-11` is at v92 — a learning curve that spans months.

## 6. What the memory got wrong (and how the curve caught it)

Real misses, scored on the all-forecasts ledger (Brier — lower is better):

- **"Will Max Verstappen win the 2026 F1 Mexican Grand Prix?"** — the market
  priced him at 99.95%; our model said 15%. He won. Brier **0.72** — the single
  worst score on the board, and it sits in memory next to its rung, not in a
  footnote. The shrinkage factor after this rung is what dampened the next
  MEDIUM-bucket size.
- **"Counter-Strike: FURIA vs Natus Vincere (BO3) — IEM Beijing Group A"** —
  model gave FURIA 18%. FURIA won. Brier **0.67**.
- For contrast, the good calls it also remembers: *Shubladze vs Samsonova,
  Hong Kong Open* (85% → won, Brier 0.02) and *Rinderknech vs Cerundolo,
  Paris Masters* (100% → won, Brier 0.00).

Selection-bias honesty: memory writes come from the *all-forecasts* ledger,
not the traded-only one — reporting misses as misses.

A blog post that only shows the wins would read as marketing. The misses are
the evidence the loop is real.

## 7. Verify it yourself

- Relayer inventory: https://relayer.memory.walrus.xyz (MemWal account
  `0xa65e…893c`)
- Example blob ids (query them yourself): `nnDhOYQy1tfwpXA4QCnQWthZHTyoKUq1Sbzq5tIFf_o`,
  `kFQxC8udGm1WJ7IEfggX91s4LyfGRQM5t4j0Bc31ZdU` (window v92),
  `J1WwaDHynSs_K43xzNrA6UwMYKlTI1qEk-LEcizva5g`,
  `sH6BDRCznTFd3FkpX9jYWVVhIj-53kYOGfh1YViSZ9M`,
  `cu0alOM_voO2AHJC3XCmTJzOQZcvqZFuCLA-ZgAb9ts`
- Live app: https://fourcastapp.vercel.app → `/arena` memory lane
- Repo: github.com/thisyearnofear/fourcast — `services/memory/`,
  `services/tatum/`, `docs/WALRUS_MEMORY.md`

## 8. Numbers box (for the header/social card)

| | |
|---|---|
| Confirmed writes on mainnet | **598** |
| signal / window | 275 / 275 |
| `window:2026-11` | versions **1 → 92** |
| Write trigger | hourly resolve cron → `rememberResolution` |
| Reads | Tatum GraphQL → Sui mainnet account object |
| Cost | append-only, non-PII, evidence-gated |

---

### Submission form cheat-sheet (keep with the post)
- Track: **1 — Markets & Sports Prediction**
- Tatum account ID: `64f72e0e0c34f3d88de98881`
- `MEMWAL_AGENT_ID` (delegate pubkey): `0de77bec7ae0f7c5c4a63c7609fd08e96af1840c6db4a4533a775cc406d70db3`
- Repo + demo + this post link; target submission **Nov 9** (hard close Nov 10 17:00 UTC)
