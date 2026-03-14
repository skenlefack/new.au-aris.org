#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════
# ARIS 4.0 — Deploy Web Container Fix (CORS/localhost)
# Run this ON VM-APP (10.202.101.183) as arisadmin
# ═══════════════════════════════════════════════════════════════
set -euo pipefail

echo "════════════════════════════════════════════════════"
echo "  ARIS 4.0 — Deploying Web Container Fix"
echo "════════════════════════════════════════════════════"

ARIS_DIR="/opt/aris"
DEPLOY_DIR="/opt/aris-deploy/vm-app"

# 1. Pull latest code from GitHub
echo ""
echo "[1/5] Pulling latest code..."
cd "$ARIS_DIR"
sudo git pull origin main
echo "  OK: Code updated"

# 2. Copy updated docker-compose
echo ""
echo "[2/5] Updating docker-compose..."
sudo cp "$ARIS_DIR/deploy/vm-app/docker-compose.yml" "$DEPLOY_DIR/docker-compose.yml"
echo "  OK: docker-compose.yml updated"

# 3. Rebuild web container
echo ""
echo "[3/5] Rebuilding web container (this may take 2-5 minutes)..."
cd "$DEPLOY_DIR"
sudo docker compose build --no-cache web
echo "  OK: Web container rebuilt"

# 4. Restart web container
echo ""
echo "[4/5] Restarting web container..."
sudo docker compose up -d web
echo "  OK: Web container restarted"

# 5. Verify
echo ""
echo "[5/5] Verifying deployment..."
sleep 5
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3100/ | grep -q "200"; then
    echo "  OK: Web container is responding (HTTP 200)"
else
    echo "  WARNING: Web container may still be starting up"
    echo "  Check logs: sudo docker compose logs --tail=30 web"
fi

# Check for localhost in the response
if curl -s http://localhost:3100/ | grep -q "localhost"; then
    echo "  WARNING: localhost references still found in response!"
else
    echo "  OK: No localhost references in response"
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "  Deployment complete!"
echo "════════════════════════════════════════════════════"
echo ""
echo "  Test login: curl -s -X POST http://10.202.101.183/api/v1/credential/auth/login \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"email\":\"admin@au-aris.org\",\"password\":\"Aris2024!\"}'"
echo ""
echo "  View logs: cd $DEPLOY_DIR && sudo docker compose logs --tail=50 web"
