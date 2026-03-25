#!/usr/bin/env python3
"""
ARIS — Fix Veeam false-positive (internmap/nmap IoC) — v2
Handles sudo -S properly with individual commands.
"""

import paramiko
import sys
from datetime import datetime


VM_APP = {
    "ip": "10.202.101.183",
    "user": "arisadmin",
    "password": "@u-1baR.0rg$U24",
}


def run_sudo(client, cmd, timeout=600):
    """Run a single sudo command, piping password via stdin."""
    full_cmd = f"sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    stdin.write(VM_APP["password"] + "\n")
    stdin.flush()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    # Filter sudo prompt noise
    err_lines = [l for l in err.split("\n")
                 if "[sudo]" not in l and "password for" not in l.lower()]
    err = "\n".join(err_lines).strip()
    return out, err, code


def step(client, num, title, cmd, timeout=600):
    """Run and display a deployment step."""
    print(f"\n{'='*70}")
    print(f"  STEP {num} — {title}")
    print(f"{'='*70}")
    out, err, code = run_sudo(client, cmd, timeout=timeout)
    if out:
        # Truncate very long output
        lines = out.split("\n")
        if len(lines) > 60:
            print("\n".join(lines[:30]))
            print(f"  ... ({len(lines) - 60} lines omitted) ...")
            print("\n".join(lines[-30:]))
        else:
            print(out)
    if err:
        lines = err.split("\n")
        if len(lines) > 20:
            print(f"  [STDERR] ({len(lines)} lines, showing last 20)")
            print("\n".join(lines[-20:]))
        else:
            print(f"  [STDERR] {err}")
    status = "OK" if code == 0 else f"FAILED (exit {code})"
    print(f"  [{status}]")
    return code


def main():
    print(f"\n{'#'*70}")
    print(f"  ARIS — Fix Veeam IoC False Positive (v2)")
    print(f"  Target: nbo-aris04 ({VM_APP['ip']})")
    print(f"  Time: {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(
            hostname=VM_APP["ip"],
            username=VM_APP["user"],
            password=VM_APP["password"],
            timeout=15,
        )
        print("[+] Connected.\n")

        # Step 1: Verify git pull already done
        step(client, "1/7", "Verify Dockerfile.service has the fix",
             "grep -c internmap /opt/aris/Dockerfile.service")

        # Step 2: Copy docker-compose.yml to deploy dir
        step(client, "2/7", "Copy docker-compose.yml to deploy dir",
             "cp /opt/aris/deploy/vm-app/docker-compose.yml /opt/aris-deploy/vm-app/docker-compose.yml")

        # Step 3: Copy Dockerfile.service to where compose expects it
        # compose context is /opt/aris, so Dockerfile.service is already there from git pull
        step(client, "3/7", "Verify Dockerfile.service is accessible",
             "ls -la /opt/aris/Dockerfile.service")

        # Step 4: Rebuild ALL services with --no-cache
        print(f"\n{'='*70}")
        print(f"  STEP 4/7 — Rebuilding all services (--no-cache)")
        print(f"  This will take 10-15 minutes...")
        print(f"{'='*70}")
        code = step(client, "4/7", "Docker compose build --no-cache",
                    "cd /opt/aris-deploy/vm-app && docker compose build --no-cache 2>&1",
                    timeout=600)

        if code != 0:
            print("\n  [!] Build failed. Trying individual service rebuild...")
            # Try building just one service as a test
            step(client, "4b/7", "Test build: tenant service only",
                 "cd /opt/aris-deploy/vm-app && docker compose build --no-cache tenant 2>&1",
                 timeout=300)

        # Step 5: Restart services
        step(client, "5/7", "Restart services (docker compose up -d)",
             "cd /opt/aris-deploy/vm-app && docker compose up -d 2>&1")

        # Step 6: Prune Docker
        step(client, "6/7", "Prune Docker build cache + dangling images",
             "docker builder prune -af && docker image prune -af")

        # Step 7: Verify internmap is gone
        step(client, "7/7", "Verify: search for internmap in Docker filesystem",
             "count=$(find /var/lib/docker -iname \"*internmap*\" 2>/dev/null | wc -l); echo \"internmap occurrences: $count\"; if [ \"$count\" -eq 0 ]; then echo \"SUCCESS: internmap completely removed\"; else find /var/lib/docker -iname \"*internmap*\" 2>/dev/null | head -10; echo \"WARNING: $count files still present (may need full image prune)\"; fi")

    except Exception as e:
        print(f"\n[!] Error: {e}")
        sys.exit(1)
    finally:
        client.close()
        print(f"\n{'#'*70}")
        print(f"  Deployment complete — {datetime.now().isoformat()}")
        print(f"{'#'*70}")


if __name__ == "__main__":
    main()
