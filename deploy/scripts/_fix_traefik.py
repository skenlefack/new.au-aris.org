#!/usr/bin/env python3
"""Fix Traefik routing: add HTTP entrypoint for web, fix file provider."""
import json
from ssh_config import ssh, VM_APP

# Step 1: Check Traefik mounts
print("=== Step 1: Checking Traefik mounts ===")
code, out, _ = ssh(VM_APP, "docker inspect aris-traefik --format json 2>&1")
try:
    info = json.loads(out)
    mounts = info[0].get("Mounts", [])
    for m in mounts:
        print(f"  {m.get('Source', '?')} -> {m.get('Destination', '?')}")
except:
    print(f"  Could not parse: {out[:200]}")

# Step 2: Check if tls.yml is accessible inside container
print("\n=== Step 2: Check file inside Traefik container ===")
code, out, _ = ssh(VM_APP, "docker exec aris-traefik cat /etc/traefik/tls.yml 2>&1 | head -5")
print(f"  Exit: {code}")
print(f"  {out[:200]}")

# Step 3: Check Traefik static config (command args)
print("\n=== Step 3: Traefik static config ===")
try:
    cmd_args = info[0].get("Config", {}).get("Cmd", [])
    for a in cmd_args:
        print(f"  {a}")
except:
    code, out, _ = ssh(VM_APP, "docker inspect aris-traefik --format '{{ .Config.Cmd }}' 2>&1")
    print(f"  {out}")

# Step 4: Check what Traefik sees for routers
print("\n=== Step 4: Traefik API - routers ===")
code, out, _ = ssh(VM_APP, "curl -s http://localhost:8090/api/http/routers 2>&1 | python3 -m json.tool 2>/dev/null | head -80")
print(out[:2000] if out else "  No output")

# Step 5: Check certs directory
print("\n=== Step 5: Certs directory ===")
code, out, _ = ssh(VM_APP, "ls -la /opt/aris-deploy/vm-app/certs/ 2>&1")
print(out)

if __name__ == "__main__":
    main() if 'main' in dir() else None
