#!/usr/bin/env python3
"""
Restore the staging docker-compose.yml (aris-stg-* naming) from the
automatic backup, remove the orphan aris-knowledge-hub container that was
created when prod compose was mistakenly applied, then rebuild
aris-stg-knowledge-hub from the latest code.
"""
import paramiko, sys, time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.146", username="arisadmin",
            password="@u-1baR.0rg$U24", timeout=15,
            allow_agent=False, look_for_keys=False)

SUDO = "echo '@u-1baR.0rg$U24' | sudo -S "
DIR = "/opt/aris-deploy/vm-app-stg"
BAK = "docker-compose.yml.bak.1775512162"


def run(cmd, timeout=600):
    print(f"\n$ {cmd[:150]}")
    _, out, err = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    result = out.read().decode(errors="replace").strip()
    print(result[-1500:] if result else "(no output)")
    return result


# 1. Backup the wrong compose that was pushed
run(f"{SUDO}mv {DIR}/docker-compose.yml {DIR}/docker-compose.yml.wrong-prod")

# 2. Restore the staging compose from backup
run(f"{SUDO}cp {DIR}/{BAK} {DIR}/docker-compose.yml")

# 3. Verify naming is correct
run(f"{SUDO}grep -c 'aris-stg-' {DIR}/docker-compose.yml")

# 4. Stop the orphan prod-named container
run(f"docker stop aris-knowledge-hub || true")
run(f"docker rm aris-knowledge-hub || true")

# 5. Now rebuild the correct staging container from latest code
run(
    f"cd {DIR} && {SUDO}docker compose up -d --build --force-recreate --no-deps knowledge-hub 2>&1 | tail -20",
    timeout=900,
)

# 6. Wait briefly then verify
time.sleep(5)
run("docker ps --filter name=knowledge-hub --format '{{.Names}} | {{.Status}}'")
run("docker logs --tail 20 aris-stg-knowledge-hub 2>&1")

ssh.close()
