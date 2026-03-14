#!/usr/bin/env python3
"""Debug: why enrichment fails — check cross-schema access."""
import sys, json
from ssh_config import ssh, VM_APP, VM_DB

def safe_print(t):
    try: print(t)
    except UnicodeEncodeError: print(t.encode("ascii",errors="replace").decode())
    sys.stdout.flush()

# 1. Check what database credential service uses
safe_print("=== 1. Credential container DB URL ===")
code, out, err = ssh(VM_APP, "docker exec aris-credential env | grep DATABASE_URL", timeout=10)
safe_print(f"  {out}")

# 2. Check schemas available in 'aris' DB
safe_print("\n=== 2. Schemas in 'aris' DB (as user 'aris') ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U aris -d aris -t -A -c "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast') ORDER BY schema_name;" """, timeout=10)
safe_print(f"  {out if out else '(empty)'}")
if err:
    safe_print(f"  Err: {err[:300]}")

# 3. Check if credential schema exists in aris DB
safe_print("\n=== 3. Check credential.users in aris DB ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U aris -d aris -t -A -c "SELECT count(*) FROM credential.users;" """, timeout=10)
safe_print(f"  Count: {out if out else '(empty)'}")
if err:
    safe_print(f"  Err: {err[:300]}")

# 4. Check column names
safe_print("\n=== 4. Credential.users columns ===")
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U aris -d aris -t -A -c "SELECT column_name FROM information_schema.columns WHERE table_schema='credential' AND table_name='users' ORDER BY ordinal_position;" """, timeout=10)
safe_print(f"  Columns: {out if out else '(empty)'}")
if err:
    safe_print(f"  Err: {err[:300]}")

# 5. Try the exact enrichment query
safe_print("\n=== 5. Run exact enrichment query ===")
test_ids = "12000000-0000-4000-a000-000000000080,11000000-0000-4000-a000-000000000001,10000000-0000-4000-a000-000000000001"
code, out, err = ssh(VM_DB, f"""docker exec aris-postgres psql -U aris -d aris -t -A -F '|' -c "SELECT id, display_name, email FROM credential.users WHERE id = ANY(ARRAY['{test_ids.replace(",", "','")}'::uuid]);" """, timeout=10)
safe_print(f"  Result: {out if out else '(empty)'}")
if err:
    safe_print(f"  Err: {err[:300]}")

# 6. Check workflow service logs for errors
safe_print("\n=== 6. Workflow service recent logs ===")
code, out, err = ssh(VM_APP, "docker logs aris-workflow --tail 30 2>&1", timeout=10)
safe_print(f"  {out[:2000]}")
