#!/usr/bin/env python3
"""Check form-builder data and service on staging."""
import sys, os, tempfile, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import VM_PASS, VM_USER
import paramiko

STG_APP = "10.202.101.146"
STG_DB = "10.202.101.148"


def get_client(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=22, username=VM_USER, password=VM_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)
    return c


def run_sql(host, container, sql):
    c = get_client(host)
    sftp = c.open_sftp()
    local_tmp = tempfile.mktemp(suffix=".sql")
    with open(local_tmp, "w", newline="\n") as f:
        f.write(sql)
    sftp.put(local_tmp, "/tmp/_q.sql")
    sftp.close()
    os.unlink(local_tmp)
    c.close()

    c = get_client(host)
    stdin, stdout, stderr = c.exec_command(
        f"sudo -S bash -c 'docker cp /tmp/_q.sql {container}:/tmp/_q.sql && "
        f"docker exec {container} psql -U aris -d aris -f /tmp/_q.sql'",
        timeout=15)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    stdout.channel.settimeout(15)
    out = stdout.read().decode("utf-8", errors="replace")
    out = "\n".join(l for l in out.splitlines()
                    if "[sudo]" not in l and "password" not in l.lower())
    c.close()
    return out


def run_remote_script(host, script):
    c = get_client(host)
    sftp = c.open_sftp()
    local_tmp = tempfile.mktemp(suffix=".sh")
    with open(local_tmp, "w", newline="\n") as f:
        f.write(script)
    sftp.put(local_tmp, "/tmp/_script.sh")
    sftp.close()
    os.unlink(local_tmp)
    c.close()

    c = get_client(host)
    stdin, stdout, stderr = c.exec_command("bash /tmp/_script.sh", timeout=30)
    stdout.channel.settimeout(30)
    out = stdout.read().decode("utf-8", errors="replace")
    c.close()
    return out


# ── 1. DB check ──
print("=" * 60)
print("  Form Builder — Diagnostic")
print("=" * 60)

print("\n--- Staging DB: form_templates ---")
out = run_sql(STG_DB, "aris-stg-postgres",
              "SELECT id, name, status, domain, tenant_id FROM form_builder.form_templates ORDER BY name;")
print(out)

print("\n--- Staging DB: form_templates columns ---")
out = run_sql(STG_DB, "aris-stg-postgres",
              "SELECT column_name FROM information_schema.columns "
              "WHERE table_schema='form_builder' AND table_name='form_templates' ORDER BY ordinal_position;")
print(out)

# ── 2. Service check ──
print("\n--- Form-builder container ---")
out = run_remote_script(STG_APP, """#!/bin/bash
docker ps --filter name=aris-stg-form-builder --format "{{.Names}}  {{.Status}}  {{.Ports}}"
echo ""
echo "Last logs:"
docker logs aris-stg-form-builder --tail 10 2>&1
""")
print(out[:1000])

# ── 3. API check ──
print("\n--- Form-builder API ---")
out = run_remote_script(STG_APP, """#!/bin/bash
# Login
cat > /tmp/login_body.json << 'JSONEOF'
{"email":"admin@au-aris.org","password":"Aris2024!"}
JSONEOF

TOKEN=$(curl -s --max-time 10 -X POST http://localhost:3002/api/v1/credential/auth/login \
  -H 'Content-Type: application/json' \
  -d @/tmp/login_body.json 2>&1 | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "Login FAILED"
  exit 1
fi

echo "GET /api/v1/form-builder/templates :"
curl -s --max-time 10 http://localhost:3010/api/v1/form-builder/templates \
  -H "Authorization: Bearer $TOKEN" 2>&1 | head -c 1000

echo ""
echo ""
echo "GET /api/v1/form-builder/templates?page=1&limit=5 :"
curl -s --max-time 10 "http://localhost:3010/api/v1/form-builder/templates?page=1&limit=5" \
  -H "Authorization: Bearer $TOKEN" 2>&1 | head -c 1000
""")
print(out[:2000])
