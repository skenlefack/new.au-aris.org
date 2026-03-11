#!/usr/bin/env python3
"""
Build 3 missing services (datalake, offline, web) and start all containers.
"""
import paramiko
import sys
import time
import os

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


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, out, err


def run_sudo_stream(client, cmd, timeout=600):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
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
safe_print("  Building 3 missing services + starting containers")
safe_print("=" * 60)

missing = ["datalake", "offline", "web"]
failed = []
ok = []

for i, svc in enumerate(missing, 1):
    svc_start = time.time()
    safe_print(f"\n  [{i}/{len(missing)}] Building {svc}...")
    c = get_client()
    cmd = f"""bash -c '
cd /opt/aris-deploy/vm-app
set -a
source /opt/aris-deploy/.env.production 2>/dev/null || true
set +a
export DOCKER_BUILDKIT=1
docker compose build {svc} 2>&1
'"""
    code, err = run_sudo_stream(c, cmd, timeout=900)
    c.close()

    elapsed = int(time.time() - svc_start)
    if code == 0:
        safe_print(f"  [{svc}] OK ({elapsed}s)")
        ok.append(svc)
    else:
        safe_print(f"  [{svc}] FAILED (exit {code}, {elapsed}s)")
        if err:
            safe_print(f"  Error: {err[:500]}")
        failed.append(svc)

safe_print(f"\n  Build results: {len(ok)}/{len(missing)} built")
if failed:
    safe_print(f"  Failed: {', '.join(failed)}")

# Start all containers
safe_print("\n=== Starting all containers ===")
c = get_client()
code, err = run_sudo_stream(c, """bash -c '
cd /opt/aris-deploy/vm-app
set -a
source /opt/aris-deploy/.env.production 2>/dev/null || true
set +a

docker compose up -d 2>&1
echo ""
echo "Waiting 60s for services to start..."
sleep 60
echo ""
echo "=== Container Status ==="
docker ps --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || true
echo ""
RUNNING=$(docker ps -q 2>/dev/null | wc -l)
TOTAL=$(docker ps -aq 2>/dev/null | wc -l)
echo "Running: $RUNNING / Total: $TOTAL"
'""", timeout=180)
c.close()

# Health checks
safe_print("\n=== Health Checks ===")
c = get_client()

checks = [
    ("Traefik", "curl -sf http://localhost:80/ping 2>&1 && echo OK || echo STARTING"),
    ("Credential", "curl -sf http://localhost:3002/api/v1/credential/health 2>/dev/null && echo OK || echo STARTING"),
    ("Tenant", "curl -sf http://localhost:3001/api/v1/tenants/health 2>/dev/null && echo OK || echo STARTING"),
    ("Frontend", "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3100 2>/dev/null || echo STARTING"),
    ("Grafana", "curl -sf http://localhost:3200/api/health 2>/dev/null && echo OK || echo STARTING"),
    ("Master Data", "curl -sf http://localhost:3003/api/v1/master-data/health 2>/dev/null && echo OK || echo STARTING"),
]

for name, cmd in checks:
    code, out, err = run_sudo(c, f"bash -c \"{cmd}\"", timeout=10)
    safe_print(f"  {name}: {out[:100] if out else 'N/A'}")

# Show crashed containers
code, out, err = run_sudo(c, "docker ps -a --filter 'status=exited' --format '{{.Names}}: exited {{.Status}}' 2>/dev/null")
if out.strip():
    safe_print(f"\n  Exited containers:")
    for line in out.strip().splitlines()[:15]:
        safe_print(f"    {line}")

# Disk
code, out, err = run_sudo(c, "df -h / | tail -1")
safe_print(f"\n  Disk: {out}")

c.close()

safe_print("\n" + "=" * 60)
safe_print("  VM-APP deployment complete!")
safe_print("=" * 60)
safe_print("  Frontend:     http://10.202.101.183")
safe_print("  API Gateway:  http://10.202.101.183/api/v1/")
safe_print("  Traefik:      http://10.202.101.183:8090")
safe_print("  Grafana:      http://10.202.101.183:3200")
safe_print("  Superset:     http://10.202.101.183:8088")
safe_print("  Metabase:     http://10.202.101.183:3035")
safe_print("=" * 60)
