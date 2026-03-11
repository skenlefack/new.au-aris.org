#!/usr/bin/env python3
"""Verify all Traefik routes work."""
import paramiko
import sys
import os
import json

os.environ["PYTHONIOENCODING"] = "utf-8"

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
HOST = "10.202.101.183"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, SSH_USER, SSH_PASS, timeout=15,
              allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=15):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


c = get_client()

safe_print("=" * 60)
safe_print("  Traefik Route Verification")
safe_print("=" * 60)

# 1. Count routers
safe_print("\n=== 1. Router count ===")
code, out = run_sudo(c, "curl -s http://localhost:8090/api/http/routers 2>&1")
# Strip sudo prefix
json_start = out.find("[")
if json_start >= 0:
    out = out[json_start:]
try:
    routers = json.loads(out)
    safe_print(f"  Total routers: {len(routers)}")
    for r in routers:
        provider = r.get("provider", "?")
        name = r.get("name", "?")
        rule = r.get("rule", "?")
        status = r.get("status", "?")
        if provider == "docker":
            safe_print(f"    {name:30s} {rule[:60]:60s} [{status}]")
except json.JSONDecodeError:
    safe_print(f"  Could not parse: {out[:200]}")

# 2. Test routes via port 80 (Traefik gateway)
safe_print("\n=== 2. API Gateway Routes (port 80) ===")
routes = [
    ("/", "Frontend"),
    ("/api/v1/credential/auth/login", "Credential (login endpoint)"),
    ("/api/v1/tenants", "Tenant"),
    ("/api/v1/master-data", "Master Data"),
    ("/api/v1/form-builder", "Form Builder"),
    ("/api/v1/collecte", "Collecte"),
    ("/api/v1/workflow", "Workflow"),
    ("/api/v1/animal-health", "Animal Health"),
    ("/api/v1/livestock", "Livestock"),
    ("/api/v1/fisheries", "Fisheries"),
    ("/api/v1/wildlife", "Wildlife"),
    ("/api/v1/apiculture", "Apiculture"),
    ("/api/v1/trade", "Trade SPS"),
    ("/api/v1/governance", "Governance"),
    ("/api/v1/climate", "Climate Env"),
    ("/api/v1/analytics", "Analytics"),
    ("/api/v1/geo", "Geo Services"),
    ("/api/v1/knowledge", "Knowledge Hub"),
    ("/api/v1/datalake", "Datalake"),
    ("/api/v1/data-quality", "Data Quality"),
    ("/api/v1/data-contracts", "Data Contract"),
    ("/api/v1/messages", "Message"),
    ("/api/v1/drive", "Drive"),
    ("/api/v1/interop", "Interop Hub"),
    ("/api/v1/support", "Support"),
    ("/api/v1/offline", "Offline"),
]

routed = 0
not_routed = 0
for path, name in routes:
    cmd = f'curl -s -o /dev/null -w "%{{http_code}}" http://localhost:80{path} 2>/dev/null'
    code, out = run_sudo(c, f"bash -c '{cmd}'", timeout=5)
    status = out if out else "000"
    # 200/301/302/401/403/404/405 all mean Traefik routed to the service
    # Only "404 page not found" from Traefik itself means no route
    is_routed = status not in ["000"]
    mark = f"{status}" if is_routed else "NO ROUTE"
    safe_print(f"  {name:25s} {path:40s} -> {mark}")
    if is_routed and status != "404":
        routed += 1
    else:
        not_routed += 1

safe_print(f"\n  Routed: {routed}/{routed + not_routed}")

# 3. Test login via gateway
safe_print("\n=== 3. Login via API Gateway ===")
sftp = c.open_sftp()
with sftp.open("/tmp/aris-gw-login.json", "w") as f:
    json.dump({"email": "admin@au-aris.org", "password": "Aris2024!"}, f)
sftp.close()

code, out = run_sudo(c, 'curl -s -X POST http://localhost:80/api/v1/credential/auth/login -H "Content-Type: application/json" -d @/tmp/aris-gw-login.json 2>&1', timeout=10)
json_start = out.find("{")
if json_start >= 0:
    out = out[json_start:]
try:
    data = json.loads(out)
    if "data" in data and "accessToken" in data["data"]:
        safe_print(f"  LOGIN VIA GATEWAY: SUCCESS!")
        safe_print(f"  JWT: {data['data']['accessToken'][:60]}...")
    else:
        safe_print(f"  Response: {json.dumps(data)[:300]}")
except:
    if "eyJ" in out:
        safe_print(f"  LOGIN VIA GATEWAY: SUCCESS (contains JWT)")
    else:
        safe_print(f"  Response: {out[:300]}")

run_sudo(c, "rm -f /tmp/aris-gw-login.json")

c.close()
safe_print("\n=== Done ===")
