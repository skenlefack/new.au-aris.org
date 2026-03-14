#!/usr/bin/env python3
"""Verify all 3 infrastructure VMs are operational."""
import sys

from ssh_config import ssh, VM_APP, VM_DB, VM_KAFKA, VM_CACHE


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()

def run_sudo(host, cmd, timeout=15):
    code, out, _err = ssh(host, cmd, timeout=timeout)
    return code, out

safe_print("=" * 60)
safe_print("  ARIS 4.0 - Infrastructure Verification")
safe_print("=" * 60)

# VM-DB
safe_print(f"\n--- VM-DB ({VM_DB}) ---")
code, out = run_sudo(VM_DB, "docker ps --format '{{.Names}}: {{.Status}}'")
safe_print(f"  Containers: {out}")
code, out = run_sudo(VM_DB, "docker exec aris-pgbouncer pg_isready -h 127.0.0.1 -p 6432 -U aris -d aris")
safe_print(f"  PgBouncer: {out}")
code, out = run_sudo(VM_DB, "docker exec aris-postgres psql -U aris -d aris -t -c \"SELECT count(*) FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'\"")
safe_print(f"  Schema count: {out.strip()}")

# VM-KAFKA
safe_print(f"\n--- VM-KAFKA ({VM_KAFKA}) ---")
code, out = run_sudo(VM_KAFKA, "docker ps --format '{{.Names}}: {{.Status}}'")
safe_print(f"  Containers:\n    {out.replace(chr(10), chr(10) + '    ')}")
code, out = run_sudo(VM_KAFKA, "docker exec aris-kafka-1 kafka-topics --list --bootstrap-server localhost:29092 2>/dev/null | wc -l")
safe_print(f"  Topic count: {out}")

# VM-CACHE
safe_print(f"\n--- VM-CACHE ({VM_CACHE}) ---")
code, out = run_sudo(VM_CACHE, "docker ps --format '{{.Names}}: {{.Status}}'")
safe_print(f"  Containers:\n    {out.replace(chr(10), chr(10) + '    ')}")
code, out = run_sudo(VM_CACHE, "docker exec aris-redis redis-cli -a 'R3d1s_Pr0d_2024!vN7wQ' ping 2>/dev/null")
safe_print(f"  Redis PING: {out}")
code, out = run_sudo(VM_CACHE, "curl -sf http://localhost:9200/_cluster/health?pretty 2>/dev/null")
safe_print(f"  OpenSearch: {out[:200] if out else 'NOT READY'}")

# Cross-VM connectivity test (from VM-APP perspective)
safe_print(f"\n--- Cross-VM Connectivity (from VM-APP {VM_APP}) ---")
tests = [
    ("PostgreSQL (PgBouncer)", f"timeout 3 bash -c 'echo > /dev/tcp/{VM_DB}/6432' 2>/dev/null && echo OK || echo FAIL"),
    ("Kafka broker 1",        f"timeout 3 bash -c 'echo > /dev/tcp/{VM_KAFKA}/9092' 2>/dev/null && echo OK || echo FAIL"),
    ("Kafka broker 2",        f"timeout 3 bash -c 'echo > /dev/tcp/{VM_KAFKA}/9094' 2>/dev/null && echo OK || echo FAIL"),
    ("Kafka broker 3",        f"timeout 3 bash -c 'echo > /dev/tcp/{VM_KAFKA}/9096' 2>/dev/null && echo OK || echo FAIL"),
    ("Redis",                 f"timeout 3 bash -c 'echo > /dev/tcp/{VM_CACHE}/6379' 2>/dev/null && echo OK || echo FAIL"),
    ("OpenSearch",            f"curl -sf http://{VM_CACHE}:9200 >/dev/null 2>&1 && echo OK || echo FAIL"),
]
for name, cmd in tests:
    code, out = run_sudo(VM_APP, cmd)
    safe_print(f"  {name}: {out}")

safe_print("\n" + "=" * 60)
safe_print("  Infrastructure verification complete!")
safe_print("=" * 60)
