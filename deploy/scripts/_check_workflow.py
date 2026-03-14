#!/usr/bin/env python3
"""Check workflow service status and data in production."""
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
safe_print("  ARIS — Workflow Service Diagnostic")
safe_print("=" * 60)

# 1. Check if workflow container is running
safe_print("\n=== 1. Docker container status ===")
code, out, err = ssh(VM_APP, "docker ps -a --filter name=aris-workflow --format '{{.Names}} | {{.Status}} | {{.Ports}}'", timeout=10)
if out:
    safe_print(f"  {out}")
else:
    safe_print("  aris-workflow container NOT FOUND")

# 2. Check workflow service health
safe_print("\n=== 2. Workflow service health ===")
code, out, err = ssh(VM_APP, "curl -s http://localhost:3012/health", timeout=10)
safe_print(f"  Health: {out[:200] if out else 'NO RESPONSE'}")

# 3. Check Traefik routing for workflow
safe_print("\n=== 3. Traefik routing test ===")
code, out, err = ssh(VM_APP, "curl -s -o /dev/null -w '%{http_code}' http://localhost/api/v1/workflow/definitions", timeout=10)
safe_print(f"  HTTP status via Traefik (no auth): {out}")

# 4. Login and check workflow definitions
safe_print("\n=== 4. Login & check workflow definitions ===")
login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'"""
code, out, err = ssh(VM_APP, login_cmd, timeout=10)

token = None
tenant_id = None
try:
    login_data = json.loads(out)
    token = login_data.get("data", {}).get("accessToken")
    tenant_id = login_data.get("data", {}).get("user", {}).get("tenantId")
    safe_print(f"  Logged in (tenant: {tenant_id})")
except Exception as e:
    safe_print(f"  Login failed: {e}")
    safe_print(f"  Response: {out[:200]}")

if token:
    # Check workflow definitions via Traefik (port 80)
    safe_print("\n  --- Workflow Definitions via Traefik ---")
    code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost/api/v1/workflow/definitions?limit=50' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)
    try:
        d = json.loads(out)
        items = d.get("data", [])
        meta = d.get("meta", {})
        safe_print(f"  Total definitions: {meta.get('total', len(items))}")
        for item in items:
            safe_print(f"    - {item.get('countryCode', '?')}: {item.get('name', '?')} (active={item.get('isActive')}, steps={len(item.get('steps', []))})")
            for s in item.get("steps", []):
                safe_print(f"        Step {s.get('stepOrder')}: {s.get('name')} [{s.get('levelType')}] level={s.get('adminLevel')}")
    except Exception as e:
        safe_print(f"  Parse error: {e}")
        safe_print(f"  Raw: {out[:500]}")

    # Also try direct to workflow service (port 3012)
    safe_print("\n  --- Workflow Definitions via direct (port 3012) ---")
    code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/definitions?limit=50' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)
    try:
        d = json.loads(out)
        items = d.get("data", [])
        meta = d.get("meta", {})
        safe_print(f"  Total definitions: {meta.get('total', len(items))}")
        for item in items:
            safe_print(f"    - {item.get('countryCode', '?')}: {item.get('name', '?')} (active={item.get('isActive')}, steps={len(item.get('steps', []))})")
    except Exception as e:
        safe_print(f"  Parse error: {e}")
        safe_print(f"  Raw: {out[:500]}")

    # Check validation chains
    safe_print("\n  --- Validation Chains ---")
    code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/validation-chains?limit=50' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)
    try:
        d = json.loads(out)
        items = d.get("data", [])
        meta = d.get("meta", {})
        safe_print(f"  Total chains: {meta.get('total', len(items))}")
        for item in items[:5]:
            safe_print(f"    - User: {item.get('userId', '?')} | Validator: {item.get('validatorId', '?')}")
    except Exception as e:
        safe_print(f"  Parse error: {e}")
        safe_print(f"  Raw: {out[:500]}")

# 5. Check DB directly for workflow tables
safe_print("\n=== 5. Check workflow DB tables ===")
code, out, err = ssh(VM_APP, """docker exec aris-workflow sh -c "npx prisma db execute --stdin --schema=/app/packages/db-schemas/prisma <<'SQL'
SELECT 'workflow_definitions' as tbl, count(*) as cnt FROM workflow.workflow_definitions
UNION ALL
SELECT 'workflow_steps' as tbl, count(*) as cnt FROM workflow.workflow_steps
UNION ALL
SELECT 'workflow_instances' as tbl, count(*) as cnt FROM workflow.workflow_instances
UNION ALL
SELECT 'validation_chains' as tbl, count(*) as cnt FROM workflow.validation_chains;
SQL" """, timeout=15)
safe_print(f"  {out[:500] if out else 'No output'}")
if err:
    safe_print(f"  Err: {err[:300]}")

# 5b. Alternative: check via psql in DB container or direct SQL
safe_print("\n=== 5b. Check workflow tables via tenant DB ===")
code, out, err = ssh(VM_APP, """docker exec aris-tenant sh -c 'npx prisma db execute --stdin --schema=/app/packages/db-schemas/prisma' <<'SQL'
SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'workflow' ORDER BY table_name;
SQL""", timeout=15)
safe_print(f"  {out[:500] if out else 'No output'}")
if err:
    safe_print(f"  Err: {err[:300]}")

safe_print("\n" + "=" * 60)
safe_print("  Diagnostic complete!")
safe_print("=" * 60)
