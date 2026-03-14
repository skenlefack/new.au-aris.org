#!/usr/bin/env python3
"""Quick diagnostic script for VM-APP."""
import sys
from ssh_config import ssh, VM_APP

cmds = sys.argv[1] if len(sys.argv) > 1 else "status"

if cmds == "status":
    print("=== DOCKER CONTAINERS ===")
    _, o, _ = ssh(VM_APP, "docker ps -a --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>&1")
    print(o)

    print("=== TRAEFIK LOGS (last 30) ===")
    _, o, _ = ssh(VM_APP, "docker logs aris-traefik --tail 30 2>&1 || echo NO_TRAEFIK_CONTAINER")
    print(o)

    print("=== WEB LOGS (last 20) ===")
    _, o, _ = ssh(VM_APP, "docker logs aris-web --tail 20 2>&1 || echo NO_WEB_CONTAINER")
    print(o)

    print("=== CURL localhost ===")
    _, o, _ = ssh(VM_APP, "curl -s -o /dev/null -w '%{http_code} %{redirect_url}' http://localhost/ 2>&1")
    print(f"  Response: {o}")

    print("=== CURL localhost:3000 (web direct) ===")
    _, o, _ = ssh(VM_APP, "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>&1")
    print(f"  Response: {o}")

    print("=== TRAEFIK CONFIG ===")
    _, o, _ = ssh(VM_APP, "cat /opt/aris-deploy/vm-app/docker-compose.yml 2>/dev/null | grep -A5 'traefik' | head -30 || echo 'No compose found'")
    print(o)

elif cmds == "exec":
    cmd = sys.argv[2]
    _, o, e = ssh(VM_APP, cmd, timeout=120)
    print(o)
    if e.strip(): print("STDERR:", e[-500:])
