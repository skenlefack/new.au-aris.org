#!/usr/bin/env python3
"""Deploy collecte + web (form validation & submission fixes) to PROD + STAGING.

Changes:
- FormRenderer: required field validation, submit loading state, error display
- Submit page: isSubmitting prop, better error parsing
- SubmissionService: validateAgainstTemplate rewrite (FormBuilder schema support)
"""

import paramiko
import time
import sys

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S bash -c"

TARGETS = [
    {
        "name": "STAGING",
        "host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "collecte_container": "aris-stg-collecte",
        "web_container": "aris-stg-web",
    },
    {
        "name": "PROD",
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "collecte_container": "aris-collecte",
        "web_container": "aris-web",
    },
]


def run_cmd(chan, cmd, timeout=120):
    """Execute command and return output."""
    chan.exec_command(cmd)
    chan.settimeout(timeout)
    out = b""
    try:
        while True:
            chunk = chan.recv(4096)
            if not chunk:
                break
            out += chunk
    except Exception:
        pass
    exit_code = chan.recv_exit_status()
    return out.decode(errors="replace"), exit_code


def deploy(target):
    name = target["name"]
    host = target["host"]
    deploy_dir = target["deploy_dir"]

    print(f"\n{'='*60}")
    print(f"  DEPLOYING COLLECTE + WEB -> {name} ({host})")
    print(f"{'='*60}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
        print(f"  [OK] SSH connected to {host}")
    except Exception as e:
        print(f"  [FAIL] SSH connection failed: {e}")
        return False

    try:
        # 1. Git pull
        print(f"  [1/5] Git fetch + reset...")
        chan = client.get_transport().open_session()
        out, rc = run_cmd(chan, f"{SUDO} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'")
        if rc != 0:
            print(f"  [FAIL] Git pull failed (rc={rc}): {out[-300:]}")
            return False
        # Show commit
        chan = client.get_transport().open_session()
        out, _ = run_cmd(chan, f"{SUDO} 'cd /opt/aris && git log --oneline -1'")
        print(f"  [OK] Git: {out.strip()}")

        # 2. Rebuild collecte service
        print(f"  [2/5] Rebuilding collecte...")
        chan = client.get_transport().open_session()
        out, rc = run_cmd(
            chan,
            f"{SUDO} 'cd {deploy_dir} && docker compose up -d --build --force-recreate --no-deps collecte'",
            timeout=300,
        )
        if rc != 0:
            print(f"  [FAIL] Collecte build failed (rc={rc}): {out[-500:]}")
            return False
        print(f"  [OK] Collecte rebuilt")

        # 3. Rebuild web app
        print(f"  [3/5] Rebuilding web (this takes ~2-3 min)...")
        chan = client.get_transport().open_session()
        out, rc = run_cmd(
            chan,
            f"{SUDO} 'cd {deploy_dir} && docker compose up -d --build --force-recreate --no-deps web'",
            timeout=600,
        )
        if rc != 0:
            print(f"  [FAIL] Web build failed (rc={rc}): {out[-500:]}")
            # Try with --no-cache if pnpm lockfile issue
            if "frozen-lockfile" in out or "lockfile" in out.lower():
                print(f"  [RETRY] Lockfile issue detected, retrying with --no-cache...")
                chan = client.get_transport().open_session()
                run_cmd(chan, f"{SUDO} 'docker builder prune -f'", timeout=60)
                chan = client.get_transport().open_session()
                out, rc = run_cmd(
                    chan,
                    f"{SUDO} 'cd {deploy_dir} && docker compose build --no-cache web && docker compose up -d --no-deps web'",
                    timeout=600,
                )
                if rc != 0:
                    print(f"  [FAIL] Web rebuild with --no-cache also failed: {out[-500:]}")
                    return False
            else:
                return False
        print(f"  [OK] Web rebuilt")

        # 4. Verify containers
        print(f"  [4/5] Verifying containers...")
        time.sleep(8)
        for svc, container_name in [
            ("collecte", target["collecte_container"]),
            ("web", target["web_container"]),
        ]:
            chan = client.get_transport().open_session()
            out, rc = run_cmd(chan, f"{SUDO} 'docker ps --filter name={container_name} --format \"{{{{.Status}}}}\"'")
            status = out.strip()
            if "Up" in status:
                print(f"  [OK] {container_name}: {status}")
            else:
                print(f"  [WARN] {container_name}: {status or 'NOT FOUND'}")

        # 5. Cleanup disk space
        print(f"  [5/5] Cleanup...")
        chan = client.get_transport().open_session()
        out, _ = run_cmd(chan, f"{SUDO} 'docker image prune -f 2>&1 | tail -1'", timeout=60)
        print(f"  [OK] Pruned: {out.strip()}")
        chan = client.get_transport().open_session()
        out, _ = run_cmd(chan, f"df -h / | tail -1")
        print(f"  [OK] Disk: {out.strip()}")

        return True
    finally:
        client.close()


if __name__ == "__main__":
    results = {}
    for target in TARGETS:
        ok = deploy(target)
        results[target["name"]] = ok

    print(f"\n{'='*60}")
    print("  DEPLOYMENT RESULTS")
    print(f"{'='*60}")
    for name, ok in results.items():
        status = "SUCCESS" if ok else "FAILED"
        icon = "[OK]" if ok else "[FAIL]"
        print(f"  {icon} {name}: {status}")
    print()

    if not all(results.values()):
        sys.exit(1)
