#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy Domain CRUD (create/update/delete) changes.
1. Tenant service: schemas + service + routes → docker cp + restart
2. Web app: page + hooks → git-free file copy to /opt/aris + rebuild Docker image
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
    """Upload a local file to the production server via SFTP."""
    c = get_client(VM_APP)
    sftp = c.open_sftp()
    sftp.put(local_path, remote_path, confirm=False)
    sftp.close()
    c.close()


def docker_cp(tmp_path, container, container_path):
    """docker cp a file into a container."""
    code, out, err = ssh(VM_APP, f'docker cp "{tmp_path}" "{container}:{container_path}"', timeout=15)
    return code == 0


safe_print("=" * 60)
safe_print("  ARIS 4.0 — Deploy Domain CRUD")
safe_print("=" * 60)

repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ─────────────────────────────────────────────────────
# PART A: Tenant Service (hot-reload via docker cp + restart)
# ─────────────────────────────────────────────────────
safe_print("\n=== A. Updating tenant service (docker cp) ===")

tenant_files = {
    "services/tenant/src/schemas/settings.schemas.ts": "/app/services/tenant/src/schemas/settings.schemas.ts",
    "services/tenant/src/services/settings.service.ts": "/app/services/tenant/src/services/settings.service.ts",
    "services/tenant/src/routes/settings.routes.ts": "/app/services/tenant/src/routes/settings.routes.ts",
}

for rel_path, dest in tenant_files.items():
    local = os.path.join(repo, rel_path.replace("/", os.sep))
    tmp = f"/tmp/aris-{os.path.basename(local)}"
    upload_file(local, tmp)
    ok = docker_cp(tmp, "aris-tenant", dest)
    # cleanup
    ssh(VM_APP, f"rm -f {tmp}", timeout=5)
    safe_print(f"  {os.path.basename(local)}: {'OK' if ok else 'FAILED'}")

safe_print("\n  Restarting aris-tenant...")
code, out, err = ssh(VM_APP, "docker restart aris-tenant", timeout=30)
safe_print(f"  Restart: {'OK' if code == 0 else 'FAILED'}")
time.sleep(8)

# ─────────────────────────────────────────────────────
# PART B: Web App (copy source to /opt/aris + rebuild image)
# ─────────────────────────────────────────────────────
safe_print("\n=== B. Updating web app source on host ===")

web_files = {
    "apps/web/src/lib/api/settings-hooks.ts": "/opt/aris/apps/web/src/lib/api/settings-hooks.ts",
    "apps/web/src/app/(dashboard)/settings/domains/page.tsx": "/opt/aris/apps/web/src/app/(dashboard)/settings/domains/page.tsx",
}

for rel_path, dest in web_files.items():
    local = os.path.join(repo, rel_path.replace("/", os.sep))
    tmp = f"/tmp/aris-web-{os.path.basename(local)}"
    upload_file(local, tmp)
    # Use shell quoting to handle parentheses
    code, out, err = ssh(VM_APP, f'cp "{tmp}" "{dest}" && rm -f "{tmp}"', timeout=10)
    safe_print(f"  {os.path.basename(local)}: {'OK' if code == 0 else 'FAILED'}")
    if code != 0 and err:
        safe_print(f"    ERR: {err[:200]}")

safe_print("\n=== C. Rebuilding web Docker image ===")
c = get_client(VM_APP)
code, err = run_sudo_stream(c,
    "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml build --no-cache web",
    timeout=600
)
safe_print(f"  Build: {'OK' if code == 0 else f'FAILED ({code})'}")
c.close()

safe_print("\n=== D. Restarting web container ===")
c = get_client(VM_APP)
code, err = run_sudo_stream(c,
    "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d web",
    timeout=60
)
c.close()
time.sleep(5)

code, out, err = ssh(VM_APP, "docker ps --filter name=aris-web --format '{{.Status}}'", timeout=10)
safe_print(f"  aris-web status: {out}")

safe_print("\n" + "=" * 60)
safe_print("  Deploy complete!")
safe_print("=" * 60)
