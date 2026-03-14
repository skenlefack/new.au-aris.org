#!/usr/bin/env python3
"""Fix Jaeger + run comprehensive health checks."""
import sys
import os
import time
from ssh_config import get_client, VM_APP, VM_PASS

REMOTE_DEPLOY = "/opt/aris-deploy"


def sp(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(VM_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


# Upload fixed docker-compose
sp("=== 1. Uploading fixed docker-compose.yml ===")
local_compose = os.path.join(os.getcwd(), "deploy", "vm-app", "docker-compose.yml")
c = get_client(VM_APP)
sftp = c.open_sftp()
sftp.put(local_compose, "/tmp/aris-compose-v8b.yml")
sftp.close()
c.close()

c = get_client(VM_APP)
code, out = run_sudo(c, f"cp /tmp/aris-compose-v8b.yml {REMOTE_DEPLOY}/vm-app/docker-compose.yml && rm -f /tmp/aris-compose-v8b.yml")
sp(f"  Upload: exit {code}")

# Restart Jaeger
sp("\n=== 2. Restarting Jaeger ===")
code, out = run_sudo(c, "bash -c 'cd /opt/aris-deploy/vm-app && set -a && source /opt/aris-deploy/.env.production 2>/dev/null && set +a && docker compose up -d --force-recreate jaeger 2>&1'", timeout=60)
sp(f"  Jaeger restart: {out[:300]}")
c.close()

sp("  Waiting 15s...")
time.sleep(15)

# Comprehensive health checks
sp("\n=== 3. Comprehensive Health Checks ===")
c = get_client(VM_APP)

services = [
    ("Traefik dashboard", "http://localhost:8090/dashboard/", 8090),
    ("Frontend (web)", "http://localhost:3100", 3100),
    ("Credential", "http://localhost:3002/health", 3002),
    ("Tenant", "http://localhost:3001/health", 3001),
    ("Master Data", "http://localhost:3003/health", 3003),
    ("Form Builder", "http://localhost:3010/health", 3010),
    ("Collecte", "http://localhost:3011/health", 3011),
    ("Workflow", "http://localhost:3012/health", 3012),
    ("Animal Health", "http://localhost:3020/health", 3020),
    ("Livestock Prod", "http://localhost:3021/health", 3021),
    ("Fisheries", "http://localhost:3022/health", 3022),
    ("Wildlife", "http://localhost:3023/health", 3023),
    ("Apiculture", "http://localhost:3024/health", 3024),
    ("Trade SPS", "http://localhost:3025/health", 3025),
    ("Governance", "http://localhost:3026/health", 3026),
    ("Climate Env", "http://localhost:3027/health", 3027),
    ("Analytics", "http://localhost:3030/health", 3030),
    ("Geo Services", "http://localhost:3031/health", 3031),
    ("Interop Hub", "http://localhost:3032/health", 3032),
    ("Knowledge Hub", "http://localhost:3033/health", 3033),
    ("Datalake", "http://localhost:3044/health", 3044),
    ("Data Quality", "http://localhost:3004/health", 3004),
    ("Data Contract", "http://localhost:3005/health", 3005),
    ("Message", "http://localhost:3006/health", 3006),
    ("Drive", "http://localhost:3007/health", 3007),
    ("Realtime", "http://localhost:3008/health", 3008),
    ("Support", "http://localhost:3041/health", 3041),
    ("Interop", "http://localhost:3042/health", 3042),
    ("Offline", "http://localhost:3040/health", 3040),
    ("Analytics Worker", "http://localhost:3043/health", 3043),
    ("Grafana", "http://localhost:3200/api/health", 3200),
    ("Prometheus", "http://localhost:9090/-/healthy", 9090),
    ("Superset", "http://localhost:8088/health", 8088),
    ("Metabase", "http://localhost:3035/api/health", 3035),
    ("MinIO", "http://localhost:9000/minio/health/live", 9000),
    ("Jaeger UI", "http://localhost:16686/", 16686),
    ("Mailpit", "http://localhost:8025/", 8025),
]

up_count = 0
down_count = 0
for name, url, port in services:
    cmd = f'curl -sf -o /dev/null -w "%{{http_code}}" {url} 2>/dev/null'
    code, out = run_sudo(c, f'bash -c \'{cmd}\'', timeout=5)
    status = out if out else "000"
    is_up = status in ["200", "204", "301", "302", "303", "307", "308"]
    mark = "OK" if is_up else f"FAIL ({status})"
    sp(f"  {name:20s} :{port} -> {mark}")
    if is_up:
        up_count += 1
    else:
        down_count += 1

sp(f"\n  Services UP: {up_count}/{up_count + down_count}")

# Container status for problem ones
code, out = run_sudo(c, "docker ps -a --filter 'status=exited' --filter 'status=restarting' --format '{{.Names}}: {{.Status}}' 2>/dev/null")
if out.strip():
    sp(f"\n  Problem containers:")
    for line in out.strip().splitlines()[:10]:
        sp(f"    {line}")
else:
    sp("  All containers running!")

# Login test
sp("\n=== 4. Login Test ===")
login_cmd = """curl -sf -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}' 2>&1 | head -c 500"""
code, out = run_sudo(c, f"bash -c '{login_cmd}'", timeout=10)
sp(f"  Login: {out[:500] if out else 'NO RESPONSE'}")

# Disk
code, out = run_sudo(c, "df -h / | tail -1")
sp(f"\n  Disk: {out}")

c.close()
sp("\n=== Done! ===")
