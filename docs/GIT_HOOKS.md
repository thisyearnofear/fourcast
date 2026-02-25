# Git Hooks

Fourcast uses git hooks to prevent committing sensitive files and secrets.

## Pre-commit Hook

Automatically runs before every commit to check for:

### Blocked Files
- `.env` files (except `.env.local.example`)
- Private keys (`.pem`, `.key`, `.pub`)
- Blockchain config files (`.aptos/`, `.movement/`, `movement-key.txt`, `config.yaml`)
- Certificates (`.crt`, `.cert`)

### Secret Scanning
Scans staged changes for patterns like:
- `API_KEY=...`
- `PRIVATE_KEY=0x...`
- `SECRET=...`
- `PASSWORD=...`

## Installation

The hook installs automatically when you run:

```bash
npm install
```

Or manually:

```bash
npm run hooks:install
```

## Testing

To test the hook before committing:

```bash
npm run hooks:test
```

## Bypassing

If you need to commit something that triggers a false positive:

```bash
git commit --no-verify
```

⚠️ **Use with caution** - only bypass if you're certain the content is safe.

## Scripts

- `scripts/pre-commit.sh` - The actual hook script
- `scripts/install-hooks.sh` - Installs all hooks
- `.git/hooks/pre-commit` - Installed hook location

## Troubleshooting

### Hook not running?
1. Check if script is executable: `chmod +x scripts/pre-commit.sh`
2. Reinstall: `npm run hooks:install`

### False positive?
- Review the pattern that matched
- If it's truly safe, use `--no-verify`
- Consider using environment variables instead of hardcoded values

### Hook file missing?
Run `npm install` or `npm run hooks:install` to reinstall.
