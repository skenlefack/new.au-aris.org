#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ARIS 4.0 — Redis Backup Script
# Runs on VM-CACHE (nbo-cch01 / 10.202.101.186)
# Schedule: cron daily at 02:30 UTC
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
BACKUP_DIR="/backups/redis"
REDIS_CLI="docker exec aris-redis redis-cli"
REDIS_DATA_DIR="/opt/aris-deploy/vm-cache/redis-data"
RETENTION_DAYS=7
LOG_FILE="/var/log/aris-backup-redis.log"
DATE=$(date +%Y-%m-%d_%H-%M)

# ── Setup ─────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== Redis backup started ==="

# ── Trigger BGSAVE ────────────────────────────────────────────
log "Triggering BGSAVE..."
${REDIS_CLI} BGSAVE 2>> "$LOG_FILE"

# Wait for BGSAVE to complete (max 120 seconds)
WAITED=0
while [ $WAITED -lt 120 ]; do
    LASTSAVE_BEFORE=$(${REDIS_CLI} LASTSAVE | tr -d '\r')
    sleep 2
    LASTSAVE_AFTER=$(${REDIS_CLI} LASTSAVE | tr -d '\r')
    if [ "$LASTSAVE_BEFORE" = "$LASTSAVE_AFTER" ]; then
        BG_STATUS=$(${REDIS_CLI} INFO persistence | grep -c "rdb_bgsave_in_progress:0" || true)
        if [ "$BG_STATUS" -ge 1 ]; then
            log "BGSAVE completed"
            break
        fi
    fi
    WAITED=$((WAITED + 2))
done

if [ $WAITED -ge 120 ]; then
    log "WARNING: BGSAVE may not have completed within 120s, proceeding anyway"
fi

# ── Copy RDB dump ─────────────────────────────────────────────
RDB_SRC="${REDIS_DATA_DIR}/dump.rdb"
RDB_DST="${BACKUP_DIR}/redis_dump_${DATE}.rdb"

if [ -f "$RDB_SRC" ]; then
    cp "$RDB_SRC" "$RDB_DST"
    RDB_SIZE=$(du -h "$RDB_DST" | cut -f1)
    log "RDB copied: ${RDB_DST} (${RDB_SIZE})"
else
    log "WARNING: RDB file not found at ${RDB_SRC}"
fi

# ── Copy AOF if present ──────────────────────────────────────
AOF_SRC="${REDIS_DATA_DIR}/appendonly.aof"
if [ -f "$AOF_SRC" ]; then
    AOF_DST="${BACKUP_DIR}/redis_aof_${DATE}.aof"
    cp "$AOF_SRC" "$AOF_DST"
    AOF_SIZE=$(du -h "$AOF_DST" | cut -f1)
    log "AOF copied: ${AOF_DST} (${AOF_SIZE})"
fi

# Also check for AOF directory (Redis 7 multi-part AOF)
AOF_DIR="${REDIS_DATA_DIR}/appendonlydir"
if [ -d "$AOF_DIR" ]; then
    AOF_ARCHIVE="${BACKUP_DIR}/redis_aof_${DATE}.tar.gz"
    tar -czf "$AOF_ARCHIVE" -C "${REDIS_DATA_DIR}" appendonlydir 2>> "$LOG_FILE"
    AOF_SIZE=$(du -h "$AOF_ARCHIVE" | cut -f1)
    log "AOF dir archived: ${AOF_ARCHIVE} (${AOF_SIZE})"
fi

# ── Rotation ──────────────────────────────────────────────────
find "${BACKUP_DIR}" -name "redis_*" -mtime +${RETENTION_DAYS} -exec rm -f {} \;
log "Rotation: kept last ${RETENTION_DAYS} days"

# ── Summary ───────────────────────────────────────────────────
BACKUP_COUNT=$(find "${BACKUP_DIR}" -name "redis_*" -mtime -${RETENTION_DAYS} | wc -l)
TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" | cut -f1)

log "Summary: ${BACKUP_COUNT} backup files, total size: ${TOTAL_SIZE}"
log "=== Redis backup completed ==="
