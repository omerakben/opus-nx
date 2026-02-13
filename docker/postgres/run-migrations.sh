#!/bin/bash
# ============================================================
# Run all Opus Nx SQL migrations in order
# Executed automatically by docker-entrypoint-initdb.d
# ============================================================
set -e

echo "═══════════════════════════════════════════"
echo "  Running Opus Nx database migrations..."
echo "═══════════════════════════════════════════"

MIGRATION_DIR="/docker-entrypoint-initdb.d/migrations"

if [ ! -d "$MIGRATION_DIR" ] || [ -z "$(ls -A "$MIGRATION_DIR"/*.sql 2>/dev/null)" ]; then
  echo "  No migrations found in $MIGRATION_DIR — skipping."
  exit 0
fi

count=0
for f in "$MIGRATION_DIR"/*.sql; do
  [ -e "$f" ] || continue
  echo "  → $(basename "$f")"
  psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" -f "$f"
  count=$((count + 1))
done

# Ensure roles have access to all migration-created objects
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<'EOSQL'
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
EOSQL

echo "═══════════════════════════════════════════"
echo "  Migrations complete ($count applied)."
echo "═══════════════════════════════════════════"
