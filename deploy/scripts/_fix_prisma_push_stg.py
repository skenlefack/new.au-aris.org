#!/usr/bin/env python3
"""Redo prisma db push on STAGING using the correct DB host (VM-DB-STG IP)."""
import paramiko, sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.146", username="arisadmin",
            password="@u-1baR.0rg$U24", timeout=15,
            allow_agent=False, look_for_keys=False)

# Use the DIRECT PG port 5432 on VM-DB-STG (pgbouncer port 6432 is not
# usable by prisma db push in transaction pooling mode).
DB_URL = "postgresql://aris:Ar1s_Stg_2024%21xK9mZ@10.202.101.148:5432/aris?schema=public"

cmd = (
    f"docker exec -w /app/packages/db-schemas "
    f'-e DATABASE_URL="{DB_URL}" '
    f"aris-stg-credential npx prisma db push --schema=prisma --accept-data-loss --skip-generate 2>&1 | tail -15"
)
print(f"$ {cmd[:140]}")
_, out, _ = ssh.exec_command(cmd, timeout=600, get_pty=True)
print(out.read().decode(errors="replace"))

# Restart credential so it picks up the new schema
print("\nRestarting aris-stg-credential...")
_, out, _ = ssh.exec_command("docker restart aris-stg-credential", timeout=60, get_pty=True)
print(out.read().decode(errors="replace"))

ssh.close()
