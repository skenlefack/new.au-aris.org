#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ARIS 4.0 — VM-CACHE Setup Script
# Host: 10.202.101.186 (nbo-cch01)
# Redis 7 + OpenSearch 2.17.1
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

echo "════════════════════════════════════════════"
echo "  ARIS 4.0 — VM-CACHE Setup (Redis + OpenSearch)"
echo "  Host: $(hostname) / $(hostname -I | awk '{print $1}')"
echo "════════════════════════════════════════════"

# ── 1. System Update ──
echo "[1/6] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# ── 2. Install Docker ──
echo "[2/6] Installing Docker..."
if ! command -v docker &>/dev/null; then
    apt-get install -y -qq ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -qq
    apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    systemctl enable docker
    systemctl start docker
    echo "Docker installed: $(docker --version)"
else
    echo "Docker already installed: $(docker --version)"
fi

# ── 3. OS Kernel Tuning for Redis + OpenSearch ──
echo "[3/6] Applying kernel parameters for Redis + OpenSearch..."
cat > /etc/sysctl.d/99-aris-cache.conf <<'SYSCTL'
# ARIS Redis tuning
vm.swappiness = 1
vm.overcommit_memory = 1
net.core.somaxconn = 65535

# ARIS OpenSearch tuning (needs ≥262144)
vm.max_map_count = 1048576
SYSCTL
sysctl --system >/dev/null 2>&1

# Disable Transparent Huge Pages (Redis recommendation)
echo never > /sys/kernel/mm/transparent_hugepage/enabled 2>/dev/null || true
echo never > /sys/kernel/mm/transparent_hugepage/defrag 2>/dev/null || true

# Persist THP disable across reboots
cat > /etc/systemd/system/disable-thp.service <<'THP'
[Unit]
Description=Disable Transparent Huge Pages (THP)
DefaultDependencies=no
After=sysinit.target local-fs.target
Before=basic.target

[Service]
Type=oneshot
ExecStart=/bin/sh -c 'echo never > /sys/kernel/mm/transparent_hugepage/enabled && echo never > /sys/kernel/mm/transparent_hugepage/defrag'

[Install]
WantedBy=basic.target
THP
systemctl daemon-reload
systemctl enable disable-thp.service

# ── 4. UFW Firewall ──
echo "[4/6] Configuring UFW firewall..."
apt-get install -y -qq ufw 2>/dev/null || true
ufw --force reset >/dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH-global'
ufw allow from 10.202.101.0/24 to any port 6379 comment 'Redis'
ufw allow from 10.202.101.0/24 to any port 9200 comment 'OpenSearch API'
ufw allow from 10.202.101.0/24 to any port 5601 comment 'OpenSearch Dashboards'
ufw --force enable
echo "UFW enabled:"
ufw status numbered

# ── 5. Prepare Data Directories ──
echo "[5/6] Preparing data directories..."
mkdir -p /var/lib/redis
mkdir -p /var/lib/opensearch
# OpenSearch runs as opensearch user (UID 1000)
chown -R 1000:1000 /var/lib/opensearch

# ── 6. Deploy Docker Compose ──
echo "[6/6] Deploying Redis + OpenSearch..."
cd "${DEPLOY_DIR}/vm-cache"

# Load production environment (convert CRLF → LF for Linux)
if [ -f "${DEPLOY_DIR}/.env.production" ]; then
    ENV_FILE="/tmp/aris-env-clean"
    sed 's/\r$//' "${DEPLOY_DIR}/.env.production" > "$ENV_FILE"
    set -a
    source "$ENV_FILE"
    set +a
    rm -f "$ENV_FILE"
fi

docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d

# Wait for services
echo "Waiting for Redis..."
for i in $(seq 1 20); do
    if docker exec aris-redis redis-cli -a "${REDIS_PASSWORD:-R3d1s_Pr0d_2024!vN7wQ}" ping 2>/dev/null | grep -q PONG; then
        echo "Redis is ready!"
        break
    fi
    echo "  Waiting... ($i/20)"
    sleep 3
done

echo "Waiting for OpenSearch..."
for i in $(seq 1 30); do
    if curl -sf http://localhost:9200/_cluster/health >/dev/null 2>&1; then
        echo "OpenSearch is ready!"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 5
done

# Verify
echo ""
echo "════════════════════════════════════════════"
echo "  Verification"
echo "════════════════════════════════════════════"
echo "Redis:"
docker exec aris-redis redis-cli -a "${REDIS_PASSWORD:-R3d1s_Pr0d_2024!vN7wQ}" info server 2>/dev/null | grep redis_version || echo "  Not ready"
echo ""
echo "OpenSearch:"
curl -s http://localhost:9200 2>/dev/null || echo "  Not ready"

# Install Node Exporter for Prometheus monitoring
if [ -f "${SCRIPT_DIR}/install-node-exporter.sh" ]; then
    echo "Installing Node Exporter..."
    bash "${SCRIPT_DIR}/install-node-exporter.sh"
fi

echo ""
echo "VM-CACHE setup complete!"
