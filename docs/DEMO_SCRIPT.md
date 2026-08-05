# Fourcast — 3-Minute Demo Script (HackCanton S2 Grand Final)

The judge watches a position exist and not exist simultaneously, from two
perspectives, on the same ledger — then watches the winner collect the payout
with their own key, no operator involved. Those two moments are the pitch.

**Nav after venue redesign:** Markets · Positions · Private (primary).
Private → `/proof?chain=canton`. Holder settle → `/positions?view=private`.

## Opening (15s)

> "A large position can leak strategy as soon as it is placed on a public venue. On Canton, the position is visible to its stakeholders and invisible to everyone else. Watch."

**Show:** nav **Private** → `/proof?chain=canton` (or `/` → **See Private**).
Title: **They can't see your size**. Sticky rail: Hide · Lock · Paid.
Home is the wound + door — the felt arc is only on Private.

### Mute test (60–90s, no narration)

Record with sound off. A stranger should feel **secret → locked → paid**:
1. Run the check → holder stake pops, book stays blank, then wipe.
2. Brief pass on escrow weight (legs / locked).
3. CBTC hero payout + seal stamp. Checklist stays collapsed.

If it only feels like “correct panels,” re-record after tightening the frame.

---

## Act 1 — The secret · 45s

1. Open the prepared DevNet market and position (pre-staged the night before).
2. Show **YOU SEE IT** — stake / side large.

**Say:** "This position is on-ledger. The stake, the side — visible only to the operator and this holder."

---

## Act 2 — The absence · 45s

1. Click **"Run the check"** (no wallet).
2. Watch the act: **As you** → **As the book** → **Compare**, then the curtain wipe.
3. Two live ledger queries — real DevNet.

**Show:** Holder has stake/side. **THE BOOK DOESN'T** is Blind. Verdict stamp.

**Say:** "On Polymarket your size telegraphs. Here we ask the same ledger twice — as the holder, then as everyone else."

**Optional (5s):** **Talk to us** after the duel — operator interview, not a waitlist.

---

## Act 3 — Paid · 60s

**Judge path (no browser wallet — Noders has no CIP-0103 gateway):**

1. After the check, let the page advance — **Locked** escrow, then **The money moved**.
2. Point at hero payout, SealMoment update id, holder/operator Δ. Open **Evidence checklist** only if asked.

**Say:** "Atomic settle on real BitSafe CBTC — stake cancelled and payout executed in one transaction. Economics proven on DevNet with the pinned receipt."

**Ops path (only if asked — `/labs/canton`, server OIDC, not a product surface):**

1. Operator resolve + server `Settle` in the hub.
2. Show settle update id.

*Do not lead with Console Wallet on a Noders stage — it reads as the wrong vendor stack.*

---

## Act 4 — Receipts: real CBTC, queryable · 20s

1. Back on `/proof?chain=canton`, scroll to **Settled · CBTC**.
2. Point at payout, holder Δ, settle update id, checks — all green. Optional: **Raw ledger** for contract ids.

**Say:** "This wall is real DevNet state captured by our lifecycle script tonight. Re-running the script refreshes it — nothing is mocked. The settled payout moved real BitSafe CBTC, atomically."

---

## Close (10s)

> "Private by construction, settled atomically, collected by the holder's own key — on Canton DevNet today. Next: independent attesters onboarded through the attester role already in the contract, and mainnet hardening."

---

## Pre-demo checklist

- [x] DAR built and uploaded to NODERS Devnet (package ID confirmed)
- [x] `NEXT_PUBLIC_CANTON_DAR_PACKAGE_ID` set in `.env.local.example`
- [x] `CANTON_OPERATOR_PARTY_ID` set — `FourcastOperator::122003aa7c...`
- [x] Server-side direct ledger API access (OIDC password grant)
- [x] Daml commands formatted to JSON Ledger API spec (`CreateCommand` / `ExerciseCommand` with `choiceArgument`)
- [x] Contract queries use `eventFormat` + `activeAtOffset` + `#fourcast:` package name format
- [x] Market + position lifecycle functions implemented (`services/cantonLedgerClient.js`)
- [x] API routes: `/api/canton/markets`, `/api/canton/markets/resolve`, `/api/canton/positions`, `/api/canton/settle`, `/api/canton/settle/prepare` (wallet-signing payload assembly)
- [x] End-to-end v2 lifecycle verified on DevNet: offer → accept → escrow → resolve → atomic settle
- [x] Deployed URL loads (not localhost) — verified live after env fix & redeploy
- [x] Two-view privacy test (stakeholder sees position, non-stakeholder sees empty result set) — live in-page PrivacyProof component, both cells real ledger queries
- [x] Real BitSafe CBTC registry/instrument settlement verified — `canton-bitsafe-lifecycle.mjs` passes end-to-end (receipt `instrument.id = CBTC`)
- [x] Holder-signed settle path implemented: `SettleAsHolder` via Console Wallet (`useCantonHolderWallet.settleAsHolder` + `/api/canton/settle/prepare` + dashboard button)
- [x] Settlement hub TDZ crash fixed (loadAll ReferenceError); known-good commit tagged `finals-known-good`
- [ ] **Wallet gateway URL confirmed with organizers** — verified 2026-08-04: the dApp SDK (CIP-0103) is vendor-neutral with a built-in picker that accepts custom gateway URLs; NODERS hosts a splice Wallet UI at `wallet.validator.hackcanton-01.devnet.naas.noders.services` (Keycloak `noders-appsfactory`) but does NOT expose the dApp JSON-RPC gateway at `/api/json-rpc` (405 on POST; no gateway subdomain resolves). Ask organizers for the CIP-0103 gateway URL, or whether finalists should use PixelPlex Console Wallet instead. Once known, wallet must control the holder party used for staging (`node scripts/canton-stage-demo.mjs --resolve --holder=<that party>`)
- [ ] **Holder wallet-signed settle verified live on DevNet** — run tonight; if not green by cutoff, use the Act 3 fallback path and hide nothing else
- [x] Fresh dossier captured: `canton-bitsafe-lifecycle.mjs` PASSED 6/6 (real CBTC, settle update id `1220f9fd…`), pinned to `public/proof/canton-receipts.json`, deployed + verified live (200) — receipt wall renders it
- [x] One resolved, escrowed, settle-ready position staged on DevNet (`demo-1785870515670`) — reserved for the wallet-settle click if the gateway unblocks
- [ ] Morning-of: run `node scripts/canton-stage-demo.mjs` (no `--resolve`) ~10 min before the pitch so Act 3 can do resolve → settle live (Alice 3.8 / operator 1.2 CBTC — ample; script prints the faucet link if short)
- [ ] ~~Console Wallet on demo machine~~ — skip; judge path is privacy proof + pinned CBTC (no wallet)
- [ ] CC funded via NODERS wallet tap — reported done by operator, not re-tested this session
- [ ] Venice API key for live AI analysis — reported done by operator, not re-tested this session
- [ ] Form: GitHub URL, video link, demo URL — reported submitted by operator, not verified
- [x] Operator **Talk to us** capture under PrivacyProof (`POST /api/talk` → `operator_leads`; Telegram notify when configured)

## Copy source of truth

All UI strings: `constants/brand.js`
Talk to us: `components/TalkToUs.js` · `app/api/talk/route.js` · `migrations/0012_operator_leads.sql`
Daml contracts: `canton/daml/Fourcast/`
Server-side ledger client: `services/cantonLedgerClient.js`
Wallet-signing prepare route: `app/api/canton/settle/prepare/route.js`
Holder wallet hook: `hooks/useCantonHolderWallet.js`
Holder dashboard (wallet lane): `components/CantonHolderDashboard.js`
Operator hub (fallback lane): `components/CantonSettlementHub.js`
Proof dossier capture: `scripts/canton-bitsafe-lifecycle.mjs` → `public/proof/canton-receipts.json`
