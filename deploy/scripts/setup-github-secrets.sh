#!/usr/bin/env bash
# ARIS 4.0 — Configure GitHub Secrets for CI/CD workflows
#
# Prerequisites:
#   1. Install GitHub CLI: https://cli.github.com/
#   2. Authenticate: gh auth login
#
# Usage:
#   bash deploy/scripts/setup-github-secrets.sh
#
# This script sets all required GitHub Actions secrets for:
#   - deploy.yml (automated deployment to production VMs)
#   - backup-check.yml (daily backup verification)
#
set -euo pipefail

echo "=== ARIS 4.0 — GitHub Secrets Setup ==="
echo ""

# Verify gh CLI is available and authenticated
if ! command -v gh &>/dev/null; then
  echo "ERROR: GitHub CLI (gh) is not installed."
  echo "Install it from: https://cli.github.com/"
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "ERROR: GitHub CLI is not authenticated."
  echo "Run: gh auth login"
  exit 1
fi

REPO=$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null)
echo "Repository: ${REPO}"
echo ""

# ── Prompt for values ────────────────────────────────────────
read -rp "VM-APP IP      [10.202.101.183]: " VM_APP_HOST
VM_APP_HOST=${VM_APP_HOST:-10.202.101.183}

read -rp "VM-DB IP       [10.202.101.185]: " VM_DB_HOST
VM_DB_HOST=${VM_DB_HOST:-10.202.101.185}

read -rp "VM-CACHE IP    [10.202.101.186]: " VM_CACHE_HOST
VM_CACHE_HOST=${VM_CACHE_HOST:-10.202.101.186}

read -rp "SSH username   [arisadmin]: " DEPLOY_SSH_USER
DEPLOY_SSH_USER=${DEPLOY_SSH_USER:-arisadmin}

read -rsp "SSH password: " DEPLOY_SSH_PASS
echo ""

if [ -z "$DEPLOY_SSH_PASS" ]; then
  echo "ERROR: SSH password cannot be empty."
  exit 1
fi

echo ""
echo "=== Setting GitHub Secrets ==="

# ── Set secrets ──────────────────────────────────────────────
gh secret set VM_APP_HOST   --body "$VM_APP_HOST"
echo "  [OK] VM_APP_HOST"

gh secret set VM_DB_HOST    --body "$VM_DB_HOST"
echo "  [OK] VM_DB_HOST"

gh secret set VM_CACHE_HOST --body "$VM_CACHE_HOST"
echo "  [OK] VM_CACHE_HOST"

gh secret set DEPLOY_SSH_USER --body "$DEPLOY_SSH_USER"
echo "  [OK] DEPLOY_SSH_USER"

gh secret set DEPLOY_SSH_PASS --body "$DEPLOY_SSH_PASS"
echo "  [OK] DEPLOY_SSH_PASS"

echo ""
echo "=== All secrets configured! ==="
echo ""
echo "You can now trigger the deploy workflow:"
echo "  gh workflow run deploy.yml"
echo ""
echo "Or verify with:"
echo "  gh secret list"
