#!/usr/bin/env python3
"""Check Traefik routing and test from outside."""
import sys
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# 1. Check Traefik config for settings/public routing
safe_print("=== 1. Traefik routing rules for settings/public ===")
code, out, err = ssh(VM_APP, "grep -r 'settings\\|public' /opt/aris-deploy/vm-app/docker-compose.yml 2>/dev/null | head -20", timeout=10)
safe_print(out)

# 2. Check Traefik dynamic config
safe_print("\n=== 2. Traefik dynamic config ===")
code, out, err = ssh(VM_APP, "ls /opt/aris-deploy/vm-app/traefik/ 2>/dev/null", timeout=10)
safe_print(f"  Files: {out}")

code, out, err = ssh(VM_APP, "cat /opt/aris-deploy/vm-app/traefik/dynamic.yml 2>/dev/null | head -80", timeout=10)
safe_print(f"  Dynamic config:\n{out}")

# 3. Test through Traefik (port 4000)
safe_print("\n=== 3. Test /api/v1/public/domains through Traefik (port 4000) ===")
code, out, err = ssh(VM_APP, "curl -s http://localhost:4000/api/v1/public/domains | head -200", timeout=10)
safe_print(f"  Response: {out[:500]}")

# 4. Test through port 80/443 (external)
safe_print("\n=== 4. Test /api/v1/public/domains via HTTPS ===")
code, out, err = ssh(VM_APP, "curl -sk https://localhost/api/v1/public/domains | head -200", timeout=10)
safe_print(f"  Response: {out[:500]}")

# 5. Test /api/v1/settings/domains through Traefik
safe_print("\n=== 5. Test /api/v1/settings/domains through Traefik ===")
code, out, err = ssh(VM_APP, "curl -s http://localhost:4000/api/v1/settings/domains | head -200", timeout=10)
safe_print(f"  Response: {out[:500]}")

# 6. Check what NEXT_PUBLIC env vars are baked into the web build
safe_print("\n=== 6. NEXT_PUBLIC env vars in web build ===")
code, out, err = ssh(VM_APP, "docker exec aris-web grep -r 'NEXT_PUBLIC' /app/apps/web/.next/server/chunks/ 2>/dev/null | grep -o 'NEXT_PUBLIC_[A-Z_]*' | sort -u", timeout=15)
safe_print(f"  Env vars in build: {out}")

# 7. Check .env in /opt/aris
safe_print("\n=== 7. .env file for web in /opt/aris ===")
code, out, err = ssh(VM_APP, "cat /opt/aris/.env 2>/dev/null | grep -i 'TENANT\\|API_URL\\|NEXT_PUBLIC' | head -20", timeout=10)
safe_print(f"  {out}")

code, out, err = ssh(VM_APP, "cat /opt/aris/apps/web/.env 2>/dev/null | head -10", timeout=10)
safe_print(f"  web/.env: {out}")

code, out, err = ssh(VM_APP, "cat /opt/aris/apps/web/.env.local 2>/dev/null | head -10", timeout=10)
safe_print(f"  web/.env.local: {out}")

safe_print("\n=== Debug complete! ===")
