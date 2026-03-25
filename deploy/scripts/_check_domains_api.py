#!/usr/bin/env python3
"""
ARIS — Check why domains on login page don't come from DB
Test API endpoints and DB connectivity
"""

import paramiko
import sys
from datetime import datetime

VM_APP = {"ip": "10.202.101.183", "user": "arisadmin", "password": "@u-1baR.0rg$U24"}


def run_sudo(client, cmd, timeout=30):
    full_cmd = f"sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    stdin.write(VM_APP["password"] + "\n")
    stdin.flush()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return out, err, code


def run(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return out, err, code


def step(client, title, cmd, sudo=False, timeout=30):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")
    if sudo:
        out, err, code = run_sudo(client, cmd, timeout)
    else:
        out, err, code = run(client, cmd, timeout)
    if out:
        print(out[:3000])
    if err and "[sudo]" not in err and "password" not in err.lower():
        print(f"  [STDERR] {err[:500]}")
    if code != 0:
        print(f"  [EXIT {code}]")
    return out, code


def main():
    print(f"{'#'*70}")
    print(f"  ARIS — Debug: Login Page Domains")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=VM_APP["ip"], username=VM_APP["user"], password=VM_APP["password"], timeout=15)
    print("[+] Connected.\n")

    # 1. Check tenant service is running
    step(client, "1. Tenant service container status",
         "docker ps --filter 'name=aris-tenant' --format '{{.Names}} {{.Status}}'", sudo=True)

    # 2. Test tenant service directly (port 3001)
    step(client, "2. API: GET /api/v1/public/domains (direct tenant:3001)",
         "curl -s http://localhost:3001/api/v1/public/domains 2>&1 | head -100")

    # 3. Test via Traefik (port 443)
    step(client, "3. API: GET /api/v1/public/domains (via Traefik HTTPS)",
         "curl -sk https://localhost/api/v1/public/domains 2>&1 | head -100")

    # 4. Test RECs endpoint
    step(client, "4. API: GET /api/v1/public/recs (direct tenant:3001)",
         "curl -s http://localhost:3001/api/v1/public/recs 2>&1 | head -100")

    # 5. Test RECs via Traefik
    step(client, "5. API: GET /api/v1/public/recs (via Traefik HTTPS)",
         "curl -sk https://localhost/api/v1/public/recs 2>&1 | head -100")

    # 6. Test public stats
    step(client, "6. API: GET /api/v1/public/stats (via Traefik)",
         "curl -sk https://localhost/api/v1/public/stats 2>&1 | head -100")

    # 7. Check tenant service logs for errors
    step(client, "7. Tenant service logs (last 30 lines)",
         "docker logs aris-tenant --tail 30 2>&1", sudo=True)

    # 8. Check if DB is reachable from tenant service
    step(client, "8. Test DB connection from tenant container",
         "docker exec aris-tenant sh -c 'node -e \"const { PrismaClient } = require(\\\"@prisma/client\\\"); const p = new PrismaClient(); p.\\$queryRaw\\`SELECT 1\\`.then(r => { console.log(\\\"DB OK:\\\", r); process.exit(0); }).catch(e => { console.error(\\\"DB FAIL:\\\", e.message); process.exit(1); })\"' 2>&1",
         sudo=True)

    # 9. Check domain table directly from DB VM
    print(f"\n{'='*70}")
    print(f"  9. Query domain table directly from DB")
    print(f"{'='*70}")

    db_client = paramiko.SSHClient()
    db_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        db_client.connect(hostname="10.202.101.185", username="arisadmin", password=VM_APP["password"], timeout=15)
        out, err, code = run_sudo(db_client,
            "docker exec aris-postgresql psql -U aris -d aris -c \"SELECT id, code, name, \\\"isActive\\\", \\\"sortOrder\\\" FROM tenant.domain ORDER BY \\\"sortOrder\\\" LIMIT 20;\" 2>&1",
            timeout=15)
        if out:
            print(out[:2000])
        if err and "[sudo]" not in err:
            print(f"  [STDERR] {err[:500]}")
        db_client.close()
    except Exception as e:
        print(f"  [!] DB connection failed: {e}")

    # 10. Check Redis cache
    print(f"\n{'='*70}")
    print(f"  10. Check Redis cache for public domains")
    print(f"{'='*70}")

    cache_client = paramiko.SSHClient()
    cache_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        cache_client.connect(hostname="10.202.101.186", username="arisadmin", password=VM_APP["password"], timeout=15)
        out, err, code = run_sudo(cache_client,
            "docker exec aris-redis redis-cli -a R3d1s_Pr0d_2024!vN7wQ GET aris:public:domains 2>&1 | head -50",
            timeout=15)
        if out:
            print(out[:2000])
        if err and "[sudo]" not in err and "Warning" not in err:
            print(f"  [STDERR] {err[:300]}")
        cache_client.close()
    except Exception as e:
        print(f"  [!] Redis connection failed: {e}")

    client.close()
    print(f"\n{'#'*70}")
    print(f"  Done — {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
