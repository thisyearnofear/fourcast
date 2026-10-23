# Strike Perpetuals (V2) as a venue

## The claim

**Fourcast's agent core does not change. Strike becomes the perps venue, and the
decision receipts — the thing no other Strike integration commits — become the
differentiator: an autonomous trader that proves mandate adherence on an
exchange that monitors its traders' every fill.**

Every AI-trading submission in the Strike Hackathon will *claim* performance.
Our submission *proves discipline*: a SHA-256 receipt of the full decision
payload committed **before** the entry fill, reconciled against Strike's own
fills/positions record, with Brier-scored calibration over a ledger of real
decisions. Strike built its V2 explicitly for programmatic access ("custom
trading bots, portfolio management integrations, third-party tooling") — we are
the bot with an audit trail.

Facts read from [docs.strikefinance.org](https://docs.strikefinance.org) on
2026-10-23. Deadline was 23 Oct 2026 and is being extended per the organizers —
do not treat 23 Oct as a constraint.

---

## What Strike is (verified)

| Fact | Detail |
|------|--------|
| V2 architecture | Central limit order book on a dedicated execution layer ("Strike Node"); matching, funding, liquidations run off-chain; **custody and settlement by on-chain locker contracts** |
| Chains | Deposit/trade/withdraw from **Ethereum, Solana, Cardano** (ETH/USDC, SOL/USDC, ADA); min deposit $5, withdrawal $5 min + $1 flat fee, withdrawal address locked server-side to the user's wallet |
| STRIKE token | Additional collateral for higher leverage (never sole collateral); **burned on liquidation** |
| API | REST + WebSocket, mainnet `https://api.strikefinance.org`, **testnet `https://api-v2-testnet.strikefinance.org`** |
| Docs | Complete index at [llms.txt](https://docs.strikefinance.org/llms.txt); every page available as `.md` |
| Agent skills | `npx strike-finance-skills install` (repo: strike-finance/strike-finance-skills); builder reference: strike-finance/strike-builder-reference |
| Auth | **Ed25519 API wallets** — 4 headers (`X-API-Wallet-Public-Key`, `X-API-Wallet-Signature`, `X-API-Wallet-Timestamp`, `X-API-Wallet-Nonce`), message `METHOD:PATH:TIMESTAMP:NONCE:BODY_HASH`, timestamp skew ±3 min, nonce must be a fresh UUID per request, raw-hex keys (32-byte seed accepted, SSH format is not) |
| Safety | API wallets **cannot deposit or withdraw** — ideal for an autonomous agent demo |

## Occupied lanes (community submissions already named by organizers)

| Submission | Lane | Our posture |
|-----------|------|-------------|
| Bolt | Memecoin copy-trade + buy STRIKE | Not entered |
| Strike Copilot | Global copy trading | Not entered (their public copy-trader discovery API is raw surface, not a moat) |
| Hizz | Perps dashboard / activity tracker | Not entered — a dashboard alone cannot answer "prove the strategy was followed" |

Nobody is in the **mandate-bound autonomous trader** lane. Our wedge is also our
existing product.

---

## API surface we use

| Endpoints | What for |
|-----------|----------|
| `GET /v2/account`, `GET /v2/positions` | mandate bounds gate; receipt reconciliation |
| `POST /v2/order` | entries + exits; `client_order_id` carries the receipt ID; market orders take `slippage`; `post_only`, `reduce_only`, `close_position`, `price_protect` supported |
| **`POST /v2/order/strategy`** | **bracket orders — primary order + TP/SL legs placed server-side atomically, sibling auto-canceled**. This is mandate enforcement *by the venue*: the tail-loss gate's stop is placed in the same engine call as the entry, not by our LLM's discretion later |
| `POST /v2/orders/batch`, `POST /v2/order/replace(+batch)` | multi-leg entry, quote re-pegging for maker strategies |
| `DELETE /v2/order/cancel(-all)` | exits |
| Market REST (public, no auth) | order book, trades, prices, ticker, **exchange-info** (universe discovery), **klines** (simulation input), **open interest** (positioning context) |
| WebSocket (market + user) | live fills → reconciliation; book-imbalance edge features |
| Platform stats | leaderboard, daily/coin statistics — cross-checks and the reconciliation page's context |
| Builder codes | registration at `app.strikefinance.org/builder-codes`; ≤100 BPS fee share via `X-Builder-Fee-Bps` on fills; **we register one** — its teaching materials also force the builder-wallet onboarding flow we need for the demo, and it converts into post-hackathon monetization (judging criterion 5) |

## Venue adapter contract (frozen — code against this)

Naming and shape follow the Polymarket pattern already in `services/`:

| Module | Exports | Notes |
|--------|---------|-------|
| `services/strike/strikeClient.js` | signed fetch, `isConfigured()` | Ed25519 signing exactly per the [getting-started](https://docs.strikefinance.org/api/getting-started.md) example; nonce UUID v4 fresh per call; body hashed from the **serialized body actually sent**; routed through the shared budgeted-fetch primitive ( timeouts, retries, circuit breaker). Throws on non-2xx with the API's `Error` payload. |
| `services/strike/strikeTrading.js` | `validateSymbolForTrading(symbol)`, `getEnrichedMarketDetails(symbol)`, `buildOrderObject(...)`, `validateOrder(...)`, `executeServerOrder(orderData)` | 1:1 with `polymarketTrading.js` so the autonomous loop needs no fork; `executeServerOrder` for brackets calls `/v2/order/strategy` and stores the engine's `tp/sl` client IDs in the receipt |
| `services/strike/strikeDiscovery.js` | candidate universe + per-symbol stats | exchange-info × open interest × book depth × kline volatility; feeds the existing cross-venue edge machinery (`services/txline/crossVenueEdge.js` gets a second venue) |
| `services/strike/receiptAdapter.js` | canonical receipt → Strike reconciliation view | mirrors `services/txline/receiptAdapter.js`; reconciles receipt → fills → realized PnL using the position/fills endpoints |
| `scripts/strike-check.mjs` | CLI self-test | auth round-trip (signed account read), book/klines read, order validation dry-run — green in ≥2 min on a fresh checkout |

## The five-gate mandate, mapped to perps

The core's gates do not change shape — their *physics* does:

| Gate | Prediction-market form | Perps form on Strike |
|------|----------------------|---------------------|
| Edge | probability edge over consensus price | directional expectation **net of fees + funding drag** (funding compounds; a stale edge is underwater by design) |
| Allocation | Kelly on calibrated confidence, shrunk by bucket hit-rate | same Kelly math output maps to **size × leverage**, with the leverage ceiling coming from the mandate, not from what the exchange allows |
| Tail-loss | max loss fraction before settlement | **liquidation-distance floor + posted SL**: entry always a bracket order, SL distance ≥ mandate floor, working on `mark_price` |
| Simulation | Monte Carlo over price paths | same, seeded from Strike klines; persisted seed (existing infra) |
| Bounds | per-market/max-total exposure | per-symbol notional caps, max concurrent positions, `post_only` maker preference, `price_protect` on |

Calibration ledger, Brier scoring, and pre-outcome receipts are reused
untouched. The one semantic change: perps positions don't resolve at a single
timestamp, so **reconciliation = entry vs realized fills** (average fill price,
fees, funding actually paid, exit reason), attested by Strike's own records.
The claim "you can prove what the agent decided before the position existed"
holds exactly as before.

## Env

```
STRIKE_NETWORK=testnet|mainnet        # default testnet
STRIKE_API_WALLET_PRIVATE_KEY=        # raw hex (32- or 64-byte)
STRIKE_API_WALLET_PUBLIC_KEY=
STRIKE_BUILDER_CODE=                  # optional; enables X-Builder-Fee-Bps
STRIKE_BUILDER_FEE_BPS=               # must be ≤ registered max and user-approved fee_share_bps
```
Unconfigured → `isConfigured() = false` → the venue degrades to **read-only
discovery** (public market endpoints need no auth) and the autonomous loop
skips it. Fail-closed, never guessed. Secrets via the existing env chain; keys
never committed.

## Build plan (each phase gated on `main` green + verification block)

| Phase | Scope | Gate |
|-------|-------|------|
| 0 — creds & probe (0.5d) | register builder code; testnet API wallet at `app.strikefinance.org/api-keys`; `npx strike-finance-skills install`; `scripts/strike-check.mjs` green | signed account read returns on testnet |
| 1 — adapter (2–3d) | client + trading + bracket-order receipt wiring; one strategy (momentum) running on testnet with live receipts; `/strike` surface | receipt ID appears in fills via `client_order_id`; SL leg exists on venue |
| 2 — reconciliation (1d) | receipt→fills reconciliation, realized PnL, calibration ledger extension | a closed testnet position reconciles with hashes matching |
| 3 — demo + docs (1d) | video via the existing pipeline, README section, submission form | submission pack complete |

Add these rows to `docs/EXECUTION_PLAN.md` when greenlit — that doc remains the
canonical plan; this one describes the integration.

## Submission checklist (from the rules, read 2026-10-23)

- [x] Builds on Strike meaningfully — a trading venue adapter + autonomous agent shipping fills on their API
- [~] Working prototype running on **testnet** with real fills (Phase 1–2) —
      **Phase 0/1 partial landed 2026-10-23**: `services/strike/{strikeClient,
      strikeDiscovery,strikeTrading}.js` + `scripts/strike-check.mjs` + 18 tests.
      Public market data verified live on testnet (4 symbols); signed path is
      built and mocked-tested, blocked only on a testnet API wallet.
- [x] Documentation — this doc + README section
- [ ] Demonstration video (existing pipeline)
- [x] Source access — this repo
- [ ] Submission form (link not yet published — watch official channels)

Judging criteria → our answers: **Integration** = venue adapter + builder code +
bracket enforcement on Strike's engine; **Innovation** = only submission whose
agent proves mandate adherence; **Utility** = auditable trading track record,
the thing allocators ask for; **Technical** = the seven-gates surface bar we
already hold everything to; **Future** = builder code fee share + the receipt
standard generalizes across venues.
