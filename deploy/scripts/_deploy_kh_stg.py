#!/usr/bin/env python3
"""
Deploy knowledge-hub service to STAGING (test.au-aris.org).
Targeted deploy of the 5s Kafka timeout fix (commit 9f60eac).
"""
import paramiko
import sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

STG_APP = "10.202.101.146"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
DEPLOY_DIR = "/opt/aris-deploy/vm-app-stg"
GIT_DIR = "/opt/aris"
SERVICE = "knowledge-hub"
CONTAINER = f"aris-stg-{SERVICE}"


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15,
                allow_agent=False, look_for_keys=False)
    return ssh


def run(ssh, cmd, timeout=600):
    print(f"  $ {cmd[:120]}")
    stdin, stdout, stderr = ssh.exec_command(
        f"echo '{SSH_PASS}' | sudo -S bash -c \"{cmd}\"",
        timeout=timeout,
        get_pty=True,
    )
    out = stdout.read().decode(errors="replace")
    err = stderr.read().decode(errors="replace")
    rc = stdout.channel.recv_exit_status()
    return rc, out, err


def main():
    print(f"Connecting to STAGING VM-APP ({STG_APP})...")
    ssh = connect(STG_APP)

    print("\n[1/3] Git pull latest main...")
    rc, out, _ = run(ssh, f"cd {GIT_DIR} && git fetch origin && git reset --hard origin/main && git log --oneline -1")
    print(out.strip().split("\n")[-1] if out else "(no output)")

    print("\n[2/3] Copy docker-compose.yml to deploy dir...")
    rc, out, _ = run(ssh, f"cp {GIT_DIR}/deploy/vm-app/docker-compose.yml {DEPLOY_DIR}/docker-compose.yml && echo OK")
    print(out.strip()[-40:] if out else "(done)")

    print(f"\n[3/3] Rebuild + restart {CONTAINER}...")
    rc, out, _ = run(
        ssh,
        f"cd {DEPLOY_DIR} && docker compose up -d --build --force-recreate --no-deps {SERVICE} 2>&1 | tail -20",
        timeout=900,
    )
    print(out.strip()[-800:] if out else "(no output)")

    print("\n[verify] Container status...")
    rc, out, _ = run(ssh, f"docker ps --filter name={CONTAINER} --format '{{{{.Names}}}} {{{{.Status}}}}'")
    print(out.strip() or "(not running)")

    ssh.close()
    print("\nDeploy complete. Run E2E tests: cd tests && npx vitest run --config vitest.e2e.config.ts e2e/api/knowledge-hub.spec.ts")


if __name__ == "__main__":
    main()
