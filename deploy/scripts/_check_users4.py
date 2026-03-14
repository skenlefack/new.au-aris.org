#!/usr/bin/env python3
"""Get full user list from production."""
import sys
import json
from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'"""
code, out, err = ssh(VM_APP, login_cmd, timeout=10)
login_data = json.loads(out)
token = login_data["data"]["accessToken"]

# Get ALL users (page 1 + page 2)
all_users = []
for pg in [1, 2, 3]:
    code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3002/api/v1/credential/users?limit=100&page={pg}' -H 'Authorization: Bearer {token}'""", timeout=10)
    d = json.loads(out)
    users = d.get("data", [])
    all_users.extend(users)
    if len(users) < 100:
        break

safe_print(f"Total users: {len(all_users)}\n")

by_role = {}
for u in all_users:
    role = u.get("role", "?")
    if role not in by_role:
        by_role[role] = []
    by_role[role].append(u)

for role in sorted(by_role.keys()):
    safe_print(f"=== {role} ({len(by_role[role])}) ===")
    for u in by_role[role]:
        safe_print(f"  {u['id']} | {u.get('email', '?'):40s} | {u.get('displayName', '-')}")
    safe_print("")
