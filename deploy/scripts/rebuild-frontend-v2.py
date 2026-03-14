#!/usr/bin/env python3
"""Rebuild the Next.js frontend on VM-APP — v2.

Approach: Build directly with `npx next build` in the web app directory,
then copy the standalone output into the container.
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
safe_print("ARIS Frontend: Rebuild & Redeploy (v2)")
safe_print("=" * 60)

# ── Step 1: Check package name and workspace ──
safe_print("\n--- Step 1: Check workspace ---")
c = get_client()
code, out, err = run_sudo(c, 'cat /opt/aris/apps/web/package.json | head -5')
safe_print(f"  web package.json:\n{out}")
code, out, err = run_sudo(c, 'cat /opt/aris/package.json | head -5')
safe_print(f"  root package.json:\n{out}")

# Check current container internal structure
safe_print("\n  Current container structure:")
code, out, err = run_sudo(c, 'docker exec aris-web find /app -maxdepth 4 -name "*.js" -o -name ".next" | head -30')
safe_print(f"{out}")
c.close()

# ── Step 2: Build on host ──
safe_print("\n--- Step 2: Build Next.js on host ---")
safe_print("  Running 'npx next build' directly...")
c = get_client()

# Build with correct env vars
code, out = run_sudo_stream(c,
    'bash -c "cd /opt/aris/apps/web && NODE_ENV=production npx next build 2>&1"',
    timeout=600)
safe_print(f"\n  Build exit: {code}")
c.close()

if code != 0:
    safe_print("  ERROR: Build failed!")
    safe_print("  Trying to check what went wrong...")
    c = get_client()
    code, out, err = run_sudo(c, 'ls -la /opt/aris/apps/web/node_modules/.bin/next 2>&1')
    safe_print(f"  next binary: {out}")
    code, out, err = run_sudo(c, 'ls /opt/aris/apps/web/node_modules/next/package.json 2>&1')
    safe_print(f"  next package: {out}")

    # Maybe we need to install first
    safe_print("  Running pnpm install first...")
    code2, out2 = run_sudo_stream(c,
        'bash -c "cd /opt/aris && pnpm install --no-frozen-lockfile 2>&1 | tail -20"',
        timeout=300)
    safe_print(f"  pnpm install exit: {code2}")

    # Try build again
    safe_print("\n  Retrying build...")
    code, out = run_sudo_stream(c,
        'bash -c "cd /opt/aris/apps/web && npx next build 2>&1"',
        timeout=600)
    safe_print(f"\n  Retry build exit: {code}")
    c.close()

    if code != 0:
        safe_print("\nFATAL: Build failed after retry. Exiting.")
        sys.exit(1)

# ── Step 3: Check build output ──
safe_print("\n--- Step 3: Check build output ---")
c = get_client()
code, out, err = run_sudo(c, 'ls -la /opt/aris/apps/web/.next/standalone/ 2>&1')
safe_print(f"  Standalone output: {out[:500]}")
code, out, err = run_sudo(c, 'ls /opt/aris/apps/web/.next/standalone/apps/web/ 2>&1')
safe_print(f"  Standalone web: {out}")
code, out, err = run_sudo(c, 'ls -la /opt/aris/apps/web/.next/static/ 2>&1')
safe_print(f"  Static files: {out[:300]}")
c.close()

# ── Step 4: Update container ──
safe_print("\n--- Step 4: Stop container and update files ---")
c = get_client()

# Stop
code, out, err = run_sudo(c, "docker stop aris-web 2>&1", timeout=30)
safe_print(f"  Stopped: {out}")

# The container structure should be /app/apps/web/server.js
# The standalone build creates .next/standalone/ which mirrors the monorepo structure
# We need to copy the right files

# Copy the new server.js (standalone output)
safe_print("\n  Copying standalone server.js...")
code, out, err = run_sudo(c,
    "docker cp /opt/aris/apps/web/.next/standalone/apps/web/server.js aris-web:/app/apps/web/server.js 2>&1",
    timeout=60)
safe_print(f"  server.js: exit {code} {err[:200] if code != 0 else 'OK'}")

# Copy the .next directory with compiled chunks
safe_print("  Copying .next directory...")
code, out, err = run_sudo(c,
    "docker cp /opt/aris/apps/web/.next/standalone/apps/web/.next aris-web:/app/apps/web/.next 2>&1",
    timeout=120)
safe_print(f"  .next: exit {code} {err[:200] if code != 0 else 'OK'}")

# Copy static files into .next/static
safe_print("  Copying static files...")
code, out, err = run_sudo(c,
    "docker cp /opt/aris/apps/web/.next/static aris-web:/app/apps/web/.next/static 2>&1",
    timeout=60)
safe_print(f"  static: exit {code} {err[:200] if code != 0 else 'OK'}")

# Copy node_modules from standalone (minimal)
safe_print("  Copying standalone node_modules...")
code, out, err = run_sudo(c,
    "docker cp /opt/aris/apps/web/.next/standalone/node_modules aris-web:/app/node_modules 2>&1",
    timeout=120)
safe_print(f"  node_modules: exit {code} {err[:200] if code != 0 else 'OK'}")

# Also copy public folder
safe_print("  Copying public folder...")
code, out, err = run_sudo(c,
    "docker cp /opt/aris/apps/web/public aris-web:/app/apps/web/public 2>&1",
    timeout=60)
safe_print(f"  public: exit {code} {err[:200] if code != 0 else 'OK'}")

# Start
safe_print("\n  Starting container...")
code, out, err = run_sudo(c, "docker start aris-web 2>&1", timeout=30)
safe_print(f"  Started: {out}")
c.close()

safe_print("  Waiting 20s for Next.js to start...")
time.sleep(20)

# ── Step 5: Verify ──
safe_print("\n--- Step 5: Verification ---")
c = get_client()

code, out, err = run_sudo(c,
    "docker ps --filter name=aris-web --format '{{.Names}}: {{.Status}}'")
safe_print(f"  Container: {out}")

# Check if it's crashed
code, out, err = run_sudo(c, "docker logs aris-web --tail 10 2>&1")
safe_print(f"  Last 10 log lines:\n{out}")

code, out, err = run_sudo(c,
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:3100 2>&1")
safe_print(f"\n  Port 3100: HTTP {out}")

code, out, err = run_sudo(c,
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/ 2>&1")
safe_print(f"  Port 80: HTTP {out}")

c.close()

safe_print("\n" + "=" * 60)
safe_print("Done! Refresh browser with Ctrl+Shift+R.")
safe_print("=" * 60)
