#!/usr/bin/env python3
"""Debug routing with correct Traefik ports."""
from ssh_config import get_client, VM_APP, VM_PASS

c = get_client(VM_APP)

tests = [
    # Traefik on port 443 (HTTPS)
    ("curl -sk https://localhost/api/v1/settings/config/general -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -5",
     "Traefik :443 -> /api/v1/settings/config/general"),

    ("curl -sk https://localhost/api/v1/public/stats -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -5",
     "Traefik :443 -> /api/v1/public/stats"),

    ("curl -sk https://localhost/api/v1/tenants -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -5",
     "Traefik :443 -> /api/v1/tenants (should 401)"),

    # Try HTTP port 80
    ("curl -s http://localhost/api/v1/settings/config/general -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -5",
     "Traefik :80 -> /api/v1/settings/config/general"),

    # Check tenant container health from Docker network
    (f"echo '{VM_PASS}' | sudo -S docker exec aris-tenant curl -s http://localhost:3001/api/v1/public/stats 2>/dev/null || echo 'curl not in container'",
     "Direct tenant container -> /api/v1/public/stats"),

    # Use node inside the container for testing
    (f"echo '{VM_PASS}' | sudo -S docker exec aris-tenant node -e \"fetch('http://localhost:3001/api/v1/public/stats').then(r=>r.text()).then(t=>console.log('STATUS OK, body:',t.substring(0,150))).catch(e=>console.log('ERR:',e.message))\" 2>&1",
     "Node fetch inside tenant -> /api/v1/public/stats"),
]

for cmd, desc in tests:
    print(f"\n=== {desc} ===")
    stdin, stdout, stderr = c.exec_command(cmd, timeout=15)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    for line in out.split('\n'):
        if not line.startswith('[sudo]'):
            print(f"  {line[:200]}")

c.close()
