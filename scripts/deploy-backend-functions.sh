#!/usr/bin/env bash
# Run after backend_commands_v3.sql on the intended project; does not run SQL
# or publish a frontend. Uses your existing Supabase CLI login, never chat secrets.
set -euo pipefail
cd "$(dirname "$0")/.."
: "${SUPABASE_PROJECT_REF:?Set the intended Supabase project reference.}"
command -v supabase >/dev/null || { echo "Install/login to the Supabase CLI first." >&2; exit 1; }
for entry in supabase/functions/*/index.ts; do
  function_name="$(basename "$(dirname "$entry")")"
  supabase functions deploy "$function_name" --project-ref "$SUPABASE_PROJECT_REF"
done
