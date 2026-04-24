#!/bin/sh
# Start the Next.js dev server with .env.local fully applied.
#
# Background: some shells (notably Claude Code CLI) export empty values for
# ANTHROPIC_API_KEY, ANTHROPIC_BASE_URL, etc. Next.js respects existing
# process.env values and *doesn't* override them with .env.local entries
# (https://nextjs.org/docs/pages/building-your-application/configuring/environment-variables#loading-environment-variables).
# That can silently break ANTHROPIC_API_KEY-dependent paths (Claude calls)
# even though the key is clearly in .env.local.
#
# This script sources .env.local into the current shell (set -a → export all)
# before invoking next dev, guaranteeing the file wins over the inherited
# shell env.

set -e

cd "$(dirname "$0")/.."

if [ ! -f .env.local ]; then
  echo "[dev.sh] .env.local missing — copy .env.example and fill the blanks"
  exit 1
fi

set -a
# shellcheck disable=SC1091
. ./.env.local
set +a

# Call next directly (bypass npm run dev → this script → npm run dev loop).
exec npx next dev "$@"
