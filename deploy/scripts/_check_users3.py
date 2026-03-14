#!/usr/bin/env python3
"""Check users via multiple methods."""
import sys
import json
from ssh_config import ssh, VM_APP, VM_DB


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


safe_print("=" * 60)
safe_print("  ARIS — Find Users")
safe_print("=" * 60)

# 1. Check DB containers
safe_print("\n=== 1. DB containers ===")
code, out, err = ssh(VM_APP, "docker ps --format '{{.Names}} | {{.Ports}}' | grep -i 'db\\|postgres\\|pg'", timeout=10)
safe_print(f"  {out if out else 'No DB containers found on app server'}")

# 2. Check DB on DB server
safe_print("\n=== 2. DB on DB server ===")
code, out, err = ssh(VM_DB, "docker ps --format '{{.Names}} | {{.Ports}}' | grep -i 'db\\|postgres\\|pg'", timeout=10)
safe_print(f"  {out if out else 'No DB containers found'}")

# 3. Try psql on DB server
safe_print("\n=== 3. Users via psql on DB server ===")
code, out, err = ssh(VM_DB, """docker exec aris-db psql -U postgres -d aris_db -t -A -F '|' -c "SELECT id, email, role, display_name FROM credential.users ORDER BY role, email LIMIT 30;" """, timeout=15)
if out:
    safe_print(f"  Users:")
    for line in out.strip().splitlines():
        safe_print(f"    {line}")
else:
    safe_print(f"  No output (code={code})")
    if err:
        safe_print(f"  Err: {err[:300]}")

# 3b. Try different container names
safe_print("\n=== 3b. Try other container names ===")
for cname in ["aris-db", "aris-postgres", "postgres", "aris-pgbouncer"]:
    code, out, err = ssh(VM_DB, f"docker ps --filter name={cname} --format '{{{{.Names}}}} | {{{{.Status}}}}'", timeout=10)
    safe_print(f"  {cname}: {out if out else 'not found'}")

# 4. Try credential service internal API
safe_print("\n=== 4. Credential users via internal API ===")
login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'"""
code, out, err = ssh(VM_APP, login_cmd, timeout=10)

token = None
try:
    login_data = json.loads(out)
    token = login_data["data"]["accessToken"]
    user = login_data["data"]["user"]
    safe_print(f"  Logged in as: {user.get('email')} (id={user.get('id')}, role={user.get('role')}, tenant={user.get('tenantId')})")
except Exception as e:
    safe_print(f"  Login error: {e}")

if token:
    # Try /users/me
    code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3002/api/v1/credential/users/me' -H 'Authorization: Bearer {token}'""", timeout=10)
    safe_print(f"\n  /users/me: {out[:300]}")

    # Try /users with different tenant header
    code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3002/api/v1/credential/users?limit=100' -H 'Authorization: Bearer {token}'""", timeout=10)
    try:
        d = json.loads(out)
        users = d.get("data", [])
        total = d.get("meta", {}).get("total", len(users))
        safe_print(f"\n  /users (no tenant header): {total} users")
        for u in users[:20]:
            safe_print(f"    {u.get('id', '?')[:36]} | {u.get('email', '?'):40s} | {u.get('role', '?')}")
    except:
        safe_print(f"\n  /users response: {out[:300]}")

# 5. Direct DB query via credential container
safe_print("\n=== 5. Direct SQL via credential container ===")
code, out, err = ssh(VM_APP, """docker exec aris-credential sh -c 'node -e "
const { PrismaClient } = require(String.fromCharCode(64)+\\"prisma/client\\");
const p = new PrismaClient();
p.user.findMany({select:{id:true,email:true,role:true},orderBy:{role:\\"asc\\"}}).then(u=>{console.log(JSON.stringify(u));p.\\$disconnect()}).catch(e=>{console.error(e);p.\\$disconnect()});
"'""", timeout=20)
try:
    users = json.loads(out)
    safe_print(f"  Found {len(users)} users via Prisma:")
    for u in users[:30]:
        safe_print(f"    {u.get('id', '?')[:36]} | {u.get('email', '?'):40s} | {u.get('role', '?')}")
except:
    safe_print(f"  Output: {out[:500]}")
    if err:
        safe_print(f"  Err: {err[:300]}")

safe_print("\n" + "=" * 60)
