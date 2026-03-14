#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy URL fix for dynamic domains.
Fixes: settings-hooks.ts (client-side URL) + public-data.ts (server-side URL)
"""
import sys
import os
import time

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
safe_print("  ARIS 4.0 — Deploy URL Fix")
safe_print("=" * 60)

repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# Files to deploy
web_files = {
    "apps/web/src/lib/api/settings-hooks.ts": "/opt/aris/apps/web/src/lib/api/settings-hooks.ts",
    "apps/web/src/lib/api/public-data.ts": "/opt/aris/apps/web/src/lib/api/public-data.ts",
}

safe_print("\n=== A. Uploading fixed source files ===")
for rel_path, dest in web_files.items():
    local = os.path.join(repo, rel_path.replace("/", os.sep))
    tmp = f"/tmp/aris-web-{os.path.basename(local)}"
    upload_file(local, tmp)
    code, out, err = ssh(VM_APP, f'cp "{tmp}" "{dest}" && rm -f "{tmp}"', timeout=10)
    safe_print(f"  {os.path.basename(local)}: {'OK' if code == 0 else 'FAILED'}")
    if code != 0 and err:
        safe_print(f"    ERR: {err[:200]}")

safe_print("\n=== B. Rebuilding web Docker image ===")
c = get_client(VM_APP)
code, err = run_sudo_stream(c,
    "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml build --no-cache web",
    timeout=600
)
safe_print(f"  Build: {'OK' if code == 0 else f'FAILED ({code})'}")
c.close()

safe_print("\n=== C. Restarting web container ===")
c = get_client(VM_APP)
code, err = run_sudo_stream(c,
    "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d web",
    timeout=60
)
c.close()
time.sleep(8)

# Verify
code, out, err = ssh(VM_APP, "docker ps --filter name=aris-web --format '{{.Status}}'", timeout=10)
safe_print(f"  aris-web status: {out}")

# Test: verify server-side fetch works (from inside web container)
safe_print("\n=== D. Verify: web container can reach tenant service ===")
code, out, err = ssh(VM_APP, "docker exec aris-web wget -qO- http://aris-tenant:3001/api/v1/public/domains 2>&1 | head -200", timeout=10)
safe_print(f"  Internal fetch: {out[:300] if out else 'EMPTY'}")
if err:
    safe_print(f"  Err: {err[:200]}")

# Test: verify the compiled JS has the right URL
safe_print("\n=== E. Verify: compiled JS URL resolution ===")
code, out, err = ssh(VM_APP, r"""docker exec aris-web grep -roh 'NEXT_PUBLIC_TENANT_API_URL[^,)]*' /app/apps/web/.next/server/chunks/ 2>/dev/null | head -5""", timeout=15)
safe_print(f"  Server chunks TENANT_API: {out[:300] if out else 'NONE'}")

code, out, err = ssh(VM_APP, r"""docker exec aris-web grep -roh 'aris-tenant[^"]*' /app/apps/web/.next/server/ 2>/dev/null | sort -u | head -5""", timeout=15)
safe_print(f"  Internal URL in server: {out[:300] if out else 'NONE'}")

safe_print("\n" + "=" * 60)
safe_print("  Deploy complete!")
safe_print("=" * 60)
