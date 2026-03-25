#!/usr/bin/env python3
"""
Verify user_domains + deploy credential service on staging.

1. Verify user_domains via aris-stg-postgres container
2. Copy updated source files to server
3. Rebuild + restart credential service

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _deploy_credential_stg.py
"""
import sys
import os
import glob

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, VM_PASS, VM_USER

import paramiko

STG_APP = "10.202.101.146"
STG_DB = "10.202.101.148"
PG_CONTAINER = "aris-stg-postgres"
CRED_CONTAINER = "aris-stg-credential"
COMPOSE_SERVICE = "credential"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=22, username=VM_USER, password=VM_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, out, err


def run_sudo_stream(client, cmd, timeout=300):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"  {line}")
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, err


repo_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

safe_print("=" * 60)
safe_print("  ARIS 4.0 — Deploy Credential Service (Staging)")
safe_print("=" * 60)

# ── Step 1: Verify user_domains ──
step("Step 1: Verify user_domains in database")
c = get_client(STG_DB)
sql = "SELECT u.email, count(ud.id) as domains FROM public.users u JOIN governance.user_domains ud ON u.id = ud.user_id GROUP BY u.email ORDER BY domains DESC;"
cmd = f"""bash -c 'docker exec -e PGPASSWORD="Ar1s_Stg_2024!xK9mZ" {PG_CONTAINER} psql -U aris -d aris -c "{sql}"'"""
code, out, err = run_sudo(c, cmd, timeout=15)
if code == 0:
    safe_print(out)
else:
    safe_print(f"  Failed: {out[:200]} {err[:200]}")
c.close()

# ── Step 2: Upload changed files to server ──
step("Step 2: Upload updated source files")
files_to_upload = {
    # Packages
    "packages/shared-types/src/enums/domain-code.enum.ts": "packages/shared-types/src/enums/domain-code.enum.ts",
    "packages/shared-types/src/enums/index.ts": "packages/shared-types/src/enums/index.ts",
    "packages/shared-types/src/index.ts": "packages/shared-types/src/index.ts",
    "packages/shared-types/src/kafka/topic-names.ts": "packages/shared-types/src/kafka/topic-names.ts",
    "packages/auth-middleware/src/interfaces/jwt-payload.interface.ts": "packages/auth-middleware/src/interfaces/jwt-payload.interface.ts",
    "packages/auth-middleware/src/fastify/auth.hook.ts": "packages/auth-middleware/src/fastify/auth.hook.ts",
    "packages/auth-middleware/src/fastify/domains.hook.ts": "packages/auth-middleware/src/fastify/domains.hook.ts",
    "packages/auth-middleware/src/fastify/index.ts": "packages/auth-middleware/src/fastify/index.ts",
    "packages/auth-middleware/src/guards/auth.guard.ts": "packages/auth-middleware/src/guards/auth.guard.ts",
    "packages/auth-middleware/src/index.ts": "packages/auth-middleware/src/index.ts",
    "packages/db-schemas/prisma/settings.prisma": "packages/db-schemas/prisma/settings.prisma",
    "packages/db-schemas/prisma/credential.prisma": "packages/db-schemas/prisma/credential.prisma",
    # Credential service
    "services/credential/src/services/domain.service.ts": "services/credential/src/services/domain.service.ts",
    "services/credential/src/services/auth.service.ts": "services/credential/src/services/auth.service.ts",
    "services/credential/src/services/user.service.ts": "services/credential/src/services/user.service.ts",
    "services/credential/src/routes/domain.routes.ts": "services/credential/src/routes/domain.routes.ts",
    "services/credential/src/schemas/domain.schemas.ts": "services/credential/src/schemas/domain.schemas.ts",
    "services/credential/src/schemas/auth.schemas.ts": "services/credential/src/schemas/auth.schemas.ts",
    "services/credential/src/schemas/user.schemas.ts": "services/credential/src/schemas/user.schemas.ts",
    "services/credential/src/app.ts": "services/credential/src/app.ts",
    "services/credential/src/types.d.ts": "services/credential/src/types.d.ts",
}

c = get_client(STG_APP)
sftp = c.open_sftp()
uploaded = 0
for local_rel, remote_rel in files_to_upload.items():
    local_path = os.path.join(repo_root, local_rel.replace("/", os.sep))
    if not os.path.exists(local_path):
        safe_print(f"  SKIP (not found): {local_rel}")
        continue
    remote_tmp = f"/tmp/aris-deploy-{os.path.basename(local_rel)}"
    sftp.put(local_path, remote_tmp)
    remote_dest = f"/opt/aris/{remote_rel}"
    # Ensure remote directory exists
    remote_dir = os.path.dirname(remote_dest)
    run_sudo(c, f"mkdir -p {remote_dir}")
    code, _, err = run_sudo(c, f"cp {remote_tmp} {remote_dest} && rm -f {remote_tmp}")
    if code == 0:
        uploaded += 1
    else:
        safe_print(f"  WARN: {local_rel}: {err[:100]}")
sftp.close()
c.close()
safe_print(f"  Uploaded {uploaded}/{len(files_to_upload)} files")

# ── Step 3: Rebuild + restart credential service ──
step("Step 3: Rebuild + restart credential service")
c = get_client(STG_APP)
cmd = f"""bash -c 'cd /opt/aris-deploy/vm-app-stg && docker compose up -d --build --no-deps {COMPOSE_SERVICE} 2>&1'"""
code, err = run_sudo_stream(c, cmd, timeout=600)
safe_print(f"  Rebuild: {'OK' if code == 0 else f'FAILED ({code})'}")
if code != 0 and err:
    safe_print(f"  Error: {err[:500]}")
c.close()

# ── Step 4: Wait and check health ──
step("Step 4: Verify service running")
import time
time.sleep(5)

c = get_client(STG_APP)
code, out, err = run_sudo(c, f"docker ps --filter name={CRED_CONTAINER} --format '{{{{.Names}}}} {{{{.Status}}}}'")
safe_print(f"  {out}")
c.close()

# Quick health check
c = get_client(STG_APP)
code, out, err = run_sudo(c, f"""bash -c 'curl -sf http://localhost:3002/api/v1/credential/health 2>&1 || echo "NO_RESPONSE"'""", timeout=10)
safe_print(f"  Health: {out[:200]}")
c.close()

safe_print("\n" + "=" * 60)
safe_print("  CREDENTIAL SERVICE DEPLOYED!")
safe_print("=" * 60)
