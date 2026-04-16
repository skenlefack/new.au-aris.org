"""
Deploy web service to staging and production.
Steps: git pull -> copy docker-compose.yml -> rebuild web service
"""

import paramiko
import sys

# Force stdout to UTF-8 so we can print emojis from Docker progress output
# (Windows console defaults to cp1252 which can't encode them).
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[attr-defined]
except Exception:
    pass


_builtin_print = print


def safe_print(*args, **kwargs):
    """print() that never crashes on encoding errors."""
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
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
    },
    {
        "name": "PRODUCTION",
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
    },
]


def run_ssh_command(ssh, command, timeout=120):
    """Execute a command via SSH and return output."""
    safe_print(f"  > {command[:120]}{'...' if len(command) > 120 else ''}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)

    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()

    # Show last 5 lines of output
    combined = (out + err).strip()
    if combined:
        lines = combined.split("\n")
        last_lines = lines[-5:] if len(lines) > 5 else lines
        for line in last_lines:
            safe_print(f"    {line}")

    return exit_code, out, err


def deploy_server(server):
    """Deploy web service on a single server."""
    name = server["name"]
    host = server["host"]
    deploy_dir = server["deploy_dir"]
    compose_src = server["compose_src"]

    safe_print(f"\n{'='*60}")
    safe_print(f"  DEPLOYING WEB -- {name} ({host})")
    safe_print(f"{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        safe_print(f"\n[1/4] Connecting to {host}...")
        ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=30)
        safe_print(f"  Connected.")

        # Step 1: Git pull
        safe_print(f"\n[2/4] Git pull on /opt/aris...")
        cmd = f"{SUDO_CMD} 'cd /opt/aris && git pull origin main'"
        exit_code, out, err = run_ssh_command(ssh, cmd, timeout=120)
        if exit_code != 0:
            safe_print(f"  WARNING: git pull exit code {exit_code}")

        # Step 2: Copy docker-compose.yml
        safe_print(f"\n[3/4] Copying docker-compose.yml to {deploy_dir}...")
        cmd = f"{SUDO_CMD} 'cp /opt/aris/{compose_src} {deploy_dir}/docker-compose.yml'"
        exit_code, out, err = run_ssh_command(ssh, cmd, timeout=30)
        if exit_code != 0:
            safe_print(f"  ERROR: copy failed with exit code {exit_code}")
            return False
        safe_print(f"  Copied successfully.")

        # Step 3: Rebuild web service only
        safe_print(f"\n[4/4] Rebuilding web service (docker compose up -d --build --no-deps web)...")
        cmd = f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --build --no-deps web'"
        exit_code, out, err = run_ssh_command(ssh, cmd, timeout=600)
        if exit_code != 0:
            safe_print(f"  ERROR: docker compose rebuild failed with exit code {exit_code}")
            return False

        safe_print(f"\n  {name} web deploy completed successfully.")
        return True

    except Exception as e:
        safe_print(f"  ERROR on {name}: {e}")
        return False
    finally:
        ssh.close()


def main():
    safe_print("=" * 60)
    safe_print("  ARIS 4.0 -- Web Service Deployment")
    safe_print("  Targets: Staging + Production")
    safe_print("  Date: 2026-03-31")
    safe_print("=" * 60)

    results = {}

    for server in SERVERS:
        success = deploy_server(server)
        results[server["name"]] = success

    # Summary
    safe_print(f"\n{'='*60}")
    safe_print("  DEPLOYMENT SUMMARY")
    safe_print(f"{'='*60}")
    for name, success in results.items():
        status = "OK" if success else "FAILED"
        safe_print(f"  {name}: {status}")
    safe_print(f"{'='*60}")

    if all(results.values()):
        safe_print("\n  All deployments succeeded.")
        return 0
    else:
        safe_print("\n  Some deployments failed. Check output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
