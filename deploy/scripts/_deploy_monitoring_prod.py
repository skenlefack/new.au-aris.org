"""
Deploy Portainer CE + Uptime Kuma to PRODUCTION environment.

Phase 1: Deploy Portainer agents on KAFKA, DB, CACHE VMs
Phase 2: Deploy Portainer server + Uptime Kuma on APP VM
         (skipped if --agents-only flag, since Docker may be stuck on APP)
Phase 3: Verify all endpoints

Usage:
  python _deploy_monitoring_prod.py              # Full deploy
  python _deploy_monitoring_prod.py --agents-only # Agents only (skip APP)
"""

import paramiko
import sys
import time

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO_CMD = f"echo '{SSH_PASS}' | sudo -S bash -c"

AGENTS_ONLY = "--agents-only" in sys.argv

AGENT_VMS = [
    {
        "name": "KAFKA",
        "host": "10.202.101.184",
        "deploy_dir": "/opt/aris-deploy/vm-kafka",
        "compose_src": "deploy/vm-kafka/docker-compose.yml",
    },
    {
        "name": "DB",
        "host": "10.202.101.185",
        "deploy_dir": "/opt/aris-deploy/vm-db",
        "compose_src": "deploy/vm-db/docker-compose.yml",
    },
    {
        "name": "CACHE",
        "host": "10.202.101.186",
        "deploy_dir": "/opt/aris-deploy/vm-cache",
        "compose_src": "deploy/vm-cache/docker-compose.yml",
    },
]

APP_VM = {
    "name": "APP",
    "host": "10.202.101.183",
    "deploy_dir": "/opt/aris-deploy/vm-app",
    "compose_src": "deploy/vm-app/docker-compose.yml",
}


def run(ssh, command, timeout=300):
    print(f"  > {command[:140]}{'...' if len(command) > 140 else ''}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        for line in combined.splitlines()[-8:]:
            print(f"    {line}")
    return code, out, err


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15,
                allow_agent=False, look_for_keys=False)
    return ssh


def step(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def deploy_agent(vm):
    """Deploy Portainer agent on a remote VM."""
    step(f"Phase 1: Portainer Agent on {vm['name']} ({vm['host']})")
    compose_src = vm["compose_src"]
    deploy_dir = vm["deploy_dir"]
    try:
        ssh = connect(vm["host"])
    except Exception as e:
        print(f"\n  [FAIL] Cannot connect to {vm['name']}: {e}")
        return False
    try:
        print("\n  [1/3] Git pull...")
        run(ssh, f"{SUDO_CMD} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'")

        print("\n  [2/3] Copy docker-compose.yml...")
        run(ssh, f"{SUDO_CMD} 'cp /opt/aris/{compose_src} {deploy_dir}/docker-compose.yml'")

        print("\n  [3/3] Start portainer-agent...")
        run(ssh, f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --no-deps portainer-agent'", timeout=120)

        code, out, _ = run(ssh, f"""{SUDO_CMD} 'docker ps --filter name=aris-portainer-agent --format "{{{{.Names}}}}  {{{{.Status}}}}"'""")
        if "Up" in out:
            print(f"\n  [OK] Portainer agent running on {vm['name']}")
            return True
        else:
            print(f"\n  [WARN] Agent may not be running on {vm['name']}")
            return False
    finally:
        ssh.close()


def deploy_server():
    """Deploy Portainer server + Uptime Kuma on APP VM."""
    compose_src = APP_VM["compose_src"]
    deploy_dir = APP_VM["deploy_dir"]
    step(f"Phase 2: Portainer + Uptime Kuma on APP ({APP_VM['host']})")

    if AGENTS_ONLY:
        print("\n  [SKIP] --agents-only flag set, skipping APP deployment")
        print("  Run without --agents-only after Docker is fixed on APP")
        return

    try:
        ssh = connect(APP_VM["host"])
    except Exception as e:
        print(f"\n  [FAIL] Cannot connect to APP: {e}")
        return
    try:
        print("\n  [1/3] Git pull...")
        run(ssh, f"{SUDO_CMD} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'")

        print("\n  [2/3] Copy docker-compose.yml...")
        run(ssh, f"{SUDO_CMD} 'cp /opt/aris/{compose_src} {deploy_dir}/docker-compose.yml'")

        print("\n  [3/3] Start portainer + uptime-kuma...")
        run(ssh, f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --no-deps portainer uptime-kuma'", timeout=180)

        for svc in ["portainer", "uptime-kuma"]:
            code, out, _ = run(ssh, f"""{SUDO_CMD} 'docker ps --filter name=aris-{svc} --format "{{{{.Names}}}}  {{{{.Status}}}}"'""")
            status = "OK" if "Up" in out else "WARN"
            print(f"\n  [{status}] {svc}: {out.strip()}")
    finally:
        ssh.close()


def verify():
    """Verify agent connectivity from APP."""
    step("Phase 3: Verification")
    try:
        ssh = connect(APP_VM["host"])
    except Exception as e:
        print(f"\n  [FAIL] Cannot connect to APP for verification: {e}")
        return
    try:
        print("\n  Checking Portainer agents...")
        for vm in AGENT_VMS:
            host = vm["host"]
            code, out, _ = run(ssh, f"""{SUDO_CMD} 'curl -s -o /dev/null -w "%{{http_code}}" --max-time 5 http://{host}:9001'""", timeout=15)
            http = out.strip().split("\n")[-1] if out.strip() else "000"
            icon = "OK" if http != "000" else "FAIL"
            print(f"  [{icon}] {vm['name']} agent ({host}:9001) -> HTTP {http}")

        if not AGENTS_ONLY:
            print("\n  Checking Traefik routing...")
            for domain in ["portainer.au-aris.org", "status.au-aris.org"]:
                code, out, _ = run(ssh, f"""{SUDO_CMD} 'curl -sk -o /dev/null -w "%{{http_code}}" --max-time 10 -H "Host: {domain}" https://localhost/'""", timeout=15)
                http = out.strip().split("\n")[-1] if out.strip() else "000"
                icon = "OK" if http in ("200", "301", "302") else "FAIL"
                print(f"  [{icon}] {domain} -> HTTP {http}")
    finally:
        ssh.close()

    step("NEXT STEPS")
    print("  1. Create DNS A records:")
    print("     portainer.au-aris.org -> 10.202.101.183")
    print("     status.au-aris.org    -> 10.202.101.183")
    print("")
    print("  2. Open https://portainer.au-aris.org")
    print("     - Create admin account on first visit")
    print("     - Add environments:")
    print("       KAFKA: 10.202.101.184:9001")
    print("       DB:    10.202.101.185:9001")
    print("       CACHE: 10.202.101.186:9001")
    print("")
    print("  3. Open https://status.au-aris.org")
    print("     - Create admin account, add monitors")


def main():
    step("ARIS 4.0 — Monitoring Tools Deployment (PRODUCTION)")

    for vm in AGENT_VMS:
        deploy_agent(vm)

    deploy_server()

    time.sleep(5)
    verify()


if __name__ == "__main__":
    main()
