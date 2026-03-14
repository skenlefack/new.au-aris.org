#!/usr/bin/env python3
"""Deep debug: Traefik, env vars, and actual URL resolution."""
import sys
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# 1. What ports is Traefik listening on?
safe_print("=== 1. Traefik container ports ===")
code, out, err = ssh(VM_APP, "docker ps --filter name=traefik --format '{{.Ports}}'", timeout=10)
safe_print(f"  {out}")

# 2. Docker compose Traefik section
safe_print("\n=== 2. Traefik service in docker-compose ===")
code, out, err = ssh(VM_APP, "grep -A 30 'traefik:' /opt/aris-deploy/vm-app/docker-compose.yml | head -40", timeout=10)
safe_print(f"  {out}")

# 3. Test through actual Traefik entrypoints
safe_print("\n=== 3. Test /api/v1/public/domains via different ports ===")
for port in [80, 443, 4000, 8080]:
    proto = "https" if port == 443 else "http"
    code, out, err = ssh(VM_APP, f'curl -sk --max-time 3 {proto}://localhost:{port}/api/v1/public/domains 2>&1 | head -100', timeout=10)
    safe_print(f"  Port {port}: {out[:200] if out else 'EMPTY'}")

# 4. Test with Host header (Traefik might need it)
safe_print("\n=== 4. Test with Host header au-aris.org ===")
code, out, err = ssh(VM_APP, "curl -sk --max-time 3 -H 'Host: au-aris.org' https://localhost/api/v1/public/domains 2>&1 | head -200", timeout=10)
safe_print(f"  With Host: {out[:300] if out else 'EMPTY'}")

code, out, err = ssh(VM_APP, "curl -sk --max-time 3 -H 'Host: au-aris.org' http://localhost:80/api/v1/public/domains 2>&1 | head -200", timeout=10)
safe_print(f"  HTTP with Host: {out[:300] if out else 'EMPTY'}")

# 5. Check Dockerfile.web for env vars
safe_print("\n=== 5. Dockerfile.web for env vars ===")
code, out, err = ssh(VM_APP, "grep -i 'ENV\\|ARG\\|NEXT_PUBLIC' /opt/aris/Dockerfile.web 2>/dev/null", timeout=10)
safe_print(f"  {out}")

# 6. Docker compose env for web service
safe_print("\n=== 6. Web service env in docker-compose ===")
code, out, err = ssh(VM_APP, "grep -A 30 'web:' /opt/aris-deploy/vm-app/docker-compose.yml | head -40", timeout=10)
safe_print(f"  {out}")

# 7. Check NEXT_PUBLIC_TENANT_API_URL actual value in compiled JS
safe_print("\n=== 7. NEXT_PUBLIC_TENANT_API_URL value in compiled JS ===")
code, out, err = ssh(VM_APP, r"""docker exec aris-web grep -roh 'NEXT_PUBLIC_TENANT_API_URL[^"]*"[^"]*"' /app/apps/web/.next/ 2>/dev/null | head -5""", timeout=15)
safe_print(f"  Pattern 1: {out[:300] if out else 'NONE'}")

# Search for the actual URL string baked into the JS
code, out, err = ssh(VM_APP, r"""docker exec aris-web grep -roh '"https://[^"]*au-aris[^"]*"' /app/apps/web/.next/static/ 2>/dev/null | sort -u | head -10""", timeout=15)
safe_print(f"  Baked URLs: {out[:500] if out else 'NONE'}")

# 8. Check the actual env passed at runtime to web
safe_print("\n=== 8. All env vars in aris-web container ===")
code, out, err = ssh(VM_APP, "docker exec aris-web printenv | sort", timeout=10)
safe_print(f"  {out}")

safe_print("\n=== Debug complete! ===")
