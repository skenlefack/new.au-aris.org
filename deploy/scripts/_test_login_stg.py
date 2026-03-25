#!/usr/bin/env python3
"""Test login and basic API operations on staging."""
import sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import VM_PASS, VM_USER
import paramiko

STG_APP = "10.202.101.146"

login_script = r"""#!/bin/bash
cat > /tmp/login_body.json << 'JSONEOF'
{"email":"admin@au-aris.org","password":"Aris2024!"}
JSONEOF

echo "=== 1. Login ==="
TOKEN=$(curl -s --max-time 10 -X POST http://localhost:3002/api/v1/credential/auth/login \
  -H 'Content-Type: application/json' \
  -d @/tmp/login_body.json 2>&1 | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('accessToken',''))" 2>/dev/null)

if [ -z "$TOKEN" ]; then
  echo "  FAILED: No token received"
  exit 1
fi
echo "  OK: Token received (${#TOKEN} chars)"

echo ""
echo "=== 2. Get current user ==="
curl -s --max-time 5 http://localhost:3002/api/v1/credential/users/me \
  -H "Authorization: Bearer $TOKEN" 2>&1 | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  u=d.get('data',{})
  print(f\"  User: {u.get('email')} ({u.get('role')}) tenant={u.get('tenantId','')[:8]}...\")
except: print('  Parse error')
" 2>/dev/null

echo ""
echo "=== 3. Check tenant service ==="
curl -s --max-time 5 http://localhost:3001/api/v1/tenant/tenants \
  -H "Authorization: Bearer $TOKEN" 2>&1 | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  items=d.get('data',[])
  print(f\"  Tenants: {len(items)} total\")
  for t in items[:3]:
    print(f\"    - {t.get('name','')} ({t.get('level','')})\")
  if len(items)>3: print(f\"    ... and {len(items)-3} more\")
except: print('  Parse error')
" 2>/dev/null

echo ""
echo "=== 4. Check master-data ==="
curl -s --max-time 5 http://localhost:3003/api/v1/master-data/species \
  -H "Authorization: Bearer $TOKEN" 2>&1 | python3 -c "
import sys,json
try:
  d=json.load(sys.stdin)
  items=d.get('data',[])
  print(f\"  Species: {len(items)} total\")
except: print('  Parse error')
" 2>/dev/null

echo ""
echo "=== 5. Check web frontend ==="
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://localhost:3000/ 2>&1)
echo "  Web (port 3000): HTTP $HTTP_CODE"

echo ""
echo "=== 6. Check via Traefik (HTTPS) ==="
HTTP_CODE=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 5 https://localhost/ 2>&1)
echo "  Traefik HTTPS: HTTP $HTTP_CODE"

echo ""
echo "=== STAGING VERIFICATION COMPLETE ==="
"""

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(STG_APP, port=22, username=VM_USER, password=VM_PASS,
          timeout=15, allow_agent=False, look_for_keys=False)

local_tmp = tempfile.mktemp(suffix=".sh")
with open(local_tmp, "w", newline="\n") as f:
    f.write(login_script)

sftp = c.open_sftp()
sftp.put(local_tmp, "/tmp/test_login.sh")
sftp.close()
os.unlink(local_tmp)
c.close()

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(STG_APP, port=22, username=VM_USER, password=VM_PASS,
          timeout=15, allow_agent=False, look_for_keys=False)

stdin, stdout, stderr = c.exec_command("bash /tmp/test_login.sh", timeout=60)
stdout.channel.settimeout(60)
out = stdout.read().decode("utf-8", errors="replace")
print(out)
c.close()
