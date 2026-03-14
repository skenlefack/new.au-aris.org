#!/usr/bin/env python3
"""Verify all settings categories in the API."""
import sys
import json
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# Login
code, out, err = ssh(VM_APP, """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'""", timeout=10)
login_data = json.loads(out)
token = login_data["data"]["accessToken"]
tid = login_data["data"]["user"]["tenantId"]
safe_print(f"Logged in (tenant: {tid})\n")

# Test all categories
categories = ['general', 'security', 'i18n', 'data-quality', 'dataQuality', 'notifications', 'workflow']
for cat in categories:
    code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3001/api/v1/settings/config/{cat}' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=10)
    try:
        d = json.loads(out)
        items = d.get("data", [])
        safe_print(f"  {cat:20s} -> {len(items)} configs")
        if items:
            for item in items[:3]:
                safe_print(f"    - {item.get('key','?')}: {json.dumps(item.get('value','?'))}")
            if len(items) > 3:
                safe_print(f"    ... +{len(items)-3} more")
    except:
        safe_print(f"  {cat:20s} -> ERROR: {out[:100]}")

# Test ALL configs (no category filter)
safe_print(f"\n  --- ALL configs ---")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3001/api/v1/settings/config' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=10)
try:
    d = json.loads(out)
    items = d.get("data", [])
    safe_print(f"  Total: {len(items)} configs")
    cats = {}
    for item in items:
        cat = item.get("category", "?")
        cats[cat] = cats.get(cat, 0) + 1
    for cat, count in sorted(cats.items()):
        safe_print(f"    {cat}: {count}")
except:
    safe_print(f"  ERROR: {out[:200]}")

# Test domains
safe_print(f"\n  --- Domains ---")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3001/api/v1/settings/domains' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=10)
try:
    d = json.loads(out)
    items = d.get("data", [])
    safe_print(f"  Total: {len(items)} domains")
    for item in items:
        safe_print(f"    - {item.get('code')}: {item.get('name',{}).get('en','?')} [{item.get('icon')}] active={item.get('isActive')}")
except:
    safe_print(f"  ERROR: {out[:200]}")

# Test public domains
safe_print(f"\n  --- Public Domains ---")
code, out, err = ssh(VM_APP, "curl -s http://localhost:3001/api/v1/public/domains", timeout=10)
try:
    d = json.loads(out)
    items = d.get("data", [])
    safe_print(f"  Total: {len(items)} active domains")
    for item in items:
        safe_print(f"    - {item.get('code')}: {item.get('name',{}).get('en','?')}")
except:
    safe_print(f"  ERROR: {out[:200]}")
