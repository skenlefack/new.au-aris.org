#!/usr/bin/env python3
"""Debug Traefik routing to frontend."""
import paramiko
import sys
import os

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


def run_sudo(client, cmd, timeout=15):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


c = get_client()

# 1. Check web container status and logs
safe_print("=== 1. Web container status ===")
code, out = run_sudo(c, "docker ps --filter name=aris-web --format '{{.Names}}: {{.Status}} {{.Ports}}' 2>/dev/null")
safe_print(f"  {out}")

# 2. Check what port web container listens on
safe_print("\n=== 2. Web container exposed ports ===")
code, out = run_sudo(c, "docker inspect aris-web --format '{{json .Config.ExposedPorts}}' 2>/dev/null")
safe_print(f"  Exposed: {out}")
code, out = run_sudo(c, "docker inspect aris-web --format '{{json .NetworkSettings.Ports}}' 2>/dev/null")
safe_print(f"  Ports: {out}")

# 3. Check web container network
safe_print("\n=== 3. Web container network ===")
code, out = run_sudo(c, "docker inspect aris-web --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}: {{$v.IPAddress}}{{end}}' 2>/dev/null")
safe_print(f"  Networks: {out}")

# 4. Check if web responds on port 3000 from inside the container
safe_print("\n=== 4. Web internal port check ===")
code, out = run_sudo(c, "docker exec aris-web curl -sf -o /dev/null -w '%{http_code}' http://localhost:3000 2>&1", timeout=10)
safe_print(f"  Port 3000 from inside: {out}")
code, out = run_sudo(c, "docker exec aris-web curl -sf -o /dev/null -w '%{http_code}' http://localhost:3100 2>&1", timeout=10)
safe_print(f"  Port 3100 from inside: {out}")

# 5. Check Traefik routing table
safe_print("\n=== 5. Traefik routers (via API) ===")
code, out = run_sudo(c, "curl -s http://localhost:8090/api/http/routers 2>&1 | python3 -m json.tool 2>/dev/null | head -80")
safe_print(f"  {out[:2000]}")

# 6. Check Traefik services
safe_print("\n=== 6. Traefik services (via API) ===")
code, out = run_sudo(c, "curl -s http://localhost:8090/api/http/services 2>&1 | python3 -m json.tool 2>/dev/null | head -40")
safe_print(f"  {out[:1500]}")

# 7. Check web container labels
safe_print("\n=== 7. Web container labels ===")
code, out = run_sudo(c, "docker inspect aris-web --format '{{json .Config.Labels}}' 2>/dev/null")
safe_print(f"  {out[:500]}")

# 8. Recent web container logs
safe_print("\n=== 8. Web container logs (last 20 lines) ===")
code, out = run_sudo(c, "docker logs aris-web --tail 20 2>&1")
safe_print(f"  {out[:1000]}")

# 9. Test access via port 80 (Traefik)
safe_print("\n=== 9. Direct Traefik test ===")
code, out = run_sudo(c, "curl -s -o /dev/null -w '%{http_code}' http://localhost:80/ 2>&1")
safe_print(f"  Port 80 /: {out}")
code, out = run_sudo(c, "curl -s http://localhost:80/ 2>&1 | head -5")
safe_print(f"  Response: {out[:300]}")

c.close()
safe_print("\n=== Done ===")
