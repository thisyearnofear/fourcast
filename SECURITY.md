# Security Notes

## Private Keys & Secrets

### What NOT to commit

- `.env` — local environment variables (contains API keys, private keys)
- `movement-key.txt` — Movement/Aptos private key
- `*.key` — any private key files
- `.movement/` — Movement CLI data directory

All of the above are listed in `.gitignore` and verified as untracked via
`git ls-files`. **Never** remove these entries from `.gitignore`.

### If secrets were exposed in the working tree

If `.env` or `movement-key.txt` were ever shared, copied to an unsecured
location, or visible in a screen-share:

1. **Rotate immediately** — generate new API keys (Bright Data, Venice AI,
   Telegram, etc.) and new wallet private keys.
2. **Update `.env`** with the new values.
3. **Update any deployed services** (Vercel env vars, Turso tokens, etc.)
   with the rotated credentials.
4. **Check git history** — `git log --all --full-history -- .env` should
   return empty (these files have never been committed).

### `.env.example` vs `.env`

`.env.example` and `.env.local.example` are committed to the repo and contain
**placeholder values only**. They serve as documentation for required
environment variables. Never put real secrets in these files.

## Dependency Security

- `--legacy-peer-deps` is currently required for installation due to
  conflicting peer dependency versions. This is tracked as a cleanup item.
- The ethers/viem dual dependency is documented in `docs/NINE_PLAN.md` as a
  planned consolidation (Phase 1.4). Both are actively used for different
  subsystems (ethers: Polymarket EVM order signing; viem: Arc settlement,
  CCTP, wagmi hooks) and should not be removed until the migration is
  verified with the full test suite.
