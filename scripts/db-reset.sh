#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# ARIS 3.0 — Database Reset Script
# Drops all schemas, recreates them, runs migrations, and seeds
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Database connection (override via env vars)
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-aris}"
DB_PASSWORD="${PGPASSWORD:-aris_dev_2024}"
DB_NAME="${PGDATABASE:-aris}"

export DATABASE_URL="${DATABASE_URL:-postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}   $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERR]${NC}  $*"; }

run_sql() {
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$1" 2>/dev/null
}

# Schemas to drop (everything except 'public' which is always there)
DROP_SCHEMAS=(
  tenant
  credential
  master_data
  data_quality
  data_contract
  message
  drive
  form_builder
  collecte
  workflow
  animal_health
  livestock_prod
  fisheries
  wildlife
  apiculture
  trade_sps
  governance
  climate_env
  analytics
  geo_services
  knowledge_hub
  interop_hub
  audit
)

# ── Safety check ───────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "  ${RED}ARIS 3.0 — Database RESET${NC}"
echo "  Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
echo ""
echo -e "  ${YELLOW}WARNING: This will DROP ALL DATA and recreate from scratch.${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""

# Auto-confirm with --yes flag, otherwise prompt
if [[ "${1:-}" != "--yes" ]] && [[ "${1:-}" != "-y" ]]; then
  read -r -p "Are you sure you want to reset the database? [y/N] " confirm
  if [[ "$confirm" != "y" ]] && [[ "$confirm" != "Y" ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# ── Step 1: Drop all schemas ──────────────────────────────────────────────
log_info "Dropping all schemas..."

for schema in "${DROP_SCHEMAS[@]}"; do
  run_sql "DROP SCHEMA IF EXISTS ${schema} CASCADE;" || true
done

# Clean public schema (drop all tables but keep the schema)
run_sql "
  DO \$\$ DECLARE
    r RECORD;
  BEGIN
    FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename != '_prisma_migrations')
    LOOP
      EXECUTE 'DROP TABLE IF EXISTS public.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- Drop Prisma migrations table too
    DROP TABLE IF EXISTS public._prisma_migrations CASCADE;

    -- Drop all enums
    FOR r IN (SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typtype = 'e')
    LOOP
      EXECUTE 'DROP TYPE IF EXISTS public.' || quote_ident(r.typname) || ' CASCADE';
    END LOOP;
  END \$\$;
" || true

log_success "All schemas dropped"

# ── Step 2: Run full setup ────────────────────────────────────────────────
log_info "Running full database setup..."
bash "$SCRIPT_DIR/db-setup.sh"

log_success "Database reset complete!"
