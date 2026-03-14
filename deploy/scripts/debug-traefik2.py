#!/usr/bin/env python3
"""Debug Traefik routing - part 2."""
import sys
from ssh_config import get_client, VM_APP, VM_PASS


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def run_sudo(client, cmd, timeout=15):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(VM_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


c = get_client(VM_APP)

# 1. Check Traefik API raw output
safe_print("=== 1. Traefik API raw routers ===")
code, out = run_sudo(c, "curl -s http://localhost:8090/api/http/routers 2>&1 | head -c 2000")
safe_print(f"  {out[:2000] if out else 'EMPTY'}")

# 2. Check Traefik logs
safe_print("\n=== 2. Traefik logs (last 30 lines) ===")
code, out = run_sudo(c, "docker logs aris-traefik --tail 30 2>&1")
for line in out.splitlines():
    safe_print(f"  {line}")

# 3. Check if docker socket is accessible from Traefik
safe_print("\n=== 3. Traefik container docker socket ===")
code, out = run_sudo(c, "docker exec aris-traefik ls -la /var/run/docker.sock 2>&1")
safe_print(f"  {out}")

# 4. Check if Traefik and web are on the same network
safe_print("\n=== 4. Traefik network ===")
code, out = run_sudo(c, "docker inspect aris-traefik --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}: {{$v.IPAddress}}  {{end}}' 2>/dev/null")
safe_print(f"  Traefik: {out}")
code, out = run_sudo(c, "docker inspect aris-web --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}: {{$v.IPAddress}}  {{end}}' 2>/dev/null")
safe_print(f"  Web:     {out}")

# 5. Check compose file on VM for web labels
safe_print("\n=== 5. Compose file web labels on VM ===")
code, out = run_sudo(c, "grep -A 20 'container_name: aris-web' /opt/aris-deploy/vm-app/docker-compose.yml 2>/dev/null")
safe_print(f"  {out[:600]}")

# 6. Check credential container labels (it should have traefik labels too)
safe_print("\n=== 6. Credential container labels (traefik) ===")
code, out = run_sudo(c, """docker inspect aris-credential --format '{{range $k,$v := .Config.Labels}}{{$k}}={{$v}}
{{end}}' 2>/dev/null | grep traefik""")
safe_print(f"  {out[:500] if out else 'NO TRAEFIK LABELS'}")

# 7. Check Traefik provider configuration
safe_print("\n=== 7. Traefik provider config ===")
code, out = run_sudo(c, "curl -s http://localhost:8090/api/overview 2>&1 | head -c 500")
safe_print(f"  {out[:500]}")

c.close()
safe_print("\n=== Done ===")
