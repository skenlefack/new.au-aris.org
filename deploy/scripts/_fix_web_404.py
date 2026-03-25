#!/usr/bin/env python3
"""
ARIS — Fix 404 on au-aris.org — Check and restore web + services
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
    full_cmd = f"sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    stdin.write(VM_APP["password"] + "\n")
    stdin.flush()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err_lines = [l for l in err.split("\n")
                 if "[sudo]" not in l and "password for" not in l.lower()]
    err = "\n".join(err_lines).strip()
    return out, err, code


def step(client, title, cmd, timeout=600):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")
    out, err, code = run_sudo(client, cmd, timeout=timeout)
    if out:
        lines = out.split("\n")
        if len(lines) > 50:
            print("\n".join(lines[:25]))
            print(f"  ... ({len(lines) - 50} lines omitted) ...")
            print("\n".join(lines[-25:]))
        else:
            print(out)
    if err and len(err) > 10:
        err_lines = err.split("\n")
        if len(err_lines) > 15:
            print(f"  [STDERR last 15 lines]")
            print("\n".join(err_lines[-15:]))
        else:
            print(f"  [STDERR] {err}")
    status = "OK" if code == 0 else f"EXIT {code}"
    print(f"  [{status}]")
    return out, code


def main():
    print(f"{'#'*70}")
    print(f"  ARIS — Fix 404 on au-aris.org")
    print(f"  {datetime.now().isoformat()}")
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

        # 1. Check which containers are down
        step(client, "1. Container status (all)",
             "docker ps -a --format 'table {{.Names}}\\t{{.Status}}\\t{{.Image}}' | sort")

        # 2. Check specifically web and traefik
        step(client, "2. Web + Traefik status",
             "docker ps -a --filter 'name=aris-web' --filter 'name=aris-traefik' --format 'table {{.Names}}\\t{{.Status}}\\t{{.Image}}'")

        # 3. Check web container logs
        step(client, "3. Web container logs (last 30 lines)",
             "docker logs aris-web --tail 30 2>&1 || echo 'Container not running'")

        # 4. Check traefik logs
        step(client, "4. Traefik logs (last 20 lines)",
             "docker logs aris-traefik --tail 20 2>&1 || echo 'Traefik not running'")

        # 5. Rebuild web container
        step(client, "5. Rebuild aris-web",
             "cd /opt/aris-deploy/vm-app && docker compose build web 2>&1",
             timeout=600)

        # 6. Restart web + any other stopped containers
        step(client, "6. Restart all services (docker compose up -d)",
             "cd /opt/aris-deploy/vm-app && docker compose up -d 2>&1",
             timeout=300)

        # 7. Wait and verify
        import time
        print("\n  Waiting 10s for containers to start...")
        time.sleep(10)

        step(client, "7. Verify all containers running",
             "docker ps --format 'table {{.Names}}\\t{{.Status}}' | sort")

        # 8. Test web endpoint
        step(client, "8. Test web endpoint",
             "curl -sk -o /dev/null -w '%{http_code}' https://localhost/ 2>/dev/null || curl -sk -o /dev/null -w '%{http_code}' http://localhost:3100/ 2>/dev/null || echo 'FAIL'")

    except Exception as e:
        print(f"\n[!] Error: {e}")
        sys.exit(1)
    finally:
        client.close()
        print(f"\n{'#'*70}")
        print(f"  Done — {datetime.now().isoformat()}")
        print(f"{'#'*70}")


if __name__ == "__main__":
    main()
