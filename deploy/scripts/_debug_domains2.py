#!/usr/bin/env python3
"""Debug domain API chain: host curl + web container env + frontend code check."""
import sys
import os
import json
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# 1. Test public domains API from host
safe_print("=" * 60)
safe_print("  1. Testing /api/v1/public/domains from host")
safe_print("=" * 60)
code, out, err = ssh(VM_APP, 'curl -s http://localhost:3001/api/v1/public/domains', timeout=10)
safe_print(f"  Status: {code}")
safe_print(f"  Response: {out[:2000]}")
if err:
    safe_print(f"  Err: {err[:500]}")

# 2. Test authenticated domains API from host (need a valid token)
safe_print("\n" + "=" * 60)
safe_print("  2. Testing /api/v1/settings/domains from host (no auth)")
safe_print("=" * 60)
code, out, err = ssh(VM_APP, 'curl -s http://localhost:3001/api/v1/settings/domains', timeout=10)
safe_print(f"  Status: {code}")
safe_print(f"  Response: {out[:1000]}")

# 3. Get a login token and test authenticated endpoint
safe_print("\n" + "=" * 60)
safe_print("  3. Login + test authenticated /api/v1/settings/domains")
safe_print("=" * 60)
login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'"""
code, out, err = ssh(VM_APP, login_cmd, timeout=10)
safe_print(f"  Login status: {code}")

token = None
try:
    login_data = json.loads(out)
    token = login_data.get("data", {}).get("accessToken") or login_data.get("accessToken")
    safe_print(f"  Token: {token[:40]}..." if token else "  Token: NOT FOUND")
    safe_print(f"  Login response keys: {list(login_data.keys())}")
    if "data" in login_data:
        safe_print(f"  Data keys: {list(login_data['data'].keys())}")
except Exception as e:
    safe_print(f"  Login parse error: {e}")
    safe_print(f"  Raw: {out[:500]}")

if token:
    # Need tenant ID too
    tenant_id = None
    try:
        tenant_id = login_data.get("data", {}).get("user", {}).get("tenantId")
    except:
        pass
    safe_print(f"  TenantId: {tenant_id}")

    auth_cmd = f"""curl -s http://localhost:3001/api/v1/settings/domains -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id or ""}'"""
    code, out, err = ssh(VM_APP, auth_cmd, timeout=10)
    safe_print(f"\n  Authenticated domains response:")
    safe_print(f"  {out[:3000]}")

# 4. Check web container env vars for TENANT_API_URL
safe_print("\n" + "=" * 60)
safe_print("  4. Web container environment (TENANT_API)")
safe_print("=" * 60)
code, out, err = ssh(VM_APP, "docker exec aris-web printenv | grep -i tenant", timeout=10)
safe_print(f"  {out}")

code, out, err = ssh(VM_APP, "docker exec aris-web printenv | grep -i NEXT_PUBLIC", timeout=10)
safe_print(f"  {out}")

# 5. Check if the web build has the right code (check for useSettingsDomains in compiled JS)
safe_print("\n" + "=" * 60)
safe_print("  5. Check web compiled code for useSettingsDomains")
safe_print("=" * 60)
code, out, err = ssh(VM_APP, "docker exec aris-web grep -r 'useSettingsDomains\\|settings.*domains\\|public/domains' /app/apps/web/.next/static/ 2>/dev/null | head -5", timeout=15)
safe_print(f"  Static JS refs: {out[:500] if out else 'NONE FOUND'}")

code, out, err = ssh(VM_APP, "docker exec aris-web grep -rl 'public/domains' /app/apps/web/.next/ 2>/dev/null | head -10", timeout=15)
safe_print(f"  Files referencing public/domains: {out[:500] if out else 'NONE FOUND'}")

# 6. Check server-side rendering chunks for domain fetch
safe_print("\n" + "=" * 60)
safe_print("  6. Check server chunks for getPublicDomains")
safe_print("=" * 60)
code, out, err = ssh(VM_APP, "docker exec aris-web grep -rl 'getPublicDomains\\|public.*domains' /app/apps/web/.next/server/ 2>/dev/null | head -10", timeout=15)
safe_print(f"  Server files: {out[:500] if out else 'NONE'}")

if out:
    for f in out.strip().split("\n")[:3]:
        f = f.strip()
        if f:
            code2, out2, err2 = ssh(VM_APP, f"docker exec aris-web grep -n 'public.*domains\\|TENANT_API\\|NEXT_PUBLIC' '{f}' 2>/dev/null | head -5", timeout=10)
            safe_print(f"  In {os.path.basename(f)}: {out2[:300]}")

safe_print("\n" + "=" * 60)
safe_print("  Debug complete!")
safe_print("=" * 60)
