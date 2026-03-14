#!/usr/bin/env python3
"""Check tenant service health and test settings endpoint."""
from ssh_config import ssh, VM_APP

# Check tenant container status
print("=== Tenant container status ===")
code, out, err = ssh(VM_APP, "docker ps --filter name=aris-tenant --format '{{.Status}}'")
for line in out.strip().split('\n'):
    print(f"  {line}")

# Check tenant logs (last 10 lines)
print("\n=== Tenant recent logs ===")
code, out, err = ssh(VM_APP, "docker logs aris-tenant --tail 10 2>&1 | tail -10")
for line in out.strip().split('\n'):
    print(f"  {line}")

# Test settings endpoint directly against tenant container (bypassing Traefik)
print("\n=== Direct test: tenant:3001/api/v1/settings/scope ===")
code, out, err = ssh(VM_APP, "docker exec aris-tenant wget -qO- http://localhost:3001/api/v1/settings/scope 2>/dev/null || echo 'DIRECT_FAILED'")
for line in out.strip().split('\n'):
    print(f"  {line[:200]}")

# Test via Traefik with curl (401 expected = routing works, just needs auth)
print("\n=== Via Traefik: /api/v1/settings/config/general (expect 401) ===")
code, out, err = ssh(VM_APP, "docker exec aris-traefik wget -qO- -S --no-check-certificate https://localhost/api/v1/settings/config/general 2>&1 | head -5")
for line in out.strip().split('\n'):
    print(f"  {line[:200]}")

# Test the public endpoint (no auth needed)
print("\n=== Via Traefik: /api/v1/public/stats (no auth needed) ===")
code, out, err = ssh(VM_APP, "docker exec aris-traefik wget -qO- --no-check-certificate https://localhost/api/v1/public/stats 2>/dev/null || echo 'PUBLIC_FAILED'")
for line in out.strip().split('\n'):
    print(f"  {line[:200]}")
