# Fourcast × TxLINE Hackathon Submission

## Project: Fourcast — Verifiable Agent Mandates with TxLINE Outcome Proofs

**Live demo:** [https://fourcastapp.vercel.app/world-cup](https://fourcastapp.vercel.app/world-cup)
**Program on Solana devnet:** [`AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ`](https://explorer.solana.com/address/AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ?cluster=devnet)
**Demo video:** Pending final recording

---

## Our experience with the TxLINE API

The standout feature is the Merkle proof system — being able to cryptographically verify a match outcome on Solana via a CPI call to `validate_stat` is genuinely novel. The proof structure (sub-tree + main-tree proofs with `isRightSibling` bits) maps cleanly to on-chain settlement logic, and the `view()` function let us test the CPI path without submitting transactions, which accelerated development significantly. The data model (stats keyed by participant ID and period) made it straightforward to build parametric insurance policies that auto-settle based on verified results.

The main friction point was team name resolution — the API returned "Team 3095" instead of "Sweden" for a World Cup Round of 32 fixture, which we had to work around with a manual ID-to-name mapping. We also found that the CPI accounts list required careful manual assembly: the `daily_scores_roots` PDA and the `txoracle` program ID both needed to be explicitly included in our `SettlePolicy` accounts struct, and the documentation didn't make this immediately clear. Proof caching was another challenge — the proof is only available in a narrow window after the match finalizes, so we had to build a replay caching system to capture and persist the full proof data (including `statToProve`, `summary`, and both tree proofs) for later use in the demo. Once cached, though, the proof verified flawlessly on-chain.

---

## What it does

Fourcast is the **verification and reputation layer for agent-managed prediction-market capital**. It records what an agent knew before an event, which mandate constrained it, why it allocated or passed, and how the outcome later resolved. Operators use it to run policy-bound agents; allocators use it to audit mandate adherence without trusting a black box.

TxLINE is the proof layer for the flagship World Cup scenario. When live credentials are active, the app reads TxLINE fixtures, odds, score snapshots, and Merkle proofs directly. After the hackathon data cutoff, the deployed demo switches to cached TxLINE replay snapshots so judges can still inspect the same finalised proof data and Solana verification path.

The earlier settlement path still exists: a custom Solana program (`match-escrow`) performs a Cross-Program Invocation (CPI) into TxLINE's `txoracle::validate_stat` instruction to trustlessly settle parametric sports policies. The stronger product wedge now built on top of that work is **Proof of Decision**: a pre-outcome agent receipt reconciled against an independently verifiable TxLINE/Solana outcome.

### The flow

1. **Evidence** — The World Cup agent reads fixture, market, and odds data.
2. **Simulation** — The agent runs deterministic Monte Carlo with a persisted seed.
3. **Policy-bound decision** — Five mandate gates decide ALLOCATE, PASS, or REVIEW; allocation size is capped before any execution step.
4. **Pre-outcome receipt** — Fourcast canonicalizes the decision payload and stores a SHA-256 content hash. An optional Solana memo commitment can prove the hash existed before resolution.
5. **TxLINE proof** — The app fetches a TxLINE Merkle proof from `/api/scores/stat-validation` in live mode, or loads the cached replay proof in demo mode.
6. **Reconciliation** — `/api/worldcup/verify?fixtureId=18175981` checks receipt integrity, TxLINE/Solana verification, policy adherence, and decision-vs-outcome result in one call.

### Why this is novel

Most AI trading apps ask users to trust a model transcript or a claimed P&L. Fourcast produces a replayable decision receipt before the outcome is known, then reconciles it against TxLINE's independently verifiable outcome proof. That makes mandate adherence and calibration auditable instead of self-reported.

The on-chain settlement path remains novel too: Fourcast can CPI directly into TxLINE's on-chain verification program, using the same Merkle proof that TxLINE publishes on Solana devnet. Settlement is as trustless as the underlying data layer; reputation is built from the same proof chain.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Fourcast Web App                     │
│                   (Next.js, /world-cup)                  │
│                                                          │
│  ┌──────────────┐  ┌──────────────────────────────────┐  │
│  │ Fixture cards │  │ OnChainSettlementPanel           │  │
│  │ (live scores) │  │  - Connect Solana wallet         │  │
│  │               │  │  - Lock SOL on a team            │  │
│  │               │  │  - Settle via CPI button         │  │
│  └──────────────┘  └──────────────────────────────────┘  │
└────────────────────────┬────────────────────────────────┘
                         │
          ┌──────────────┴──────────────┐
          ▼                             ▼
   ┌──────────────┐            ┌────────────────┐
   │ TxLINE API   │            │ Solana devnet   │
   │              │            │                 │
   │ /api/scores/ │            │ match-escrow    │
   │ stat-valid   │── proof ──▶│   .create()     │
   │ ation        │            │   .settle()     │
   │              │            │     │ CPI       │
   │ /api/fixtures│            │     ▼           │
   │ /snapshot    │            │ txoracle        │
   │              │            │  .validate_stat │
   └──────────────┘            │  → bool         │
                               └────────────────┘
```

---

## TxLINE integration points

| Integration | Endpoint / Program | Description |
|---|---|---|
| **Primary data source** | `/api/fixtures/snapshot` | World Cup fixtures, scores, and odds in live mode |
| **Live score streaming** | `/api/scores/snapshot/{fixtureId}` | Real-time score updates with seq numbers when live credentials are active |
| **Merkle proof fetch** | `/api/scores/stat-validation` | On-chain verifiable proof with `isRightSibling` bits in live mode |
| **On-chain verification (CPI)** | `txoracle::validate_stat` (Solana devnet `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`) | The match-escrow program CPI-calls this to verify match outcomes |
| **Proof-of-decision verification** | `/api/worldcup/verify?fixtureId=18175981` | Verifies receipt integrity, TxLINE proof, Solana result, policy adherence, and reconciliation state |
| **Receipt commitment** | `/api/worldcup/verify/commit` | Builds an optional Solana memo transaction that commits the receipt hash before resolution |
| **Replay mode** | `data/txline-replays/18175981.json` and `cache/txline/replays/18175981.json` | Post-deadline demo fallback using cached final-fixture proofs |

---

## The `match-escrow` Solana program

**Program ID:** `AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ`
**Source:** [`onchain/match-escrow/programs/match-escrow/src/lib.rs`](onchain/match-escrow/programs/match-escrow/src/lib.rs)
**Network:** Solana devnet

### Instructions

#### `create_policy(fixture_id, min_ts, pays_recipient_on_home_win, amount)`
- Derives a PDA: `[b"policy", locker, fixture_id, min_ts, pays_recipient]`
- Transfers `amount` lamports from the locker to the policy PDA
- Records the condition (who gets paid if home wins)

#### `settle_policy(ts, fixture_summary, fixture_proof, main_tree_proof, predicate, stat_a, stat_b, op)`
- Re-derives the `daily_scores_roots` PDA from `ts` (same as txoracle)
- Builds the `validate_stat` instruction data (Borsh-serialised)
- **CPI-calls `txoracle::validate_stat`** with the Merkle proof
- Reads the `bool` return value via `get_return_data()`
- If the result matches the policy condition → transfers SOL to recipient
- Otherwise → refunds the locker
- Closes the policy PDA

### Verified end-to-end transaction

**Tx:** [`3W6Y7rtQGgcBuD8ih8hUK2pZTSFZM4yDwXRfAudxmhdzDDjDnpNqEN2TZzGBW6F4PEKhmUbfv2NWXWAQf8wwhduB`](https://explorer.solana.com/tx/3W6Y7rtQGgcBuD8ih8hUK2pZTSFZM4yDwXRfAudxmhdzDDjDnpNqEN2TZzGBW6F4PEKhmUbfv2NWXWAQf8wwhduB?cluster=devnet)

This transaction:
1. Settled a policy on fixture 18175981 (France 3-0)
2. CPI-called `txoracle::validate_stat` with the TxLINE Merkle proof
3. The on-chain program verified: home_goals(3) - away_goals(0) > 0 → `true`
4. Released 101,579,920 lamports (0.1 SOL + rent) to the recipient

---

## Key files

| File | Purpose |
|---|---|
| `onchain/match-escrow/programs/match-escrow/src/lib.rs` | The Solana program (CPI into txoracle) |
| `services/txline/settlementService.js` | Client-side service for building/signing settlement transactions |
| `app/api/worldcup/settle/create/route.js` | API: build create_policy transaction |
| `app/api/worldcup/settle/policy/route.js` | API: build settle_policy transaction (loads cached proof) |
| `app/api/worldcup/settle/status/route.js` | API: read on-chain policy state |
| `components/OnChainSettlementPanel.js` | UI: lock SOL + settle on-chain |
| `app/world-cup/WorldCupClient.js` | Main World Cup page with settlement panel |
| `services/txline/txlineService.js` | TxLINE API integration + proof caching |
| `services/domain/decision/` | Canonical decision policy, simulation, receipt hashing, and integrity checks |
| `services/txline/reconciliationService.js` | Receipt/proof reconciliation state machine |
| `services/txline/receiptAdapter.js` | Adapter from canonical decision receipts to the TxLINE reconciliation view |
| `data/txline-replays/18175981.receipt.json` | Pre-outcome ALLOCATE receipt bound to the France 3-0 proof fixture |
| `data/txline-replays/18175981.pass.receipt.json` | PASS variant proving non-action is also a first-class policy outcome |
| `data/txline-replays/18175981.json` | Committed fallback proof for France 3-0 (with `isRightSibling` bits), available in deployed environments |
| `cache/txline/replays/18175981.json` | Local replay cache generated by the snapshot script |

---

## Demo script

1. **Open `/agent`** — expand the latest autonomous run and show the decision receipt: evidence, simulation seed, five policy gates, verdict, allocation/pass, and browser-side hash verification.
2. **Open `/positions`** — show the allocator mandate view: verified receipts, policy adherence, discipline rate, max allocation, and verdict mix computed from the public run ledger.
3. **Open `/world-cup`** — select fixture `18175981` (France 3-0) and click **Verify proof of decision**.
4. **Show the closed loop** — pre-outcome receipt → TxLINE Merkle proof → Solana verification result → reconciliation status, policy adherence, calibration error, and receipt hash.
5. **Optional settlement beat** — use the existing on-chain settlement panel to show how the same TxLINE proof can drive `match-escrow` payout logic.

---

## Tech stack

- **Frontend:** Next.js 16, React, Tailwind CSS, Lucide icons
- **Backend:** Next.js API routes (Node.js runtime)
- **Blockchain:** Solana (devnet), Anchor framework 0.30.1
- **Data source:** TxLINE API (`txodds.com`)
- **On-chain verification:** TxLINE `txoracle` program (CPI)
- **Wallet:** Phantom / Solflare (Solana wallet adapter)

---

## What makes this submission strong

1. **Closed proof chain** — evidence, seeded simulation, policy gates, receipt hash, TxLINE proof, Solana verification, and reconciliation are visible in one product flow
2. **Agent autonomy with constraints** — the agent can allocate, pass, or request review under an explicit mandate; non-action is treated as a valid decision, not missing automation
3. **Commercial buyer clarity** — operators get a credible track record; allocators get diligence and ongoing mandate monitoring
4. **Real TxLINE/Solana integration** — the proof endpoint verifies real TxLINE Merkle proof data and degrades gracefully to proof-only reconciliation if RPC is unavailable
5. **Replay-mode fallback** — cached proofs and deterministic receipts ensure the demo works even after the hackathon deadline
