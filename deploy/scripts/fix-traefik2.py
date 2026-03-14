#!/usr/bin/env python3
"""Fix Traefik: verify env, try latest image."""
import sys
import time
from ssh_config import get_client, VM_APP, VM_PASS


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def run_sudo(client, cmd, timeout=60):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(VM_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


safe_print("=" * 60)
safe_print("  Fix Traefik — Docker API version")
safe_print("=" * 60)

c = get_client(VM_APP)

# 1. Check if DOCKER_API_VERSION is actually in the container
safe_print("\n=== 1. Check env in running container ===")
code, out = run_sudo(c, "docker inspect aris-traefik --format '{{json .Config.Env}}' 2>/dev/null")
safe_print(f"  Env: {out}")

# 2. The env var might not be passed due to YAML structure issue.
# Let's fix the compose properly by rewriting the Traefik section
safe_print("\n=== 2. Check current compose Traefik section ===")
code, out = run_sudo(c, "head -80 /opt/aris-deploy/vm-app/docker-compose.yml")
safe_print(f"  First 80 lines:\n{out}")
c.close()

# 3. Use sed to properly add the env var. The issue is that
# <<: *service-common may override the environment key.
# Let's use a different approach: pass it via docker run or
# add DOCKER_API_VERSION to the command line
safe_print("\n=== 3. Fixing: use traefik:latest + env via docker compose ===")
c = get_client(VM_APP)

# First revert the broken sed and use a clean approach:
# Replace the traefik image line to use latest, and add DOCKER_API_VERSION
# via the docker compose command
code, out = run_sudo(c, r"""sed -i 's/image: traefik:v3.3/image: traefik:latest/' /opt/aris-deploy/vm-app/docker-compose.yml""")
safe_print(f"  Change to traefik:latest: exit {code}")

# Also check if the previous sed broke the environment section
# Clean up: remove the broken environment block that was inserted wrongly
code, out = run_sudo(c, r"""sed -i '/^    environment:/{N;/DOCKER_API_VERSION/d}' /opt/aris-deploy/vm-app/docker-compose.yml""")

# Verify
code, out = run_sudo(c, "grep -B2 -A15 'traefik:' /opt/aris-deploy/vm-app/docker-compose.yml | head -20")
safe_print(f"  Traefik section:\n{out}")
c.close()

# 4. Pull latest and recreate with explicit env
safe_print("\n=== 4. Pull traefik:latest ===")
c = get_client(VM_APP)
code, out = run_sudo(c, "docker pull traefik:latest 2>&1", timeout=120)
safe_print(f"  Pull: {out[:500]}")
c.close()

# 5. Check the version of traefik:latest
safe_print("\n=== 5. traefik:latest version ===")
c = get_client(VM_APP)
code, out = run_sudo(c, "docker run --rm traefik:latest version 2>&1")
safe_print(f"  {out}")
c.close()

# 6. Recreate with DOCKER_API_VERSION env var passed directly
safe_print("\n=== 6. Recreate Traefik ===")
c = get_client(VM_APP)
# Stop existing
code, out = run_sudo(c, "docker stop aris-traefik && docker rm aris-traefik 2>&1")
safe_print(f"  Stop/rm: {out[:200]}")

# Run directly with the env var
code, out = run_sudo(c, """bash -c 'docker run -d \
  --name aris-traefik \
  --restart unless-stopped \
  --network aris-app-network \
  -e DOCKER_API_VERSION=1.45 \
  -p 80:80 \
  -p 443:443 \
  -p 8090:8080 \
  -v /var/run/docker.sock:/var/run/docker.sock:ro \
  traefik:latest \
  --api.insecure=true \
  --api.dashboard=true \
  --providers.docker=true \
  --providers.docker.exposedbydefault=false \
  --providers.docker.network=aris-app-network \
  --entrypoints.web.address=:80 \
  --entrypoints.websecure.address=:443 \
  --log.level=INFO \
  --accesslog=true \
  --accesslog.format=json \
  --ping=true 2>&1'""")
safe_print(f"  Run: {out[:300]}")
c.close()

safe_print("  Waiting 10s...")
time.sleep(10)

# 7. Check logs
safe_print("\n=== 7. Traefik logs ===")
c = get_client(VM_APP)
code, out = run_sudo(c, "docker logs aris-traefik --tail 20 2>&1")
# Check for errors
has_errors = "client version" in out
for line in out.splitlines()[-15:]:
    safe_print(f"  {line}")

if has_errors:
    safe_print("\n  STILL FAILING! Docker API version issue persists.")
else:
    safe_print("\n  No Docker API errors!")

# 8. Check routers
safe_print("\n=== 8. Traefik routers ===")
code, out = run_sudo(c, "curl -s http://localhost:8090/api/http/routers 2>&1 | head -c 1000")
router_count = out.count('"name"')
safe_print(f"  Router count: {router_count}")

# 9. Test port 80
safe_print("\n=== 9. Test http://localhost:80/ ===")
code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/ 2>&1")
safe_print(f"  Status: {out}")

# Test API
code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/api/v1/credential/health 2>&1")
safe_print(f"  /api/v1/credential/health: {out}")

c.close()
safe_print("\n=== Done ===")
