# SOLANA_HACKATHON.md — MLH + Encode Club Solana Hackathons (Nov 6–8, 2026)

> Project: **Fourcast — Autonomous Prediction-Market Operator**
> Repo: https://github.com/thisyearnofear/fourcast
> Live: https://fourcastapp.vercel.app
> Solana program (devnet): `AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ`

## 1. Events and deadlines

| | MLH Solana Hackathon | Encode Club Solana Hackathon 2026 |
|---|---|---|
| Format | Weekend, Nov 6–8 online | 4-week program (started Oct 12), submission Nov 8 |
| Submission | MLH Challenges — **initial Sun Nov 8 10:00 AM ET**, final 11:45 AM ET | Encode dashboard — working demo (devnet OK), public repo + README, 2–4 min video, "how Solana powers it" |
| Judging | Top 3 Overall $1,000 microgrant; AI / DeFi / Gaming / Best Beginner $100/member | Accelerator places + **Best Use of x402 on Solana** track |
| Criteria | Working product using Solana for what it's good at — speed, low fees, composability, on-chain ownership. NOT chain bolted onto web2 | User need/adoption, ease of onboarding, technical execution + meaningful Solana use, working end-to-end |

**Pre-flight checklist (user actions):**
- [ ] Encode dashboard: confirm all 3 checkpoints were submitted
- [ ] Redeploy Vercel so `/api/txline/*` aliases + `/api/signals/premium-solana` are live (prod currently serves `/api/worldcup/*` routes only)
- [ ] Set `X402_SOLANA_ENABLED=true`, `X402_USDC_CEILING`, `X402_SOLANA_PAY_TO` on the demo deployment if showing x402 live
- [ ] Record the 2–4 min demo video (script below)

## 2. Why Fourcast is a strong Solana candidate

Fourcast is a venue-agnostic autonomous agent for prediction markets. It
discovers edge, sizes positions under a policy-bound mandate, executes, and
produces **verifiable decision receipts** — committed before outcomes resolve.

Solana is not a bolt-on; it is the settlement and verification layer:

1. **`match-escrow` Anchor program (devnet, deployed)** — locks SOL in a PDA
   against a real fixture, settles by **CPI into TxLINE's `txoracle` v4 flow**
   (`validate_fixture_for_tree` → ed25519-verified `validate_stat_v4` →
   `close_worker_ticket`) inside a single transaction. Composability: we
   compose an existing oracle program's current interface instead of building
   oracle infra. No trusted operator — the proof verifies on-chain.
2. **Receipt commitment via Memo program** — decision-receipt `contentHash`
   committed on-chain *before* kickoff; `/api/worldcup/verify?commitmentTx=`
   proves ex-ante commitment (verifiable AI / fairness).
3. **x402 machine payments** — `/api/signals/premium-solana` quotes 402 →
   buyer-signed `transferChecked` → verify → simulate → broadcast → confirm →
   re-read balance delta → deliver. Canonical "payment request → on-chain
   settlement → resource delivery" (Encode x402 track).
4. **On-chain proof API** — `/api/worldcup/verify?fixtureId=` walks
   receipt → commitment → Merkle proof → Solana daily-root → reconciliation.

## 3. Demo script (2–4 min video + live judge path)

**Live endpoints (read-only, no keys):**
- `curl https://fourcastapp.vercel.app/api/worldcup/settle/status` — program info
- `curl "https://fourcastapp.vercel.app/api/worldcup/verify?fixtureId=18175981"` — full proof chain
- `curl https://fourcastapp.vercel.app/api/signals/premium-solana` — 402 payment quote

**Escrow round-trip (local, needs funded devnet wallet + TxLINE devnet auth):**
```bash
node scripts/txline-devnet-onboard.mjs          # once: guest auth + API token → cache/txline/devnet-auth.json
node scripts/solana-escrow-v4-roundtrip.mjs     # book → create_policy → settle_policy_v4
# → locks 0.05 SOL, settles via CPI oracle chain in ONE tx, prints explorer links
```
Verified on devnet 2026-11-07 (fixture 18041541):
- [create_policy](https://explorer.solana.com/tx/3cJik5pAVmSTDz4GfTaRX2SA437HjajCeHERJQ2tE1gQoYrVrZihQudBEHb55kxahfH1UceinNGkVjdHdoGV7ZNq?cluster=devnet)
- [settle_policy_v4](https://explorer.solana.com/tx/2FquTGbh42K3ozF6r3Bd1YVAW2PbtX3LREDbBB5xUetW77ZQDwUNGcruZnxMVXvbguJTugvf1xGtj2k6ZcSp8YdM?cluster=devnet) — 0.05 SOL paid out, policy closed
- [program upgrade](https://explorer.solana.com/tx/5qDd22aFYBniyDUeqKuvVUMcyiwG1mZ59W3JSoWaLEEehCJtddM7QvozogX1nQCMHFeNTEsJen9VHpq6bbvaDmi1?cluster=devnet)

**x402 payment (local dev server + funded devnet buyer):**
```bash
X402_SOLANA_ENABLED=true X402_USDC_CEILING=1 X402_SOLANA_PAY_TO=<seller> npm run dev
X402_BUYER_KEYPAIR=<key> node scripts/x402-solana-demo.mjs
# → 402 quote → signed transferChecked → on-chain settlement → signal brief delivered
```

**Video beats:**
1. (0:00) Hook — "AI agents claim edge; none prove discipline. Fourcast commits to its decision on Solana before the outcome."
2. (0:20) Product — agent finds edge on prediction markets, mandate-gated sizing, decision receipt.
3. (0:50) **Escrow** — lock SOL on a match, settle via CPI oracle proof. Show both txs on explorer.
4. (1:30) **Verifiable receipt** — contentHash on-chain via Memo before kickoff; verify endpoint walk.
5. (2:10) **x402** — pay-per-request signal brief: 402 → payment → delivery, settlement receipt.
6. (2:50) Why Solana — ~1s finality for escrow, sub-cent fees for micro-policies, CPI composability, public verifiability. Repo + live URL.

## 4. Submission copy

### Encode Club (paste into submission form)

**Project name:** Fourcast — Autonomous Prediction-Market Operator

**Description (20–2000 chars equivalent):**

> Fourcast is an autonomous agent that trades prediction markets under a
> policy-bound mandate and produces cryptographic decision receipts committed
> before outcomes resolve. Solana is its settlement and verification layer:
> a custom Anchor program (match-escrow) locks SOL against real sports
> fixtures and settles via CPI into TxLINE's txoracle program using Merkle
> proofs — trustless escrow with no oracle operator. Decision receipts are
> committed on-chain via the Memo program before kickoff, and paid API
> resources settle through x402 machine payments (buyer-signed
> transferChecked verified, simulated, broadcast and re-verified on-chain
> before delivery). Deployed on Solana devnet; live at
> fourcastapp.vercel.app.

**Verified on devnet (paste into submission):**
- Program: https://explorer.solana.com/address/AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ?cluster=devnet
- Escrow round-trip: `create_policy` https://explorer.solana.com/tx/3cJik5pAVmSTDz4GfTaRX2SA437HjajCeHERJQ2tE1gQoYrVrZihQudBEHb55kxahfH1UceinNGkVjdHdoGV7ZNq?cluster=devnet → `settle_policy_v4` https://explorer.solana.com/tx/2FquTGbh42K3ozF6r3Bd1YVAW2PbtX3LREDbBB5xUetW77ZQDwUNGcruZnxMVXvbguJTugvf1xGtj2k6ZcSp8YdM?cluster=devnet (0.05 SOL escrowed → paid out trustlessly, policy PDA closed)
- Reproduce: `node scripts/solana-escrow-v4-roundtrip.mjs` (see README "Check the gates yourself")

**How Solana powers it:**
- Escrow + oracle-composable settlement (single-tx CPI chain into txoracle v4: `validate_fixture_for_tree` → `validate_stat_v4` → `close_worker_ticket`)
- Ex-ante verifiable AI receipts (Memo commitment, pre-outcome)
- x402 payment request → on-chain settlement → resource delivery
- Sub-second finality + negligible fees make per-fixture micro-escrow viable

### MLH Challenges

**Project name:** Fourcast
**Track:** AI (verifiable AI agent; DeFi also defensible — settlement/escrow)

**Short description:**
> An autonomous prediction-market agent that commits cryptographic decision
> receipts on Solana before outcomes resolve, settles parametric escrow via
> CPI into an on-chain oracle, and sells agent output through x402 machine
> payments — every claim independently verifiable on a public explorer.

**Long description:** (use Encode text above + links)
- Repo: https://github.com/thisyearnofear/fourcast
- Live: https://fourcastapp.vercel.app
- Program: https://explorer.solana.com/address/AMT4n3imwTgHEpafKhsjfhfM5tKPXmTBVKvMCW4ohrvQ?cluster=devnet
- Verified escrow txs: create_policy `3cJik5pA…GNq` → settle_policy_v4 `2FquTGbh…8YdM` (devnet explorer links in README)
- Video: <upload/link>

## 5. Checklist

- [x] `scripts/solana-escrow-v4-roundtrip.mjs` run end-to-end on devnet — DONE, tx sigs above
- [ ] `scripts/x402-solana-demo.mjs` payment completed once on devnet
- [ ] `npm test` green incl. `tests/x402Solana.test.js`
- [ ] `npm run typecheck` / `npm run lint` clean on new files
- [ ] Vercel redeployed (latest main) — `/api/signals/premium-solana` live
- [ ] Demo video recorded (2–4 min)
- [ ] Encode: dashboard checkpoints confirmed + submission form filled
- [ ] MLH: initial submission Sun 10:00 AM ET, final 11:45 AM ET
