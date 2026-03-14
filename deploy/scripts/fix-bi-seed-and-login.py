#!/usr/bin/env python3
"""Fix BI seed (docker cp into container) + verify login."""
import sys

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


safe_print("=" * 60)
safe_print("  ARIS 4.0 — Fix BI seed + verify login")
safe_print("=" * 60)

# ── Step 1: Fix seed-bi.ts inside the container using sed ──
safe_print("\n=== 1. Fixing seed-bi.ts inside container ===")
c = get_client()
# Use sed to add ::uuid cast to $1 parameter in the INSERT statement
code, out, err = run_sudo(c,
    """docker exec aris-credential sh -c "sed -i 's/gen_random_uuid(), \\$1, /gen_random_uuid(), \\$1::uuid, /g' /app/packages/db-schemas/prisma/seed-bi.ts" """,
    timeout=10)
safe_print(f"  sed fix: exit {code}")

# Verify the fix
code, out, err = run_sudo(c,
    """docker exec aris-credential sh -c "grep '::uuid' /app/packages/db-schemas/prisma/seed-bi.ts | head -2" """,
    timeout=10)
safe_print(f"  Verify: {out[:200] if out else 'NOT FOUND'}")
c.close()

# ── Step 2: Re-run BI seed ──
safe_print("\n=== 2. Re-running BI seed ===")
c = get_client()
cmd = f"""bash -c 'docker exec -e DATABASE_URL="{DB_URL}" aris-credential sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-bi.ts 2>&1"'"""
code, err = run_sudo_stream(c, cmd, timeout=120)
status = "OK" if code == 0 else f"FAILED ({code})"
safe_print(f"  BI seed: {status}")
c.close()

# ── Step 3: Login test (without -f flag for visibility) ──
safe_print("\n=== 3. Login test ===")
c = get_client()
login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}' 2>&1 | head -c 800"""
code, out, err = run_sudo(c, f"bash -c '{login_cmd}'", timeout=10)
safe_print(f"  Login response: {out[:800] if out else 'NO RESPONSE'}")

# Also try accessing the frontend
safe_print("\n=== 4. Quick health summary ===")
checks = [
    ("Frontend", "http://localhost:3100"),
    ("Credential", "http://localhost:3002/health"),
    ("Tenant", "http://localhost:3001/health"),
    ("Master Data", "http://localhost:3003/health"),
]
for name, url in checks:
    code2, out2, err2 = run_sudo(c, f'curl -sf -o /dev/null -w "%{{http_code}}" {url} 2>/dev/null', timeout=5)
    safe_print(f"  {name:15s}: {out2 if out2 else '000'}")

c.close()

safe_print("\n" + "=" * 60)
safe_print("  Done!")
safe_print("=" * 60)
