#!/usr/bin/env python3
"""
ARIS -- Debug why campaigns don't load in browser on staging
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


def run_sudo(client, cmd, timeout=60):
    full_cmd = f"sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err_lines = [l for l in err.split("\n") if "[sudo]" not in l and "password for" not in l.lower()]
    err = "\n".join(err_lines).strip()
    return out, err, code


def main():
    print(f"{'#'*70}")
    print(f"  Debug: Why campaigns page shows empty on staging")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("10.202.101.146", username=SSH_USER, password=SSH_PASS, timeout=15)
    print("  [+] Connected to staging")

    # 1. Get auth token
    print(f"\n  1. Login")
    out, _, _ = run(client,
        '''curl -s -X POST http://localhost:3002/api/v1/credential/auth/login \
           -H "Content-Type: application/json" \
           -d '{"email":"admin@au-aris.org","password":"Aris2024!"}' 2>&1''')
    token = None
    try:
        data = json.loads(out)
        token = data.get("data", {}).get("accessToken")
        if token:
            print(f"     Token OK")
    except Exception:
        print(f"     Login failed: {out[:200]}")
        return

    # 2. Test via Traefik HTTPS (like server-side curl)
    print(f"\n  2. API via Traefik (localhost, like server does)")
    out, _, code = run(client,
        f'''curl -sk https://localhost/api/v1/workflow/campaigns?page=1&limit=20 \
           -H "Authorization: Bearer {token}" \
           -w "\\nHTTP_CODE:%{{http_code}}" 2>&1''')
    lines = out.rsplit("\n", 1)
    body = lines[0] if len(lines) > 1 else out
    http_code = lines[-1] if "HTTP_CODE:" in lines[-1] else "?"
    print(f"     {http_code}")
    try:
        resp = json.loads(body)
        print(f"     Campaigns: {len(resp.get('data', []))}")
    except Exception:
        print(f"     Body: {body[:300]}")

    # 3. Test with Host header (simulating browser request)
    print(f"\n  3. API via Traefik with Host: test.au-aris.org (simulating browser)")
    out, _, code = run(client,
        f'''curl -sk https://localhost/api/v1/workflow/campaigns?page=1&limit=20 \
           -H "Authorization: Bearer {token}" \
           -H "Host: test.au-aris.org" \
           -w "\\nHTTP_CODE:%{{http_code}}" 2>&1''')
    lines = out.rsplit("\n", 1)
    body = lines[0] if len(lines) > 1 else out
    http_code = lines[-1] if "HTTP_CODE:" in lines[-1] else "?"
    print(f"     {http_code}")
    try:
        resp = json.loads(body)
        print(f"     Campaigns: {len(resp.get('data', []))}")
    except Exception:
        print(f"     Body: {body[:300]}")

    # 4. Check Traefik dynamic config for workflow/campaigns route
    print(f"\n  4. Traefik dynamic config")
    out, err, code = run_sudo(client,
        "docker exec aris-stg-traefik cat /etc/traefik/dynamic.yml 2>/dev/null || docker exec aris-stg-traefik cat /etc/traefik/traefik.yml 2>/dev/null")
    if out:
        # Show lines related to workflow or campaigns
        for line in out.split("\n"):
            low = line.lower()
            if any(kw in low for kw in ["workflow", "campaign", "collecte", "priority"]):
                print(f"     {line}")
    else:
        print(f"     No config found")

    # 5. Check all Traefik routers
    print(f"\n  5. Traefik routers (from API)")
    out, _, code = run(client,
        "curl -s http://localhost:8080/api/http/routers 2>&1 | head -200")
    if out:
        try:
            routers = json.loads(out)
            for r in routers:
                name = r.get("name", "?")
                rule = r.get("rule", "?")
                service = r.get("service", "?")
                priority = r.get("priority", "auto")
                if any(kw in name.lower() or kw in rule.lower() for kw in ["workflow", "campaign", "collecte"]):
                    print(f"     {name}: rule={rule} -> {service} (priority={priority})")
        except Exception:
            print(f"     Response: {out[:500]}")
    else:
        print(f"     Traefik API not accessible")

    # 6. Check collecte service health
    print(f"\n  6. Collecte service health")
    out, _, code = run(client,
        "curl -s http://localhost:3011/api/v1/collecte/health 2>&1")
    print(f"     Port 3011: {out[:200]}")

    # 7. Direct test: collecte service for /api/v1/workflow/campaigns
    print(f"\n  7. Direct collecte: /api/v1/workflow/campaigns")
    out, _, code = run(client,
        f'''curl -s http://localhost:3011/api/v1/workflow/campaigns?page=1&limit=20 \
           -H "Authorization: Bearer {token}" \
           -w "\\nHTTP_CODE:%{{http_code}}" 2>&1''')
    lines = out.rsplit("\n", 1)
    body = lines[0] if len(lines) > 1 else out
    http_code = lines[-1] if "HTTP_CODE:" in lines[-1] else "?"
    print(f"     {http_code}")
    try:
        resp = json.loads(body)
        print(f"     Campaigns: {len(resp.get('data', []))}")
    except Exception:
        print(f"     Body: {body[:300]}")

    # 8. Check collecte container logs for errors
    print(f"\n  8. Collecte container recent logs")
    out, err, code = run_sudo(client,
        "docker logs aris-stg-collecte --tail 20 2>&1")
    if out:
        for line in out.split("\n")[-15:]:
            print(f"     {line}")

    # 9. Check if web container has the right env vars
    print(f"\n  9. Web container NEXT_PUBLIC vars")
    out, err, code = run_sudo(client,
        "docker exec aris-stg-web env 2>&1 | grep -i 'NEXT_PUBLIC\\|INTERNAL\\|COLLECTE'")
    if out:
        for line in out.split("\n"):
            if "[sudo]" not in line and "password" not in line.lower():
                print(f"     {line}")

    client.close()
    print(f"\n{'#'*70}")
    print(f"  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
