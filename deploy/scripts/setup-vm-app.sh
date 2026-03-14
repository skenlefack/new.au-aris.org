#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ARIS 4.0 — VM-APP Setup Script
# Host: 10.202.101.183 (nbo-aris04)
# All microservices + Traefik + Monitoring + BI + Frontend
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"
ARIS_DIR="/opt/aris"

echo "════════════════════════════════════════════"
echo "  ARIS 4.0 — VM-APP Setup (Application Server)"
echo "  Host: $(hostname) / $(hostname -I | awk '{print $1}')"
echo "════════════════════════════════════════════"

# ── 1. System Update ──
echo "[1/9] Updating system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq
apt-get install -y -qq git curl wget build-essential

# ── 2. Install Docker ──
echo "[2/9] Installing Docker..."
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

# ── 3. Install Node.js 22 LTS ──
echo "[3/9] Installing Node.js 22 LTS..."
if ! command -v node &>/dev/null || ! node -v 2>/dev/null | grep -q "v22"; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
    echo "Node.js installed: $(node -v)"
else
    echo "Node.js 22 already installed: $(node -v)"
fi

# ── 4. Install pnpm ──
echo "[4/9] Installing pnpm..."
if ! command -v pnpm &>/dev/null; then
    corepack enable
    corepack prepare pnpm@9 --activate
    echo "pnpm installed: $(pnpm -v)"
else
    echo "pnpm already installed: $(pnpm -v)"
fi

# ── 5. UFW Firewall ──
echo "[5/9] Configuring UFW firewall..."
apt-get install -y -qq ufw 2>/dev/null || true
ufw --force reset >/dev/null 2>&1
ufw default deny incoming
ufw default allow outgoing

# Public access
ufw allow 80/tcp comment 'HTTP (Traefik)'
ufw allow 443/tcp comment 'HTTPS (Traefik)'

# Internal network only
ufw allow 22/tcp comment 'SSH-global'
ufw allow from 10.202.101.0/24 to any port 8090 comment 'Traefik Dashboard'
ufw allow from 10.202.101.0/24 to any port 3200 comment 'Grafana'
ufw allow from 10.202.101.0/24 to any port 9090 comment 'Prometheus'
ufw allow from 10.202.101.0/24 to any port 8088 comment 'Superset'
ufw allow from 10.202.101.0/24 to any port 3035 comment 'Metabase'
ufw allow from 10.202.101.0/24 to any port 9000 comment 'MinIO API'
ufw allow from 10.202.101.0/24 to any port 9001 comment 'MinIO Console'
ufw allow from 10.202.101.0/24 to any port 16686 comment 'Jaeger UI'
ufw allow from 10.202.101.0/24 to any port 8025 comment 'Mailpit UI'
ufw --force enable
echo "UFW enabled:"
ufw status numbered

# ── 6. Verify ARIS Source Code ──
echo "[6/9] Verifying ARIS source code at $ARIS_DIR..."
if [ -f "$ARIS_DIR/package.json" ]; then
    echo "  ARIS codebase found at $ARIS_DIR"
    ls -la "$ARIS_DIR/package.json" "$ARIS_DIR/Dockerfile.service" "$ARIS_DIR/Dockerfile.web" 2>/dev/null || true
else
    echo "  ERROR: ARIS codebase not found at $ARIS_DIR"
    echo "  The deploy script should have transferred it before running this script."
    echo "  Continuing anyway — Docker builds may fail."
fi

# ── 7. Generate JWT RS256 Key Pair ──
echo "[7/9] Generating JWT RS256 key pair..."
mkdir -p "$ARIS_DIR/keys"
if [ ! -f "$ARIS_DIR/keys/private.pem" ]; then
    openssl genrsa -out "$ARIS_DIR/keys/private.pem" 2048
    openssl rsa -in "$ARIS_DIR/keys/private.pem" -pubout -out "$ARIS_DIR/keys/public.pem"
    chmod 600 "$ARIS_DIR/keys/private.pem"
    chmod 644 "$ARIS_DIR/keys/public.pem"
    echo "JWT keys generated at $ARIS_DIR/keys/"
else
    echo "JWT keys already exist at $ARIS_DIR/keys/"
fi

# ── 8. Build Application ──
echo "[8/9] Building ARIS application..."
cd "$ARIS_DIR"

# Remove Windows 'nul' device artifact (causes Docker BuildKit 'failed to create device' error)
rm -f "$ARIS_DIR/nul" 2>/dev/null || true

# Clean BuildKit cache to avoid stale layer issues
docker builder prune -af 2>/dev/null || true

# Copy production env (convert CRLF → LF for Linux)
sed 's/\r$//' "${DEPLOY_DIR}/.env.production" > "$ARIS_DIR/.env"

# Load production environment (needed for Prisma + seed)
set -a
source "$ARIS_DIR/.env"
set +a

# Install dependencies
echo "  Installing dependencies..."
pnpm install --frozen-lockfile

# Generate Prisma client
echo "  Generating Prisma client..."
cd packages/db-schemas && npx prisma generate --schema=prisma && cd "$ARIS_DIR"

# Run Prisma migrations (via direct connection to VM-DB)
echo "  Running database migrations..."
(cd packages/db-schemas && npx prisma migrate deploy --schema=prisma 2>&1) || echo "  Note: Migrations may need manual review"
cd "$ARIS_DIR"

# Seed reference data
echo "  Seeding reference data..."
pnpm run db:seed 2>&1 || echo "  Note: Seeding may need manual review"

# ── 9. Deploy Docker Compose (Infrastructure + Services) ──
echo "[9/9] Deploying all services..."
cd "${DEPLOY_DIR}/vm-app"

# Symlink .env for docker compose (already LF-converted at $ARIS_DIR/.env)
cp "$ARIS_DIR/.env" "${DEPLOY_DIR}/vm-app/.env" 2>/dev/null || true

docker compose down --remove-orphans 2>/dev/null || true

# Limit parallel builds to avoid runc/resource exhaustion (VM has 32GB RAM)
export COMPOSE_PARALLEL_LIMIT=4
export DOCKER_BUILDKIT=1

# Build images first, then start containers
echo "  Building Docker images (COMPOSE_PARALLEL_LIMIT=4)..."
docker compose build 2>&1 || {
    echo "  Build failed, retrying with lower parallelism..."
    export COMPOSE_PARALLEL_LIMIT=2
    docker compose build 2>&1
}

echo "  Starting containers..."
docker compose up -d

echo ""
echo "Waiting for services to start..."
sleep 30

# ── Verification ──
echo ""
echo "════════════════════════════════════════════"
echo "  Verification"
echo "════════════════════════════════════════════"

echo ""
echo "Running containers:"
docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || true

echo ""
echo "Connectivity checks:"

# Check external dependencies
echo -n "  VM-DB (PostgreSQL): "
if pg_isready -h 10.202.101.185 -p 6432 -U aris 2>/dev/null; then echo "OK"; else echo "UNREACHABLE"; fi

echo -n "  VM-KAFKA: "
if timeout 3 bash -c "echo > /dev/tcp/10.202.101.184/9092" 2>/dev/null; then echo "OK"; else echo "UNREACHABLE"; fi

echo -n "  VM-CACHE (Redis): "
if timeout 3 bash -c "echo > /dev/tcp/10.202.101.186/6379" 2>/dev/null; then echo "OK"; else echo "UNREACHABLE"; fi

echo -n "  VM-CACHE (OpenSearch): "
if curl -sf http://10.202.101.186:9200 >/dev/null 2>&1; then echo "OK"; else echo "UNREACHABLE"; fi

echo ""
echo -n "  Traefik: "
if curl -sf http://localhost:80/ping >/dev/null 2>&1; then echo "OK"; else echo "Starting..."; fi

echo -n "  Credential Service: "
if curl -sf http://localhost:3002/api/v1/credential/health >/dev/null 2>&1; then echo "OK"; else echo "Starting..."; fi

echo ""
echo "════════════════════════════════════════════"
echo "  ARIS URLs"
echo "════════════════════════════════════════════"
echo "  Frontend:     http://10.202.101.183"
echo "  API Gateway:  http://10.202.101.183/api/v1/"
echo "  Traefik:      http://10.202.101.183:8090"
echo "  Grafana:      http://10.202.101.183:3200"
echo "  Prometheus:   http://10.202.101.183:9090"
echo "  Jaeger:       http://10.202.101.183:16686"
echo "  Superset:     http://10.202.101.183:8088"
echo "  Metabase:     http://10.202.101.183:3035"
echo "  MinIO:        http://10.202.101.183:9001"
echo "  Mailpit:      http://10.202.101.183:8025"
# Install Node Exporter for Prometheus monitoring
if [ -f "${SCRIPT_DIR}/install-node-exporter.sh" ]; then
    echo "Installing Node Exporter..."
    bash "${SCRIPT_DIR}/install-node-exporter.sh"
fi

echo ""
echo "VM-APP setup complete!"
