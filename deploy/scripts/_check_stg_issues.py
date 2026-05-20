#!/usr/bin/env python3
"""Check staging DB state after sync: functions, users, settings, services."""

import paramiko
import json
import sys
import os

VM_STG_DB = "10.202.101.148"
VM_STG_APP = "10.202.101.146"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S"


def get_client(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=22, username=SSH_USER, password=SSH_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)
    return c


def ssh_cmd(host, cmd, timeout=30):
    c = get_client(host)
    stdin, stdout, stderr = c.exec_command(f"sudo -S bash -c '{cmd}'", timeout=timeout)
    if SSH_PASS:
        stdin.write(SSH_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    c.close()
    return out


def psql(sql, db="aris"):
    c = get_client(VM_STG_DB)
    sftp = c.open_sftp()
    with sftp.file("/tmp/_q.sql", "w") as f:
        f.write(sql)
    sftp.close()
    c.close()
    ssh_cmd(VM_STG_DB, f"docker cp /tmp/_q.sql aris-stg-postgres:/tmp/_q.sql")
    return ssh_cmd(VM_STG_DB, f"docker exec aris-stg-postgres psql -U aris -d {db} -t -A -f /tmp/_q.sql")


def safe(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# ═══════════════════════════════════════════════
# DB CHECKS
# ═══════════════════════════════════════════════

safe("=" * 60)
safe("  STAGING DB DIAGNOSTICS")
safe("=" * 60)

# 1. Schemas
safe("\n[1] Database schemas:")
out = psql("SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema','pg_catalog','pg_toast') ORDER BY 1;")
for line in out.strip().split("\n"):
    if line.strip():
        safe(f"  - {line.strip()}")

# 2. Functions
safe("\n[2] governance.functions:")
out = psql("SELECT count(*) FROM governance.functions;")
safe(f"  Count: {out.strip()}")
out = psql("SELECT id::text, code, tenant_id::text FROM governance.functions LIMIT 5;")
safe(f"  Sample: {out.strip()[:300]}")

# 3. Settings tables
safe("\n[3] settings schema tables:")
out = psql("SELECT tablename FROM pg_tables WHERE schemaname = 'settings' ORDER BY 1;")
safe(f"  Tables: {out.strip() or '(none)'}")

# Check if functions are in settings schema instead
out = psql("SELECT tablename FROM pg_tables WHERE tablename LIKE '%function%' ORDER BY 1;")
safe(f"  Tables with 'function': {out.strip()}")

# 4. Users
safe("\n[4] public.users:")
out = psql("SELECT count(*) FROM public.users;")
safe(f"  Count: {out.strip()}")
out = psql("SELECT email, role FROM public.users LIMIT 5;")
safe(f"  Sample:")
for line in out.strip().split("\n"):
    if line.strip():
        safe(f"    {line.strip()}")

# 5. Key counts comparison
safe("\n[5] Key table counts:")
tables = [
    ("public.tenants", "tenants"),
    ("public.users", "users"),
    ("governance.functions", "functions"),
    ("public.roles", "roles"),
    ("form_builder.form_templates", "form_templates"),
    ("public.collection_campaigns", "campaigns"),
    ("public.submissions", "submissions"),
    ("settings.bi_access_rules", "bi_access_rules"),
    ("settings.general_settings", "general_settings"),
]
for table, label in tables:
    try:
        out = psql(f"SELECT count(*) FROM {table};")
        safe(f"  {label}: {out.strip()}")
    except Exception:
        safe(f"  {label}: ERROR")

# ═══════════════════════════════════════════════
# SERVICE CHECKS
# ═══════════════════════════════════════════════

safe("\n" + "=" * 60)
safe("  STAGING SERVICE DIAGNOSTICS")
safe("=" * 60)

# Container status
safe("\n[6] Container status:")
out = ssh_cmd(VM_STG_APP, "docker ps --filter name=aris-stg --format '{{.Names}}: {{.Status}}' | sort")
for line in out.strip().split("\n"):
    if line.strip():
        safe(f"  {line.strip()}")

# Test credential /users endpoint
safe("\n[7] Testing API endpoints...")

# Login first
c = get_client(VM_STG_APP)
sftp = c.open_sftp()
with sftp.file("/tmp/login.json", "w") as f:
    f.write(json.dumps({"email": "admin@au-aris.org", "password": "Aris2026@@4!0"}))
sftp.close()
c.close()

out = ssh_cmd(VM_STG_APP,
    "curl -s -X POST http://localhost:3002/api/v1/credential/auth/login "
    "-H 'Content-Type: application/json' -d @/tmp/login.json")
try:
    resp = json.loads(out)
    token = resp["data"]["accessToken"]
    safe(f"  Login: OK")
except Exception:
    safe(f"  Login: FAILED - {out[:200]}")
    sys.exit(1)

# Test users endpoint
endpoints = [
    ("GET", "http://localhost:3002/api/v1/credential/users", "credential/users"),
    ("GET", "http://localhost:3002/api/v1/credential/users/me", "credential/users/me"),
    ("GET", "http://localhost:3001/api/v1/settings/functions", "settings/functions"),
    ("GET", "http://localhost:3001/api/v1/settings/roles", "settings/roles"),
    ("GET", "http://localhost:3011/api/v1/workflow/campaigns?limit=3", "workflow/campaigns"),
]

for method, url, label in endpoints:
    out = ssh_cmd(VM_STG_APP,
        f"curl -s -w '\\n%{{http_code}}' -X {method} "
        f"-H 'Authorization: Bearer {token}' "
        f"-H 'Content-Type: application/json' '{url}'")
    lines = out.strip().split("\n")
    http_code = lines[-1] if lines else "?"
    body = "\n".join(lines[:-1])
    try:
        r = json.loads(body)
        count = len(r.get("data", [])) if isinstance(r.get("data"), list) else "obj"
        msg = r.get("message", "")
        if http_code.startswith("2"):
            safe(f"  {label}: HTTP {http_code} OK (data: {count})")
        else:
            safe(f"  {label}: HTTP {http_code} - {msg[:100]}")
    except Exception:
        safe(f"  {label}: HTTP {http_code} - {body[:100]}")

safe("\n" + "=" * 60)
safe("  DIAGNOSTICS COMPLETE")
safe("=" * 60)
