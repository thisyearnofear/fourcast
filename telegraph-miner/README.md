# Fourcast Telegraph Miner

Telegraph Protocol miner serving **verified sports intelligence** — live scores and final match results with Solana Merkle proof verification.

## Intents

| Intent | Description | Evaluation |
|--------|-------------|------------|
| `SPORTS_SCORE` | Live/recent match scores (MLS, NFL, PL) | WASM Exact Match |
| `GAME_RESULT` | Final results + cryptographic proof | WASM Exact Match |

## Differentiator

Most sports data miners will wrap ESPN or a free API. This miner serves **TxLINE professional bookmaker consensus data** with:

- Every result verifiable via Solana Merkle proofs (no trust required)
- Professional-grade odds consensus from the world's sharpest books
- On-chain timestamp anchoring — proves when data was published
- Independent verification: consumers can CPI-call `txoracle::validate_stat` on Solana

## Quick Start

```bash
cd telegraph-miner
cp .env.example .env
# Add your TXLINE_API_TOKEN (from TxLINE subscription activation)
npm install
npm run dev
```

Test locally:

```bash
# Get live scores
curl -X POST http://localhost:8402/query \
  -H "Content-Type: application/json" \
  -d '{"intent": "SPORTS_SCORE", "params": {"team": "Inter Miami"}}'

# Get final result with proof
curl -X POST http://localhost:8402/query \
  -H "Content-Type: application/json" \
  -d '{"intent": "GAME_RESULT", "params": {"fixture_id": "123456"}}'

# Health check
curl http://localhost:8402/health

# Full status
curl http://localhost:8402/status
```

## Deploy (VPS — same host as other Fourcast workers)

The miner runs on `nuncio-vultr` alongside the fourcast-agent and delphi-agent
workers, managed by PM2. Unlike the other workers (headless, no port), this one
exposes port 8402 for incoming Telegraph network requests.

### First deploy

```bash
ssh nuncio-vultr
cd /home/linuxuser/fourcast
git pull --ff-only

# Install miner deps
cd telegraph-miner && npm ci && cd ..

# Create logs dir
mkdir -p telegraph-miner/logs

# Start under PM2
pm2 start deploy/telegraph-miner.ecosystem.config.cjs
pm2 save
pm2 logs telegraph-miner --lines 20
```

### Update

```bash
ssh nuncio-vultr
cd /home/linuxuser/fourcast
git pull --ff-only
cd telegraph-miner && npm ci && cd ..
pm2 restart telegraph-miner
```

### Expose publicly (nginx)

The miner needs a public HTTPS endpoint for Telegraph to reach it. Add to
the VPS nginx config:

```nginx
server {
    listen 443 ssl;
    server_name miner.sportwarren.com;

    ssl_certificate     /etc/letsencrypt/live/miner.sportwarren.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/miner.sportwarren.com/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:8402;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Then: `sudo certbot --nginx -d miner.sportwarren.com && sudo nginx -t && sudo systemctl reload nginx`

### Docker (alternative)

```bash
docker build -t fourcast-telegraph-miner .
docker run -d --restart=unless-stopped -p 8402:8402 \
  --env-file /home/linuxuser/fourcast/.env.agent \
  --name telegraph-miner \
  fourcast-telegraph-miner
```

## Current registration status (verified 2026-08-20)

The **process** is live and correct. The **on-chain identity** is not.

| Layer | What it says |
|---|---|
| Git `telegraph.yaml` + `GET /` | `SPORTS_SCORE`, `GAME_RESULT` |
| Live `https://miner.sportwarren.com` | healthy; `/query` only handles those two intents |
| Pinned YAML `ipfs://QmWtdBnELzsxXVf3pd5AMGeS2fYCf2UvbbZiEbcmBUQDJx` | `WEB_SEARCH`, `FACT_CHECK` |
| On-chain `supportedIntents` / `GET /api/miners` | `WEB_SEARCH`, `FACT_CHECK` |

Git never contained `WEB_SEARCH`. `registerMiner` takes intents as a **separate argument** from the YAML file; the console pinned a YAML whose intents did not match this repo. Epoch 239 scored us **0** on both wrong intents (WEB_SEARCH rank 6, FACT_CHECK rank 2) because `/query` returns 400 for them.

- Miner `id`: **1** (global — do not change; requests route on it)
- Slug: `fourcast-sports-intelligence`
- Protocol on-chain: `bittensor` (misleading; we are a plain HTTPS API. Change to `generic` on update)
- Floor on-chain: `10000` = **$0.01** USDC (protocol minimum). Git still says `0.001`, which is below the minimum — do not copy that onto the chain.
- Wallet / fee: `0x55A5705453Ee82c742274154136Fce8149597058`
- Diamond: `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8` (Base Sepolia)
- First registration: 2026-08-19, still inside the **7-day grace period**. Those zeros become the leaderboard seed after grace.
- Competitor on the sports intents: `scorewire-oracle` (`id` 300) — the only miner currently serving `SPORTS_SCORE` / `GAME_RESULT`.

**Do not re-register from scratch.** Use `updateMiner` (same wallet, same slug). It atomically replaces YAML, floor, fee, and intents and issues a new `registrationId`. Spec: [miner-registration.md](https://github.com/telegraphprotocol/telegraph-docs/blob/main/miners/miner-registration.md).

**Do not also declare `WEB_SEARCH` “for coverage.”** Validators will keep scoring us there and we will keep getting zeros.

## How Telegraph actually calls this miner

Telegraph is a **passthrough proxy**, not an envelope protocol.

- **Direct:** `POST /engine/v1/ask/{id}` with `{method, endpoint, payload}` — `payload` is forwarded verbatim to `base_url` + `endpoints[].external_path`.
- **Auto-routed:** `POST /engine/v1/ask` with `{query, context?}`. An LLM classifies the query into a canonical intent, picks a miner that declared it, and **builds a body**. `input_schema` is documentation for that router; the node does **not** enforce it.

So `/query` with `{intent, params, request_id}` is **our** contract. Keep it. The auto-router may still send a flatter body (`{query}`, `{team}`, …). After the intent fix, `/query` should accept that shape too, or sports asks will 400 even on the right intents.

Canonical intents are an on-chain closed set. Declaring one that is not canonical makes `registerMiner` / `updateMiner` **revert**. Live list:

```bash
curl -sS https://devnode.telegraphprotocol.com/engine/v1/intents
curl -sS https://devnode.telegraphprotocol.com/api/miners \
  | python3 -c "import json,sys; m=next(x for x in json.load(sys.stdin) if x.get('slug')=='fourcast-sports-intelligence'); print(m['id'], m['supported_intents'], m.get('scores'))"
```

`SPORTS_SCORE` and `GAME_RESULT` **are** canonical (Tier A — WASM exact match). Schema reference: [yaml-config.md](https://github.com/telegraphprotocol/telegraph-docs/blob/main/miners/yaml-config.md). The guide site is a JS SPA; read the GitHub docs repo.

`protocol` is only `bittensor` or `generic`. Root YAML, `endpoints[]`, `auth`, and `semantics.signal_mapping` are closed sets (`additionalProperties: false`). `input_schema` / `output_schema` are **top-level**, never inside `endpoints[]`. `signal_mapping` accepts only `confidence_field`, `label_field`, `reason_field` — and those must be **scalars**, not the whole `answer` object.

On-chain integers support `multiplier` (e.g. `source_path: risk_score, multiplier: 10000`). `on_chain.request` body is a **map** (`field: { source: strings.N }`), not a list of `{field, source}`.

## Update the registration (operator)

1. ~~Fix `telegraph-miner/telegraph.yaml`~~ **Done (git, not yet pinned).** Intents `SPORTS_SCORE` + `GAME_RESULT`, `protocol: generic`, `min_price_usdc: 0.01`, scalar `signal_mapping` (`score` / `reason`), map-shaped `on_chain.request`. `id: 1` and slug unchanged.
2. ~~Harden `POST /query`~~ **Done (git, not yet deployed).** Envelope `{intent, params}` still works. Flat auto-routed bodies (`query`, `team`, `fixture_id`, …) are accepted. Responses include `score`, `label`, `winner`, `reason` for signal mapping.
3. Deploy this commit to `nuncio-vultr` (`git pull`, `pm2 restart telegraph-miner`). Confirm live:
   ```bash
   curl -sS -X POST https://miner.sportwarren.com/query \
     -H "Content-Type: application/json" \
     -d '{"intent":"SPORTS_SCORE","params":{"team":"Inter Miami"}}'
   curl -sS -X POST https://miner.sportwarren.com/query \
     -H "Content-Type: application/json" \
     -d '{"query":"What is the Inter Miami score?"}'
   ```
   Both should be 200 with a `score` / `reason` field. Do **not** paste YAML into the console until this is true.
4. Paste `telegraph-miner/telegraph.yaml` at [integrate.telegraphprotocol.com](https://integrate.telegraphprotocol.com). Let it sandbox-test `/query`. Confirm the form's intents are the **sports** ones — the last pin overwrote them to `WEB_SEARCH` / `FACT_CHECK`.
5. Sign **`updateMiner`** with the same wallet that registered (`0x55A5705453Ee82c742274154136Fce8149597058`). Do not send a fresh `registerMiner`.
6. Re-check the live catalog until `supported_intents` is sports and a new IPFS CID is listed:

```bash
curl -sS https://devnode.telegraphprotocol.com/api/miners \
  | python3 -c "import json,sys; m=next(x for x in json.load(sys.stdin) if x.get('id')=='1'); print(m['slug'], m['protocol'], m['supported_intents'], m['yaml_url'], m.get('scores'))"
```

7. Log the new CID, `registrationId`, and tx in `docs/HACKATHONS.md`.

## TxLINE Setup

If you don't have a TxLINE API token yet:

```bash
# From the fourcast root:
node scripts/txline-generate-wallet.mjs
# Fund with devnet SOL, then:
node scripts/txline-subscribe-and-activate.mjs
```

The free tier (service level 1) gives you MLS + International Friendlies with 60-second delay — sufficient for the hackathon.

## Architecture

```
Telegraph Network (validators, apps, routing)
     │  passthrough: payload forwarded verbatim to /query
     │  (auto-router may send a flatter body than {intent, params})
     ▼
┌──────────────────────────────────────────┐
│  nuncio-vultr VPS                        │
│  nginx (443) → 127.0.0.1:8402           │
├──────────────────────────────────────────┤
│  telegraph-miner (PM2)                   │
│  ├── Express server, port 8402           │
│  ├── Intent: SPORTS_SCORE                │
│  └── Intent: GAME_RESULT                 │
├──────────────────────────────────────────┤
│  Also running on same host:              │
│  ├── fourcast-agent (PM2) — headless     │
│  └── delphi-agent (PM2) — headless       │
└───────────┬──────────────────────────────┘
            │
            ▼
┌─────────────────────────┐
│  TxLINE API             │
│  txline.txodds.com/api  │
│  ├── /fixtures/snapshot │
│  ├── /scores/snapshot   │
│  ├── /odds/snapshot     │
│  └── /scores/stat-valid │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Solana (verification)  │
│  Merkle root on-chain   │
│  txoracle program       │
└─────────────────────────┘
```

## Hackathon Notes

- **Track 1 (Miner)** — this is our submission. Status and the on-chain mismatch: `docs/HACKATHONS.md`.
- **Judging**: 75% Normalized Performance (accuracy vs ground truth), 25% X engagement. Sports intents are Tier A WASM exact match; `WEB_SEARCH` / `FACT_CHECK` are Tier B LLM-judge — we are being judged as the latter until `updateMiner`.
- **Guardrail** (as recorded in-repo; confirm on the official page): need 3+ active miners in the same intent + 100 real requests from Track 3 apps. Joining the sports intents currently makes that 2 miners, not 3. Scoring 0 on a crowded wrong intent is worse than being correctly routed in a thin category.
- **Timeline**: Aug 17–31 (Track 1 & 2), Sep 1–7 (Track 3 apps consume us)
- Tag [@Telegraphprotoc](https://x.com/Telegraphprotoc) in all progress posts
