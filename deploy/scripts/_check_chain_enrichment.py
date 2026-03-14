#!/usr/bin/env python3
"""Check if validation chain API enriches user info."""
import sys, json
from ssh_config import ssh, VM_APP

def safe_print(t):
    try: print(t)
    except UnicodeEncodeError: print(t.encode("ascii",errors="replace").decode())
    sys.stdout.flush()

code, out, err = ssh(VM_APP, """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'""", timeout=10)
d = json.loads(out)
token = d["data"]["accessToken"]
tid = d["data"]["user"]["tenantId"]

# Get first 3 chains with full detail
safe_print("=== Chain API response (first 3) ===")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/validation-chains?limit=3' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=10)
resp = json.loads(out)
for ch in resp.get("data", []):
    safe_print(json.dumps(ch, indent=2, default=str))
    safe_print("---")
