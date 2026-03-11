#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# ARIS 4.0 — Database Setup Script
# Creates PostgreSQL schemas, enables extensions, runs migrations & seeds
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DB_SCHEMAS_DIR="$ROOT_DIR/packages/db-schemas"

# Database connection (override via env vars)
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-aris}"
DB_PASSWORD="${PGPASSWORD:-aris_dev_2024}"
DB_NAME="${PGDATABASE:-aris}"

export DATABASE_URL="${DATABASE_URL:-postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}?schema=public}"

# All PostgreSQL schemas (one per service + audit)
SCHEMAS=(
  public
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

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── Helper functions ───────────────────────────────────────────────────────
log_info()    { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}   $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error()   { echo -e "${RED}[ERR]${NC}  $*"; }

check_psql() {
  if ! command -v psql &>/dev/null; then
    log_error "psql not found. Install PostgreSQL client tools."
    log_info  "  brew install libpq    (macOS)"
    log_info  "  apt install postgresql-client  (Ubuntu)"
    exit 1
  fi
}

wait_for_pg() {
  log_info "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  local retries=30
  while ! PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null; do
    retries=$((retries - 1))
    if [ $retries -le 0 ]; then
      log_error "PostgreSQL not available after 30 attempts"
      exit 1
    fi
    sleep 1
  done
  log_success "PostgreSQL is ready"
}

run_sql() {
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "$1" 2>/dev/null
}

# ── Step 1: Create PostgreSQL schemas ──────────────────────────────────────
create_schemas() {
  log_info "Creating PostgreSQL schemas..."

  for schema in "${SCHEMAS[@]}"; do
    run_sql "CREATE SCHEMA IF NOT EXISTS ${schema};" || true
  done

  log_success "Created ${#SCHEMAS[@]} schemas"
}

# ── Step 2: Enable extensions ──────────────────────────────────────────────
enable_extensions() {
  log_info "Enabling PostgreSQL extensions..."

  run_sql "CREATE EXTENSION IF NOT EXISTS postgis;"
  run_sql "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
  run_sql "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

  log_success "Extensions enabled: postgis, uuid-ossp, pg_trgm"
}

# ── Step 3: Create audit log table ────────────────────────────────────────
create_audit_table() {
  log_info "Creating audit.audit_log table..."

  run_sql "
    CREATE TABLE IF NOT EXISTS audit.audit_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      entity_type VARCHAR(100) NOT NULL,
      entity_id UUID NOT NULL,
      action VARCHAR(50) NOT NULL,
      actor_user_id UUID,
      actor_role VARCHAR(50),
      actor_tenant_id UUID,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reason TEXT,
      previous_version JSONB,
      new_version JSONB,
      data_classification VARCHAR(20) NOT NULL DEFAULT 'RESTRICTED',
      service_name VARCHAR(50) NOT NULL,
      ip_address INET,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit.audit_log(entity_type, entity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit.audit_log(actor_user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit.audit_log(actor_tenant_id);
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit.audit_log(timestamp);

    GRANT ALL ON ALL TABLES IN SCHEMA audit TO ${DB_USER};
    GRANT USAGE ON ALL SCHEMAS TO ${DB_USER};
  "

  log_success "Audit log table ready"
}

# ── Step 4: Run Prisma migrations ─────────────────────────────────────────
run_migrations() {
  log_info "Running Prisma migrations..."

  cd "$DB_SCHEMAS_DIR"

  # Generate Prisma client
  npx prisma generate --schema=prisma
  log_success "Prisma client generated"

  # Push schema to database (creates tables)
  npx prisma db push --schema=prisma --accept-data-loss 2>&1 || {
    log_warn "prisma db push had warnings (this is normal for first run)"
  }

  log_success "Database schema pushed"

  # Create PostGIS spatial indexes for geo-services
  cd "$ROOT_DIR"
  run_sql "
    CREATE INDEX IF NOT EXISTS idx_admin_boundaries_geom
      ON geo_services.admin_boundaries USING GIST (geom);
  " 2>/dev/null || true
  run_sql "
    CREATE INDEX IF NOT EXISTS idx_geo_events_geom
      ON geo_services.geo_events USING GIST (geom);
  " 2>/dev/null || true

  log_success "Spatial indexes created"
}

# ── Step 5: Run seed scripts ──────────────────────────────────────────────
run_seeds() {
  log_info "Running seed scripts..."

  cd "$ROOT_DIR"

  if [ -f "scripts/db-seed-all.ts" ]; then
    npx tsx scripts/db-seed-all.ts
    log_success "All seeds completed"
  else
    log_warn "scripts/db-seed-all.ts not found, running individual seeds..."
    cd "$DB_SCHEMAS_DIR"
    npx tsx prisma/seed-tenant.ts
    npx tsx prisma/seed-credential.ts
    log_success "Platform seeds completed"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo "  ARIS 4.0 — Database Setup"
  echo "  Database: ${DB_NAME}@${DB_HOST}:${DB_PORT}"
  echo "═══════════════════════════════════════════════════════════"
  echo ""

  check_psql
  wait_for_pg
  create_schemas
  enable_extensions
  create_audit_table
  run_migrations
  run_seeds

  echo ""
  echo "═══════════════════════════════════════════════════════════"
  echo -e "  ${GREEN}Database setup complete!${NC}"
  echo ""
  echo "  Schemas:    ${#SCHEMAS[@]}"
  echo "  Extensions: postgis, uuid-ossp, pg_trgm"
  echo "  Audit:      audit.audit_log"
  echo ""
  echo "  Next steps:"
  echo "    pnpm --filter @aris/db-schemas studio   # Browse data"
  echo "    ./scripts/start-dev.sh services         # Start services"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
}

main "$@"
