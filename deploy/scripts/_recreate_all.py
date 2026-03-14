#!/usr/bin/env python3
"""Recreate ALL ARIS containers to pick up new Traefik labels (web,websecure)."""
import time
from ssh_config import ssh, VM_APP

print("=" * 60)
print("  Recreating ALL containers with updated Traefik labels")
print("  (entrypoints=web,websecure — HTTP + HTTPS)")
print("=" * 60)

# Force recreate all services via docker compose
print("\nRunning: docker compose up -d --force-recreate ...")
code, out, _ = ssh(
    VM_APP,
    "cd /opt/aris-deploy/vm-app && docker compose up -d --force-recreate 2>&1",
    timeout=300
)
print(out)
if code != 0:
    print(f"  Exit code: {code}")

print("\nWaiting 10 seconds for all services to initialize...")
time.sleep(10)

# Verify key API routes work on HTTP
print("\n" + "=" * 60)
print("  Verifying HTTP access to key routes")
print("=" * 60)

tests = [
    ("http://localhost/", "Web frontend"),
    ("http://localhost:3003/health", "Master-data health"),
    ("http://localhost:3002/health", "Credential health"),
    ("http://localhost:3001/health", "Tenant health"),
]

for url, desc in tests:
    code, out, _ = ssh(VM_APP, f"curl -s -o /dev/null -w '%{{http_code}}' {url} 2>&1")
    print(f"  {desc}: {out.strip()}")

# Test via Traefik (port 80) - the actual user path
print("\nVia Traefik (port 80):")
traefik_tests = [
    ("/", "Web frontend"),
    ("/api/v1/master-data/ref/counts", "Master-data ref counts"),
    ("/api/v1/credential/health", "Credential"),
    ("/api/v1/tenants/health", "Tenant"),
]

for path, desc in traefik_tests:
    code, out, _ = ssh(VM_APP, f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost{path} 2>&1")
    print(f"  {desc} ({path}): {out.strip()}")

# Show container status
print("\n" + "=" * 60)
print("  Container status")
print("=" * 60)
code, out, _ = ssh(VM_APP, "docker ps --format '{{.Names}} {{.Status}}' 2>&1")
for line in sorted(out.strip().split('\n')):
    if line.startswith('aris-'):
        print(f"  {line}")

print("\n" + "=" * 60)
print("  DONE! All containers recreated with HTTP support.")
print("=" * 60)
