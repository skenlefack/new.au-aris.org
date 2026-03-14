#!/usr/bin/env python3
"""Debug domains visibility on ARIS production server."""
import sys
from ssh_config import ssh, VM_APP


def main():
    # 1. Public domains API via tenant container
    print(f"\n{'='*70}")
    print(f"  1. Public Domains API (/api/v1/public/domains)")
    print(f"{'='*70}")
    code, out, err = ssh(VM_APP, "docker exec aris-tenant curl -s http://localhost:3001/api/v1/public/domains")
    if out.strip():
        print(out)
    elif err.strip():
        print(f"[STDERR] {err}")
    else:
        print("(no output)")

    # 2. Redis cache keys matching *domain*
    print(f"\n{'='*70}")
    print(f"  2. Redis Cache Keys matching *domain*")
    print(f"{'='*70}")
    code, out, err = ssh(VM_APP, 'docker exec aris-redis redis-cli KEYS "*domain*"')
    if out.strip():
        print(out)
    elif err.strip():
        print(f"[STDERR] {err}")
    else:
        print("(no output)")

    # 3. Redis cache keys matching *public*
    print(f"\n{'='*70}")
    print(f"  3. Redis Cache Keys matching *public*")
    print(f"{'='*70}")
    code, out, err = ssh(VM_APP, 'docker exec aris-redis redis-cli KEYS "*public*"')
    if out.strip():
        print(out)
    elif err.strip():
        print(f"[STDERR] {err}")
    else:
        print("(no output)")

    # 4. Actual DB data via Prisma
    prisma_cmd = (
        'docker exec aris-tenant node -e "'
        "const {PrismaClient}=require('@prisma/client');"
        "const p=new PrismaClient();"
        "p.domain.findMany({orderBy:{sortOrder:'asc'}})"
        '.then(d=>{console.log(JSON.stringify(d,null,2));p.\\$disconnect()})'
        '.catch(e=>{console.error(e);p.\\$disconnect()})'
        '"'
    )
    print(f"\n{'='*70}")
    print(f"  4. DB Domain Records (via Prisma in tenant container)")
    print(f"{'='*70}")
    code, out, err = ssh(VM_APP, prisma_cmd)
    if out.strip():
        print(out)
    elif err.strip():
        print(f"[STDERR] {err}")
    else:
        print("(no output)")

    # 5. Check tenant container logs for domain-related entries
    print(f"\n{'='*70}")
    print(f"  5. Recent Tenant Container Logs (domain-related)")
    print(f"{'='*70}")
    code, out, err = ssh(VM_APP, 'docker logs aris-tenant --tail 50 2>&1 | grep -i domain || echo "(no domain-related logs in last 50 lines)"')
    if out.strip():
        print(out)
    elif err.strip():
        print(f"[STDERR] {err}")
    else:
        print("(no output)")

    # 6. All Redis keys
    print(f"\n{'='*70}")
    print(f"  6. ALL Redis Keys (to see full cache state)")
    print(f"{'='*70}")
    code, out, err = ssh(VM_APP, 'docker exec aris-redis redis-cli KEYS "*"')
    if out.strip():
        print(out)
    elif err.strip():
        print(f"[STDERR] {err}")
    else:
        print("(no output)")

    print(f"\n{'='*70}")
    print("  Debug complete.")
    print(f"{'='*70}")

if __name__ == "__main__":
    main()
