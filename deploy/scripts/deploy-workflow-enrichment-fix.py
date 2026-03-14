#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy fix: validation chain user enrichment.
Fix: query public.users (not credential.users), use first_name+last_name (not display_name).
"""
import sys
import os
import time
import json

from ssh_config import get_client, ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def run_sudo_stream(client, cmd, timeout=600):
    from ssh_config import VM_PASS
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(VM_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line and "[sudo]" not in line:
            safe_print(f"  {line}")
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, err


def upload_file(local_path, remote_path):
    c = get_client(VM_APP)
    sftp = c.open_sftp()
    sftp.put(local_path, remote_path, confirm=False)
    sftp.close()
    c.close()


safe_print("=" * 60)
safe_print("  ARIS 4.0 — Deploy Workflow Enrichment Fix")
safe_print("=" * 60)

repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ── Upload fixed file ──
safe_print("\n=== 1. Uploading fixed validation-chain.service.ts ===")
local = os.path.join(repo, "services", "workflow", "src", "services", "validation-chain.service.ts")
tmp = "/tmp/aris-validation-chain.service.ts"
upload_file(local, tmp)

dest = "/opt/aris/services/workflow/src/services/validation-chain.service.ts"
code, out, err = ssh(VM_APP, f'cp "{tmp}" "{dest}" && rm -f "{tmp}"', timeout=10)
safe_print(f"  Upload: {'OK' if code == 0 else 'FAILED'}")

# ── Rebuild workflow service ──
safe_print("\n=== 2. Rebuilding workflow service ===")
c = get_client(VM_APP)
code, err = run_sudo_stream(c,
    "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml build --no-cache workflow",
    timeout=300
)
safe_print(f"  Build: {'OK' if code == 0 else f'FAILED ({code})'}")
if code != 0 and err:
    safe_print(f"  Err: {err[:500]}")
c.close()

# ── Restart workflow container ──
safe_print("\n=== 3. Restarting workflow container ===")
c = get_client(VM_APP)
code, err = run_sudo_stream(c,
    "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d workflow",
    timeout=60
)
c.close()
time.sleep(8)

code, out, err = ssh(VM_APP, "docker ps --filter name=aris-workflow --format '{{.Status}}'", timeout=10)
safe_print(f"  Status: {out}")

# ── Check health ──
safe_print("\n=== 4. Health check ===")
code, out, err = ssh(VM_APP, "curl -s http://localhost:3012/health", timeout=10)
safe_print(f"  Health: {out}")

# ── Verify enrichment ──
safe_print("\n=== 5. Verify enrichment ===")
login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'"""
code, out, err = ssh(VM_APP, login_cmd, timeout=10)
login_data = json.loads(out)
token = login_data["data"]["accessToken"]
tid = login_data["data"]["user"]["tenantId"]

code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/validation-chains?limit=5' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=10)

try:
    resp = json.loads(out)
    chains = resp.get("data", [])
    total = resp.get("meta", {}).get("total", 0)
    safe_print(f"  Total chains: {total}")
    for ch in chains[:5]:
        user_info = ch.get("user", {})
        val_info = ch.get("validator", {})
        user_label = f"{user_info.get('displayName', '?')} ({user_info.get('email', '?')})" if user_info else f"[NO ENRICHMENT] {ch.get('userId', '?')[:12]}"
        val_label = f"{val_info.get('displayName', '?')} ({val_info.get('email', '?')})" if val_info else f"[NO ENRICHMENT] {ch.get('validatorId', '?')[:12]}"
        safe_print(f"    {ch.get('levelType', '?'):14s} | {user_label} -> {val_label}")
except Exception as e:
    safe_print(f"  Error: {e}")
    safe_print(f"  Raw: {out[:500]}")

safe_print("\n" + "=" * 60)
safe_print("  Deploy complete!")
safe_print("=" * 60)
