#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy revert + fix: restore settings-hooks, update Sidebar to use public API.
Also: check and reseed dataQuality configs if missing.
"""
import sys
import os
import time
import json

from ssh_config import get_client, ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def run_sudo_stream(client, cmd, timeout=600):
    from ssh_config import VM_PASS
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(VM_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line and "[sudo]" not in line:
            safe_print(f"  {line}")
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, err


def upload_file(local_path, remote_path):
    c = get_client(VM_APP)
    sftp = c.open_sftp()
    sftp.put(local_path, remote_path, confirm=False)
    sftp.close()
    c.close()


safe_print("=" * 60)
safe_print("  ARIS 4.0 — Deploy Revert + Fix")
safe_print("=" * 60)

repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ─────────────────────────────────────────────────────
# PART A: Check DB for dataQuality configs
# ─────────────────────────────────────────────────────
safe_print("\n=== A. Checking dataQuality configs in DB ===")

# Login to get token
login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'"""
code, out, err = ssh(VM_APP, login_cmd, timeout=10)

token = None
tenant_id = None
try:
    login_data = json.loads(out)
    token = login_data.get("data", {}).get("accessToken")
    tenant_id = login_data.get("data", {}).get("user", {}).get("tenantId")
except:
    pass

if token:
    # Check dataQuality
    code, out, err = ssh(VM_APP, f"""curl -s http://localhost:3001/api/v1/settings/config/dataQuality -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)
    try:
        dq_data = json.loads(out)
        dq_count = len(dq_data.get("data", []))
        safe_print(f"  dataQuality configs count: {dq_count}")
        if dq_count == 0:
            safe_print("  -> MISSING! Will re-seed after deploy.")
    except:
        safe_print(f"  Raw response: {out[:200]}")

# ─────────────────────────────────────────────────────
# PART B: Upload web source files
# ─────────────────────────────────────────────────────
safe_print("\n=== B. Uploading web source files ===")

web_files = {
    "apps/web/src/lib/api/settings-hooks.ts": "/opt/aris/apps/web/src/lib/api/settings-hooks.ts",
    "apps/web/src/components/layout/Sidebar.tsx": "/opt/aris/apps/web/src/components/layout/Sidebar.tsx",
}

for rel_path, dest in web_files.items():
    local = os.path.join(repo, rel_path.replace("/", os.sep))
    tmp = f"/tmp/aris-web-{os.path.basename(local)}"
    upload_file(local, tmp)
    code, out, err = ssh(VM_APP, f'cp "{tmp}" "{dest}" && rm -f "{tmp}"', timeout=10)
    safe_print(f"  {os.path.basename(local)}: {'OK' if code == 0 else 'FAILED'}")
    if code != 0 and err:
        safe_print(f"    ERR: {err[:200]}")

# ─────────────────────────────────────────────────────
# PART C: Rebuild web Docker image
# ─────────────────────────────────────────────────────
safe_print("\n=== C. Rebuilding web Docker image ===")
c = get_client(VM_APP)
code, err = run_sudo_stream(c,
    "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml build --no-cache web",
    timeout=600
)
safe_print(f"  Build: {'OK' if code == 0 else f'FAILED ({code})'}")
c.close()

safe_print("\n=== D. Restarting web container ===")
c = get_client(VM_APP)
code, err = run_sudo_stream(c,
    "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d web",
    timeout=60
)
c.close()
time.sleep(8)

code, out, err = ssh(VM_APP, "docker ps --filter name=aris-web --format '{{.Status}}'", timeout=10)
safe_print(f"  aris-web status: {out}")

# ─────────────────────────────────────────────────────
# PART E: Re-seed dataQuality configs if missing
# ─────────────────────────────────────────────────────
safe_print("\n=== E. Re-seeding dataQuality configs ===")

# Upload seed file to tenant container
local_seed = os.path.join(repo, "packages", "db-schemas", "prisma", "seed-settings.ts")
tmp_seed = "/tmp/aris-seed-settings.ts"
upload_file(local_seed, tmp_seed)

code, out, err = ssh(VM_APP, f'docker cp "{tmp_seed}" aris-tenant:/app/packages/db-schemas/prisma/seed-settings.ts', timeout=15)
safe_print(f"  Seed file uploaded: {'OK' if code == 0 else 'FAILED'}")
ssh(VM_APP, f"rm -f {tmp_seed}", timeout=5)

# Run the seed
safe_print("  Running seed...")
code, out, err = ssh(VM_APP, "docker exec -w /app aris-tenant npx tsx packages/db-schemas/prisma/seed-settings.ts", timeout=60)
safe_print(f"  Seed exit code: {code}")
if out:
    safe_print(f"  Output: {out[:500]}")
if err:
    safe_print(f"  Err: {err[:300]}")

# Verify dataQuality configs after seed
if token:
    safe_print("\n  Verifying dataQuality after seed...")
    code, out, err = ssh(VM_APP, f"""curl -s http://localhost:3001/api/v1/settings/config/dataQuality -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)
    try:
        dq_data = json.loads(out)
        dq_count = len(dq_data.get("data", []))
        safe_print(f"  dataQuality configs after seed: {dq_count}")
    except:
        safe_print(f"  Raw: {out[:200]}")

    # Also check other categories
    for cat in ['general', 'security', 'i18n']:
        code, out, err = ssh(VM_APP, f"""curl -s http://localhost:3001/api/v1/settings/config/{cat} -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)
        try:
            cat_data = json.loads(out)
            cat_count = len(cat_data.get("data", []))
            safe_print(f"  {cat} configs: {cat_count}")
        except:
            pass

safe_print("\n" + "=" * 60)
safe_print("  Deploy complete!")
safe_print("=" * 60)
