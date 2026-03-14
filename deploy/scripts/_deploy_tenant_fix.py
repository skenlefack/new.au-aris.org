#!/usr/bin/env python3
"""Deploy Traefik routing fix for tenant service."""
from ssh_config import get_client, VM_APP, VM_PASS

c = get_client(VM_APP)

# Recreate tenant container with updated labels
cmd = f"echo '{VM_PASS}' | sudo -S docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d tenant 2>&1"
print(">>> Recreating tenant container with updated Traefik labels...")
stdin, stdout, stderr = c.exec_command(cmd, timeout=120)
out = stdout.read().decode()
err = stderr.read().decode()
if out: print(out)
if err: print(err)

# Verify the new labels
print("\n>>> Checking tenant container labels...")
cmd2 = f"echo '{VM_PASS}' | sudo -S docker inspect aris-tenant --format '{{{{.Config.Labels}}}}' 2>&1"
stdin, stdout, stderr = c.exec_command(cmd2, timeout=30)
out = stdout.read().decode()
err = stderr.read().decode()
if out: print(out)
if err: print(err)

# Check Traefik routers
print("\n>>> Checking Traefik routers for tenant...")
cmd3 = f"echo '{VM_PASS}' | sudo -S docker exec aris-traefik wget -qO- http://localhost:8080/api/http/routers 2>&1 | python3 -c \"import sys,json; data=json.load(sys.stdin); [print(f'  {{r[\\\"name\\\"]}} -> {{r[\\\"rule\\\"]}}') for r in data if 'tenant' in r.get('name','')]\" 2>&1"
stdin, stdout, stderr = c.exec_command(cmd3, timeout=30)
out = stdout.read().decode()
err = stderr.read().decode()
if out: print(out)
if err: print(err)

c.close()
print("\nDone!")
