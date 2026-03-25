#!/usr/bin/env python3
"""
ARIS -- Verify campaigns display on staging after fix
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
    print(f"  ARIS -- Verify Campaigns on Staging")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect("10.202.101.146", username=SSH_USER, password=SSH_PASS, timeout=15)
    print("  [+] Connected to staging")

    # 1. Check web container
    print(f"\n  1. Web container status")
    out, _, _ = run(client, "docker ps --filter name=aris-stg-web --format '{{.Names}} {{.Status}}'")
    print(f"     {out}")

    # 2. Login
    print(f"\n  2. Login")
    out, _, _ = run(client,
        '''curl -s -X POST http://localhost:3002/api/v1/credential/auth/login \
           -H "Content-Type: application/json" \
           -d '{"email":"admin@au-aris.org","password":"Aris2024!"}' 2>&1''')
    token = None
    try:
        data = json.loads(out)
        token = data.get("data", {}).get("accessToken")
        if token:
            print(f"     Token: {token[:30]}...")
        else:
            print(f"     Login response: {out[:200]}")
    except Exception:
        print(f"     Login failed: {out[:200]}")

    if not token:
        client.close()
        return

    # 3. Test workflow campaigns API (the one DomainCampaignsSection now uses)
    print(f"\n  3. API: /api/v1/workflow/campaigns (via Traefik)")
    out, _, code = run(client,
        f'''curl -sk https://localhost/api/v1/workflow/campaigns \
           -H "Authorization: Bearer {token}" 2>&1''')
    try:
        resp = json.loads(out)
        campaigns = resp.get("data", [])
        total = resp.get("meta", {}).get("total", len(campaigns))
        print(f"     Total: {total} campaigns")
        for c in campaigns[:5]:
            name = c.get("name", "?")
            if isinstance(name, dict):
                name = name.get("en") or name.get("fr") or list(name.values())[0]
            print(f"     - {c.get('code', '?')} [{c.get('status', '?')}] {name}")
    except Exception:
        print(f"     Response: {out[:300]}")

    # 4. Test with domain filter (like DomainCampaignsSection does)
    print(f"\n  4. API: /api/v1/workflow/campaigns?domain=animal-health&status=ACTIVE")
    out, _, code = run(client,
        f'''curl -sk "https://localhost/api/v1/workflow/campaigns?domain=animal-health&status=ACTIVE&limit=5" \
           -H "Authorization: Bearer {token}" 2>&1''')
    try:
        resp = json.loads(out)
        campaigns = resp.get("data", [])
        print(f"     Found: {len(campaigns)} active campaigns for animal-health")
        for c in campaigns:
            name = c.get("name", "?")
            if isinstance(name, dict):
                name = name.get("en") or name.get("fr") or list(name.values())[0]
            print(f"     - {name} (submissions: {c.get('totalSubmissions', 0)}/{c.get('targetSubmissions', '?')})")
    except Exception:
        print(f"     Response: {out[:300]}")

    # 5. Test web page renders
    print(f"\n  5. Web page status codes")
    for path in ["/collecte/campaigns", "/", "/dashboard"]:
        out, _, _ = run(client,
            f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:3100{path}")
        print(f"     {path} -> HTTP {out}")

    client.close()
    print(f"\n{'#'*70}")
    print(f"  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
