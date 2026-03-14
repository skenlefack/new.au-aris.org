#!/usr/bin/env python3
"""Diagnose VM-DB docker compose failure."""
import sys
import time
from ssh_config import get_client, VM_DB, VM_PASS


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()

def run(client, cmd, sudo=True):
    if sudo:
        full_cmd = f"sudo -S bash -c '{cmd}'"
    else:
        full_cmd = cmd
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=30)
    if sudo:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
        stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out, err

safe_print(f"Connecting to VM-DB ({VM_DB})...")
c = get_client(VM_DB)

# 1. Running containers
safe_print("\n=== 1. Running containers ===")
code, out, err = run(c, "docker ps -a --format 'table {{.Names}}\\t{{.Status}}\\t{{.Image}}'")
safe_print(out if out else "(no containers)")

# 2. PgBouncer logs
safe_print("\n=== 2. PgBouncer logs ===")
code, out, err = run(c, "docker logs aris-pgbouncer 2>&1 | tail -30")
safe_print(out if out else f"(no logs, err: {err[:200]})")

# 3. PostgreSQL logs
safe_print("\n=== 3. PostgreSQL logs (last 20 lines) ===")
code, out, err = run(c, "docker logs aris-postgres 2>&1 | tail -20")
safe_print(out if out else "(no logs)")

# 4. Check PgBouncer config
safe_print("\n=== 4. PgBouncer config on VM ===")
code, out, err = run(c, "cat /opt/aris-deploy/vm-db/pgbouncer.ini")
safe_print(out if out else "(missing)")

# 5. Check userlist.txt
safe_print("\n=== 5. PgBouncer userlist.txt ===")
code, out, err = run(c, "cat /opt/aris-deploy/vm-db/userlist.txt")
safe_print(out if out else "(missing)")

# 6. Try starting PgBouncer manually
safe_print("\n=== 6. Attempting to start PgBouncer ===")
code, out, err = run(c, "cd /opt/aris-deploy/vm-db && docker compose up -d pgbouncer 2>&1")
safe_print(f"Exit: {code}")
safe_print(out if out else f"(err: {err[:300]})")

# 7. Check PgBouncer status after start attempt
safe_print("\n=== 7. PgBouncer status after start ===")
time.sleep(5)
code, out, err = run(c, "docker ps -a --filter name=aris-pgbouncer --format '{{.Names}} {{.Status}}'")
safe_print(out if out else "(not found)")

# 8. PgBouncer logs after restart
safe_print("\n=== 8. PgBouncer logs after restart ===")
code, out, err = run(c, "docker logs aris-pgbouncer 2>&1 | tail -20")
safe_print(out if out else "(no logs)")

# 9. Schema verification
safe_print("\n=== 9. PostgreSQL schemas ===")
code, out, err = run(c, "docker exec aris-postgres psql -U aris -d aris -c '\\\\dn' 2>&1")
safe_print(out if out else f"(err: {err[:200]})")

# 10. Disk space
safe_print("\n=== 10. Disk space ===")
code, out, err = run(c, "df -h / /var/lib/postgresql 2>/dev/null")
safe_print(out)

c.close()
safe_print("\nDiagnosis complete.")
