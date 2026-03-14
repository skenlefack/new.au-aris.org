#!/usr/bin/env python3
"""Check users in production DB directly."""
import sys
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


safe_print("=" * 60)
safe_print("  ARIS — DB Users Query")
safe_print("=" * 60)

# Query all users from credential schema via aris-credential container
safe_print("\n=== All users in credential.users ===")
code, out, err = ssh(VM_APP, """docker exec aris-credential sh -c "npx prisma db execute --stdin --schema=/app/packages/db-schemas/prisma" <<'SQL'
SELECT id, email, role, display_name, tenant_id
FROM credential.users
ORDER BY role, email;
SQL""", timeout=20)
safe_print(f"  Output:\n{out[:3000]}")
if err:
    safe_print(f"  Err: {err[:500]}")

# Alternative: direct psql via DB container
safe_print("\n=== Via aris-db psql ===")
code, out, err = ssh(VM_APP, """docker exec aris-db psql -U postgres -d aris_db -t -A -F '|' -c "SELECT id, email, role, display_name, tenant_id FROM credential.users ORDER BY role, email;" """, timeout=15)
if out:
    safe_print(f"  Users found:")
    for line in out.strip().splitlines():
        parts = line.split("|")
        if len(parts) >= 4:
            safe_print(f"    {parts[0][:36]} | {parts[1]:40s} | {parts[2]:20s} | {parts[3]}")
else:
    safe_print(f"  No output")
if err:
    safe_print(f"  Err: {err[:300]}")

safe_print("\n" + "=" * 60)
