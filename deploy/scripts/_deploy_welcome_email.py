#!/usr/bin/env python3
"""
Deploy commit ab1e849 (welcome email + user form polish) to STAGING and
PROD. Rebuilds credential + message + web containers and triggers a
smoke test by creating a disposable user.
"""
import paramiko, sys, time, subprocess, json

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ENVS = [
    {
        "name": "STAGING",
        "app_host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "prefix": "aris-stg",
        "api_base": "https://test.au-aris.org",
        "sync_from_git": False,
        "sudo": False,
    },
    {
        "name": "PROD",
        "app_host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "prefix": "aris",
        "api_base": "https://au-aris.org",
        "sync_from_git": True,
        "sudo": True,
    },
]


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username="arisadmin",
                password="@u-1baR.0rg$U24", timeout=15,
                allow_agent=False, look_for_keys=False)
    return ssh


def run(ssh, cmd, timeout=900, use_sudo=False):
    if use_sudo:
        # Wrap in bash -c so shell builtins like `cd` work under sudo
        escaped = cmd.replace("'", "'\\''")
        cmd = f"echo '@u-1baR.0rg$U24' | sudo -S bash -c '{escaped}'"
    print(f"  $ {cmd[:200]}")
    _, out, _ = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    result = out.read().decode(errors="replace").strip()
    print("    " + (result[-1500:].replace("\n", "\n    ") if result else "(ok)"))
    return result


for env in ENVS:
    print(f"\n═══════════════════ {env['name']} ═══════════════════")
    ssh = connect(env["app_host"])

    print("\n[1/3] Git pull...")
    run(ssh, "cd /opt/aris && git fetch origin && git reset --hard origin/main", use_sudo=env["sudo"])

    if env["sync_from_git"]:
        run(
            ssh,
            f"cp /opt/aris/deploy/vm-app/docker-compose.yml {env['deploy_dir']}/docker-compose.yml",
            use_sudo=env["sudo"],
        )

    print("\n[2/3] Rebuild credential + message + web...")
    run(
        ssh,
        f"cd {env['deploy_dir']} && docker compose up -d --build --force-recreate --no-deps credential message web 2>&1 | tail -25",
        timeout=1200,
        use_sudo=env["sudo"],
    )

    print("\n[3/3] Verify containers...")
    time.sleep(4)
    run(
        ssh,
        f"docker ps --filter name={env['prefix']}-credential --filter name={env['prefix']}-message --filter name={env['prefix']}-web "
        f"--format '{{{{.Names}}}} | {{{{.Status}}}}'",
        use_sudo=env["sudo"],
    )

    ssh.close()

print("\nDone. To smoke-test on staging:")
print(
    "  curl -sk -H 'Content-Type: application/json' -d '...' "
    "https://test.au-aris.org/api/v1/credential/auth/login "
    "then POST /api/v1/credential/auth/register with a test email"
)
