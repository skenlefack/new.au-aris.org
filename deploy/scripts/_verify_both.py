#!/usr/bin/env python3
"""Quick health check for staging + production web containers"""
import paramiko, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = [
    {"name": "STAGING",    "host": "10.202.101.146", "container": "aris-stg-web"},
    {"name": "PRODUCTION", "host": "10.202.101.183", "container": "aris-web"},
]

def run(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    return stdout.read().decode("utf-8", errors="replace").strip()

for env in ENVS:
    print(f"\n{'='*50}")
    print(f"  {env['name']} ({env['host']})")
    print(f"{'='*50}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(env["host"], username=SSH_USER, password=SSH_PASS, timeout=15)
    except Exception as e:
        print(f"  Connection failed: {e}")
        continue

    # Container status
    out = run(client, f"docker ps --filter name={env['container']} --format '{{{{.Names}}}} {{{{.Status}}}}'")
    print(f"  Container: {out}")

    # Git commit on server
    out = run(client, "cd /opt/aris && git log --oneline -1")
    print(f"  Git HEAD:  {out}")

    # Health check - home page
    out = run(client, "curl -so /dev/null -w '%{http_code}' http://localhost:3100/ 2>/dev/null")
    print(f"  HTTP /:    {out}")

    # Health check - collecte page
    out = run(client, "curl -so /dev/null -w '%{http_code}' http://localhost:3100/collecte 2>/dev/null")
    print(f"  HTTP /collecte: {out}")

    # Login + campaigns API
    out = run(client,
        'curl -s -X POST http://localhost:3002/api/v1/credential/auth/login '
        '-H "Content-Type: application/json" '
        '-d \'{"email":"admin@au-aris.org","password":"Aris2024!"}\'')
    try:
        token = json.loads(out).get("data", {}).get("accessToken")
        if token:
            out2 = run(client,
                f'curl -sk "https://localhost/api/v1/workflow/campaigns?limit=5" '
                f'-H "Authorization: Bearer {token}"')
            resp = json.loads(out2)
            total = resp.get("meta", {}).get("total", len(resp.get("data", [])))
            print(f"  Campaigns: {total} total")
        else:
            print(f"  Login: no token")
    except Exception as e:
        print(f"  API check failed: {e}")

    client.close()

print(f"\n{'='*50}")
print(f"  DONE")
print(f"{'='*50}")
