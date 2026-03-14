#!/usr/bin/env python3
"""Verify chains on correct database (aris, not aris_db)."""
import sys
import json
from ssh_config import ssh, VM_APP, VM_DB


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# Query on correct database: aris (not aris_db)
safe_print("=== 1. Schemas in database 'aris' ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris -t -A -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast') ORDER BY schema_name;" """, timeout=10)
safe_print(f"  {out}")

safe_print("\n=== 2. Workflow schema tables ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris -t -A -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'workflow' ORDER BY table_name;" """, timeout=10)
safe_print(f"  {out}")

safe_print("\n=== 3. Row counts ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris -t -A -c "
SELECT 'workflow_definitions' as t, count(*) FROM workflow.workflow_definitions
UNION ALL SELECT 'workflow_steps', count(*) FROM workflow.workflow_steps
UNION ALL SELECT 'validation_chains', count(*) FROM workflow.validation_chains;
" """, timeout=10)
safe_print(f"  {out}")

safe_print("\n=== 4. Validation chains by level_type ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris -t -A -c "
SELECT level_type, count(*) FROM workflow.validation_chains GROUP BY level_type ORDER BY level_type;
" """, timeout=10)
safe_print(f"  {out}")

safe_print("\n=== 5. Sample chains with user emails ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris -t -A -F '|' -c "
SELECT vc.level_type, u1.email as submitter, u2.email as validator
FROM workflow.validation_chains vc
JOIN credential.users u1 ON u1.id = vc.user_id
JOIN credential.users u2 ON u2.id = vc.validator_id
ORDER BY vc.level_type, u1.email
LIMIT 10;
" """, timeout=10)
if out:
    safe_print("  level_type     | submitter                       | validator")
    safe_print("  " + "-" * 80)
    for line in out.strip().splitlines():
        parts = line.split("|")
        if len(parts) >= 3:
            safe_print(f"  {parts[0]:16s} | {parts[1]:32s} | {parts[2]}")
else:
    safe_print("  No data")

# 6. Why does the API return 0?
safe_print("\n=== 6. Debug: API list with fresh token ===")
code, out, err = ssh(VM_APP, """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'""", timeout=10)
login_data = json.loads(out)
token = login_data["data"]["accessToken"]
tid = login_data["data"]["user"]["tenantId"]

code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/validation-chains?limit=5' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=10)
safe_print(f"  API response: {out[:500]}")
