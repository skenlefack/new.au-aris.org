#!/usr/bin/env python3
"""
Fix Prisma client permissions, regenerate, and re-seed credential on staging.

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _fix_prisma_seed_domains.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, VM_PASS, VM_USER

import paramiko

STG_APP = "10.202.101.146"
STG_DB = "10.202.101.148"
STG_DB_URL = "postgresql://aris:Ar1s_Stg_2024!xK9mZ@10.202.101.148:5432/aris"
CONTAINER = "aris-stg-credential"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client(host=STG_APP):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=22, username=VM_USER, password=VM_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=120):
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
    lines = []
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"  {line}")
            lines.append(line)
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, "\n".join(lines), err


safe_print("=" * 60)
safe_print("  Fix Prisma + Seed User-Domain Assignments")
safe_print("=" * 60)

# ── Step 1: Fix permissions on .prisma directory inside container ──
step("Step 1: Fix .prisma permissions (chown to uid 1001)")
c = get_client()
cmd = f"""bash -c 'docker exec -u 0 {CONTAINER} chown -R 1001:1001 /app/node_modules/.pnpm/@prisma+client@6.2.0_prisma@6.2.0/node_modules/.prisma 2>&1'"""
code, out, err = run_sudo(c, cmd)
safe_print(f"  chown: {'OK' if code == 0 else f'FAILED ({code})'}")
if out:
    safe_print(f"  {out[:200]}")
c.close()

# ── Step 2: Regenerate Prisma Client ──
step("Step 2: Regenerate Prisma Client inside container")
c = get_client()
cmd = f"""bash -c 'docker exec -u 1001 -e DATABASE_URL="{STG_DB_URL}" {CONTAINER} sh -c "cd /app/packages/db-schemas && npx prisma generate --schema=prisma 2>&1"'"""
code, out, err = run_sudo_stream(c, cmd, timeout=120)
safe_print(f"  Prisma generate: {'OK' if code == 0 else f'FAILED ({code})'}")
if code != 0 and err:
    safe_print(f"  Error: {err[:500]}")
c.close()

if code != 0:
    safe_print("\n  ABORTING: Prisma generate failed")
    sys.exit(1)

# ── Step 3: Run seed-credential.ts ──
step("Step 3: Run seed-credential.ts")
c = get_client()
cmd = f"""bash -c 'docker exec -u 1001 -e DATABASE_URL="{STG_DB_URL}" {CONTAINER} sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-credential.ts 2>&1"'"""
code, out, err = run_sudo_stream(c, cmd, timeout=180)
safe_print(f"  Seed: {'OK' if code == 0 else f'FAILED ({code})'}")
if code != 0 and err:
    safe_print(f"  Error: {err[:500]}")
c.close()

# ── Step 4: Verify via SQL on DB VM ──
step("Step 4: Verify user_domains in database")
c = get_client(host=STG_DB)
cmd = """bash -c "PGPASSWORD='Ar1s_Stg_2024!xK9mZ' psql -h localhost -U aris -d aris -t -c 'SELECT count(*) FROM governance.user_domains;'" """
code, out, err = run_sudo(c, cmd, timeout=15)
if code == 0:
    count = out.strip()
    safe_print(f"  user_domains rows: {count}")
else:
    safe_print(f"  Could not query: {err[:200]}")
c.close()

# Also check which users have domains
c = get_client(host=STG_DB)
cmd = """bash -c "PGPASSWORD='Ar1s_Stg_2024!xK9mZ' psql -h localhost -U aris -d aris -c \\"SELECT u.email, count(ud.id) as domains FROM public.users u LEFT JOIN governance.user_domains ud ON u.id = ud.user_id GROUP BY u.email HAVING count(ud.id) > 0 ORDER BY domains DESC LIMIT 5;\\"" """
code, out, err = run_sudo(c, cmd, timeout=15)
if code == 0:
    safe_print(f"  {out}")
c.close()

safe_print("\n" + "=" * 60)
safe_print("  DONE!")
safe_print("=" * 60)
