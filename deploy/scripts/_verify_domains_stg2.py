#!/usr/bin/env python3
"""Verify user_domains on staging via Docker PG container."""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, VM_PASS, VM_USER

import paramiko

STG_APP = "10.202.101.146"
STG_DB = "10.202.101.148"


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


# ── Step 1: Find PG container name on DB VM ──
step("Step 1: Find PostgreSQL container on DB VM")
c = get_client(STG_DB)
code, out, err = run_sudo(c, "docker ps --format '{{.Names}}' --filter ancestor=postgres:16-alpine")
if not out:
    code, out, err = run_sudo(c, "docker ps --format '{{.Names}}'")
safe_print(f"  Containers: {out}")
c.close()

# Use the first postgres-like container, or try common names
pg_container = None
for name in out.splitlines():
    if "postgres" in name.lower() or "pg" in name.lower() or "db" in name.lower():
        pg_container = name.strip()
        break
if not pg_container and out.strip():
    pg_container = out.splitlines()[0].strip()

safe_print(f"  Using PG container: {pg_container}")

if pg_container:
    # ── Step 2: Query user_domains ──
    step("Step 2: Query user_domains")
    c = get_client(STG_DB)
    sql = "SELECT u.email, count(ud.id) as domains FROM public.users u JOIN governance.user_domains ud ON u.id = ud.user_id GROUP BY u.email ORDER BY domains DESC;"
    cmd = f"""bash -c 'docker exec -e PGPASSWORD="Ar1s_Stg_2024!xK9mZ" {pg_container} psql -h localhost -U aris -d aris -c "{sql}"'"""
    code, out, err = run_sudo(c, cmd, timeout=15)
    if code == 0:
        safe_print(out)
    else:
        safe_print(f"  Failed (code {code}): {out[:200]} {err[:200]}")
    c.close()

    # ── Step 3: Total count ──
    step("Step 3: Total count")
    c = get_client(STG_DB)
    sql2 = "SELECT count(*) as total FROM governance.user_domains;"
    cmd2 = f"""bash -c 'docker exec -e PGPASSWORD="Ar1s_Stg_2024!xK9mZ" {pg_container} psql -h localhost -U aris -d aris -t -c "{sql2}"'"""
    code, out, err = run_sudo(c, cmd2, timeout=15)
    safe_print(f"  Total rows: {out.strip()}")
    c.close()

# ── Step 4: Check credential service + compose service name ──
step("Step 4: Check credential service on APP VM")
c = get_client(STG_APP)
code, out, err = run_sudo(c, "docker ps --filter name=aris-stg-credential --format '{{.Names}} {{.Status}} {{.Image}}'")
safe_print(f"  {out}")
c.close()

# Find compose service name
step("Step 5: Find compose service name for credential")
c = get_client(STG_APP)
code, out, err = run_sudo(c, "bash -c 'cd /opt/aris-deploy/vm-app-stg && docker compose ps --format table 2>&1 | head -5'")
safe_print(f"  {out}")
# Also grep for credential in compose file
code2, out2, err2 = run_sudo(c, "bash -c 'grep -n credential /opt/aris-deploy/vm-app-stg/docker-compose.yml | head -5'")
safe_print(f"  Compose entries: {out2}")
c.close()

safe_print("\n  DONE!")
