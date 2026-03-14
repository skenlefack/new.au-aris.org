#!/usr/bin/env python3
"""
ARIS 4.0 — VM-APP final patch (v9)
- Fix realtime Kafka plugin timeout (10s -> 60s)
- Rebuild realtime service
- Run proper login test
- Final health check summary
"""
import sys
import time
import os

from ssh_config import get_client as _get_client, VM_APP, VM_KAFKA, VM_PASS

HOST = VM_APP
REMOTE_ARIS = "/opt/aris"
REMOTE_DEPLOY = "/opt/aris-deploy"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    return _get_client(VM_APP)


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, out, err


def run_sudo_stream(client, cmd, timeout=600):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"  {line}")
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, err


safe_print("=" * 60)
safe_print("  ARIS 4.0 — VM-APP final patch (v9)")
safe_print("=" * 60)

# --- Step 1: Upload fixed realtime app.ts ---
safe_print("\n=== 1. Uploading realtime fix ===")

deploy_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
repo_root = os.path.dirname(deploy_dir)

local_file = os.path.join(repo_root, "services", "realtime", "src", "app.ts")
remote_file = f"{REMOTE_ARIS}/services/realtime/src/app.ts"

c = get_client()
sftp = c.open_sftp()
sftp.put(local_file, "/tmp/aris-realtime-app.ts")
sftp.close()
c.close()

c = get_client()
code, out, err = run_sudo(c, f"cp /tmp/aris-realtime-app.ts {remote_file} && rm -f /tmp/aris-realtime-app.ts")
safe_print(f"  Upload: exit {code}")
c.close()

# --- Step 2: Rebuild realtime ---
safe_print("\n=== 2. Rebuilding realtime ===")
c = get_client()
cmd = """bash -c '
cd /opt/aris-deploy/vm-app
set -a
source /opt/aris-deploy/.env.production 2>/dev/null || true
set +a
export DOCKER_BUILDKIT=1
docker compose build --no-cache realtime 2>&1
'"""
code, err = run_sudo_stream(c, cmd, timeout=900)
c.close()
safe_print(f"  Build: {'OK' if code == 0 else f'FAILED ({code})'}")

# --- Step 3: Restart realtime ---
safe_print("\n=== 3. Restarting realtime ===")
c = get_client()
code, out, err = run_sudo(c, "bash -c 'cd /opt/aris-deploy/vm-app && set -a && source /opt/aris-deploy/.env.production 2>/dev/null && set +a && docker compose up -d --force-recreate realtime 2>&1'", timeout=60)
safe_print(f"  Restart: {out[:200]}")
c.close()

# Wait for it to start (needs up to 60s for Kafka consumer joins)
safe_print("  Waiting 45s for Kafka consumers to join...")
time.sleep(45)

# --- Step 4: Health check for realtime ---
safe_print("\n=== 4. Realtime health check ===")
c = get_client()
code, out, err = run_sudo(c, "curl -sf http://localhost:3008/health 2>&1", timeout=10)
safe_print(f"  Realtime /health: {out[:200] if out else 'NO RESPONSE'}")

# --- Step 5: Login test ---
safe_print("\n=== 5. Login Test ===")
# Write JSON body to file first (avoiding shell escaping issues)
code, out, err = run_sudo(c, 'bash -c \'echo \'\\\'\'{"email":"admin@au-aris.org","password":"Aris2024!"}\'\\\'\'> /tmp/login.json\'')
# Verify
code, out, err = run_sudo(c, "cat /tmp/login.json")
safe_print(f"  Body: {out}")

code, out, err = run_sudo(c, 'curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H "Content-Type: application/json" -d @/tmp/login.json 2>&1', timeout=10)
safe_print(f"  Login response: {out[:500] if out else 'NO RESPONSE'}")

# --- Step 6: Final Summary ---
safe_print("\n=== 6. Final Container Summary ===")

# Count running vs total
code, out, err = run_sudo(c, "docker ps -q 2>/dev/null | wc -l")
running = out.strip()
code, out, err = run_sudo(c, "docker ps -aq 2>/dev/null | wc -l")
total = out.strip()
safe_print(f"  Containers: {running}/{total} running")

# Problem containers
code, out, err = run_sudo(c, "docker ps -a --filter 'status=exited' --filter 'status=restarting' --format '{{.Names}}: {{.Status}}' 2>/dev/null")
if out.strip():
    safe_print(f"\n  Problem containers:")
    for line in out.strip().splitlines()[:10]:
        safe_print(f"    {line}")
else:
    safe_print("  All containers healthy!")

# Disk
code, out, err = run_sudo(c, "df -h / | tail -1")
safe_print(f"  Disk: {out}")

c.close()

safe_print("\n" + "=" * 60)
safe_print("  ARIS 4.0 — VM-APP deployment COMPLETE!")
safe_print("=" * 60)
safe_print(f"  Frontend:     http://{VM_APP}")
safe_print(f"  API Gateway:  http://{VM_APP}/api/v1/")
safe_print(f"  Traefik:      http://{VM_APP}:8090")
safe_print(f"  Grafana:      http://{VM_APP}:3200")
safe_print(f"  Prometheus:   http://{VM_APP}:9090")
safe_print(f"  Superset:     http://{VM_APP}:8088")
safe_print(f"  Metabase:     http://{VM_APP}:3035")
safe_print(f"  Jaeger:       http://{VM_APP}:16686")
safe_print(f"  Kafka UI:     http://{VM_KAFKA}:8080")
safe_print("=" * 60)
