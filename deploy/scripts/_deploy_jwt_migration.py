#!/usr/bin/env python3
"""Deploy JWT hierarchical migration: rebuild credential + collecte + web, then invalidate sessions."""
import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import ssh, step
import paramiko

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = [
    {
        "name": "STAGING",
        "app_host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
        "services": ["credential", "collecte", "web"],
    },
    {
        "name": "PRODUCTION",
        "app_host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
        "services": ["credential", "collecte", "web"],
    },
]

ONLY = sys.argv[1] if len(sys.argv) > 1 else None

for env in ENVS:
    if ONLY == "--stg" and env["name"] != "STAGING":
        continue
    if ONLY == "--prod" and env["name"] != "PRODUCTION":
        continue

    step(f"{env['name']} — JWT Hierarchical Migration")
    host = env["app_host"]

    # 1. Git pull
    print("\n  [1/3] Git pull...")
    code, out, err = ssh(host, "cd /opt/aris && git fetch origin && git reset --hard origin/main 2>&1", timeout=30)
    for line in out.strip().splitlines()[-2:]:
        print(f"    {line}")

    # 2. Upload compose + rebuild services
    print(f"\n  [2/3] Rebuild {', '.join(env['services'])}...")
    local_compose = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", env["compose_src"]))
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15, allow_agent=False, look_for_keys=False)
    sftp = c.open_sftp()
    sftp.put(local_compose, "/tmp/docker-compose-jwt.yml")
    sftp.close()
    c.close()
    ssh(host, f"cp /tmp/docker-compose-jwt.yml {env['deploy_dir']}/docker-compose.yml", timeout=10)

    svc_list = " ".join(env["services"])
    code, out, err = ssh(host,
        f"cd {env['deploy_dir']} && docker compose up -d --build --no-deps {svc_list} 2>&1",
        timeout=600)
    for line in (out + err).strip().splitlines()[-5:]:
        print(f"    {line}")

    time.sleep(5)

    # 3. Verify
    print(f"\n  [3/3] Verify...")
    code, out, err = ssh(host, 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/health', timeout=10)
    print(f"    Credential health: HTTP {out.strip()}")

    code, out, err = ssh(host, 'curl -s -o /dev/null -w "%{http_code}" http://localhost:3011/health', timeout=10)
    print(f"    Collecte health: HTTP {out.strip()}")

print("\nServices rebuilt. Now run session invalidation:")
print("  python deploy/scripts/_invalidate_sessions.py")
