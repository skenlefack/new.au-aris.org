#!/usr/bin/env python3
"""Verify user_domains on staging DB and restart credential service."""
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


# ── Verify user_domains ──
step("Verify user_domains in staging DB")
c = get_client(STG_DB)
sql = "SELECT u.email, count(ud.id) as domain_count FROM public.users u JOIN governance.user_domains ud ON u.id = ud.user_id GROUP BY u.email ORDER BY domain_count DESC;"
cmd = f"""bash -c "PGPASSWORD='Ar1s_Stg_2024!xK9mZ' psql -h localhost -U aris -d aris -c \\"{sql}\\"" """
code, out, err = run_sudo(c, cmd, timeout=15)
if code == 0 and out:
    safe_print(out)
else:
    safe_print(f"  Query failed (code {code}): {err[:200]}")
c.close()

# ── Verify total count ──
step("Total user_domains rows")
c = get_client(STG_DB)
sql2 = "SELECT count(*) as total FROM governance.user_domains;"
cmd2 = f"""bash -c "PGPASSWORD='Ar1s_Stg_2024!xK9mZ' psql -h localhost -U aris -d aris -t -c \\"{sql2}\\"" """
code, out, err = run_sudo(c, cmd2, timeout=15)
if code == 0:
    safe_print(f"  Total: {out.strip()} rows")
else:
    safe_print(f"  Query failed: {err[:200]}")
c.close()

# ── Restart credential service ──
step("Restart credential service")
c = get_client(STG_APP)
cmd = f"""bash -c 'cd /opt/aris-deploy/vm-app-stg && docker compose up -d --build --no-deps aris-stg-credential 2>&1'"""
code, out, err = run_sudo(c, cmd, timeout=300)
safe_print(f"  Exit code: {code}")
for line in out.splitlines()[-10:]:
    safe_print(f"  {line}")
if code != 0 and err:
    safe_print(f"  Error: {err[:300]}")
c.close()

# ── Verify service is running ──
step("Verify credential service")
c = get_client(STG_APP)
code, out, err = run_sudo(c, f"docker ps --filter name=aris-stg-credential --format '{{{{.Names}}}} {{{{.Status}}}}'")
safe_print(f"  {out}")
c.close()

safe_print("\n  DONE!")
