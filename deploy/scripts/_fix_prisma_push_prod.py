#!/usr/bin/env python3
"""Run prisma db push on PROD via sudo docker exec."""
import paramiko, sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SUDO = "echo '@u-1baR.0rg$U24' | sudo -S "
DB_URL = "postgresql://aris:Ar1s_Pr0d_2024%21xK9mZ@postgres:5432/aris?schema=public"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.183", username="arisadmin",
            password="@u-1baR.0rg$U24", timeout=15,
            allow_agent=False, look_for_keys=False)

cmd = (
    f"{SUDO}docker exec -w /app/packages/db-schemas "
    f'-e DATABASE_URL="{DB_URL}" '
    f"aris-credential npx prisma db push --schema=prisma --accept-data-loss --skip-generate 2>&1 | tail -15"
)
print(f"$ {cmd[:140]}")
_, out, _ = ssh.exec_command(cmd, timeout=600, get_pty=True)
print(out.read().decode(errors="replace"))

# Also restart credential so it picks up the new schema in memory (Prisma
# client was already rebuilt in the image — just needs a container restart).
print("\nRestarting aris-credential...")
_, out, _ = ssh.exec_command(f"{SUDO}docker restart aris-credential", timeout=60, get_pty=True)
print(out.read().decode(errors="replace"))

ssh.close()
