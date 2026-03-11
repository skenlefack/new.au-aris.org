#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ARIS 4.0 — Sync Repository to VM-APP
# Transfers the ARIS codebase to the application server for
# Docker image builds. Excludes heavy/unnecessary directories.
# ═══════════════════════════════════════════════════════════════
#
# Usage (from development machine):
#   ./deploy/scripts/sync-repo.sh
#   ./deploy/scripts/sync-repo.sh --dry-run
#
# Prerequisites:
#   - SSH access to VM-APP (10.202.101.183)
#   - rsync installed on both machines
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

VM_APP_HOST="10.202.101.183"
VM_APP_USER="root"
REMOTE_DIR="/opt/aris"
DRY_RUN=""

# Parse args
if [ "${1:-}" = "--dry-run" ]; then
    DRY_RUN="--dry-run"
    echo "[DRY RUN MODE]"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "════════════════════════════════════════════"
echo "  ARIS 4.0 — Repository Sync to VM-APP"
echo "════════════════════════════════════════════"
echo "  Source: $REPO_ROOT"
echo "  Target: ${VM_APP_USER}@${VM_APP_HOST}:${REMOTE_DIR}"
echo ""

# Check rsync is available
if ! command -v rsync &>/dev/null; then
    echo "rsync not found. Falling back to tar+scp method..."

    echo "[1/3] Creating archive (excluding heavy directories)..."
    ARCHIVE="/tmp/aris-deploy.tar.gz"
    cd "$REPO_ROOT"
    tar czf "$ARCHIVE" \
        --exclude='node_modules' \
        --exclude='.git' \
        --exclude='.next' \
        --exclude='dist' \
        --exclude='coverage' \
        --exclude='.turbo' \
        --exclude='*.log' \
        --exclude='apps/mobile' \
        .

    ARCHIVE_SIZE=$(du -h "$ARCHIVE" | awk '{print $1}')
    echo "  Archive size: $ARCHIVE_SIZE"

    if [ -z "$DRY_RUN" ]; then
        echo "[2/3] Transferring to VM-APP..."
        ssh -o StrictHostKeyChecking=no "${VM_APP_USER}@${VM_APP_HOST}" "mkdir -p ${REMOTE_DIR}"
        scp -o StrictHostKeyChecking=no "$ARCHIVE" "${VM_APP_USER}@${VM_APP_HOST}:/tmp/aris-deploy.tar.gz"

        echo "[3/3] Extracting on VM-APP..."
        ssh -o StrictHostKeyChecking=no "${VM_APP_USER}@${VM_APP_HOST}" "
            cd ${REMOTE_DIR} &&
            tar xzf /tmp/aris-deploy.tar.gz &&
            rm /tmp/aris-deploy.tar.gz
        "
    else
        echo "[DRY RUN] Would transfer $ARCHIVE_SIZE to VM-APP"
    fi

    rm -f "$ARCHIVE"
    echo "Done!"
    exit 0
fi

# rsync method (preferred — incremental, fast)
echo "Using rsync for incremental transfer..."
echo ""

rsync -avz --progress $DRY_RUN \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='.next' \
    --exclude='dist' \
    --exclude='coverage' \
    --exclude='.turbo' \
    --exclude='*.log' \
    --exclude='apps/mobile' \
    --exclude='__pycache__' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='deploy/vm_scan_results.json' \
    --exclude='deploy/vm_audit_report.json' \
    -e "ssh -o StrictHostKeyChecking=no" \
    "$REPO_ROOT/" \
    "${VM_APP_USER}@${VM_APP_HOST}:${REMOTE_DIR}/"

echo ""
echo "════════════════════════════════════════════"
echo "  Sync complete!"
echo "════════════════════════════════════════════"
echo ""
echo "Next steps on VM-APP:"
echo "  1. ssh ${VM_APP_USER}@${VM_APP_HOST}"
echo "  2. cd ${REMOTE_DIR}"
echo "  3. cp deploy/.env.production .env"
echo "  4. pnpm install --frozen-lockfile"
echo "  5. cd packages/db-schemas && npx prisma generate --schema=prisma"
echo "  6. npx prisma migrate deploy --schema=prisma"
echo "  7. cd ${REMOTE_DIR} && pnpm run db:seed"
echo "  8. cd deploy/vm-app && docker compose up -d --build"
