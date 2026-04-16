#!/usr/bin/env python3
"""Copy updated seed-roles.ts from /opt/aris into the credential container then re-run it."""
import paramiko, sys
if sys.platform == "win32": sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ENVS = [
    {"name": "STAGING", "app_host": "10.202.101.146", "prefix": "aris-stg",
     "direct_db": "postgresql://aris:Ar1s_Stg_2024%21xK9mZ@10.202.101.148:5432/aris?schema=public", "sudo": False},
    {"name": "PROD", "app_host": "10.202.101.183", "prefix": "aris",
     "direct_db": "postgresql://aris:Ar1s_Pr0d_2024%21xK9mZ@10.202.101.185:5432/aris?schema=public", "sudo": True},
]

def run(ssh, cmd, use_sudo=False, timeout=600):
    if use_sudo:
        esc = cmd.replace("'", "'\\''")
        cmd = f"echo '@u-1baR.0rg$U24' | sudo -S bash -c '{esc}'"
    print(f"  $ {cmd[:170]}")
    _, out, _ = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    print("    " + out.read().decode(errors="replace")[-2500:].replace("\n", "\n    "))

for env in ENVS:
    print(f"\n═══ {env['name']} ═══")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(env["app_host"], username="arisadmin", password="@u-1baR.0rg$U24", timeout=15, allow_agent=False, look_for_keys=False)

    # Copy the latest seed file from host into container (overrides the baked copy)
    run(
        ssh,
        f"docker cp /opt/aris/packages/db-schemas/prisma/seed-roles.ts "
        f"{env['prefix']}-credential:/app/packages/db-schemas/prisma/seed-roles.ts",
        use_sudo=env["sudo"],
    )
    # Run the (now updated) seed
    run(
        ssh,
        f'docker exec -w /app/packages/db-schemas '
        f'-e DATABASE_URL="{env["direct_db"]}" '
        f'-e DIRECT_URL="{env["direct_db"]}" '
        f"{env['prefix']}-credential npx tsx prisma/seed-roles.ts 2>&1 | tail -60",
        use_sudo=env["sudo"],
        timeout=600,
    )
    ssh.close()

print("\nDone.")
