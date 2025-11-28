# Testing Scripts

Quick testing utilities to debug database and API issues.

## Setup

Before running any tests, you need to set up the Turso credentials in `.env.local`:

```bash
# Generate a fresh auth token
turso db tokens create fourcast

# Update .env.local with the token
# TURSO_CONNECTION_URL=libsql://fourcast-appajams.aws-eu-west-1.turso.io
# TURSO_AUTH_TOKEN=<paste-token-here>
```

## Available Tests

### 1. Test Turso Connection
```bash
npm run test:turso
```

Tests:
- Connection to Turso
- CREATE TABLE
- INSERT
- SELECT
- DROP TABLE

Helps identify: auth token issues, network connectivity, schema problems

### 2. Test Database Operations
```bash
npm run test:db
```

Tests:
- `saveSignal()` - Insert a signal
- `getLatestSignals()` - Fetch signals
- `updateSignalTxHash()` - Update a signal
- `getSignalCount()` - Count user signals

Helps identify: database layer issues, async/await problems, data serialization

### 3. Test Signals API
```bash
npm run test:api
# Or specify a custom URL:
npm run test:api http://localhost:3000
# Or production:
npm run test:api https://fourcastapp.vercel.app
```

Tests:
- GET /api/signals
- POST /api/signals
- Verify new signal appears in listings

Helps identify: API endpoint issues, request/response formatting, integration problems

## Troubleshooting

### "SERVER_ERROR: Server returned HTTP status 400"

This usually means:
1. **Invalid token** - The auth token is expired or malformed
   - Solution: Run `turso db tokens create fourcast` and update .env.local

2. **Read-only token** - Token doesn't have write permissions
   - Solution: Check if token is read-only and create a new one with full access

3. **Wrong database** - Connection URL doesn't match token
   - Solution: Verify both TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN are from the same database

### "Cannot find package 'dotenv'"

Run:
```bash
npm install dotenv --save-dev
```

### Tests pass locally but fail on Vercel

Make sure your Vercel environment variables match exactly:
- `TURSO_CONNECTION_URL`
- `TURSO_AUTH_TOKEN`

You can check them in Vercel Dashboard → Project Settings → Environment Variables

## Running All Tests

```bash
npm run test:turso && npm run test:db && npm run test:api
```

Or after starting the dev server:
```bash
npm run dev  # In another terminal
npm run test:api http://localhost:3000
```
