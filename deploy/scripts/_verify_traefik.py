#!/usr/bin/env python3
"""Verify Traefik has the updated tenant routing."""
import json

from ssh_config import get_client, VM_APP, VM_PASS

c = get_client(VM_APP)

# Check Traefik routers via API
cmd = "docker exec aris-traefik wget -qO- http://localhost:8080/api/http/routers 2>/dev/null"
stdin, stdout, stderr = c.exec_command(f"echo '{VM_PASS}' | sudo -S {cmd}", timeout=30)
out = stdout.read().decode().strip()
err = stderr.read().decode()

# The sudo password prompt goes to stderr, actual output is in stdout
# Remove any sudo password prompt from output
lines = out.split('\n')
json_line = ''
for line in lines:
    if line.startswith('['):
        json_line = line
        break

if json_line:
    routers = json.loads(json_line)
    print("Traefik Routers (tenant & settings-related):")
    for r in routers:
        name = r.get('name', '')
        if 'tenant' in name or 'setting' in name:
            print(f"  {name}: {r.get('rule', 'no rule')}")
            print(f"    Status: {r.get('status', 'unknown')}")
    print()

# Test the settings endpoint directly
print("Testing /api/v1/settings/config endpoint...")
test_cmd = "docker exec aris-traefik wget -qO- --no-check-certificate https://localhost/api/v1/settings/config 2>/dev/null || echo 'ENDPOINT_FAILED'"
stdin, stdout, stderr = c.exec_command(f"echo '{VM_PASS}' | sudo -S {test_cmd}", timeout=15)
out = stdout.read().decode().strip()
# Filter out sudo prompt
for line in out.split('\n'):
    if not line.startswith('[sudo]'):
        print(f"  Response: {line[:200]}")

c.close()
