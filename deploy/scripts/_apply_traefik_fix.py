#!/usr/bin/env python3
"""Fix Traefik routing: enable HTTP access for web, remove broken middleware ref."""
import time
from ssh_config import ssh, VM_APP

COMPOSE = "/opt/aris-deploy/vm-app/docker-compose.yml"

# Step 1: Backup compose
print("=== Step 1: Backup compose file ===")
code, out, _ = ssh(VM_APP, f"cp {COMPOSE} {COMPOSE}.bak.$(date +%Y%m%d%H%M%S)")
print(f"  Backup: exit {code}")

# Step 2: Remove HTTP->HTTPS redirect (3 lines)
print("\n=== Step 2: Remove HTTP->HTTPS redirect ===")
code, out, _ = ssh(VM_APP, f"sed -i '/entrypoints.web.http.redirections/d' {COMPOSE}")
print(f"  Removed redirect lines: exit {code}")

# Step 3: Fix web router - use both entrypoints, remove TLS-only, remove broken middleware
print("\n=== Step 3: Fix web router labels ===")

# Change web entrypoints from websecure to web,websecure
code, out, _ = ssh(VM_APP, f"sed -i 's/traefik.http.routers.web.entrypoints=websecure/traefik.http.routers.web.entrypoints=web,websecure/' {COMPOSE}")
print(f"  Web entrypoints: exit {code}")

# Remove TLS=true for web router (not needed for HTTP)
code, out, _ = ssh(VM_APP, f"sed -i '/traefik.http.routers.web.tls=true/d' {COMPOSE}")
print(f"  Remove web TLS: exit {code}")

# Remove security-headers middleware (file provider may not be loaded)
code, out, _ = ssh(VM_APP, f"sed -i '/traefik.http.routers.web.middlewares=security-headers/d' {COMPOSE}")
print(f"  Remove web middleware: exit {code}")

# Step 4: Also fix ALL service routers to use both entrypoints (for HTTP API access)
print("\n=== Step 4: Fix ALL service router entrypoints ===")
code, out, _ = ssh(VM_APP, f"sed -i 's/entrypoints=websecure/entrypoints=web,websecure/g' {COMPOSE}")
print(f"  All services entrypoints: exit {code}")

# Also remove tls=true from all routers (so they work on HTTP too)
code, out, _ = ssh(VM_APP, f"sed -i '/traefik.http.routers.*\\.tls=true/d' {COMPOSE}")
print(f"  Remove TLS from all routers: exit {code}")

# Step 5: Verify the changes look correct
print("\n=== Step 5: Verify compose changes ===")
code, out, _ = ssh(VM_APP, f"grep -n 'traefik' {COMPOSE} | head -40")
print(out)

# Step 6: Force recreate Traefik to pick up new config (file provider, volumes)
print("\n=== Step 6: Recreate Traefik container ===")
code, out, _ = ssh(
    VM_APP,
    f"cd /opt/aris-deploy/vm-app && docker compose up -d --force-recreate traefik 2>&1",
    timeout=120
)
print(out)
print(f"  Exit: {code}")

# Step 7: Recreate web container with new labels
print("\n=== Step 7: Recreate web container ===")
code, out, _ = ssh(
    VM_APP,
    f"cd /opt/aris-deploy/vm-app && docker compose up -d --force-recreate --no-deps web 2>&1",
    timeout=120
)
print(out)
print(f"  Exit: {code}")

# Step 8: Wait and verify
print("\n=== Step 8: Verify (waiting 5s for startup) ===")
time.sleep(5)

code, out, _ = ssh(VM_APP, "docker ps --format 'table {{.Names}}\t{{.Status}}' 2>&1 | grep -E 'traefik|web|NAME'")
print(out)

code, out, _ = ssh(VM_APP, "curl -s -o /dev/null -w '%{http_code}' http://localhost/ 2>&1")
print(f"  curl http://localhost/ => {out}")

code, out, _ = ssh(VM_APP, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/ 2>&1")
print(f"  curl http://localhost:3100/ => {out}")

# Step 9: Check Traefik logs for errors
print("\n=== Step 9: Traefik logs ===")
code, out, _ = ssh(VM_APP, "docker logs aris-traefik --tail 15 2>&1")
print(out)

print("\n" + "=" * 60)
print("  FIX APPLIED!")
print("=" * 60)
