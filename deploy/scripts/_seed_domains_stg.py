#!/usr/bin/env python3
"""
ARIS 4.0 — Seed user-domain assignments on staging.

Steps:
  1. Upload updated Prisma schema files (settings.prisma, credential.prisma)
  2. Upload seed-credential.ts
  3. Regenerate Prisma Client inside the container
  4. Re-run seed-credential.ts

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _seed_domains_stg.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, VM_PASS, VM_USER

import paramiko

STG_APP = "10.202.101.146"
STG_DB_URL = "postgresql://aris:Ar1s_Stg_2024!xK9mZ@10.202.101.148:5432/aris"
CONTAINER = "aris-stg-credential"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(STG_APP, port=22, username=VM_USER, password=VM_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, out, err


def run_sudo_stream(client, cmd, timeout=300):
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


repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
prisma_dir = os.path.join(repo_root, "packages", "db-schemas", "prisma")

safe_print("=" * 60)
safe_print("  ARIS 4.0 — Seed User-Domain Assignments (Staging)")
safe_print("=" * 60)

# ── Step 1: Upload updated Prisma schema files ──
step("Step 1: Upload Prisma schema + seed files")
files_to_upload = [
    "settings.prisma",
    "credential.prisma",
    "schema.prisma",
    "seed-credential.ts",
]

c = get_client()
sftp = c.open_sftp()
for f in files_to_upload:
    local_path = os.path.join(prisma_dir, f)
    if not os.path.exists(local_path):
        safe_print(f"  SKIP: {f} not found locally")
        continue
    remote_tmp = f"/tmp/aris-prisma-{f}"
    sftp.put(local_path, remote_tmp)
    safe_print(f"  Uploaded: {f}")
sftp.close()
c.close()

# Copy into /opt/aris (which is mounted into containers)
c = get_client()
for f in files_to_upload:
    remote_tmp = f"/tmp/aris-prisma-{f}"
    dest = f"/opt/aris/packages/db-schemas/prisma/{f}"
    code, out, err = run_sudo(c, f"bash -c 'cp {remote_tmp} {dest} && rm -f {remote_tmp}'")
    if code != 0:
        safe_print(f"  WARN: Could not copy {f}: {err[:200]}")
    else:
        safe_print(f"  Copied to: {dest}")
c.close()

# ── Step 2: Also copy files directly into the container (in case /opt/aris is not volume-mounted) ──
step("Step 2: Copy files into container")
c = get_client()
for f in files_to_upload:
    host_path = f"/opt/aris/packages/db-schemas/prisma/{f}"
    container_path = f"/app/packages/db-schemas/prisma/{f}"
    cmd = f"docker cp {host_path} {CONTAINER}:{container_path}"
    code, out, err = run_sudo(c, cmd)
    status = "OK" if code == 0 else f"FAIL: {err[:100]}"
    safe_print(f"  {f} -> container: {status}")
c.close()

# ── Step 3: Regenerate Prisma Client inside the container ──
step("Step 3: Regenerate Prisma Client in container")
c = get_client()
cmd = f"""bash -c 'docker exec -e DATABASE_URL="{STG_DB_URL}" {CONTAINER} sh -c "cd /app/packages/db-schemas && npx prisma generate --schema=prisma 2>&1"'"""
code, err = run_sudo_stream(c, cmd, timeout=120)
status = "OK" if code == 0 else f"FAILED ({code})"
safe_print(f"  Prisma generate: {status}")
if code != 0 and err:
    safe_print(f"  Error: {err[:500]}")
c.close()

# ── Step 4: Run seed-credential.ts ──
step("Step 4: Run seed-credential.ts")
c = get_client()
cmd = f"""bash -c 'docker exec -e DATABASE_URL="{STG_DB_URL}" {CONTAINER} sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-credential.ts 2>&1"'"""
code, err = run_sudo_stream(c, cmd, timeout=180)
status = "OK" if code == 0 else f"FAILED ({code})"
safe_print(f"  Seed: {status}")
if code != 0 and err:
    safe_print(f"  Error: {err[:500]}")
c.close()

# ── Step 5: Verify domain assignments ──
step("Step 5: Verify user_domains table")
c = get_client()
verify_cmd = f"""docker exec -e PGPASSWORD='Ar1s_Stg_2024!xK9mZ' {CONTAINER} sh -c "apt-get install -yqq postgresql-client > /dev/null 2>&1 || true; PGPASSWORD='Ar1s_Stg_2024!xK9mZ' psql -h 10.202.101.148 -U aris -d aris -c 'SELECT count(*) as total_assignments FROM governance.user_domains;' 2>&1" """
code, out, err = run_sudo(c, f"bash -c '{verify_cmd}'", timeout=30)
if code == 0:
    safe_print(f"  {out}")
else:
    # Fallback: use docker exec with psql from DB container
    safe_print(f"  psql not available in credential container, trying direct query...")
    c2 = paramiko.SSHClient()
    c2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c2.connect("10.202.101.148", port=22, username=VM_USER, password=VM_PASS,
               timeout=15, allow_agent=False, look_for_keys=False)
    verify_cmd2 = f"""sudo -S bash -c "PGPASSWORD='Ar1s_Stg_2024!xK9mZ' psql -h localhost -U aris -d aris -c 'SELECT count(*) as total_assignments FROM governance.user_domains;'" """
    stdin, stdout, stderr = c2.exec_command(verify_cmd2, timeout=15)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out2 = stdout.read().decode("utf-8", errors="replace").strip()
    safe_print(f"  {out2}")
    c2.close()
c.close()

safe_print("\n" + "=" * 60)
safe_print("  USER-DOMAIN SEED COMPLETE!")
safe_print("=" * 60)
