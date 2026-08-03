"""
Deploy slideshow layout fix: analytics + web on Staging + Production.

Fix: PPR dashboard showing only in left column in slideshow.
- analytics: render API now returns section metadata (column_count, section_id, column_index)
- web: PublicDashboardSlideRenderer reconstructs sections with proper columnCount
"""

import paramiko
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_builtin_print = print

def safe_print(*args, **kwargs):
    try:
        _builtin_print(*args, **kwargs)
    except UnicodeEncodeError:
        text = " ".join(str(a) for a in args)
        _builtin_print(text.encode("ascii", "replace").decode("ascii"), **kwargs)

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO_CMD = f"echo '{SSH_PASS}' | sudo -S bash -c"

SERVERS = [
    {
        "name": "STAGING",
        "host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "services": ["analytics", "web"],
    },
    {
        "name": "PRODUCTION",
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "services": ["analytics", "web"],
    },
]


def run_ssh_command(ssh, command, timeout=120):
    safe_print(f"  > {command[:120]}{'...' if len(command) > 120 else ''}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        lines = combined.split("\n")
        for line in lines[-8:]:
            safe_print(f"    {line}")
    return exit_code, out, err


def deploy_server(server):
    name = server["name"]
    host = server["host"]
    deploy_dir = server["deploy_dir"]

    safe_print(f"\n{'='*60}")
    safe_print(f"  DEPLOYING slideshow fix -- {name} ({host})")
    safe_print(f"{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        safe_print(f"\n[1] Connecting to {host}...")
        ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=30)
        safe_print("  Connected.")

        # Step 2: Git pull
        safe_print(f"\n[2] Git pull on /opt/aris...")
        cmd = f"{SUDO_CMD} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'"
        run_ssh_command(ssh, cmd, timeout=120)

        # Step 3: Rebuild services
        for i, svc in enumerate(server["services"], start=3):
            safe_print(f"\n[{i}] Rebuilding {svc}...")
            cmd = f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --build --force-recreate --no-deps {svc}'"
            exit_code, _, _ = run_ssh_command(ssh, cmd, timeout=600)
            if exit_code != 0:
                safe_print(f"  ERROR: {svc} rebuild failed")
                return False

        safe_print(f"\n  {name} deploy completed successfully.")
        return True

    except Exception as e:
        safe_print(f"  ERROR on {name}: {e}")
        return False
    finally:
        ssh.close()


def main():
    safe_print("=" * 60)
    safe_print("  ARIS 4.0 -- Slideshow Layout Fix Deployment")
    safe_print("  Rebuilds analytics + web on STG + PROD")
    safe_print("=" * 60)

    results = {}
    for server in SERVERS:
        results[server["name"]] = deploy_server(server)

    safe_print(f"\n{'='*60}")
    safe_print("  DEPLOYMENT SUMMARY")
    safe_print(f"{'='*60}")
    for name, success in results.items():
        safe_print(f"  {name}: {'OK' if success else 'FAILED'}")
    safe_print(f"{'='*60}")

    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
