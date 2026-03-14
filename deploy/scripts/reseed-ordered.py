#!/usr/bin/env python3
"""
ARIS 4.0 — Re-run seeds in correct dependency order.
Prisma db push already done. Now seed in order:
  1. tenant      (already done, skip)
  2. settings    (countries, RECs, domains, admin levels)
  3. credential  (users — needs tenants)
  4. functions   (functions + user_functions — needs users)
  5. master-data (reference data)
  6. workflow    (needs settings/countries + users)
  7. bi          (needs users, UUID cast fixed)
"""
import sys
import os

from ssh_config import get_client as _get_client, VM_APP, VM_PASS

HOST = VM_APP
DB_URL = "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    return _get_client(VM_APP)


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


safe_print("=" * 60)
safe_print("  ARIS 4.0 — Database Seeds (correct order)")
safe_print("=" * 60)

# ── Step 0: Upload fixed seed-bi.ts ──
safe_print("\n=== 0. Uploading fixed seed-bi.ts ===")
deploy_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
repo_root = os.path.dirname(deploy_dir)
local_bi = os.path.join(repo_root, "packages", "db-schemas", "prisma", "seed-bi.ts")

c = get_client()
sftp = c.open_sftp()
sftp.put(local_bi, "/tmp/aris-seed-bi-fix.ts")
sftp.close()
c.close()

c = get_client()
code, out, err = run_sudo(c, "cp /tmp/aris-seed-bi-fix.ts /opt/aris/packages/db-schemas/prisma/seed-bi.ts && rm -f /tmp/aris-seed-bi-fix.ts")
safe_print(f"  Upload seed-bi.ts: exit {code}")
c.close()

# Seed order: settings → credential → functions → master-data → workflow → bi

SEEDS = [
    ("settings",    "aris-tenant",     "seed-settings.ts"),
    ("credential",  "aris-credential", "seed-credential.ts"),
    ("functions",   "aris-credential", "seed-functions.ts"),
    ("master-data", "aris-credential", "seed-master-data.ts"),
    ("workflow",    "aris-workflow",   "seed-workflow.ts"),
    ("bi",          "aris-credential", "seed-bi.ts"),
]

for i, (name, container, script) in enumerate(SEEDS, 1):
    safe_print(f"\n=== {i}. Seeding {name} (via {container}) ===")
    c = get_client()
    cmd = f"""bash -c 'docker exec -e DATABASE_URL="{DB_URL}" {container} sh -c "cd /app/packages/db-schemas && npx tsx prisma/{script} 2>&1"'"""
    code, err = run_sudo_stream(c, cmd, timeout=180)
    status = "OK" if code == 0 else f"FAILED ({code})"
    safe_print(f"  {name}: {status}")
    if err and code != 0:
        safe_print(f"  Error: {err[:300]}")
    c.close()

# ── Verify login ──
safe_print("\n=== 7. Verifying login ===")
c = get_client()
login_cmd = """curl -sf -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}' 2>&1 | head -c 500"""
code, out, err = run_sudo(c, f"bash -c '{login_cmd}'", timeout=10)
safe_print(f"  Login: {out[:500] if out else 'NO RESPONSE'}")
c.close()

safe_print("\n" + "=" * 60)
safe_print("  Seeding complete!")
safe_print("=" * 60)
