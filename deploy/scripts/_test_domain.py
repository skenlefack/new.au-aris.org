#!/usr/bin/env python3
"""Test settings endpoint via actual domain."""
from ssh_config import get_client, VM_APP, VM_PASS

c = get_client(VM_APP)

tests = [
    # Test via the actual domain (resolves to this server)
    ("curl -sk https://au-aris.org/api/v1/settings/config/general -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3",
     "Domain HTTPS -> /api/v1/settings/config/general"),

    ("curl -sk https://au-aris.org/api/v1/public/stats -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3",
     "Domain HTTPS -> /api/v1/public/stats"),

    ("curl -sk https://au-aris.org/api/v1/tenants -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3",
     "Domain HTTPS -> /api/v1/tenants"),

    # Test with Host header via localhost
    ("curl -sk https://localhost/api/v1/settings/config/general -H 'Host: au-aris.org' -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3",
     "localhost + Host header -> /api/v1/settings/config/general"),

    # Test with --resolve to map domain to 127.0.0.1
    ("curl -sk --resolve 'au-aris.org:443:127.0.0.1' https://au-aris.org/api/v1/settings/config/general -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3",
     "--resolve -> /api/v1/settings/config/general"),

    # Check if Traefik dashboard shows our updated tenant router
    (f"echo '{VM_PASS}' | sudo -S docker exec aris-traefik wget -qO- http://localhost:8080/api/http/routers/tenant@docker 2>/dev/null",
     "Traefik API - tenant router details"),
]

for cmd, desc in tests:
    print(f"\n=== {desc} ===")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=15)
    out = stdout.read().decode().strip()
    for line in out.split('\n'):
        if not line.startswith('[sudo]'):
            print(f"  {line[:200]}")

c.close()
