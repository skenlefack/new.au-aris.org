#!/usr/bin/env python3
"""Deploy Phase 1 S2: prisma db push (User.permissions) + rebuild credential service."""
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
        "db_host": "10.202.101.148",
        "db_url": "postgresql://aris:Ar1s_Stg_2024!xK9mZ@10.202.101.148:5432/aris",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
        "container": "aris-stg-credential",
        "prefix": "aris-stg",
    },
    {
        "name": "PRODUCTION",
        "app_host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "db_url": "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
        "container": "aris-credential",
        "prefix": "aris",
    },
]

ONLY = sys.argv[1] if len(sys.argv) > 1 else None

for env in ENVS:
    if ONLY == "--stg" and env["name"] != "STAGING":
        continue
    if ONLY == "--prod" and env["name"] != "PRODUCTION":
        continue

    step(f"{env['name']} — Phase 1 S2 Deploy")
    host = env["app_host"]
    container = env["container"]
    db_url = env["db_url"]

    # 1. Git pull
    print("\n  [1/4] Git pull...")
    code, out, err = ssh(host, "cd /opt/aris && git fetch origin && git reset --hard origin/main 2>&1", timeout=30)
    for line in out.strip().splitlines()[-2:]:
        print(f"    {line}")

    # 2. Copy updated prisma schema into container + db push
    print("\n  [2/4] Prisma db push (User.permissions column)...")
    code, out, err = ssh(host,
        f"docker cp /opt/aris/packages/db-schemas/prisma/. {container}:/app/packages/db-schemas/prisma/",
        timeout=15)
    print(f"    docker cp: exit={code}")

    code, out, err = ssh(host,
        f'docker exec -w /app/packages/db-schemas '
        f'-e DATABASE_URL="{db_url}?pgbouncer=true" '
        f'-e DIRECT_DATABASE_URL="{db_url}" '
        f'{container} npx prisma db push --schema=prisma --accept-data-loss --skip-generate 2>&1',
        timeout=120)
    combined = (out + err).strip()
    for line in combined.splitlines()[-5:]:
        print(f"    {line}")

    if "in sync" in combined:
        print("    [OK] Schema applied")
    else:
        print(f"    [CHECK] exit={code}")

    # 3. Rebuild credential service
    print(f"\n  [3/4] Rebuild {container}...")

    # Upload latest compose file
    local_compose = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", env["compose_src"]))
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15, allow_agent=False, look_for_keys=False)
    sftp = c.open_sftp()
    sftp.put(local_compose, "/tmp/docker-compose-deploy.yml")
    sftp.close()
    c.close()

    ssh(host, f"cp /tmp/docker-compose-deploy.yml {env['deploy_dir']}/docker-compose.yml", timeout=10)

    code, out, err = ssh(host,
        f"cd {env['deploy_dir']} && docker compose up -d --build --no-deps credential 2>&1",
        timeout=300)
    for line in (out + err).strip().splitlines()[-5:]:
        print(f"    {line}")

    time.sleep(5)

    # 4. Verify
    print(f"\n  [4/4] Verify...")
    code, out, err = ssh(host,
        f"docker ps --filter name={container} --format '{{{{.Names}}}}  {{{{.Status}}}}'",
        timeout=10)
    print(f"    Container: {out.strip()}")

    code, out, err = ssh(host,
        f'curl -s -o /dev/null -w "%{{http_code}}" http://localhost:3002/health',
        timeout=10)
    print(f"    Health: HTTP {out.strip()}")

print("\nDone!")
