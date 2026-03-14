#!/usr/bin/env python3
"""Verify login works on ARIS 4.0 VM-APP."""
import sys
import json

from ssh_config import get_client as _get_client, VM_APP, VM_PASS

HOST = VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    return _get_client(VM_APP)


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


# Step 1: Write the JSON body to a file on the remote host
safe_print("=== Login Verification ===")
c = get_client()
sftp = c.open_sftp()
with sftp.open("/tmp/aris-login.json", "w") as f:
    json.dump({"email": "admin@au-aris.org", "password": "Aris2024!"}, f)
sftp.close()
c.close()

# Step 2: Curl with the file
c = get_client()
code, out = run_sudo(c, 'curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H "Content-Type: application/json" -d @/tmp/aris-login.json 2>&1', timeout=10)
safe_print(f"  Response: {out[:800] if out else 'NO RESPONSE'}")

# Parse to check for token
if out:
    try:
        data = json.loads(out)
        if "accessToken" in data or "access_token" in data or "token" in data:
            safe_print("  LOGIN SUCCESSFUL!")
            token_key = next(k for k in ["accessToken", "access_token", "token"] if k in data)
            token = data[token_key][:50] + "..."
            safe_print(f"  Token: {token}")
            if "user" in data:
                user = data["user"]
                safe_print(f"  User: {user.get('email', '?')} ({user.get('role', '?')})")
        elif "statusCode" in data and data["statusCode"] >= 400:
            safe_print(f"  LOGIN FAILED: {data.get('message', 'Unknown error')}")
        else:
            safe_print(f"  Unexpected response format")
    except json.JSONDecodeError:
        safe_print(f"  Could not parse response as JSON")

# Clean up
run_sudo(c, "rm -f /tmp/aris-login.json")
c.close()

# Step 3: Quick container check
safe_print("\n=== Container Status ===")
c = get_client()
code, out = run_sudo(c, "docker ps -q 2>/dev/null | wc -l")
running = out.strip()
code, out = run_sudo(c, "docker ps -aq 2>/dev/null | wc -l")
total = out.strip()
safe_print(f"  Containers: {running}/{total} running")

# Problem containers
code, out = run_sudo(c, "docker ps -a --filter 'status=exited' --filter 'status=restarting' --format '{{.Names}}: {{.Status}}' 2>/dev/null")
if out.strip():
    safe_print(f"  Problem containers:")
    for line in out.strip().splitlines()[:10]:
        safe_print(f"    {line}")
else:
    safe_print("  All containers healthy!")

c.close()
safe_print("\n=== Done ===")
