#!/usr/bin/env python3
"""Fix Traefik Docker API version mismatch and recreate container."""
import paramiko
import sys
import os
import time

os.environ["PYTHONIOENCODING"] = "utf-8"

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
HOST = "10.202.101.183"


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


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


def run_sudo_stream(client, cmd, timeout=120):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"  {line}")
    code = stdout.channel.recv_exit_status()
    return code


safe_print("=" * 60)
safe_print("  Fix Traefik Docker API Version")
safe_print("=" * 60)

c = get_client()

# 1. Check Docker Engine version
safe_print("\n=== 1. Docker Engine info ===")
code, out = run_sudo(c, "docker version --format '{{.Server.APIVersion}}' 2>/dev/null")
safe_print(f"  Server API version: {out}")
code, out = run_sudo(c, "docker version --format '{{.Server.Version}}' 2>/dev/null")
safe_print(f"  Docker version:     {out}")

# 2. Check current Traefik image
safe_print("\n=== 2. Current Traefik image ===")
code, out = run_sudo(c, "docker inspect aris-traefik --format '{{.Config.Image}}' 2>/dev/null")
safe_print(f"  Image: {out}")
code, out = run_sudo(c, "docker inspect aris-traefik --format '{{json .Config.Env}}' 2>/dev/null")
safe_print(f"  Env: {out[:300]}")
c.close()

# 3. Add DOCKER_API_VERSION to Traefik in compose and pull latest
safe_print("\n=== 3. Fixing docker-compose.yml on VM ===")
c = get_client()
# Use sed to add DOCKER_API_VERSION env var to Traefik service
# We need to add an environment section with DOCKER_API_VERSION=1.45
# In the compose, traefik uses <<: *service-common which may have environment
# Simplest: use docker run directly or patch the compose

# First, let's check if traefik section already has environment
code, out = run_sudo(c, "grep -A 30 'aris-traefik' /opt/aris-deploy/vm-app/docker-compose.yml | head -35")
safe_print(f"  Current traefik config:\n{out}")
c.close()

# 4. Add environment variable via sed
safe_print("\n=== 4. Adding DOCKER_API_VERSION to Traefik ===")
c = get_client()
# Add environment section after the healthcheck block of traefik
# Strategy: add DOCKER_API_VERSION=1.45 as env var
# Use sed to add it after the 'image: traefik:v3.3' line
code, out = run_sudo(c, r"""bash -c 'grep -q "DOCKER_API_VERSION" /opt/aris-deploy/vm-app/docker-compose.yml && echo "ALREADY_SET" || echo "NOT_SET"'""")
safe_print(f"  DOCKER_API_VERSION in compose: {out}")

if "NOT_SET" in out:
    # Add environment section to traefik service - insert after "image: traefik:v3.3"
    # We'll use sed to insert an environment block
    code, out = run_sudo(c, r"""sed -i '/image: traefik:v3.3/a\    environment:\n      DOCKER_API_VERSION: "1.45"' /opt/aris-deploy/vm-app/docker-compose.yml""")
    safe_print(f"  sed exit: {code}")

    # Verify
    code, out = run_sudo(c, "grep -A 5 'traefik:v3.3' /opt/aris-deploy/vm-app/docker-compose.yml")
    safe_print(f"  After fix:\n{out}")
c.close()

# 5. Pull latest traefik:v3.3 and recreate
safe_print("\n=== 5. Pulling traefik:v3.3 and recreating ===")
c = get_client()
code, out = run_sudo(c, "bash -c 'cd /opt/aris-deploy/vm-app && set -a && source /opt/aris-deploy/.env.production 2>/dev/null && set +a && docker compose pull traefik 2>&1'", timeout=120)
safe_print(f"  Pull: {out[:300]}")
c.close()

c = get_client()
code, out = run_sudo(c, "bash -c 'cd /opt/aris-deploy/vm-app && set -a && source /opt/aris-deploy/.env.production 2>/dev/null && set +a && docker compose up -d --force-recreate traefik 2>&1'", timeout=60)
safe_print(f"  Recreate: {out[:300]}")
c.close()

safe_print("  Waiting 10s for Traefik to start...")
time.sleep(10)

# 6. Check Traefik logs
safe_print("\n=== 6. Traefik logs (after fix) ===")
c = get_client()
code, out = run_sudo(c, "docker logs aris-traefik --tail 15 2>&1")
for line in out.splitlines()[-10:]:
    safe_print(f"  {line}")

# 7. Check routers
safe_print("\n=== 7. Traefik routers ===")
code, out = run_sudo(c, "curl -s http://localhost:8090/api/http/routers 2>&1 | head -c 500")
# Count routers
router_count = out.count('"name"')
safe_print(f"  Router count: {router_count}")
safe_print(f"  Sample: {out[:300]}")

# 8. Test port 80
safe_print("\n=== 8. Test http://localhost:80/ ===")
code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/ 2>&1")
safe_print(f"  Status: {out}")
code, out = run_sudo(c, "curl -s http://localhost:80/ 2>&1 | head -c 200")
safe_print(f"  Body: {out[:200]}")

# 9. Test API gateway
safe_print("\n=== 9. Test API gateway ===")
code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/api/v1/credential/health 2>&1")
safe_print(f"  /api/v1/credential/health: {out}")
code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/api/v1/tenants/health 2>&1")
safe_print(f"  /api/v1/tenants/health: {out}")

c.close()
safe_print("\n=== Done ===")
