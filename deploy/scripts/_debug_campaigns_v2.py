#!/usr/bin/env python3
"""
ARIS -- Debug campaigns API v2: properly quoted URLs + Traefik API check
"""

import paramiko
import json
import sys
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"


def run(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return out, err, code


def main():
    print(f"{'#'*70}")
    print(f"  Debug: Campaigns API v2")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("10.202.101.146", username=SSH_USER, password=SSH_PASS, timeout=15)
    print("  [+] Connected to staging")

    # 1. Login
    print(f"\n  1. Login")
    out, _, _ = run(client,
        'curl -s -X POST http://localhost:3002/api/v1/credential/auth/login '
        '-H "Content-Type: application/json" '
        '-d \'{"email":"admin@au-aris.org","password":"Aris2024!"}\'')
    token = None
    try:
        data = json.loads(out)
        token = data.get("data", {}).get("accessToken")
        if token:
            print(f"     Token OK: {token[:40]}...")
    except Exception:
        print(f"     Login failed: {out[:200]}")
        return

    # 2. Traefik API - list routers related to workflow/collecte
    print(f"\n  2. Traefik routers (port 8090)")
    out, _, code = run(client, "curl -s http://localhost:8090/api/http/routers")
    if out:
        try:
            routers = json.loads(out)
            for r in routers:
                name = r.get("name", "?")
                rule = r.get("rule", "?")
                service = r.get("service", "?")
                priority = r.get("priority", "auto")
                status = r.get("status", "?")
                low = (name + rule + service).lower()
                if any(kw in low for kw in ["workflow", "collecte", "campaign"]):
                    print(f"     [{status}] {name}")
                    print(f"       rule: {rule}")
                    print(f"       service: {service}")
                    print(f"       priority: {priority}")
        except Exception:
            print(f"     Parse error: {out[:300]}")
    else:
        print(f"     No response (code={code})")

    # 3. Direct to collecte (port 3011) - workflow campaigns
    print(f"\n  3. Direct collecte (3011): /api/v1/workflow/campaigns")
    out, _, code = run(client,
        f'curl -s -w "\\nHTTP:%{{http_code}}" '
        f'"http://localhost:3011/api/v1/workflow/campaigns?page=1&limit=5" '
        f'-H "Authorization: Bearer {token}" '
        f'-H "Content-Type: application/json"')
    lines = out.rsplit("\n", 1)
    body = lines[0] if len(lines) > 1 else out
    http = lines[-1] if len(lines) > 1 else ""
    print(f"     {http}")
    try:
        resp = json.loads(body)
        campaigns = resp.get("data", [])
        total = resp.get("meta", {}).get("total", "?")
        print(f"     Total: {total}, returned: {len(campaigns)}")
        for c in campaigns[:3]:
            name = c.get("name", "?")
            if isinstance(name, dict):
                name = name.get("en", name.get("fr", "?"))
            print(f"       - [{c.get('status', '?')}] {name}")
    except Exception:
        print(f"     Body: {body[:300]}")

    # 4. Via Traefik HTTPS - workflow campaigns
    print(f"\n  4. Via Traefik HTTPS: /api/v1/workflow/campaigns")
    out, _, code = run(client,
        f'curl -sk -w "\\nHTTP:%{{http_code}}" '
        f'"https://localhost/api/v1/workflow/campaigns?page=1&limit=5" '
        f'-H "Authorization: Bearer {token}" '
        f'-H "Content-Type: application/json"')
    lines = out.rsplit("\n", 1)
    body = lines[0] if len(lines) > 1 else out
    http = lines[-1] if len(lines) > 1 else ""
    print(f"     {http}")
    try:
        resp = json.loads(body)
        campaigns = resp.get("data", [])
        total = resp.get("meta", {}).get("total", "?")
        print(f"     Total: {total}, returned: {len(campaigns)}")
    except Exception:
        print(f"     Body: {body[:300]}")

    # 5. Via Traefik HTTPS with Host header (simulating browser on test.au-aris.org)
    print(f"\n  5. Via Traefik HTTPS + Host: test.au-aris.org")
    out, _, code = run(client,
        f'curl -sk -w "\\nHTTP:%{{http_code}}" '
        f'"https://localhost/api/v1/workflow/campaigns?page=1&limit=5" '
        f'-H "Host: test.au-aris.org" '
        f'-H "Authorization: Bearer {token}" '
        f'-H "Content-Type: application/json"')
    lines = out.rsplit("\n", 1)
    body = lines[0] if len(lines) > 1 else out
    http = lines[-1] if len(lines) > 1 else ""
    print(f"     {http}")
    try:
        resp = json.loads(body)
        campaigns = resp.get("data", [])
        total = resp.get("meta", {}).get("total", "?")
        print(f"     Total: {total}, returned: {len(campaigns)}")
    except Exception:
        print(f"     Body: {body[:300]}")

    # 6. Check collecte logs after the requests
    print(f"\n  6. Collecte logs (last 20 lines)")
    out, _, _ = run(client, "docker logs aris-stg-collecte --tail 20 2>&1")
    if out:
        for line in out.split("\n")[-15:]:
            print(f"     {line}")

    # 7. Check if NEXT_PUBLIC_API_BASE_URL is set in the web container build
    print(f"\n  7. Web container env vars")
    out, _, _ = run(client,
        "docker exec aris-stg-web printenv 2>&1 | sort")
    if out:
        for line in out.split("\n"):
            low = line.lower()
            if any(kw in low for kw in ["next_public", "internal", "api_base", "collecte_url", "hostname", "port"]):
                print(f"     {line}")

    client.close()
    print(f"\n{'#'*70}")
    print(f"  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
