#!/usr/bin/env python3
"""Verify chains via psql on DB server + test one creation."""
import sys
import json
from ssh_config import ssh, VM_APP, VM_DB


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# 1. psql on DB server
safe_print("=== 1. DB tables in workflow schema (via psql) ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_db -t -A -F '|' -c "
SELECT table_name FROM information_schema.tables WHERE table_schema='workflow' ORDER BY table_name;
" """, timeout=15)
safe_print(f"  Tables: {out}")

safe_print("\n=== 2. Count rows in workflow tables ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_db -t -A -c "
SELECT 'workflow_definitions' as t, count(*) FROM workflow.workflow_definitions
UNION ALL
SELECT 'workflow_steps', count(*) FROM workflow.workflow_steps
UNION ALL
SELECT 'validation_chains', count(*) FROM workflow.validation_chains
UNION ALL
SELECT 'workflow_instances', count(*) FROM workflow.workflow_instances;
" """, timeout=15)
safe_print(f"  {out}")
if err:
    safe_print(f"  Err: {err[:200]}")

safe_print("\n=== 3. First 5 validation chains ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_db -t -A -F '|' -c "
SELECT id, user_id, validator_id, level_type, priority
FROM workflow.validation_chains
ORDER BY created_at
LIMIT 5;
" """, timeout=15)
if out:
    safe_print(f"  Chains found:")
    for line in out.strip().splitlines():
        safe_print(f"    {line}")
else:
    safe_print(f"  No chains found")

# 4. Test one creation and show full response
safe_print("\n=== 4. Test one chain creation (full response) ===")
code, out, err = ssh(VM_APP, """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'""", timeout=10)
login_data = json.loads(out)
token = login_data["data"]["accessToken"]
tenant_id = login_data["data"]["user"]["tenantId"]

payload = {
    "userId": "12000000-0000-4000-a000-000000000101",
    "validatorId": "10000000-0000-4000-a000-000000000101",
    "backupValidatorId": "10000000-0000-4000-a000-000000000001",
    "levelType": "national",
    "priority": 1,
}
payload_json = json.dumps(payload)

code, out, err = ssh(VM_APP, f"""curl -sv -X POST 'http://localhost:3012/api/v1/workflow/validation-chains' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}' -H 'Content-Type: application/json' -d '{payload_json}' 2>&1""", timeout=15)
safe_print(f"  Full response:\n{out[:1000]}")

# 5. Check DB again after test creation
safe_print("\n=== 5. Check DB after test creation ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_db -t -A -c "
SELECT count(*) FROM workflow.validation_chains;
" """, timeout=15)
safe_print(f"  Count: {out}")
