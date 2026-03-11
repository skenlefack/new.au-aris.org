#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ARIS 4.0 — Install Prometheus Node Exporter
# Run on all 4 VMs to expose host metrics to Prometheus on VM-APP.
# Port 9100 (default)
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

echo "Installing Prometheus Node Exporter..."

if docker ps --format '{{.Names}}' | grep -q node-exporter; then
    echo "Node exporter already running."
    exit 0
fi

docker run -d \
    --name node-exporter \
    --restart unless-stopped \
    --net host \
    --pid host \
    -v /:/host:ro,rslave \
    prom/node-exporter:v1.8.1 \
    --path.rootfs=/host

echo "Node Exporter running on port 9100"
curl -s http://localhost:9100/metrics | head -5
