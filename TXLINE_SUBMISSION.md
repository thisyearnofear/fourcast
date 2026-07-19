# Fourcast × TxLINE Hackathon Submission

## Project: Fourcast — Trustless On-Chain Sports Settlement via TxLINE CPI

**Live demo:** [https://fourcastapp.vercel.app/world-cup](https://fourcastapp.vercel.app/world-cup)
**Program on Solana devnet:** [`AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ`](https://explorer.solana.com/address/AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ?cluster=devnet)
**Demo video:** [video URL — fill in after recording]

---

## What it does

Fourcast is a sports prediction platform that uses **TxLINE** as its primary data source for World Cup fixtures. The core innovation is a **custom Solana program (`match-escrow`) that performs a Cross-Program Invocation (CPI) into TxLINE's `txoracle::validate_stat` instruction** to trustlessly settle parametric sports insurance policies — no trusted oracle, no intermediary, no manual verification.

### The flow

1. **Lock SOL** — A user locks SOL in a Solana program PDA, specifying a match outcome condition (e.g., "France wins")
2. **Fetch proof** — The app fetches a TxLINE Merkle proof from `/api/scores/stat-validation` (home goals key=1, away goals key=2)
3. **Settle on-chain** — Anyone clicks "Settle on-chain". The `match-escrow` program CPI-calls `txoracle::validate_stat` with the proof
4. **Auto-payout** — If `validate_stat` returns `true` and the condition matches, SOL transfers to the recipient. Otherwise the locker is refunded

### Why this is novel

Most "blockchain + sports" projects use a price-feed oracle (Chainlink, Pyth, Switchboard) or a multi-sig to settle bets. Fourcast is the first to **CPI directly into TxLINE's on-chain verification program**, using the same Merkle proof that TxLINE publishes on Solana devnet. The settlement is as trustless as the underlying data layer — if TxLINE's proof is valid, the payout is guaranteed by the Solana runtime.

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
| **Primary data source** | `/api/fixtures/snapshot` | World Cup fixtures, scores, and odds |
| **Live score streaming** | `/api/scores/snapshot/{fixtureId}` | Real-time score updates with seq numbers |
| **Merkle proof fetch** | `/api/scores/stat-validation` | On-chain verifiable proof with `isRightSibling` bits |
| **On-chain verification (CPI)** | `txoracle::validate_stat` (Solana devnet `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`) | The match-escrow program CPI-calls this to verify match outcomes |
| **Replay mode** | Cached proof fixtures | Post-deadline demo fallback using cached final-fixture proofs |

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
| `cache/txline/replays/18175981.json` | Cached proof for France 3-0 (with `isRightSibling` bits) |

---

## Demo script

1. **Open the app** → navigate to `/world-cup`
2. **View the fixture card** → France vs [opponent], final score 3-0
3. **See the "On-Chain Settlement Engine" panel** → shows verified result, Merkle proof node count, txoracle PDA link
4. **Connect Solana wallet** → click "Connect Solana Wallet" (Phantom/Solflare on devnet)
5. **Create a policy** → choose "France wins", enter 0.1 SOL, click "Lock 0.1 SOL on France"
   - Transaction creates a PDA and locks 0.1 SOL
   - Explorer link appears
6. **Settle on-chain** → click "Settle on-chain (CPI validate_stat)"
   - Transaction CPI-calls `txoracle::validate_stat`
   - Program verifies the Merkle proof on-chain
   - SOL transfers to the recipient (since France won 3-0)
   - Policy PDA is closed
7. **Verify on Solana Explorer** → click the transaction link to see the CPI inner instruction

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

1. **Real CPI into TxLINE's on-chain program** — not just reading an API; the Solana program actually calls `txoracle::validate_stat` and uses its return value to determine the payout
2. **Trustless settlement** — no trusted oracle, no multi-sig, no manual verification. The Solana runtime enforces the outcome
3. **Production-grade code** — the Anchor program compiles, deploys, and has been tested end-to-end on devnet with a real transaction
4. **Clean UX** — the settlement panel is integrated directly into the fixture card, with wallet connection, policy creation, and one-click settlement
5. **Replay-mode fallback** — cached proofs ensure the demo works even after the hackathon deadline
