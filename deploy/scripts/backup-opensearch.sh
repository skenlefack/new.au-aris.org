#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ARIS 4.0 — OpenSearch Backup Script
# Runs on VM-CACHE (nbo-cch01 / 10.202.101.186)
# Schedule: cron daily at 03:00 UTC
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

# ── Configuration ─────────────────────────────────────────────
BACKUP_DIR="/backups/opensearch"
OPENSEARCH_URL="${OPENSEARCH_URL:-http://localhost:9200}"
REPO_NAME="aris_backup"
RETENTION_SNAPSHOTS=7
LOG_FILE="/var/log/aris-backup-opensearch.log"
DATE=$(date +%Y-%m-%d_%H-%M)
SNAPSHOT_NAME="snapshot_${DATE}"

# ── Setup ─────────────────────────────────────────────────────
mkdir -p "${BACKUP_DIR}/snapshots"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

log "=== OpenSearch backup started ==="

# ── Register snapshot repository (idempotent) ────────────────
log "Registering snapshot repository: ${REPO_NAME}"
REGISTER_RESULT=$(curl -s -X PUT "${OPENSEARCH_URL}/_snapshot/${REPO_NAME}" \
    -H "Content-Type: application/json" \
    -d "{
        \"type\": \"fs\",
        \"settings\": {
            \"location\": \"${BACKUP_DIR}/snapshots\",
            \"compress\": true
        }
    }" 2>> "$LOG_FILE")

if echo "$REGISTER_RESULT" | grep -q '"acknowledged":true'; then
    log "Repository registered successfully"
else
    log "Repository registration response: ${REGISTER_RESULT}"
fi

# ── Create snapshot ───────────────────────────────────────────
log "Creating snapshot: ${SNAPSHOT_NAME}"
SNAPSHOT_RESULT=$(curl -s -X PUT "${OPENSEARCH_URL}/_snapshot/${REPO_NAME}/${SNAPSHOT_NAME}?wait_for_completion=true" \
    -H "Content-Type: application/json" \
    -d '{
        "indices": "*",
        "ignore_unavailable": true,
        "include_global_state": true
    }' 2>> "$LOG_FILE")

if echo "$SNAPSHOT_RESULT" | grep -q '"state":"SUCCESS"'; then
    log "Snapshot created successfully: ${SNAPSHOT_NAME}"
else
    log "WARNING: Snapshot result: ${SNAPSHOT_RESULT}"
fi

# ── Rotation: delete old snapshots ────────────────────────────
log "Checking for old snapshots to delete..."
SNAPSHOTS=$(curl -s "${OPENSEARCH_URL}/_snapshot/${REPO_NAME}/_all" 2>> "$LOG_FILE")

# Get snapshot names sorted by date, skip the most recent N
SNAPSHOT_LIST=$(echo "$SNAPSHOTS" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    snaps = data.get('snapshots', [])
    snaps.sort(key=lambda s: s.get('start_time_in_millis', 0))
    # Print snapshots to delete (all except the last RETENTION_SNAPSHOTS)
    to_delete = snaps[:-${RETENTION_SNAPSHOTS}] if len(snaps) > ${RETENTION_SNAPSHOTS} else []
    for s in to_delete:
        print(s['snapshot'])
except Exception as e:
    print(f'ERROR: {e}', file=sys.stderr)
" 2>> "$LOG_FILE")

DELETED=0
for SNAP in $SNAPSHOT_LIST; do
    curl -s -X DELETE "${OPENSEARCH_URL}/_snapshot/${REPO_NAME}/${SNAP}" > /dev/null 2>> "$LOG_FILE"
    log "Deleted old snapshot: ${SNAP}"
    DELETED=$((DELETED + 1))
done
log "Rotation: deleted ${DELETED} old snapshots, keeping last ${RETENTION_SNAPSHOTS}"

# ── Summary ───────────────────────────────────────────────────
CURRENT_COUNT=$(curl -s "${OPENSEARCH_URL}/_snapshot/${REPO_NAME}/_all" 2>/dev/null | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    print(len(data.get('snapshots', [])))
except:
    print('?')
" 2>/dev/null || echo "?")

TOTAL_SIZE=$(du -sh "${BACKUP_DIR}" 2>/dev/null | cut -f1 || echo "?")
log "Summary: ${CURRENT_COUNT} snapshots, total size: ${TOTAL_SIZE}"
log "=== OpenSearch backup completed ==="
