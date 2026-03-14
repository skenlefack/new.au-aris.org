#!/usr/bin/env python3
"""Emergency diagnostic: check DB data, tenant service, and settings endpoints."""
import sys
import json
from ssh_config import ssh, VM_APP, VM_DB


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# 1. Check all containers status
safe_print("=" * 60)
safe_print("  1. Container status")
safe_print("=" * 60)
code, out, err = ssh(VM_APP, "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'aris|NAME'", timeout=10)
safe_print(out)

# 2. Check tenant service logs (recent errors)
safe_print("\n" + "=" * 60)
safe_print("  2. Tenant service recent logs (last 30 lines)")
safe_print("=" * 60)
code, out, err = ssh(VM_APP, "docker logs --tail 30 aris-tenant 2>&1", timeout=10)
safe_print(out)

# 3. Check DB directly - domains table
safe_print("\n" + "=" * 60)
safe_print("  3. Domains in DB (direct query)")
safe_print("=" * 60)
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_tenant -c "SELECT id, code, name->>'en' as name_en, \\\"isActive\\\", \\\"sortOrder\\\" FROM governance.domains ORDER BY \\\"sortOrder\\\";" """, timeout=10)
safe_print(out)

# 4. Check system_configs count
safe_print("\n" + "=" * 60)
safe_print("  4. System configs in DB")
safe_print("=" * 60)
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_tenant -c "SELECT category, COUNT(*) FROM governance.system_configs GROUP BY category ORDER BY category;" """, timeout=10)
safe_print(out)

# 5. Check some specific config values
safe_print("\n" + "=" * 60)
safe_print("  5. Sample config values (general + security)")
safe_print("=" * 60)
code, out, err = ssh(VM_DB, """docker exec aris-postgres psql -U postgres -d aris_tenant -c "SELECT category, key, value FROM governance.system_configs WHERE category IN ('general','security') ORDER BY category, key LIMIT 20;" """, timeout=10)
safe_print(out)

# 6. Test the settings API
safe_print("\n" + "=" * 60)
safe_print("  6. Test settings API endpoints")
safe_print("=" * 60)

# Login first
code, out, err = ssh(VM_APP, """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'""", timeout=10)

token = None
tenant_id = None
try:
    login_data = json.loads(out)
    token = login_data.get("data", {}).get("accessToken")
    tenant_id = login_data.get("data", {}).get("user", {}).get("tenantId")
    safe_print(f"  Login: OK (token={token[:30]}...)")
except Exception as e:
    safe_print(f"  Login FAILED: {e}")
    safe_print(f"  Raw: {out[:300]}")

if token:
    # Test domains endpoint
    code, out, err = ssh(VM_APP, f"""curl -s http://localhost:3001/api/v1/settings/domains -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)
    safe_print(f"\n  GET /settings/domains: {out[:500]}")

    # Test config endpoints
    for cat in ['general', 'security', 'i18n', 'dataQuality']:
        code, out, err = ssh(VM_APP, f"""curl -s http://localhost:3001/api/v1/settings/config/{cat} -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)
        safe_print(f"\n  GET /settings/config/{cat}: {out[:300]}")

# 7. Check web app logs
safe_print("\n" + "=" * 60)
safe_print("  7. Web container recent logs")
safe_print("=" * 60)
code, out, err = ssh(VM_APP, "docker logs --tail 20 aris-web 2>&1", timeout=10)
safe_print(out)

safe_print("\n" + "=" * 60)
safe_print("  Diagnostic complete!")
safe_print("=" * 60)
