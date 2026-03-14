#!/usr/bin/env python3
"""Verify validation chains in production."""
import sys
import json
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# Fresh login
code, out, err = ssh(VM_APP, """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'""", timeout=10)
login_data = json.loads(out)
token = login_data["data"]["accessToken"]
tenant_id = login_data["data"]["user"]["tenantId"]
safe_print(f"Fresh login (tenant: {tenant_id})")

# Check via API
safe_print("\n=== Via API (fresh token) ===")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/validation-chains?limit=200' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=15)
safe_print(f"  HTTP code: {code}")
try:
    resp = json.loads(out)
    chains = resp.get("data", [])
    total = resp.get("meta", {}).get("total", len(chains))
    safe_print(f"  Total: {total}, returned: {len(chains)}")
    by_level = {}
    for ch in chains:
        lt = ch.get("levelType", "?")
        by_level[lt] = by_level.get(lt, 0) + 1
    for lt, cnt in sorted(by_level.items()):
        safe_print(f"    {lt}: {cnt}")
    if chains:
        safe_print(f"\n  First 3:")
        for ch in chains[:3]:
            safe_print(f"    {json.dumps(ch, default=str)[:200]}")
except:
    safe_print(f"  Raw: {out[:500]}")

# Check via direct DB query
safe_print("\n=== Via direct DB (workflow schema) ===")
code, out, err = ssh(VM_APP, """docker exec aris-workflow sh -c "npx prisma db execute --stdin --schema=/app/packages/db-schemas/prisma <<'ENDSQL'
SELECT count(*) as total FROM workflow.validation_chains;
ENDSQL" """, timeout=15)
safe_print(f"  Count: {out}")
if err:
    safe_print(f"  Err: {err[:200]}")

# Also check with SELECT
safe_print("\n=== First 5 chains from DB ===")
code, out, err = ssh(VM_APP, """docker exec aris-workflow sh -c "npx prisma db execute --stdin --schema=/app/packages/db-schemas/prisma <<'ENDSQL'
SELECT id, user_id, validator_id, level_type, priority
FROM workflow.validation_chains
ORDER BY level_type, created_at
LIMIT 5;
ENDSQL" """, timeout=15)
safe_print(f"  {out}")
if err:
    safe_print(f"  Err: {err[:200]}")

# Check if the schema exists
safe_print("\n=== Check workflow tables ===")
code, out, err = ssh(VM_APP, """docker exec aris-workflow sh -c "npx prisma db execute --stdin --schema=/app/packages/db-schemas/prisma <<'ENDSQL'
SELECT table_name, (SELECT count(*) FROM workflow.validation_chains) as vc_count
FROM information_schema.tables
WHERE table_schema = 'workflow'
ORDER BY table_name;
ENDSQL" """, timeout=15)
safe_print(f"  {out}")
if err:
    safe_print(f"  Err: {err[:200]}")
