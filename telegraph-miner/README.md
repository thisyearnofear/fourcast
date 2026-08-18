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

## Telegraph Registration

1. Deploy the miner to a public endpoint
2. Go to [integrate.telegraphprotocol.com](https://integrate.telegraphprotocol.com)
3. Register your miner with:
   - Endpoint URL: `https://miner.sportwarren.com/query`
   - Intents: `SPORTS_SCORE`, `GAME_RESULT`
   - Category: Weather & Sports
4. Your miner will appear on the leaderboard once evaluation scripts score it

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
     │
     │  POST /query { intent, params }
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

- **Track 1 (Miner)** — this is our submission
- **Judging**: 75% Normalized Performance (accuracy vs ground truth), 25% X engagement
- **Guardrail**: Need 3+ active miners in same intent + 100 real requests from Track 3 apps
- **Timeline**: Aug 17–31 (Track 1 & 2), Sep 1–7 (Track 3 apps consume us)
- Tag [@Telegraphprotoc](https://x.com/Telegraphprotoc) in all progress posts
