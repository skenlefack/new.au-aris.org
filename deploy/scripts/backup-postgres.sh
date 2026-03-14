#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ARIS 4.0 — PostgreSQL Backup Script
# Runs on VM-DB (nbo-dbms03 / 10.202.101.185)
# Schedule: cron daily at 02:00 UTC
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
BACKUP_DIR="/backups/postgres"
PG_USER="${POSTGRES_USER:-aris}"
PG_DB="${POSTGRES_DB:-aris}"
PG_HOST="${POSTGRES_HOST:-localhost}"
PG_PORT="${POSTGRES_PORT:-5432}"
RETENTION_DAILY=7
RETENTION_WEEKLY=4
LOG_FILE="/var/log/aris-backup-postgres.log"
DATE=$(date +%Y-%m-%d_%H-%M)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday

# ── Setup ─────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}/daily" "${BACKUP_DIR}/weekly"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== PostgreSQL backup started ==="

# ── Dump ──────────────────────────────────────────────────────
DUMP_FILE="${BACKUP_DIR}/daily/aris_backup_${DATE}.dump"

log "Creating dump: ${DUMP_FILE}"
pg_dump \
    -h "$PG_HOST" \
    -p "$PG_PORT" \
    -U "$PG_USER" \
    -d "$PG_DB" \
    -Fc \
    -Z9 \
    --verbose \
    -f "$DUMP_FILE" 2>> "$LOG_FILE"

# ── Verify dump ───────────────────────────────────────────────
if pg_restore --list "$DUMP_FILE" > /dev/null 2>&1; then
    DUMP_SIZE=$(du -h "$DUMP_FILE" | cut -f1)
    log "Dump verified OK — size: ${DUMP_SIZE}"
else
    log "ERROR: Dump verification FAILED for ${DUMP_FILE}"
    exit 1
fi

# ── Weekly copy (Sunday) ─────────────────────────────────────
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    WEEKLY_FILE="${BACKUP_DIR}/weekly/aris_weekly_${DATE}.dump"
    cp "$DUMP_FILE" "$WEEKLY_FILE"
    log "Weekly backup created: ${WEEKLY_FILE}"
fi

# ── Rotation: daily ──────────────────────────────────────────
DELETED_DAILY=0
find "${BACKUP_DIR}/daily" -name "aris_backup_*.dump" -mtime +${RETENTION_DAILY} -exec rm -f {} \; -exec sh -c 'echo "  deleted: $1"' _ {} \; 2>> "$LOG_FILE" | while read -r line; do
    DELETED_DAILY=$((DELETED_DAILY + 1))
done
log "Daily rotation: kept last ${RETENTION_DAILY} days"

# ── Rotation: weekly ─────────────────────────────────────────
RETENTION_WEEKLY_DAYS=$((RETENTION_WEEKLY * 7))
find "${BACKUP_DIR}/weekly" -name "aris_weekly_*.dump" -mtime +${RETENTION_WEEKLY_DAYS} -exec rm -f {} \;
log "Weekly rotation: kept last ${RETENTION_WEEKLY} weeks"

# ── Summary ───────────────────────────────────────────────────
DAILY_COUNT=$(find "${BACKUP_DIR}/daily" -name "*.dump" | wc -l)
WEEKLY_COUNT=$(find "${BACKUP_DIR}/weekly" -name "*.dump" | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)

log "Summary: ${DAILY_COUNT} daily, ${WEEKLY_COUNT} weekly, total size: ${TOTAL_SIZE}"
log "=== PostgreSQL backup completed ==="
