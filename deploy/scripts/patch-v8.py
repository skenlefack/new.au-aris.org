#!/usr/bin/env python3
"""
ARIS 4.0 — VM-APP patch v8
============================
Fixes:
  1. Remove `import './types/fastify.d'` from trade-sps, apiculture, datalake app.ts
  2. Upgrade Traefik v3.0 → v3.3 (Docker API version compatibility)
  3. Rebuild only the 3 affected services + restart Traefik/Jaeger
"""
import sys
import time
import os

from ssh_config import get_client as _get_client, VM_APP, VM_PASS

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
safe_print("  ARIS 4.0 — VM-APP patch v8")
safe_print("  Fix fastify.d imports + Traefik upgrade")
safe_print("=" * 60)

# --- Step 1: Upload patched files ---
safe_print("\n=== 1. Uploading fixed files ===")

deploy_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
repo_root = os.path.dirname(deploy_dir)

files_to_upload = [
    # Fixed app.ts files (removed import './types/fastify.d')
    (os.path.join(repo_root, "services", "trade-sps", "src", "app.ts"),
     f"{REMOTE_ARIS}/services/trade-sps/src/app.ts"),
    (os.path.join(repo_root, "services", "apiculture", "src", "app.ts"),
     f"{REMOTE_ARIS}/services/apiculture/src/app.ts"),
    (os.path.join(repo_root, "services", "datalake", "src", "app.ts"),
     f"{REMOTE_ARIS}/services/datalake/src/app.ts"),
    # Updated docker-compose (Traefik v3.3)
    (os.path.join(deploy_dir, "vm-app", "docker-compose.yml"),
     f"{REMOTE_DEPLOY}/vm-app/docker-compose.yml"),
]

c = get_client()
sftp = c.open_sftp()

pending_moves = []
for i, (local_path, remote_path) in enumerate(files_to_upload):
    if not os.path.exists(local_path):
        safe_print(f"  SKIP (not found): {os.path.basename(local_path)}")
        continue
    filename = os.path.basename(remote_path)
    tmp_path = f"/tmp/aris-v8-{i:02d}-{filename}"
    safe_print(f"  Upload: {local_path.split(os.sep)[-3:]}")
    sftp.put(local_path, tmp_path)
    pending_moves.append((tmp_path, remote_path))

sftp.close()
c.close()

c = get_client()
for tmp_path, remote_path in pending_moves:
    code, out, err = run_sudo(c, f"cp {tmp_path} {remote_path} && rm -f {tmp_path}")
    if code != 0:
        safe_print(f"  ERROR: {err[:200]}")
c.close()
safe_print(f"  All {len(pending_moves)} files uploaded")

# --- Step 2: Rebuild only the 3 affected services ---
safe_print("\n=== 2. Rebuilding 3 affected services ===")

rebuild = ["trade-sps", "apiculture", "datalake"]
failed = []
ok = []

for i, svc in enumerate(rebuild, 1):
    svc_start = time.time()
    safe_print(f"\n  [{i}/{len(rebuild)}] Rebuilding {svc}...")
    c = get_client()
    cmd = f"""bash -c '
cd /opt/aris-deploy/vm-app
set -a
source /opt/aris-deploy/.env.production 2>/dev/null || true
set +a
export DOCKER_BUILDKIT=1
docker compose build --no-cache {svc} 2>&1
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

safe_print(f"\n  Rebuild results: {len(ok)}/{len(rebuild)}")
if failed:
    safe_print(f"  Failed: {', '.join(failed)}")

# --- Step 3: Restart affected containers + Traefik + Jaeger ---
safe_print("\n=== 3. Restarting affected containers ===")
c = get_client()
code, err = run_sudo_stream(c, """bash -c '
cd /opt/aris-deploy/vm-app
set -a
source /opt/aris-deploy/.env.production 2>/dev/null || true
set +a

# Pull new Traefik image
docker compose pull traefik 2>&1

# Recreate affected services
docker compose up -d --force-recreate trade-sps apiculture datalake traefik jaeger 2>&1

echo ""
echo "Waiting 30s for services to start..."
sleep 30
echo ""
echo "=== Container Status ==="
docker ps -a --format "table {{.Names}}\t{{.Status}}" 2>/dev/null || true
echo ""
RUNNING=$(docker ps -q 2>/dev/null | wc -l)
TOTAL=$(docker ps -aq 2>/dev/null | wc -l)
echo "Running: $RUNNING / Total: $TOTAL"
'""", timeout=180)
c.close()

# --- Step 4: Health checks ---
safe_print("\n=== 4. Health Checks ===")
c = get_client()

checks = [
    ("Traefik", "curl -sf http://localhost:80/ping 2>&1 && echo OK || echo FAIL"),
    ("Credential", "curl -sf http://localhost:3002/api/v1/credential/auth/login 2>/dev/null && echo OK || echo -n $(curl -sf -o /dev/null -w '%{http_code}' http://localhost:3002/api/v1/credential/auth/login 2>/dev/null)"),
    ("Tenant", "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3001/api/v1/tenants/health 2>/dev/null"),
    ("Frontend", "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3100 2>/dev/null"),
    ("Grafana", "curl -sf http://localhost:3200/api/health 2>/dev/null | head -c 50"),
    ("Master Data", "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3003/api/v1/master-data/health 2>/dev/null"),
    ("Form Builder", "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3010/api/v1/form-builder/health 2>/dev/null"),
    ("Collecte", "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3011/api/v1/collecte/health 2>/dev/null"),
    ("Trade SPS", "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3025/api/v1/trade-sps/health 2>/dev/null"),
    ("Apiculture", "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3024/api/v1/apiculture/health 2>/dev/null"),
    ("Datalake", "curl -sf -o /dev/null -w '%{http_code}' http://localhost:3034/api/v1/datalake/health 2>/dev/null"),
]

for name, cmd in checks:
    code, out, err = run_sudo(c, f"bash -c \"{cmd}\"", timeout=10)
    safe_print(f"  {name}: {out[:100] if out else 'NO RESPONSE'}")

# Show crashed/exited containers
code, out, err = run_sudo(c, "docker ps -a --filter 'status=exited' --filter 'status=restarting' --format '{{.Names}}: {{.Status}}' 2>/dev/null")
if out.strip():
    safe_print(f"\n  Problem containers:")
    for line in out.strip().splitlines()[:10]:
        safe_print(f"    {line}")
else:
    safe_print("\n  All containers healthy!")

# Disk
code, out, err = run_sudo(c, "df -h / | tail -1")
safe_print(f"\n  Disk: {out}")

c.close()

safe_print("\n" + "=" * 60)
safe_print("  VM-APP patch v8 complete!")
safe_print("=" * 60)
