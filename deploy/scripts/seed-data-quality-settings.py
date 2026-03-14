#!/usr/bin/env python3
"""
ARIS 4.0 — Seed new data-quality settings (19 new parameters).
Uploads updated seed-settings.ts and re-runs the settings seed only.
Idempotent: uses upsert on (category, key) unique constraint.
"""
import sys
import os

from ssh_config import get_client, ssh, VM_APP

DB_URL = "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def run_sudo_stream(client, cmd, timeout=300):
    from ssh_config import VM_PASS
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
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
safe_print("  ARIS 4.0 — Seed Data Quality Settings (19 new params)")
safe_print("=" * 60)

# ── Step 1: Upload updated seed-settings.ts ──
safe_print("\n=== 1. Uploading updated seed-settings.ts ===")
deploy_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
repo_root = os.path.dirname(deploy_dir)
local_file = os.path.join(repo_root, "packages", "db-schemas", "prisma", "seed-settings.ts")

c = get_client(VM_APP)
sftp = c.open_sftp()
sftp.put(local_file, "/tmp/aris-seed-settings-dq.ts", confirm=False)
sftp.close()
c.close()

code, out, err = ssh(VM_APP,
    "cp /tmp/aris-seed-settings-dq.ts /opt/aris/packages/db-schemas/prisma/seed-settings.ts"
    " && docker cp /tmp/aris-seed-settings-dq.ts aris-tenant:/app/packages/db-schemas/prisma/seed-settings.ts"
    " && rm -f /tmp/aris-seed-settings-dq.ts"
)
safe_print(f"  Upload (host + container): exit {code}")

# ── Step 2: Re-run settings seed ──
safe_print("\n=== 2. Running settings seed (upsert) ===")
c = get_client(VM_APP)
cmd = f"""bash -c 'docker exec -e DATABASE_URL="{DB_URL}" aris-tenant sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-settings.ts 2>&1"'"""
code, err = run_sudo_stream(c, cmd, timeout=180)
status = "OK" if code == 0 else f"FAILED ({code})"
safe_print(f"  Settings seed: {status}")
if err and code != 0:
    safe_print(f"  Error: {err[:500]}")
c.close()

# ── Step 3: Verify new settings exist ──
safe_print("\n=== 3. Verifying new data-quality settings ===")
verify_sql = "SELECT count(*) FROM governance.system_configs WHERE category = 'data-quality'"
verify_cmd = f"""bash -c "docker exec aris-postgres psql -U aris -d aris -t -c \\"{verify_sql}\\" 2>&1" """
code, out, err = ssh(VM_APP, verify_cmd, timeout=15)
count = out.strip() if out else "?"
safe_print(f"  data-quality config count: {count} (expected: 23)")

safe_print("\n" + "=" * 60)
safe_print("  Done!")
safe_print("=" * 60)
