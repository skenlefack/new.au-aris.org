#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ARIS 4.0 — VM-DB Setup Script
# Host: 10.202.101.185 (nbo-dbms03)
# PostgreSQL 16 + PostGIS 3.4 + PgBouncer
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

echo "════════════════════════════════════════════"
echo "  ARIS 4.0 — VM-DB Setup (PostgreSQL)"
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

# ── 3. OS Kernel Tuning for PostgreSQL ──
echo "[3/6] Applying kernel parameters for PostgreSQL..."
cat > /etc/sysctl.d/99-aris-postgresql.conf <<'SYSCTL'
# ARIS PostgreSQL tuning
vm.swappiness = 10
vm.dirty_ratio = 40
vm.dirty_background_ratio = 5
kernel.shmmax = 17179869184
kernel.shmall = 4194304
SYSCTL
sysctl --system >/dev/null 2>&1

# ── 4. UFW Firewall ──
echo "[4/6] Configuring UFW firewall..."
if command -v ufw &>/dev/null; then
    ufw --force reset >/dev/null 2>&1
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment 'SSH-global'
    ufw allow from 10.202.101.0/24 to any port 5432 comment 'PostgreSQL direct'
    ufw allow from 10.202.101.0/24 to any port 6432 comment 'PgBouncer'
    ufw --force enable
    echo "UFW enabled:"
    ufw status numbered
else
    apt-get install -y -qq ufw
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow 22/tcp comment 'SSH-global'
    ufw allow from 10.202.101.0/24 to any port 5432 comment 'PostgreSQL direct'
    ufw allow from 10.202.101.0/24 to any port 6432 comment 'PgBouncer'
    ufw --force enable
fi

# ── 5. Prepare Data Directories ──
echo "[5/6] Preparing data directories..."
mkdir -p /var/lib/postgresql/data
chmod 700 /var/lib/postgresql/data

# ── 6. Deploy Docker Compose ──
echo "[6/6] Deploying PostgreSQL + PgBouncer..."
cd "${DEPLOY_DIR}/vm-db"

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

# Start PostgreSQL first, then PgBouncer after healthcheck passes
docker compose up -d postgres

# Wait for PostgreSQL to be healthy
echo "Waiting for PostgreSQL to be healthy..."
for i in $(seq 1 30); do
    if docker exec aris-postgres pg_isready -U aris -d aris >/dev/null 2>&1; then
        echo "PostgreSQL is ready!"
        break
    fi
    echo "  Waiting... ($i/30)"
    sleep 5
done

# Now start PgBouncer (PostgreSQL should be healthy)
echo "Starting PgBouncer..."
docker compose up -d pgbouncer

# Wait for PgBouncer
for i in $(seq 1 10); do
    if docker exec aris-pgbouncer pg_isready -h 127.0.0.1 -p 6432 -U aris -d aris >/dev/null 2>&1; then
        echo "PgBouncer is ready!"
        break
    fi
    echo "  Waiting for PgBouncer... ($i/10)"
    sleep 3
done

# Verify schemas
echo ""
echo "════════════════════════════════════════════"
echo "  Verification"
echo "════════════════════════════════════════════"
docker exec aris-postgres psql -U aris -d aris -c '\dn' 2>/dev/null || echo "Warning: Could not list schemas"
echo ""
echo "PgBouncer status:"
docker exec aris-pgbouncer pg_isready -h 127.0.0.1 -p 6432 -U aris -d aris 2>/dev/null && echo "PgBouncer is ready!" || echo "Warning: PgBouncer not ready yet"

# Install Node Exporter for Prometheus monitoring
if [ -f "${SCRIPT_DIR}/install-node-exporter.sh" ]; then
    echo "Installing Node Exporter..."
    bash "${SCRIPT_DIR}/install-node-exporter.sh"
fi

echo ""
echo "VM-DB setup complete!"
