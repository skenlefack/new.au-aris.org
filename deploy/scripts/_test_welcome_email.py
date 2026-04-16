#!/usr/bin/env python3
"""
End-to-end smoke test on STAGING:
  1. Login as super admin
  2. Register a disposable test user
  3. Tail aris-stg-message logs for the [WELCOME] line
  4. Clean up: delete the test user via DB
"""
import json, subprocess, time, paramiko, sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

API = "https://test.au-aris.org/api/v1/credential"
TENANT_HOST = "10.202.101.146"
DB_HOST = "10.202.101.148"

# 1. Login
print("[1] Login as super admin...")
login = subprocess.run([
    "curl", "-sk", "--max-time", "15",
    "-H", "Content-Type: application/json",
    "-d", '{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}',
    f"{API}/auth/login",
], capture_output=True, text=True)
data = json.loads(login.stdout)
token = data["data"]["accessToken"]
print(f"    token: {token[:30]}...")

# 2. Use the admin's own tenant (AU-IBAR continental)
tenant_id = data["data"]["user"]["tenantId"]
print(f"\n[2] Using admin tenant_id={tenant_id}")

# 3. Register disposable user
test_email = f"welcome-test-{int(time.time())}@example.test"
print(f"\n[3] Register test user {test_email}...")
reg = subprocess.run([
    "curl", "-sk", "--max-time", "20",
    "-X", "POST",
    "-H", f"Authorization: Bearer {token}",
    "-H", "Content-Type: application/json",
    "-d", json.dumps({
        "email": test_email,
        "password": "Temp-P@ss-" + str(int(time.time()))[-6:],
        "firstName": "Welcome",
        "lastName": "SmokeTest",
        "role": "ANALYST",
        "tenantId": tenant_id,
    }),
    f"{API}/auth/register",
], capture_output=True, text=True)
print("    HTTP response:", reg.stdout[:400])
try:
    reg_data = json.loads(reg.stdout)
    user_id = reg_data.get("data", {}).get("id")
    print(f"    user_id={user_id}")
except Exception:
    user_id = None

# 4. Tail message container logs
print("\n[4] Checking aris-stg-message logs for [WELCOME] line...")
time.sleep(3)
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(TENANT_HOST, username="arisadmin", password="@u-1baR.0rg$U24", timeout=15, allow_agent=False, look_for_keys=False)
_, out, _ = ssh.exec_command("docker logs aris-stg-message --tail 50 2>&1 | grep -E 'WELCOME|welcome|error|Error' | tail -20", timeout=30)
print(out.read().decode())
ssh.close()

# 5. Cleanup via direct DB
if user_id:
    print(f"\n[5] Cleanup test user {user_id}...")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(DB_HOST, username="arisadmin", password="@u-1baR.0rg$U24", timeout=15, allow_agent=False, look_for_keys=False)
    # FK cleanup: delete user_devices / collecte_vc first if needed, then user
    cmd = (
        'docker exec -e PGPASSWORD="Ar1s_Stg_2024!xK9mZ" aris-stg-postgres '
        f'psql -U aris -d aris -c "'
        f"DELETE FROM public.user_devices WHERE user_id='{user_id}'; "
        f"DELETE FROM public.users WHERE id='{user_id}';"
        f'"'
    )
    _, out, _ = ssh.exec_command(cmd, timeout=30, get_pty=True)
    print(out.read().decode())
    ssh.close()

print("\nDone.")
