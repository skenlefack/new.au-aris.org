#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy Dynamic Domains (sidebar + landing page)
Files: lucide-icon-map.ts, Sidebar.tsx, ContinentalStats.tsx, HeroSection.tsx, page.tsx, public-data.ts
Strategy: copy source to /opt/aris + rebuild web Docker image
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
safe_print("  ARIS 4.0 — Deploy Dynamic Domains")
safe_print("=" * 60)

repo = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# ─────────────────────────────────────────────────────
# Web source files to deploy
# ─────────────────────────────────────────────────────
web_files = {
    "apps/web/src/lib/lucide-icon-map.ts": "/opt/aris/apps/web/src/lib/lucide-icon-map.ts",
    "apps/web/src/components/layout/Sidebar.tsx": "/opt/aris/apps/web/src/components/layout/Sidebar.tsx",
    "apps/web/src/components/landing/ContinentalStats.tsx": "/opt/aris/apps/web/src/components/landing/ContinentalStats.tsx",
    "apps/web/src/components/landing/HeroSection.tsx": "/opt/aris/apps/web/src/components/landing/HeroSection.tsx",
    "apps/web/src/app/(public)/page.tsx": "/opt/aris/apps/web/src/app/(public)/page.tsx",
}

safe_print("\n=== A. Uploading web source files ===")
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
time.sleep(5)

code, out, err = ssh(VM_APP, "docker ps --filter name=aris-web --format '{{.Status}}'", timeout=10)
safe_print(f"  aris-web status: {out}")

safe_print("\n" + "=" * 60)
safe_print("  Deploy complete!")
safe_print("=" * 60)
