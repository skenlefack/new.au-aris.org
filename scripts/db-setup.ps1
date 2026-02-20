# ═══════════════════════════════════════════════════════════════════════════
# ARIS 3.0 — Database Setup Script (PowerShell)
# Creates PostgreSQL schemas, enables extensions, runs migrations & seeds
# ═══════════════════════════════════════════════════════════════════════════
$ErrorActionPreference = "Stop"

# ── Configuration ──────────────────────────────────────────────────────────
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir   = Split-Path -Parent $ScriptDir
$DbSchemasDir = Join-Path $RootDir "packages\db-schemas"

# Database connection (override via env vars)
$DbHost     = if ($env:PGHOST)     { $env:PGHOST }     else { "localhost" }
$DbPort     = if ($env:PGPORT)     { $env:PGPORT }     else { "5432" }
$DbUser     = if ($env:PGUSER)     { $env:PGUSER }     else { "aris" }
$DbPassword = if ($env:PGPASSWORD) { $env:PGPASSWORD } else { "aris_dev_2024" }
$DbName     = if ($env:PGDATABASE) { $env:PGDATABASE } else { "aris" }

if (-not $env:DATABASE_URL) {
  $env:DATABASE_URL = "postgresql://${DbUser}:${DbPassword}@${DbHost}:${DbPort}/${DbName}?schema=public"
}

# All PostgreSQL schemas (one per service + audit)
$Schemas = @(
  "public"
  "tenant"
  "credential"
  "master_data"
  "data_quality"
  "data_contract"
  "message"
  "drive"
  "form_builder"
  "collecte"
  "workflow"
  "animal_health"
  "livestock_prod"
  "fisheries"
  "wildlife"
  "apiculture"
  "trade_sps"
  "governance"
  "climate_env"
  "analytics"
  "geo_services"
  "knowledge_hub"
  "interop_hub"
  "audit"
)

# ── Helper functions ───────────────────────────────────────────────────────
function Log-Info    { param($Msg) Write-Host "[INFO] $Msg" -ForegroundColor Cyan }
function Log-Success { param($Msg) Write-Host "[OK]   $Msg" -ForegroundColor Green }
function Log-Warn    { param($Msg) Write-Host "[WARN] $Msg" -ForegroundColor Yellow }
function Log-Error   { param($Msg) Write-Host "[ERR]  $Msg" -ForegroundColor Red }

function Test-Psql {
  if (-not (Get-Command "psql" -ErrorAction SilentlyContinue)) {
    Log-Error "psql not found. Install PostgreSQL client tools."
    Write-Host "  choco install postgresql   (Windows)"
    Write-Host "  scoop install postgresql   (Windows)"
    exit 1
  }
}

function Wait-ForPg {
  Log-Info "Waiting for PostgreSQL at ${DbHost}:${DbPort}..."
  $retries = 30
  while ($retries -gt 0) {
    try {
      $env:PGPASSWORD = $DbPassword
      $result = & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c "SELECT 1" 2>$null
      if ($LASTEXITCODE -eq 0) {
        Log-Success "PostgreSQL is ready"
        return
      }
    } catch { }
    $retries--
    Start-Sleep -Seconds 1
  }
  Log-Error "PostgreSQL not available after 30 attempts"
  exit 1
}

function Run-Sql {
  param([string]$Sql)
  $env:PGPASSWORD = $DbPassword
  & psql -h $DbHost -p $DbPort -U $DbUser -d $DbName -c $Sql 2>$null
}

# ── Step 1: Create PostgreSQL schemas ──────────────────────────────────────
function New-Schemas {
  Log-Info "Creating PostgreSQL schemas..."

  foreach ($schema in $Schemas) {
    Run-Sql "CREATE SCHEMA IF NOT EXISTS $schema;" | Out-Null
  }

  Log-Success "Created $($Schemas.Count) schemas"
}

# ── Step 2: Enable extensions ──────────────────────────────────────────────
function Enable-Extensions {
  Log-Info "Enabling PostgreSQL extensions..."

  Run-Sql 'CREATE EXTENSION IF NOT EXISTS postgis;'
  Run-Sql 'CREATE EXTENSION IF NOT EXISTS "uuid-ossp";'
  Run-Sql 'CREATE EXTENSION IF NOT EXISTS pg_trgm;'

  Log-Success "Extensions enabled: postgis, uuid-ossp, pg_trgm"
}

# ── Step 3: Create audit log table ────────────────────────────────────────
function New-AuditTable {
  Log-Info "Creating audit.audit_log table..."

  $sql = @"
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

    GRANT ALL ON ALL TABLES IN SCHEMA audit TO $DbUser;
    GRANT USAGE ON ALL SCHEMAS TO $DbUser;
"@

  Run-Sql $sql | Out-Null
  Log-Success "Audit log table ready"
}

# ── Step 4: Run Prisma migrations ─────────────────────────────────────────
function Invoke-Migrations {
  Log-Info "Running Prisma migrations..."

  Push-Location $DbSchemasDir

  # Generate Prisma client
  & npx prisma generate --schema=prisma
  Log-Success "Prisma client generated"

  # Push schema to database (creates tables)
  & npx prisma db push --schema=prisma --accept-data-loss 2>&1 | Out-Null
  Log-Success "Database schema pushed"

  Pop-Location

  # Create PostGIS spatial indexes for geo-services
  Run-Sql "CREATE INDEX IF NOT EXISTS idx_admin_boundaries_geom ON geo_services.admin_boundaries USING GIST (geom);" 2>$null | Out-Null
  Run-Sql "CREATE INDEX IF NOT EXISTS idx_geo_events_geom ON geo_services.geo_events USING GIST (geom);" 2>$null | Out-Null

  Log-Success "Spatial indexes created"
}

# ── Step 5: Run seed scripts ──────────────────────────────────────────────
function Invoke-Seeds {
  Log-Info "Running seed scripts..."

  $seedAll = Join-Path $RootDir "scripts\db-seed-all.ts"
  if (Test-Path $seedAll) {
    Push-Location $RootDir
    & npx tsx $seedAll
    Pop-Location
    Log-Success "All seeds completed"
  } else {
    Log-Warn "scripts\db-seed-all.ts not found, running individual seeds..."
    Push-Location $DbSchemasDir
    & npx tsx prisma/seed-tenant.ts
    & npx tsx prisma/seed-credential.ts
    Pop-Location
    Log-Success "Platform seeds completed"
  }
}

# ── Main ──────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "========================================================"
Write-Host "  ARIS 3.0 - Database Setup"
Write-Host "  Database: ${DbName}@${DbHost}:${DbPort}"
Write-Host "========================================================"
Write-Host ""

Test-Psql
Wait-ForPg
New-Schemas
Enable-Extensions
New-AuditTable
Invoke-Migrations
Invoke-Seeds

Write-Host ""
Write-Host "========================================================"
Write-Host "  Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Schemas:    $($Schemas.Count)"
Write-Host "  Extensions: postgis, uuid-ossp, pg_trgm"
Write-Host "  Audit:      audit.audit_log"
Write-Host ""
Write-Host "  Next steps:"
Write-Host "    pnpm --filter @aris/db-schemas studio   # Browse data"
Write-Host "    ./scripts/start-dev.ps1 services        # Start services"
Write-Host "========================================================"
Write-Host ""
