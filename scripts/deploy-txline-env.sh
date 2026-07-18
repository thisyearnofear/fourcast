#!/usr/bin/env bash
# Push TxLINE env vars from local .env.local to the Vercel project so the
# /world-cup route runs in live mode on the deployed app.
#
# Prereq:
#   npm i -g vercel    (or use npx)
#   vercel login       (one-time, browser-based)
#
# Usage:
#   bash scripts/deploy-txline-env.sh            # all env vars to production (default)
#   bash scripts/deploy-txline-env.sh --env=preview  # push to preview env instead
#   bash scripts/deploy-txline-env.sh --file=.env.local  # override source file
#
# Security:
#   - Reads values from .env.local (which is gitignored and chmod 600).
#   - Pipes each value to `vercel env add` via stdin (printf "%s").
#     Values NEVER appear in argv, so `ps`/`history` cannot leak them.
#   - Prints only the variable NAME and LENGTH, never the value itself.
#   - Deliberately SKIPS TXLINE_SOLANA_SECRET_KEY - the deployed app doesn't
#     need a signing key, only the activated API token + guest JWT.
#
# This script is safe to re-run - Vercel upserts each var (you may be prompted
# to confirm replacement of an existing value).

set -euo pipefail

ENV_FILE="${ENV_FILE:-.env.local}"
TARGET_ENV="${TARGET_ENV:-production}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env=*) TARGET_ENV="${1#--env=}"; shift ;;
    --file=*) ENV_FILE="${1#--file=}"; shift ;;
    -h|--help)
      sed -n '2,18p' "$0"
      exit 0 ;;
    *) echo "Unknown arg: $1" >&2; exit 2 ;;
  esac
done

if [[ ! -f "$ENV_FILE" ]]; then
  echo "ERROR: $ENV_FILE not found" >&2
  exit 1
fi

# Vercel CLI: prefer globally-installed, fall back to npx
if command -v vercel >/dev/null 2>&1; then
  VC="vercel"
else
  VC="npx --yes vercel"
fi

# Verify auth before doing anything
echo "Vercel CLI: $VC"
WHOAMI_OUT=$($VC whoami 2>&1) || {
  echo "ERROR: not authenticated to Vercel. Run: $VC login" >&2
  exit 1
}
echo "Authenticated as: $WHOAMI_OUT"
echo "Target environment: $TARGET_ENV"
echo "Source env file: $ENV_FILE"
echo ""

# Vars required for TxLINE live mode on Vercel.
# Deliberately does NOT include TXLINE_SOLANA_SECRET_KEY (signing key, local-only).
declare -a TXLINE_VARS=(
  TXLINE_API_TOKEN
  TXLINE_GUEST_JWT
  TXLINE_API_ORIGIN
  TXLINE_SOLANA_NETWORK
  TXLINE_PROGRAM_ID
  TXLINE_SERVICE_LEVEL
  TXLINE_MODE
  TXLINE_LAST_TX_SIG
  TXLINE_SOLANA_PUBLIC_KEY
)

push_var() {
  local name="$1"
  local value="$2"
  local len=${#value}
  echo "Pushing $name (len $len) -> $TARGET_ENV..."
  # Pipe the value via stdin so it never appears in argv.
  # `vercel env add <name> <env>` reads the value from stdin when not a TTY.
  printf "%s" "$value" | $VC env add "$name" "$TARGET_ENV" 2>&1 | sed 's/^/    /' || {
    echo "    WARN: failed to push $name (may already exist)"
    echo "    To remove and retry: $VC env rm $name $TARGET_ENV"
  }
}

for name in "${TXLINE_VARS[@]}"; do
  # Extract value from .env.local without sourcing (safer - no shell expansion).
  # grep -E anchors the line start so we only match exact var names.
  value=$(grep -E "^${name}=" "$ENV_FILE" 2>/dev/null | head -n1 | sed -E "s/^${name}=//" || true)
  if [[ -z "$value" ]]; then
    echo "SKIP $name (not set in $ENV_FILE)"
    continue
  fi
  push_var "$name" "$value"
done

echo ""
echo "Done. Verify with: $VC env ls $TARGET_ENV | grep TXLINE"
echo ""
echo "Next steps:"
echo "  1. New env vars require a redeploy to take effect."
echo "  2. If autodeploy is on (recommended), the next push picks them up automatically."
echo "  3. For an immediate refresh without a code change:"
echo "     $VC redeploy <latest-prod-url> --target production"
