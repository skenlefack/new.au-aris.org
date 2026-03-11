#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ARIS 4.0 — VM-KAFKA Setup Script
# Host: 10.202.101.184 (nbo-brk01)
# 3 Kafka KRaft Brokers + Schema Registry + Kafka UI
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DEPLOY_DIR="$(dirname "$SCRIPT_DIR")"

echo "════════════════════════════════════════════"
echo "  ARIS 4.0 — VM-KAFKA Setup (Kafka KRaft)"
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

# ── 3. OS Kernel Tuning for Kafka ──
echo "[3/6] Applying kernel parameters for Kafka..."
cat > /etc/sysctl.d/99-aris-kafka.conf <<'SYSCTL'
# ARIS Kafka tuning
vm.swappiness = 1
vm.dirty_ratio = 80
vm.dirty_background_ratio = 5
net.core.wmem_max = 2097152
net.core.rmem_max = 2097152
net.ipv4.tcp_window_scaling = 1
net.ipv4.tcp_max_syn_backlog = 8192
net.core.somaxconn = 65535
SYSCTL
sysctl --system >/dev/null 2>&1

# ── 4. UFW Firewall ──
echo "[4/6] Configuring UFW firewall..."
if command -v ufw &>/dev/null; then
    ufw --force reset >/dev/null 2>&1
fi
apt-get install -y -qq ufw 2>/dev/null || true
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH-global'
ufw allow from 10.202.101.0/24 to any port 9092 comment 'Kafka broker 1'
ufw allow from 10.202.101.0/24 to any port 9094 comment 'Kafka broker 2'
ufw allow from 10.202.101.0/24 to any port 9096 comment 'Kafka broker 3'
ufw allow from 10.202.101.0/24 to any port 8081 comment 'Schema Registry'
ufw allow from 10.202.101.0/24 to any port 8080 comment 'Kafka UI'
ufw --force enable
echo "UFW enabled:"
ufw status numbered

# ── 5. Prepare Data Directories ──
echo "[5/6] Preparing Kafka data directories..."
mkdir -p /kafka-data/broker-1
mkdir -p /kafka-data/broker-2
mkdir -p /kafka-data/broker-3
# Kafka runs as appuser (UID 1000) inside cp-kafka container
chown -R 1000:1000 /kafka-data

# ── 6. Deploy Docker Compose ──
echo "[6/6] Deploying Kafka KRaft cluster..."
cd "${DEPLOY_DIR}/vm-kafka"

docker compose down --remove-orphans 2>/dev/null || true
docker compose up -d

# Wait for Kafka to be ready
echo "Waiting for Kafka brokers to be ready..."
for i in $(seq 1 60); do
    if docker exec aris-kafka-1 kafka-broker-api-versions --bootstrap-server localhost:29092 >/dev/null 2>&1; then
        echo "Kafka broker 1 is ready!"
        break
    fi
    echo "  Waiting... ($i/60)"
    sleep 5
done

# Wait for topic creation
echo "Waiting for kafka-init to create topics..."
for i in $(seq 1 30); do
    STATUS=$(docker inspect -f '{{.State.Status}}' aris-kafka-init 2>/dev/null || echo "unknown")
    if [ "$STATUS" = "exited" ]; then
        EXIT_CODE=$(docker inspect -f '{{.State.ExitCode}}' aris-kafka-init 2>/dev/null || echo "1")
        if [ "$EXIT_CODE" = "0" ]; then
            echo "All topics created successfully!"
        else
            echo "Warning: kafka-init exited with code $EXIT_CODE"
            docker logs aris-kafka-init --tail 20
        fi
        break
    fi
    echo "  kafka-init status: $STATUS ($i/30)"
    sleep 5
done

# Verify
echo ""
echo "════════════════════════════════════════════"
echo "  Verification"
echo "════════════════════════════════════════════"
echo "Topic count:"
docker exec aris-kafka-1 kafka-topics --list --bootstrap-server localhost:29092 2>/dev/null | wc -l || echo "Could not list topics"
echo ""
echo "Schema Registry:"
curl -s http://localhost:8081/subjects 2>/dev/null && echo "" || echo "Schema Registry not ready yet"

# Install Node Exporter for Prometheus monitoring
if [ -f "${SCRIPT_DIR}/install-node-exporter.sh" ]; then
    echo "Installing Node Exporter..."
    bash "${SCRIPT_DIR}/install-node-exporter.sh"
fi

echo ""
echo "VM-KAFKA setup complete!"
