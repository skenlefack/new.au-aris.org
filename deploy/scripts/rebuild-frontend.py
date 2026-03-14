#!/usr/bin/env python3
"""Rebuild the Next.js frontend on VM-APP host and restart the container.

The aris-web container uses Next.js 'standalone' output which is a minimal
production build. Source files and build tools are NOT inside the container.
We must rebuild on the host and update the container.
"""
import sys
import time

from ssh_config import get_client as _get_client, VM_APP, VM_PASS


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    return _get_client(VM_APP)


def run_sudo(client, cmd, timeout=300):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out, err


def run_sudo_stream(client, cmd, timeout=600):
    """Run command and stream output line by line."""
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    lines = []
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"  {line}")
            lines.append(line)
    code = stdout.channel.recv_exit_status()
    return code, "\n".join(lines)


safe_print("=" * 60)
safe_print("ARIS Frontend: Rebuild & Redeploy")
safe_print("=" * 60)

# ── Step 1: Check the container's internal structure ──
safe_print("\n--- Step 1: Inspect aris-web container structure ---")
c = get_client()
code, out, err = run_sudo(c, "docker exec aris-web ls -la /app/ 2>&1")
safe_print(f"  /app/ contents:\n{out}")

code, out, err = run_sudo(c, "docker exec aris-web ls /app/apps/web/ 2>&1")
safe_print(f"\n  /app/apps/web/ contents: {out}")

# Check how the container starts (what CMD/ENTRYPOINT)
code, out, err = run_sudo(c, "docker inspect aris-web --format='{{.Config.Cmd}}' 2>&1")
safe_print(f"  Container CMD: {out}")
code, out, err = run_sudo(c, "docker inspect aris-web --format='{{.Config.Entrypoint}}' 2>&1")
safe_print(f"  Container Entrypoint: {out}")
code, out, err = run_sudo(c, "docker inspect aris-web --format='{{.Config.WorkingDir}}' 2>&1")
safe_print(f"  Working dir: {out}")
c.close()

# ── Step 2: Check if node/pnpm are available on host ──
safe_print("\n--- Step 2: Check host build tools ---")
c = get_client()
code, out, err = run_sudo(c, "node --version 2>&1")
safe_print(f"  Node.js: {out}")
code, out, err = run_sudo(c, "pnpm --version 2>&1")
safe_print(f"  pnpm: {out}")
code, out, err = run_sudo(c, "ls /opt/aris/apps/web/package.json 2>&1")
safe_print(f"  Source exists: {out}")
c.close()

# ── Step 3: Rebuild on host ──
safe_print("\n--- Step 3: Rebuild Next.js on host ---")
safe_print("  This may take 3-5 minutes...")
c = get_client()

# First ensure dependencies are installed
safe_print("\n  Installing dependencies...")
code, out = run_sudo_stream(c, 'bash -c "cd /opt/aris && pnpm install 2>&1 | tail -10"', timeout=300)
safe_print(f"  pnpm install exit: {code}")

# Build the web app
safe_print("\n  Building Next.js app...")
code, out = run_sudo_stream(c,
    'bash -c "cd /opt/aris && NODE_ENV=production npx turbo run build --filter=web 2>&1 | tail -30"',
    timeout=600)
safe_print(f"\n  Build exit: {code}")

c.close()

if code != 0:
    safe_print("\n  turbo build failed. Trying direct next build...")
    c = get_client()
    code, out = run_sudo_stream(c,
        'bash -c "cd /opt/aris/apps/web && npx next build 2>&1 | tail -30"',
        timeout=600)
    safe_print(f"\n  Direct build exit: {code}")
    c.close()

if code != 0:
    safe_print("\nERROR: Build failed. Cannot continue.")
    sys.exit(1)

# ── Step 4: Update the container ──
safe_print("\n--- Step 4: Update aris-web container with new build ---")
c = get_client()

# Check what format the container uses
code, out, err = run_sudo(c, "docker exec aris-web ls /app/.next/standalone 2>&1")
uses_standalone = code == 0
safe_print(f"  Uses standalone output: {uses_standalone}")

if uses_standalone:
    # Standalone mode: copy the .next directory (which contains server.js etc.)
    safe_print("  Copying .next build to container (standalone mode)...")

    # Stop the container first for clean copy
    code, out, err = run_sudo(c, "docker stop aris-web 2>&1", timeout=30)
    safe_print(f"  Stopped: {out}")

    # Copy the .next directory
    code, out, err = run_sudo(c,
        "docker cp /opt/aris/apps/web/.next aris-web:/app/apps/web/.next 2>&1",
        timeout=120)
    safe_print(f"  Copy .next: exit {code} {out[:200]}")

    # Also copy standalone server files
    code, out, err = run_sudo(c,
        "docker cp /opt/aris/apps/web/.next/standalone/. aris-web:/app/ 2>&1",
        timeout=120)
    safe_print(f"  Copy standalone: exit {code} {out[:200]}")

    # Copy static files
    code, out, err = run_sudo(c,
        "docker cp /opt/aris/apps/web/.next/static aris-web:/app/apps/web/.next/static 2>&1",
        timeout=60)
    safe_print(f"  Copy static: exit {code}")

    # Copy public folder if it exists
    code, out, err = run_sudo(c,
        "docker cp /opt/aris/apps/web/public aris-web:/app/apps/web/public 2>&1",
        timeout=60)
    safe_print(f"  Copy public: exit {code}")

    # Start the container again
    code, out, err = run_sudo(c, "docker start aris-web 2>&1", timeout=30)
    safe_print(f"  Started: {out}")
else:
    # Non-standalone: just copy .next and restart
    safe_print("  Copying .next build to container (standard mode)...")
    code, out, err = run_sudo(c,
        "docker cp /opt/aris/apps/web/.next aris-web:/app/apps/web/.next 2>&1",
        timeout=120)
    safe_print(f"  Copy: exit {code}")

    code, out, err = run_sudo(c, "docker restart aris-web 2>&1", timeout=60)
    safe_print(f"  Restart: {out}")

c.close()

safe_print("\n  Waiting 20s for Next.js to start...")
time.sleep(20)

# ── Step 5: Verify ──
safe_print("\n--- Step 5: Verification ---")
c = get_client()

code, out, err = run_sudo(c,
    "docker ps --filter name=aris-web --format '{{.Names}}: {{.Status}}'")
safe_print(f"  Container: {out}")

code, out, err = run_sudo(c,
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:3100 2>&1")
safe_print(f"  Port 3100: HTTP {out}")

code, out, err = run_sudo(c,
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/ 2>&1")
safe_print(f"  Port 80 (Traefik): HTTP {out}")

# Check form-builder through Traefik
code, out, err = run_sudo(c,
    "curl -s http://localhost:80/api/v1/form-builder/templates 2>&1 | head -c 200")
safe_print(f"  /api/v1/form-builder/templates: {out[:200]}")

c.close()

safe_print("\n" + "=" * 60)
safe_print("Done! Refresh browser with Ctrl+Shift+R (hard refresh).")
safe_print("=" * 60)
