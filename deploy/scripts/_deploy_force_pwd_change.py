#!/usr/bin/env python3
"""
Deploy the force-password-change feature (commit 27f6b96) to STAGING
and PROD. Order of operations per env:
  1. git pull on the app VM
  2. Copy docker-compose.yml to deploy dir (PROD only — staging drifted
     so no compose copy; the code-level deploy is enough as schema lives
     in the tenant/credential container image).
  3. Run prisma db push inside an existing credential container so the
     public.users table gets must_change_password + password_changed_at.
  4. Rebuild + restart credential and web.
  5. Smoke test: login as admin and confirm mustChangePassword=false.
"""
import paramiko, sys, time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S "

ENVS = [
    {
        "name": "STAGING",
        "host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "prefix": "aris-stg",
        "db_url": "postgresql://aris:Ar1s_Stg_2024%21xK9mZ@pgbouncer:6432/aris?pgbouncer=true&schema=public",
        "direct_db_url": "postgresql://aris:Ar1s_Stg_2024%21xK9mZ@postgres:5432/aris?schema=public",
        "sync_from_git": False,
    },
    {
        "name": "PROD",
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "prefix": "aris",
        "db_url": "postgresql://aris:Ar1s_Pr0d_2024%21xK9mZ@pgbouncer:6432/aris?pgbouncer=true&schema=public",
        "direct_db_url": "postgresql://aris:Ar1s_Pr0d_2024%21xK9mZ@postgres:5432/aris?schema=public",
        "sync_from_git": True,
    },
]


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15,
                allow_agent=False, look_for_keys=False)
    return ssh


def run(ssh, cmd, timeout=900):
    print(f"  $ {cmd[:140]}")
    _, out, _ = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    result = out.read().decode(errors="replace").strip()
    print("    " + (result[-1800:].replace("\n", "\n    ") if result else "(ok)"))
    return result


for env in ENVS:
    print(f"\n═══════════════════ {env['name']} ═══════════════════")
    ssh = connect(env["host"])

    if env["sync_from_git"]:
        print("\n[1/4] Git pull + sync compose...")
        run(ssh, f"cd /opt/aris && {SUDO}git fetch origin && {SUDO}git reset --hard origin/main")
        run(ssh, f"{SUDO}cp /opt/aris/deploy/vm-app/docker-compose.yml {env['deploy_dir']}/docker-compose.yml")
    else:
        print("\n[1/4] Git pull (code only — staging compose is drifted)...")
        run(ssh, f"cd /opt/aris && {SUDO}git fetch origin && {SUDO}git reset --hard origin/main")

    print("\n[2/4] Prisma db push (adds must_change_password + password_changed_at)...")
    # Run inside the existing credential container using DIRECT_DATABASE_URL
    # (port 5432, NOT pgbouncer — prisma migrate/push doesn't work via pgbouncer
    # in transaction mode).
    # Use the db-schemas package so all schemas are kept in sync.
    cont = f"{env['prefix']}-credential"
    run(
        ssh,
        f'docker exec -w /app/packages/db-schemas '
        f'-e DATABASE_URL="{env["direct_db_url"]}" '
        f'{cont} npx prisma db push --schema=prisma --accept-data-loss --skip-generate 2>&1 | tail -15',
        timeout=600,
    )

    print("\n[3/4] Rebuild + restart credential + web...")
    run(
        ssh,
        f"cd {env['deploy_dir']} && {SUDO}docker compose up -d --build --force-recreate --no-deps credential web 2>&1 | tail -15",
        timeout=900,
    )

    print("\n[4/4] Verify containers...")
    time.sleep(4)
    run(
        ssh,
        f"docker ps --filter name={env['prefix']}-credential --filter name={env['prefix']}-web "
        f"--format '{{{{.Names}}}} | {{{{.Status}}}}'",
    )

    ssh.close()

print("\n─── Smoke test login ───")
import subprocess
for host, url in [
    ("PROD",    "https://au-aris.org/api/v1/credential/auth/login"),
    ("STAGING", "https://test.au-aris.org/api/v1/credential/auth/login"),
]:
    cmd = [
        "curl", "-sk", "--max-time", "15",
        "-H", "Content-Type: application/json",
        "-d", '{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}',
        url,
    ]
    res = subprocess.run(cmd, capture_output=True, text=True)
    body = res.stdout[:400]
    has_flag = '"mustChangePassword"' in body
    print(f"  {host}: mustChangePassword present = {has_flag}")
    print(f"    {body[:200]}")

print("\nDone.")
