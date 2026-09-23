#!/usr/bin/env bash

set -euo pipefail

MIGRATIONS_DIR="supabase/migrations"

echo "Checking migration files for suspicious replacement characters..."

if grep -RInE '\?\?|\xEF\xBF\xBD' "$MIGRATIONS_DIR" --include='*.sql'; then
    echo
    echo "ERROR: Suspicious replacement characters found in migration files."
    echo "Expected mathematical notation to use ^2, not ??."
    exit 1
fi

echo "Migration encoding check passed."
