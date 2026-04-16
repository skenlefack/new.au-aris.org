import paramiko, sys, time
if sys.platform == "win32": sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ENVS = [
    {"name": "STG", "host": "10.202.101.146", "dir": "/opt/aris-deploy/vm-app-stg", "container": "aris-stg-message", "sudo": False},
    {"name": "PROD", "host": "10.202.101.183", "dir": "/opt/aris-deploy/vm-app", "container": "aris-message", "sudo": True},
]

def run(ssh, cmd, use_sudo=False, timeout=900):
    if use_sudo:
        escaped = cmd.replace("'", "'\\''")
        cmd = f"echo '@u-1baR.0rg$U24' | sudo -S bash -c '{escaped}'"
    print(f"  $ {cmd[:130]}")
    _, out, _ = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    print("    " + out.read().decode(errors="replace")[-1000:].replace("\n", "\n    "))

for env in ENVS:
    print(f"\n════ {env['name']} ════")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(env["host"], username="arisadmin", password="@u-1baR.0rg$U24", timeout=15, allow_agent=False, look_for_keys=False)
    run(ssh, "cd /opt/aris && git fetch origin && git reset --hard origin/main", use_sudo=env["sudo"])
    run(ssh, f"cd {env['dir']} && docker compose up -d --build --force-recreate --no-deps message 2>&1 | tail -10", use_sudo=env["sudo"], timeout=900)
    time.sleep(3)
    run(ssh, f"docker ps --filter name={env['container']} --format '{{{{.Names}}}} | {{{{.Status}}}}'", use_sudo=env["sudo"])
    ssh.close()
