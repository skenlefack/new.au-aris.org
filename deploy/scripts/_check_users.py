#!/usr/bin/env python3
"""Check users in production to build validation chains."""
import sys
import json
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


safe_print("=" * 60)
safe_print("  ARIS — Check Users for Validation Chains")
safe_print("=" * 60)

# Login
login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'"""
code, out, err = ssh(VM_APP, login_cmd, timeout=10)

login_data = json.loads(out)
token = login_data["data"]["accessToken"]
tenant_id = login_data["data"]["user"]["tenantId"]
safe_print(f"  Logged in (tenant: {tenant_id})")

# Get all users
safe_print("\n=== All Users ===")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3002/api/v1/credential/users?limit=200' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=15)

try:
    d = json.loads(out)
    users = d.get("data", [])
    safe_print(f"  Total users: {d.get('meta', {}).get('total', len(users))}")

    # Group by role
    by_role = {}
    for u in users:
        role = u.get("role", "?")
        if role not in by_role:
            by_role[role] = []
        by_role[role].append(u)

    for role in sorted(by_role.keys()):
        safe_print(f"\n  --- {role} ({len(by_role[role])}) ---")
        for u in by_role[role]:
            safe_print(f"    {u.get('id', '?')[:36]} | {u.get('email', '?'):40s} | {u.get('displayName', '?')}")
except Exception as e:
    safe_print(f"  Parse error: {e}")
    safe_print(f"  Raw: {out[:500]}")

# Also check via direct SQL for user IDs from seed
safe_print("\n=== Check seed user IDs existence ===")

SEED_IDS = {
    "SUPER_ADMIN": "10000000-0000-4000-a000-000000000001",
    "CONTINENTAL_ADMIN": "11000000-0000-4000-a000-000000000001",
    "REC_ADMIN_IGAD": "10000000-0000-4000-a000-000000000010",
    "REC_ADMIN_ECOWAS": "10000000-0000-4000-a000-000000000020",
    "REC_STEWARD_IGAD": "12000000-0000-4000-a000-000000000010",
    "REC_STEWARD_ECOWAS": "12000000-0000-4000-a000-000000000020",
    "KE_ADMIN": "10000000-0000-4000-a000-000000000101",
    "KE_STEWARD": "12000000-0000-4000-a000-000000000101",
    "NG_ADMIN": "10000000-0000-4000-a000-000000000201",
    "NG_STEWARD": "12000000-0000-4000-a000-000000000201",
}

for label, uid in SEED_IDS.items():
    code, out, err = ssh(VM_APP, f"""docker exec aris-workflow sh -c "npx prisma db execute --stdin --schema=/app/packages/db-schemas/prisma <<'SQL'
SELECT id, email, role FROM credential.users WHERE id = '{uid}';
SQL" """, timeout=15)
    if uid in out:
        safe_print(f"  {label:25s} {uid[:20]}... EXISTS")
    else:
        safe_print(f"  {label:25s} {uid[:20]}... NOT FOUND")

safe_print("\n" + "=" * 60)
