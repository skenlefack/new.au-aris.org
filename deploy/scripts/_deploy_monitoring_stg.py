"""
Deploy Portainer CE + Uptime Kuma to STAGING environment.

Steps:
  Phase 1: Deploy Portainer agents on KAFKA, DB, CACHE VMs
  Phase 2: Deploy Portainer server + Uptime Kuma on APP VM
  Phase 3: Verify all endpoints
"""

import paramiko
import sys
import time

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO_CMD = f"echo '{SSH_PASS}' | sudo -S bash -c"

AGENT_VMS = [
    {
        "name": "KAFKA",
        "host": "10.202.101.147",
        "deploy_dir": "/opt/aris-deploy/vm-kafka-stg",
        "compose_src": "deploy/vm-kafka-stg/docker-compose.yml",
    },
    {
        "name": "DB",
        "host": "10.202.101.148",
        "deploy_dir": "/opt/aris-deploy/vm-db-stg",
        "compose_src": "deploy/vm-db-stg/docker-compose.yml",
    },
    {
        "name": "CACHE",
        "host": "10.202.101.149",
        "deploy_dir": "/opt/aris-deploy/vm-cache-stg",
        "compose_src": "deploy/vm-cache-stg/docker-compose.yml",
    },
]

APP_VM = {
    "name": "APP",
    "host": "10.202.101.146",
    "deploy_dir": "/opt/aris-deploy/vm-app-stg",
    "compose_src": "deploy/vm-app-stg/docker-compose.yml",
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
    ssh = connect(vm["host"])
    compose_src = vm["compose_src"]
    deploy_dir = vm["deploy_dir"]
    try:
        # 1. Git pull
        print("\n  [1/3] Git pull...")
        run(ssh, f"{SUDO_CMD} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'")

        # 2. Copy docker-compose.yml
        print("\n  [2/3] Copy docker-compose.yml...")
        run(ssh, f"{SUDO_CMD} 'cp /opt/aris/{compose_src} {deploy_dir}/docker-compose.yml'")

        # 3. Start portainer-agent only (--no-deps avoids touching existing services)
        print("\n  [3/3] Start portainer-agent...")
        run(ssh, f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --no-deps portainer-agent'", timeout=120)

        # Verify
        code, out, _ = run(ssh, f"""{SUDO_CMD} 'docker ps --filter name=aris-stg-portainer-agent --format "{{{{.Names}}}}  {{{{.Status}}}}"'""")
        if "Up" in out:
            print(f"\n  [OK] Portainer agent running on {vm['name']}")
        else:
            print(f"\n  [WARN] Agent may not be running on {vm['name']}")
    finally:
        ssh.close()


def deploy_server():
    """Deploy Portainer server + Uptime Kuma on APP VM."""
    compose_src = APP_VM["compose_src"]
    deploy_dir = APP_VM["deploy_dir"]
    step(f"Phase 2: Portainer + Uptime Kuma on APP ({APP_VM['host']})")
    ssh = connect(APP_VM["host"])
    try:
        # 1. Git pull
        print("\n  [1/3] Git pull...")
        run(ssh, f"{SUDO_CMD} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'")

        # 2. Copy docker-compose.yml
        print("\n  [2/3] Copy docker-compose.yml...")
        run(ssh, f"{SUDO_CMD} 'cp /opt/aris/{compose_src} {deploy_dir}/docker-compose.yml'")

        # 3. Start portainer + uptime-kuma only
        print("\n  [3/3] Start portainer + uptime-kuma...")
        run(ssh, f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --no-deps portainer uptime-kuma'", timeout=180)

        # Verify
        for svc in ["portainer", "uptime-kuma"]:
            code, out, _ = run(ssh, f"""{SUDO_CMD} 'docker ps --filter name=aris-stg-{svc} --format "{{{{.Names}}}}  {{{{.Status}}}}"'""")
            status = "OK" if "Up" in out else "WARN"
            print(f"\n  [{status}] {svc}: {out.strip()}")
    finally:
        ssh.close()


def verify():
    """Verify endpoints via Traefik and agent connectivity."""
    step("Phase 3: Verification")
    ssh = connect(APP_VM["host"])
    try:
        # Check Portainer via Traefik
        print("\n  Checking Traefik routing...")
        code, out, _ = run(ssh, f"{SUDO_CMD} 'curl -sk -o /dev/null -w \"%{{http_code}}\" --max-time 10 https://portainer-test.au-aris.org/'")
        http = out.strip().split("\n")[-1] if out.strip() else "000"
        icon = "OK" if http in ("200", "301", "302") else "FAIL"
        print(f"  [{icon}] portainer-test.au-aris.org -> HTTP {http}")

        code, out, _ = run(ssh, f"{SUDO_CMD} 'curl -sk -o /dev/null -w \"%{{http_code}}\" --max-time 10 https://status-test.au-aris.org/'")
        http = out.strip().split("\n")[-1] if out.strip() else "000"
        icon = "OK" if http in ("200", "301", "302") else "FAIL"
        print(f"  [{icon}] status-test.au-aris.org -> HTTP {http}")

        # Check agent connectivity
        print("\n  Checking Portainer agents...")
        for vm in AGENT_VMS:
            host = vm["host"]
            code, out, _ = run(ssh, f"""{SUDO_CMD} 'curl -s -o /dev/null -w "%{{http_code}}" --max-time 5 http://{host}:9001'""", timeout=15)
            http = out.strip().split("\n")[-1] if out.strip() else "000"
            icon = "OK" if http != "000" else "FAIL"
            print(f"  [{icon}] {vm['name']} agent ({vm['host']}:9001) -> HTTP {http}")

    finally:
        ssh.close()

    step("NEXT STEPS")
    print("  1. Open https://portainer-test.au-aris.org")
    print("     - Create admin account on first visit")
    print("     - Add environments:")
    print("       KAFKA: 10.202.101.147:9001")
    print("       DB:    10.202.101.148:9001")
    print("       CACHE: 10.202.101.149:9001")
    print("")
    print("  2. Open https://status-test.au-aris.org")
    print("     - Create admin account on first visit")
    print("     - Add monitors for all services + VMs")


def main():
    step("ARIS 4.0 — Monitoring Tools Deployment (Staging)")

    # Phase 1: Agents on remote VMs
    for vm in AGENT_VMS:
        deploy_agent(vm)

    # Phase 2: Server on APP
    deploy_server()

    # Phase 3: Verify
    time.sleep(5)
    verify()


if __name__ == "__main__":
    main()
