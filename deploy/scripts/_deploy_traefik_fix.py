#!/usr/bin/env python3
"""Deploy Traefik routing fix — enable HTTP+HTTPS on all services."""
import time
from ssh_config import get_client, VM_APP, VM_PASS

def ssh_exec(client, cmd, timeout=120):
    """Execute command and return output."""
    full_cmd = f"echo '{VM_PASS}' | sudo -S {cmd}" if cmd.startswith('docker') else cmd
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    out = stdout.read().decode().strip()
    err = stderr.read().decode().strip()
    # Filter sudo password prompt
    out_lines = [l for l in out.split('\n') if not l.startswith('[sudo]')]
    err_lines = [l for l in err.split('\n') if not l.startswith('[sudo]')]
    return '\n'.join(out_lines), '\n'.join(err_lines)

c = get_client(VM_APP)

# Step 1: Pull latest code
print("Step 1: Pulling latest code...")
out, err = ssh_exec(c, "cd /opt/aris && git pull origin main")
print(f"  {out}")
if err: print(f"  [err] {err}")

# Step 2: Copy updated docker-compose
print("\nStep 2: Copying updated docker-compose.yml...")
out, err = ssh_exec(c, "cp /opt/aris/deploy/vm-app/docker-compose.yml /opt/aris-deploy/vm-app/docker-compose.yml")
print("  Done")

# Step 3: Recreate Traefik (to pick up entrypoint config change)
print("\nStep 3: Recreating Traefik...")
out, err = ssh_exec(c, "docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d traefik", timeout=60)
print(f"  {out}")
if err: print(f"  {err}")

# Step 4: Recreate all services that had label changes
# We need to recreate them so Docker/Traefik picks up the new labels
services = [
    'tenant', 'credential', 'message', 'drive', 'realtime',
    'master-data', 'data-quality', 'data-contract', 'interop-hub',
    'form-builder', 'collecte', 'workflow',
    'animal-health', 'livestock-prod', 'fisheries', 'wildlife',
    'apiculture', 'trade-sps', 'governance', 'climate-env',
    'analytics', 'geo-services', 'knowledge-hub',
    'support', 'interop', 'analytics-worker', 'datalake', 'offline',
    'web', 'pg-tileserv'
]
print(f"\nStep 4: Recreating {len(services)} services...")
svc_list = ' '.join(services)
out, err = ssh_exec(c, f"docker compose -f /opt/aris-deploy/vm-app/docker-compose.yml up -d {svc_list}", timeout=300)
print(f"  {out}")
if err: print(f"  {err}")

# Step 5: Verify
print("\nStep 5: Testing HTTP routing...")
time.sleep(3)  # Wait for services to start
out, err = ssh_exec(c, "curl -s http://localhost/api/v1/settings/scope -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3")
print(f"  /api/v1/settings/scope: {out}")

out, err = ssh_exec(c, "curl -s http://localhost/api/v1/public/stats -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3")
print(f"  /api/v1/public/stats: {out}")

out, err = ssh_exec(c, "curl -s http://localhost/api/v1/messages/unread-count -w '\\nHTTP_CODE:%{http_code}' 2>&1 | tail -3")
print(f"  /api/v1/messages/unread-count: {out}")

c.close()
print("\nDeployment complete!")
