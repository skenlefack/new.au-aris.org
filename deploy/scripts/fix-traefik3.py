#!/usr/bin/env python3
"""Fix Traefik: force remove + start latest (v3.6.10)."""
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


def run_sudo(client, cmd, timeout=60):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


safe_print("=" * 60)
safe_print("  Fix Traefik — force recreate with latest")
safe_print("=" * 60)

# 1. Force remove old container
safe_print("\n=== 1. Force remove old container ===")
c = get_client()
code, out = run_sudo(c, "docker rm -f aris-traefik 2>&1")
safe_print(f"  rm -f: {out}")
c.close()

# 2. Run traefik:latest (v3.6.10) with DOCKER_API_VERSION
safe_print("\n=== 2. Start traefik:latest (v3.6.10) ===")
c = get_client()
code, out = run_sudo(c, """docker run -d \
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
  --ping=true 2>&1""")
safe_print(f"  Container ID: {out[:80]}")
c.close()

safe_print("  Waiting 8s for startup...")
time.sleep(8)

# 3. Check logs
safe_print("\n=== 3. Traefik logs ===")
c = get_client()
code, out = run_sudo(c, "docker logs aris-traefik 2>&1 | tail -15")
has_api_error = "client version" in out
for line in out.splitlines():
    safe_print(f"  {line}")

if has_api_error:
    safe_print("\n  Docker API error still present.")
else:
    safe_print("\n  No Docker API errors!")

# 4. Check routers discovered
safe_print("\n=== 4. Traefik routers ===")
code, out = run_sudo(c, "curl -s http://localhost:8090/api/http/routers 2>&1 | head -c 1500")
router_count = out.count('"name"')
safe_print(f"  Router count: {router_count}")
if router_count > 3:
    safe_print("  Docker provider is working!")

# 5. Test
safe_print("\n=== 5. Test routing ===")
code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/ 2>&1")
safe_print(f"  / -> {out}")
code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/api/v1/credential/health 2>&1")
safe_print(f"  /api/v1/credential/health -> {out}")
code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/api/v1/tenants/health 2>&1")
safe_print(f"  /api/v1/tenants/health -> {out}")

c.close()
safe_print("\n=== Done ===")
