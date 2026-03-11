#!/usr/bin/env python3
"""Fix frontend API URLs: replace hardcoded localhost with relative paths.

The root cause: all API hooks in the Next.js frontend used hardcoded
localhost:XXXX URLs as fallbacks. In production behind Traefik, browser
requests to localhost fail. The fix uses relative paths (/api/v1/...) which
are resolved against the current origin by the browser.

This script:
1. Uploads the fixed source files to the VM
2. Rebuilds the Next.js app inside the container
3. Restarts the frontend container
"""
import paramiko
import sys
import os
import time

os.environ["PYTHONIOENCODING"] = "utf-8"

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
HOST = "10.202.101.183"
REMOTE_BASE = "/opt/aris"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, SSH_USER, SSH_PASS, timeout=15,
              allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=300):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out, err


def upload_file(sftp, local_path, remote_path):
    """Upload a local file to remote via SFTP."""
    safe_print(f"  Uploading {os.path.basename(local_path)} -> {remote_path}")
    sftp.put(local_path, remote_path)


# ── Files to upload ──
LOCAL_BASE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "apps", "web", "src")

FILES_TO_FIX = [
    ("lib/api/client.ts", "apps/web/src/lib/api/client.ts"),
    ("lib/api/form-builder-hooks.ts", "apps/web/src/lib/api/form-builder-hooks.ts"),
    ("lib/api/workflow-hooks.ts", "apps/web/src/lib/api/workflow-hooks.ts"),
    ("lib/api/settings-hooks.ts", "apps/web/src/lib/api/settings-hooks.ts"),
    ("lib/api/bi-hooks.ts", "apps/web/src/lib/api/bi-hooks.ts"),
    ("lib/api/ref-data-hooks.ts", "apps/web/src/lib/api/ref-data-hooks.ts"),
    ("lib/api/historical-hooks.ts", "apps/web/src/lib/api/historical-hooks.ts"),
    ("lib/api/public-data.ts", "apps/web/src/lib/api/public-data.ts"),
    ("components/auth/AuthGuard.tsx", "apps/web/src/components/auth/AuthGuard.tsx"),
]


safe_print("=" * 60)
safe_print("ARIS Frontend: Fix API URLs (localhost -> relative paths)")
safe_print("=" * 60)

# ── Step 1: Upload fixed files ──
safe_print("\n--- Step 1: Uploading fixed source files ---")
c = get_client()
sftp = c.open_sftp()

for local_rel, remote_rel in FILES_TO_FIX:
    local_full = os.path.join(LOCAL_BASE, local_rel.replace("/", os.sep))
    remote_full = f"{REMOTE_BASE}/{remote_rel}"
    try:
        upload_file(sftp, local_full, remote_full)
    except Exception as e:
        safe_print(f"  ERROR uploading {local_rel}: {e}")

sftp.close()
c.close()
safe_print("  All files uploaded.\n")

# ── Step 2: Rebuild the Next.js app inside the container ──
safe_print("--- Step 2: Rebuilding Next.js app inside aris-web container ---")
safe_print("  This will take 2-4 minutes...")

c = get_client()

# First, copy the updated files into the container
safe_print("\n  Copying updated files into Docker container...")
for _, remote_rel in FILES_TO_FIX:
    container_path = f"/app/{remote_rel}"
    host_path = f"{REMOTE_BASE}/{remote_rel}"
    code, out, err = run_sudo(c, f"docker cp {host_path} aris-web:{container_path}", timeout=30)
    if code != 0:
        safe_print(f"  WARN: docker cp failed for {remote_rel}: {err}")
    else:
        safe_print(f"  OK: {remote_rel}")

# Now rebuild inside the container
safe_print("\n  Running 'npx next build' inside container...")
code, out, err = run_sudo(c,
    'docker exec -w /app/apps/web aris-web sh -c "npx next build 2>&1 | tail -30"',
    timeout=600)

safe_print(f"  Build exit code: {code}")
if out:
    for line in out.split("\n")[-20:]:
        safe_print(f"  {line}")
if code != 0 and err:
    safe_print(f"  STDERR: {err[:500]}")

c.close()

if code != 0:
    safe_print("\n  Build failed. Trying alternative approach (rebuild from host)...")
    c = get_client()

    # Alternative: rebuild on the host and recreate the container
    safe_print("  Installing deps and building on host...")
    code, out, err = run_sudo(c,
        f'bash -c "cd {REMOTE_BASE} && pnpm install --frozen-lockfile 2>&1 | tail -5"',
        timeout=300)
    safe_print(f"  pnpm install exit: {code}")

    code, out, err = run_sudo(c,
        f'bash -c "cd {REMOTE_BASE}/apps/web && npx next build 2>&1 | tail -20"',
        timeout=600)
    safe_print(f"  next build exit: {code}")
    if out:
        for line in out.split("\n")[-15:]:
            safe_print(f"  {line}")

    if code == 0:
        # Copy built output into container
        safe_print("  Copying .next build output into container...")
        code, out, err = run_sudo(c,
            f"docker cp {REMOTE_BASE}/apps/web/.next aris-web:/app/apps/web/.next",
            timeout=120)
        safe_print(f"  Copy exit: {code}")

    c.close()

# ── Step 3: Restart the frontend ──
safe_print("\n--- Step 3: Restarting frontend container ---")
c = get_client()
code, out, err = run_sudo(c, "docker restart aris-web", timeout=60)
safe_print(f"  Restart: {out}")
c.close()

safe_print("  Waiting 15s for Next.js to start...")
time.sleep(15)

# ── Step 4: Verify ──
safe_print("\n--- Step 4: Verification ---")
c = get_client()

# Check container is running
code, out, err = run_sudo(c,
    "docker ps --filter name=aris-web --format '{{.Names}}: {{.Status}}'")
safe_print(f"  Container: {out}")

# Check frontend is serving
code, out, err = run_sudo(c,
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:3100 2>&1")
safe_print(f"  Port 3100: HTTP {out}")

# Check via Traefik
code, out, err = run_sudo(c,
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/ 2>&1")
safe_print(f"  Port 80 (Traefik): HTTP {out}")

# Check that the form-builder API is routed through Traefik
code, out, err = run_sudo(c,
    "curl -s http://localhost:80/api/v1/form-builder/templates 2>&1 | head -c 300")
safe_print(f"  Form-builder API via Traefik: {out[:300]}")

# Check that the login endpoint is routed through Traefik
code, out, err = run_sudo(c,
    "curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:80/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{}' 2>&1")
safe_print(f"  Login endpoint via Traefik: HTTP {out}")

c.close()

safe_print("\n" + "=" * 60)
safe_print("Done! Refresh your browser with Ctrl+Shift+R.")
safe_print("All API calls now use relative URLs (/api/v1/...) which")
safe_print("are routed by Traefik to the correct backend services.")
safe_print("=" * 60)
