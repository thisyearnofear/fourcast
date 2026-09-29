# Fourcast Telegraph Miner

Telegraph Protocol miner serving **verified sports intelligence** — live scores and final match results with Solana Merkle proof verification.

> **Season II plan:** Season I scored this miner 0 (structural — we shipped into
> a near-zero-scored intent family with paid-gated ground truth, and had no
> instrumentation to notice). The Season II readiness plan — instrument first
> (survey/asked), make verification a one-command independent check, dual-shape
> `GAME_RESULT`, an evaluator WASM, and a paid-rail Track 3 app — lives in
> [`docs/HACKATHONS.md`](../docs/HACKATHONS.md#telegraph-protocol-hackathon-season-ii----preparing).
> Read it before registering into any intent.

## Intents

| Intent | Description | Sources |
|--------|-------------|---------|
| `SPORTS_SCORE` | Live or most recent score for a team/fixture/league | TxLINE, then ESPN |
| `GAME_RESULT` | Final result of the most recent *completed* game | TxLINE (with Merkle proof when published), then ESPN |

## Season II changes (v1.1)

Season I scored this miner 0 on `GAME_RESULT`: the free TxLINE tier has no
history, so most asks came back "no completed match", and nothing told us.
v1.1 fixes the cause and instruments the rest.

- **Free finals.** When TxLINE has no live/final answer, the miner reads ESPN's
  public scoreboards (MLB, NFL, NCAAF, NBA, WNBA, NHL, EPL, MLS, La Liga,
  Bundesliga, Serie A, Ligue 1, UCL), looking back `ESPN_LOOKBACK_DAYS` (4).
  The `GAME_RESULT` miners that did score in Season I answered from free
  official feeds too.
- **Attributed answers.** `reason` is a sentence naming who beat whom, winner's
  score first: `Buffalo Bills beat Los Angeles Chargers 24-16 (final)`. The
  scalars (`score` home-away, `winner`, `answer.*`) are unchanged for on-chain use.
- **Absence is absence.** No `"Unknown"` team names, no `0-0` for a game that has
  not started, no `verified: true` without a proof. A miss is `label: no_result`,
  `answer: null`, and a `reason` saying what was searched. Team matching requires
  every word of the name, so "Manchester City" never matches Manchester United.
- **Two kinds of evidence, never merged.** Every answer carries
  `metadata.attestation` (Ed25519 over the settle fields, which proves this
  miner said it). Only TxLINE answers with a published proof carry
  `answer.proof` and `verified: true`, which proves the data. ESPN answers are
  signed but say `verified: false`.
- **Instruments.** `GET /api/asked` (last 50 requests: field, text, resolved
  intent, outcome, source, latency), `GET /health` (`degraded` when every called
  upstream is failing; still HTTP 200), `npm run survey` (live network standing).

`telegraph.yaml` is **unchanged**, so no `updateMiner` is needed. Deploy is
`git pull` + `npm ci` + `pm2 restart`, plus `MINER_SIGNING_KEY` in `.env.agent`
(below).

## Endpoints

| Endpoint | Purpose |
|---|---|
| `POST /query` | The scored endpoint. Envelope `{intent, params}` or flat `{query}` / `{team}` |
| `GET /health` | `ok` / `degraded` + per-upstream last success/failure |
| `GET /status` | Sources, leagues, signing-key state |
| `GET /api/asked` | What the network actually asked, and how each ask ended |
| `GET /.well-known/fourcast-miner.json` | Signing public key, signed fields, how to verify |

`/api/asked` is public and unauthenticated by design (so judges and we can read
it without a key). It stores request text truncated to 200 chars, with no IP
addresses, in memory only.

## Tools

```bash
npm run survey                         # our rank/score per intent vs the live network
npm run survey -- --intent GAME_RESULT # one intent, top 5 miners + scorer bar
npm run survey -- --all                # every scored intent
npm run verify -- --team "Buffalo Bills" --intent GAME_RESULT   # ask + verify live
npm run verify -- --url http://localhost:8402 --query "Did the Bills win?"
npm run verify -- --file saved.json    # verify a response you kept
npm run keygen                         # new MINER_SIGNING_KEY (put in .env.agent, never git)
```

`verify` checks the attestation against the key at `/.well-known` (not the key
inside the response), checks that the displayed values are the signed values,
and for TxLINE answers checks the proof shape and compares the root with the
Solana daily-root account. Each check is reported separately. A check that
can't run is shown as `--`, never as a pass.

Read `npm run survey` before any registration change. On 2026-09-28 it showed
`SPORTS_SCORE` effectively unmeasured network-wide (best miner 7.5e-12), while
`GAME_RESULT` is measured (best 0.1197) and we were 15/15 at 0.

## Differentiator

Most sports miners return a score. This one returns a score with its evidence
stated plainly:

- **TxLINE answers** can carry a Solana Merkle proof; consumers can check it
  (`npm run verify`, or CPI `txoracle::validate_stat`) without trusting the miner.
  `verified: true` appears only then.
- **ESPN answers** fill the gaps the free TxLINE tier leaves. They are signed by
  the miner and marked `verified: false`.
- **Every answer** is Ed25519-signed over the settle fields, with the key
  published at `/.well-known/fourcast-miner.json`.
- Natural-language asks work: "Did the Dodgers beat the Giants?" resolves both
  sides, the intent, and the league.

## Query Interface

```bash
# Natural language (auto-detects SPORTS_SCORE vs GAME_RESULT)
curl -X POST http://localhost:8402/query \
  -H "Content-Type: application/json" \
  -d '{"query": "who won Manchester City this weekend"}'

# Structured intent
curl -X POST http://localhost:8402/query \
  -H "Content-Type: application/json" \
  -d '{"intent": "SPORTS_SCORE", "params": {"team": "Liverpool"}}'

# Graceful degradation — unparseable queries return 200, not 500
curl -X POST http://localhost:8402/query \
  -H "Content-Type: application/json" \
  -d '{"intent": "WEB_SEARCH", "query": "what can you offer"}'
```

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
# once: persistent signing key, so attestations verify across restarts
grep -q '^MINER_SIGNING_KEY=' .env.agent || node telegraph-miner/scripts/keygen.mjs >> .env.agent
pm2 restart deploy/telegraph-miner.ecosystem.config.cjs --update-env   # re-reads .env.agent

# Verify it actually bound the port (don't trust "online" alone):
curl -s http://localhost:8402/health
curl -s https://miner.sportwarren.com/.well-known/fourcast-miner.json   # persistent: true
```

**PM2 v7 gotcha (bit us 2026-09-01):** PM2 forks apps through
`ProcessContainerFork.js`, so inside the app `process.argv[1]` is PM2's
container, not this script. `src/server.js` gates `app.listen()` on being the
entrypoint using `process.env.pm_exec_path` (PM2 sets it to the real script
path) — if you swap that check back to `argv[1]`, the process will show
`online` in pm2 forever while binding nothing. If pm2 says online but
`/health` refuses connections, check the listen gate first, then
`pm2 delete telegraph-miner && pm2 start deploy/telegraph-miner.ecosystem.config.cjs`.

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

The **process** and the **on-chain identity** now match.

| Layer | What it says |
|---|---|
| Git `telegraph.yaml` + `GET /` | `SPORTS_SCORE`, `GAME_RESULT` |
| Live `https://miner.sportwarren.com` | healthy; `/query` only handles those two intents |
| Node `GET /api/miners/148` | **`active`**, same intents, GitHub raw YAML |
| Catalog slug `fourcast-sports-intelligence` | `SPORTS_SCORE`, `GAME_RESULT` |

First pin (2026-08-19, `registrationId` 128) wrote `WEB_SEARCH` / `FACT_CHECK`
because `registerMiner` takes intents as a **separate argument** from the YAML.
Epoch 239 scored **0** on those (WEB_SEARCH rank 6, FACT_CHECK rank 2). Corrected
the same day with `updateMiner` — tx
[0xbc89aed7…e4e608](https://sepolia.basescan.org/tx/0xbc89aed7f52fe0c292c5e1ce3209af914aeb0988ec9c315c5be4e385dde4e608).
128 is **deregistered**. Intermediate 146/147 were rejected: zsh wrapped the
YAML URL across lines (`telegrap\n  h-miner`). Keep `"$U"` on **one line**.

- Miner `id`: **1** (YAML / catalog routing id — do not change)
- Live **`registrationId`**: **148** (lookup `/api/miners/148`, not `/api/miners/1`)
- Slug: `fourcast-sports-intelligence`
- Protocol: `generic`
- Floor: `10000` = **$0.01** USDC (protocol minimum)
- Wallet / fee: `0x55A5705453Ee82c742274154136Fce8149597058`
- Diamond: `0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8` (Base Sepolia)
- YAML:
  `https://raw.githubusercontent.com/thisyearnofear/fourcast/main/telegraph-miner/telegraph.yaml`
  SHA-256 `0x608b7dd0dcbba7c1a2f97e4a675a83720d6e96deed5ca2304db4716c72330927`
- Still inside the **7-day grace period** from the first registration. WEB_SEARCH
  zeros may linger as seed until grace ends; sports scoring starts on 148.
- Competitor on the sports intents: `scorewire-oracle` (`id` 300).

**Do not click Register On-Chain again.** Protocol engineering confirmed
(2026-08-20): `registerMiner` with the same wallet does **not** supersede the
live listing. It creates a second `registrationId` / `intentId`. Further YAML
or intent changes use **`updateMiner(148, …)`**. Spec:
[miner-registration.md](https://github.com/telegraphprotocol/telegraph-docs/blob/main/miners/miner-registration.md).

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

Confirmed 2026-08-20 by Telegraph protocol engineering: pin the git YAML, then
`updateMiner`. Do **not** use the console **Register On-Chain** button (that is
`registerMiner` and duplicates us). If the new UI grows a true **Update**
control that calls `updateMiner(148, …)`, that is fine — verify the calldata
before signing. Pass the YAML URL as a **single line** (no shell wrap).

GitHub raw already serves the corrected file (same bytes as git; no Pinata
required):

```text
https://raw.githubusercontent.com/thisyearnofear/fourcast/main/telegraph-miner/telegraph.yaml
SHA-256  0x608b7dd0dcbba7c1a2f97e4a675a83720d6e96deed5ca2304db4716c72330927
```

From a machine that has Foundry `cast` and the **registering wallet** (never
paste the key into chat):

```bash
export DIAMOND="0x5a2324aA18613FAD4e44bDF0d6c73Ec1f6D87ff8"
export RPC="https://sepolia.base.org"
export YAML_URL="https://raw.githubusercontent.com/thisyearnofear/fourcast/main/telegraph-miner/telegraph.yaml"
export YAML_HASH="0x608b7dd0dcbba7c1a2f97e4a675a83720d6e96deed5ca2304db4716c72330927"
export FEE_ADDRESS="0x55A5705453Ee82c742274154136Fce8149597058"
export MIN_PRICE=10000   # 0.01 USDC (6 decimals)

cast send "$DIAMOND" \
  "updateMiner(uint256,string,bytes32,address,uint256,string[])" \
  148 \
  "$YAML_URL" \
  "$YAML_HASH" \
  "$FEE_ADDRESS" \
  "$MIN_PRICE" \
  '["SPORTS_SCORE","GAME_RESULT"]' \
  --rpc-url "$RPC" \
  --private-key "$MINER_PRIVATE_KEY"
```

After a further update confirms, `GET /api/miners/148` should show
`deregistered` / superseded, and the catalog row for slug
`fourcast-sports-intelligence` should list the new `registration_id`. Check:

```bash
curl -sS -A 'fourcast-review/1.0' https://devnode.telegraphprotocol.com/api/miners/148
curl -sS -A 'fourcast-review/1.0' https://devnode.telegraphprotocol.com/api/miners \
  | python3 -c "import json,sys; m=next(x for x in json.load(sys.stdin) if x.get('slug')=='fourcast-sports-intelligence'); print(m['id'], m['supported_intents'], m['yaml_url'], m.get('scores'))"
```

Log the new `registrationId`, tx, and YAML URL in `docs/HACKATHONS.md`.

## TxLINE Setup

If you don't have a TxLINE API token yet:

```bash
# From the fourcast root:
node scripts/txline-generate-wallet.mjs
# Fund with devnet SOL, then:
node scripts/txline-subscribe-and-activate.mjs
```

The free tier (service levels 1 and 12 — both free, 60 s delay vs real-time)
covers NFL, MLS, the English Premier League, World Cup & Int Friendlies,
scores and StablePrice odds included (tier docs + measured 2026-09-28).
Finished games stay readable via `/scores/historical/{fixtureId}` (an
SSE-style `data:`-frame replay; `readScores` falls back to it when the
snapshot/sequence window has closed). Caution: `Competition` "Premier
League" is ambiguous — the Kazakh league shares the exact name and is NOT in
the bundle (403 "Bundle access denied"); match on country/competition id,
not the name. The Merkle proof endpoints are the one part that does not
serve the free tier yet: both documented `stat-validation` shapes answer 500
(see `docs/HACKATHONS.md`; exhibit: `scripts/proof-probe*.mjs`).

### Renewing the subscription (every 4 weeks — do not let it lapse)

When the subscription lapses, every TxLINE call starts failing and the miner
silently drops to ESPN-only (no `verified: true` answers anywhere). The miner
reports the deadline: `GET /health` → `txline_renewal.days_left` /
`due_soon` / `expired` (set from `TXLINE_SUBSCRIBED_UNTIL` in the env).

```bash
# On the machine holding the wallet (fourcast root, .env.local has
# TXLINE_SOLANA_SECRET_KEY for the funded wallet):
node scripts/txline-subscribe-and-activate.mjs            # subscribe tx + activate
# It writes fresh TXLINE_API_TOKEN / TXLINE_GUEST_JWT into .env.local.
# Push them to the miner (values stay off the command line):
scp .env.local nuncio-vultr:/tmp/renew.env && ssh nuncio-vultr '
  cd /home/linuxuser/fourcast &&
  python3 - <<PYEOF
import re
new = dict(l.strip().split("=",1) for l in open("/tmp/renew.env") if "=" in l)
lines = open(".env.agent").read().splitlines(True)
keys = ("TXLINE_API_TOKEN","TXLINE_GUEST_JWT","TXLINE_SUBSCRIBED_UNTIL")
out, seen = [], set()
for l in lines:
    k = l.split("=",1)[0]
    if k in keys and k in new:
        out.append(f"{k}={new[k]}\n"); seen.add(k)
    else: out.append(l)
for k in keys:
    if k not in seen and k in new: out.append(f"{k}={new[k]}\n")
open(".env.agent","w").writelines(out)
PYEOF
  rm /tmp/renew.env
  pm2 restart deploy/telegraph-miner.ecosystem.config.cjs --update-env'
```

Set `TXLINE_SUBSCRIBED_UNTIL=<subscription end date>` in `.env.agent` when
renewing so /health keeps counting down. A renewal reminder is scheduled on
the VPS (`crontab -l` on `nuncio-vultr`). The subscription tx from 2026-09-28
and the wallet are recorded in `docs/HACKATHONS.md`.

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
│  ├── Intent: GAME_RESULT                 │
│  └── fallback: ESPN public scoreboards   │
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
- **Judging**: 75% Normalized Performance (accuracy vs ground truth), 25% X engagement. Sports intents are Tier A WASM exact match; `WEB_SEARCH` / `FACT_CHECK` are Tier B LLM-judge. We are now on the sports intents (`registrationId` 148).
- **Guardrail** (as recorded in-repo; confirm on the official page): need 3+ active miners in the same intent + 100 real requests from Track 3 apps. Joining the sports intents currently makes that 2 miners, not 3. Scoring 0 on a crowded wrong intent is worse than being correctly routed in a thin category.
- **Timeline** (verified 2026-09-01): Track 1 & 2 extended to **Sep 2, 2026 11:59:59 UTC**; Track 3 (apps consume us) coming soon — see `docs/HACKATHONS.md`
- Tag [@Telegraphprotoc](https://x.com/Telegraphprotoc) in all progress posts
