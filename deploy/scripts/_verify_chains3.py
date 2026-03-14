#!/usr/bin/env python3
"""Deep diagnostic: workflow DB connection, schema, tables."""
import sys
import json
from ssh_config import ssh, VM_APP, VM_DB


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# 1. Check workflow container's DATABASE_URL
safe_print("=== 1. Workflow container env ===")
code, out, err = ssh(VM_APP, "docker exec aris-workflow env | grep -i 'database\\|db_\\|postgres\\|pgbouncer'", timeout=10)
safe_print(f"  {out}")

# 2. List all schemas in the DB
safe_print("\n=== 2. All schemas in aris_db ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_db -t -A -c "SELECT schema_name FROM information_schema.schemata ORDER BY schema_name;" """, timeout=10)
safe_print(f"  Schemas: {out}")

# 3. Check if workflow schema exists
safe_print("\n=== 3. Workflow schema tables ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_db -t -A -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'workflow' ORDER BY table_name;" """, timeout=10)
safe_print(f"  Tables: {out if out else '(empty)'}")
if err:
    safe_print(f"  Err: {err[:200]}")

# 4. Maybe workflow_definitions is in a different schema?
safe_print("\n=== 4. Search for workflow_definitions table in ANY schema ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_db -t -A -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%workflow%' ORDER BY table_schema, table_name;" """, timeout=10)
safe_print(f"  Results: {out if out else '(none)'}")

# 5. Check if migration was run
safe_print("\n=== 5. Prisma migrations for workflow ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_db -t -A -c "SELECT table_schema, table_name FROM information_schema.tables WHERE table_name LIKE '%migration%' OR table_name LIKE '%prisma%' ORDER BY table_schema, table_name;" """, timeout=10)
safe_print(f"  Migration tables: {out if out else '(none)'}")

# 6. Try creating the schema if it doesn't exist
safe_print("\n=== 6. Check workflow definitions via direct API on port 3012 ===")
code, out, err = ssh(VM_APP, """curl -s http://localhost:3012/health""", timeout=10)
safe_print(f"  Health: {out}")

# Login and test
code, out, err = ssh(VM_APP, """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'""", timeout=10)
login_data = json.loads(out)
token = login_data["data"]["accessToken"]
tid = login_data["data"]["user"]["tenantId"]

# Get definitions count
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/definitions?limit=1' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=10)
safe_print(f"  Definitions: {out[:300]}")

# Try chain creation and capture full response
safe_print("\n=== 7. Create test chain — full response ===")
payload = json.dumps({
    "userId": "12000000-0000-4000-a000-000000000101",
    "validatorId": "10000000-0000-4000-a000-000000000101",
    "backupValidatorId": "10000000-0000-4000-a000-000000000001",
    "levelType": "national",
    "priority": 1,
})

code, out, err = ssh(VM_APP, f"""curl -s -w '\\nHTTP_CODE:%{{http_code}}' -X POST 'http://localhost:3012/api/v1/workflow/validation-chains' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}' -H 'Content-Type: application/json' -d '{payload}'""", timeout=15)
safe_print(f"  Response:\n  {out}")

# 8. Check DB right after
safe_print("\n=== 8. DB check right after creation ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_db -c "SELECT count(*) as total FROM workflow.validation_chains;" """, timeout=10)
safe_print(f"  {out}")
if err:
    safe_print(f"  Err: {err[:200]}")
