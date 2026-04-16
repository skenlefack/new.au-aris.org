#!/usr/bin/env python3
"""Verify deployed commit on staging and prod."""
import paramiko
import sys

PASSWORD = "@u-1baR.0rg$U24"

ENVS = {
    "stg": {"host": "10.202.101.146", "container": "aris-stg-web"},
    "prod": {"host": "10.202.101.183", "container": "aris-web"},
}


def run_sudo(ssh, cmd):
    full = f"echo '{PASSWORD}' | sudo -S bash -c '{cmd}' 2>&1"
    _, stdout, _ = ssh.exec_command(full, timeout=60)
    out = stdout.read().decode()
    lines = [l for l in out.split("\n") if l.strip() and "[sudo]" not in l]
    return lines


def check(name):
    env = ENVS[name]
    print(f"\n--- {name.upper()} ({env['host']}) ---")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(env["host"], username="arisadmin", password=PASSWORD, timeout=15)

    # Check git log
    print("  Git HEAD:")
    for l in run_sudo(ssh, "cd /opt/aris && git log --oneline -3"):
        print(f"    {l}".encode("ascii", errors="replace").decode())

    # Check if the file has the changes
    print("  Functions page check (level counts):")
    for l in run_sudo(ssh, "cd /opt/aris && grep -n 'countContinental' apps/web/src/app/\\(dashboard\\)/settings/functions/page.tsx | head -5"):
        print(f"    {l}".encode("ascii", errors="replace").decode())

    # Check container created time
    print("  Container status:")
    for l in run_sudo(ssh, f"docker ps --filter name={env['container']} --format 'table {{{{.Names}}}}\\t{{{{.Status}}}}\\t{{{{.CreatedAt}}}}'"):
        print(f"    {l}".encode("ascii", errors="replace").decode())

    # Check image creation time
    print("  Image info:")
    for l in run_sudo(ssh, f"docker images vm-app-{('stg-' if name == 'stg' else '')}web --format 'table {{{{.Repository}}}}\\t{{{{.Tag}}}}\\t{{{{.CreatedAt}}}}\\t{{{{.Size}}}}'"):
        print(f"    {l}".encode("ascii", errors="replace").decode())

    ssh.close()


if __name__ == "__main__":
    targets = sys.argv[1:] or ["stg", "prod"]
    for t in targets:
        check(t)
