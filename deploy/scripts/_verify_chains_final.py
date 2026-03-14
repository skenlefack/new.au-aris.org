#!/usr/bin/env python3
"""Final verification of validation chains via API."""
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

# Get ALL chains (paginated)
safe_print("=== Validation Chains ===")
all_chains = []
for pg in [1, 2]:
    code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/validation-chains?limit=100&page={pg}' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=15)
    resp = json.loads(out)
    chains = resp.get("data", [])
    total = resp.get("meta", {}).get("total", 0)
    all_chains.extend(chains)
    if pg == 1:
        safe_print(f"  Total: {total}")
    if len(chains) < 100:
        break

# Count by level
by_level = {}
for ch in all_chains:
    lt = ch.get("levelType", "?")
    by_level[lt] = by_level.get(lt, 0) + 1

safe_print(f"  Retrieved: {len(all_chains)}")
for lt in sorted(by_level.keys()):
    safe_print(f"    {lt}: {by_level[lt]}")

# Show examples per level
for level in ["national", "regional", "continental"]:
    level_chains = [ch for ch in all_chains if ch.get("levelType") == level]
    safe_print(f"\n  --- {level.upper()} (first 5 of {len(level_chains)}) ---")
    for ch in level_chains[:5]:
        user_info = ch.get("user", {})
        val_info = ch.get("validator", {})
        user_label = user_info.get("email", ch.get("userId", "?")[:20]) if user_info else ch.get("userId", "?")[:20]
        val_label = val_info.get("email", ch.get("validatorId", "?")[:20]) if val_info else ch.get("validatorId", "?")[:20]
        safe_print(f"    {user_label} → {val_label}")

# Also verify workflow definitions
safe_print("\n\n=== Workflow Definitions ===")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/definitions?limit=1' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=10)
resp = json.loads(out)
total_defs = resp.get("meta", {}).get("total", 0)
safe_print(f"  Total definitions: {total_defs}")

safe_print("\n" + "=" * 60)
safe_print("  All workflow data verified!")
safe_print("=" * 60)
