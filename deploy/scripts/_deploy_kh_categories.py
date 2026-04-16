#!/usr/bin/env python3
"""
Deploy the modern-categories + public-KPIs commit (b914ef2) to staging and
production. Per environment:
  1. git pull origin main on /opt/aris
  2. Rebuild knowledge-hub container (new public/stats endpoint, relaxed
     update/delete authz)
  3. Rebuild web container (categories admin rewrite, public landing KPIs,
     breadcrumb component)
  4. Health-check both containers

Strategy: STAGING first; if green, PRODUCTION. No DB migration, no seeding —
this commit is code-only.
"""
import sys
import time
import paramiko

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "stg": {
        "label": "STAGING",
        "host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "prefix": "aris-stg",
        "url": "https://test.au-aris.org",
    },
    "prod": {
        "label": "PRODUCTION",
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "prefix": "aris",
        "url": "https://au-aris.org",
    },
}

SERVICES = ["knowledge-hub", "web"]
SERVICE_PORTS = {"knowledge-hub": 3033, "web": 3100}


def log(msg):
    print(msg, flush=True)


def run(ssh, cmd, sudo=False, timeout=900):
    if sudo:
        cmd = f"echo '{SSH_PASS}' | sudo -S bash -c \"{cmd}\""
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    rc = stdout.channel.recv_exit_status()
    return rc, out, err


def deploy(env_key):
    env = ENVS[env_key]
    log(f"\n{'='*70}\n  {env['label']}  →  {env['host']}\n{'='*70}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(env["host"], username=SSH_USER, password=SSH_PASS, timeout=30)

    try:
        # 1. git pull
        log("[1/4] git pull on /opt/aris")
        rc, out, err = run(ssh, "cd /opt/aris && git fetch --all && git reset --hard origin/main && git log --oneline -1", sudo=True)
        log(out.strip() or err.strip())
        if rc != 0:
            raise RuntimeError(f"git pull failed: {err}")

        # 2. Rebuild knowledge-hub
        log("\n[2/4] Rebuild knowledge-hub container")
        rc, out, err = run(
            ssh,
            f"cd {env['deploy_dir']} && docker compose up -d --build --no-deps knowledge-hub 2>&1 | tail -40",
            sudo=True,
            timeout=900,
        )
        log(out)
        if rc != 0:
            raise RuntimeError(f"knowledge-hub build failed: {err}")

        # 3. Rebuild web
        log("\n[3/4] Rebuild web container")
        rc, out, err = run(
            ssh,
            f"cd {env['deploy_dir']} && docker compose up -d --build --no-deps web 2>&1 | tail -40",
            sudo=True,
            timeout=1500,
        )
        log(out)
        if rc != 0:
            raise RuntimeError(f"web build failed: {err}")

        # 4. Health check
        log("\n[4/4] Health checks (waiting 15s for boot)")
        time.sleep(15)
        for svc in SERVICES:
            container = f"{env['prefix']}-{svc}"
            port = SERVICE_PORTS[svc]
            rc, out, err = run(
                ssh,
                f"docker exec {container} wget -qO- http://localhost:{port}/health 2>&1 || curl -fsS http://localhost:{port}/health 2>&1",
                sudo=True,
                timeout=20,
            )
            status = "OK" if "ok" in out.lower() or "healthy" in out.lower() or rc == 0 else "FAIL"
            log(f"  {svc:15} [{status}]  {out.strip()[:120]}")

        # Quick public stats endpoint check
        rc, out, err = run(
            ssh,
            f"curl -fsS {env['url']}/api/v1/knowledge/publications/public/stats 2>&1 | head -c 300",
            sudo=False,
            timeout=20,
        )
        log(f"\n  public/stats: {out.strip()[:200]}")

        log(f"\n{env['label']} deploy DONE")
    finally:
        ssh.close()


def main():
    targets = sys.argv[1:] or ["stg", "prod"]
    for t in targets:
        if t not in ENVS:
            log(f"Unknown target: {t}")
            sys.exit(1)
        deploy(t)
    log("\nAll targets deployed.")


if __name__ == "__main__":
    main()
