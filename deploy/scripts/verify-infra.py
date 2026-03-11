#!/usr/bin/env python3
"""Verify all 3 infrastructure VMs are operational."""
import paramiko
import sys
import os

os.environ["PYTHONIOENCODING"] = "utf-8"

SSH_PASS = "@u-1baR.0rg$U24"

def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()

def run_sudo(host, cmd, timeout=15):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, "arisadmin", SSH_PASS, timeout=10,
              allow_agent=False, look_for_keys=False)
    stdin, stdout, stderr = c.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    c.close()
    return code, out

safe_print("=" * 60)
safe_print("  ARIS 4.0 - Infrastructure Verification")
safe_print("=" * 60)

# VM-DB
safe_print("\n--- VM-DB (10.202.101.185) ---")
code, out = run_sudo("10.202.101.185", "docker ps --format '{{.Names}}: {{.Status}}'")
safe_print(f"  Containers: {out}")
code, out = run_sudo("10.202.101.185", "docker exec aris-pgbouncer pg_isready -h 127.0.0.1 -p 6432 -U aris -d aris")
safe_print(f"  PgBouncer: {out}")
code, out = run_sudo("10.202.101.185", "docker exec aris-postgres psql -U aris -d aris -t -c \"SELECT count(*) FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'\"")
safe_print(f"  Schema count: {out.strip()}")

# VM-KAFKA
safe_print("\n--- VM-KAFKA (10.202.101.184) ---")
code, out = run_sudo("10.202.101.184", "docker ps --format '{{.Names}}: {{.Status}}'")
safe_print(f"  Containers:\n    {out.replace(chr(10), chr(10) + '    ')}")
code, out = run_sudo("10.202.101.184", "docker exec aris-kafka-1 kafka-topics --list --bootstrap-server localhost:29092 2>/dev/null | wc -l")
safe_print(f"  Topic count: {out}")

# VM-CACHE
safe_print("\n--- VM-CACHE (10.202.101.186) ---")
code, out = run_sudo("10.202.101.186", "docker ps --format '{{.Names}}: {{.Status}}'")
safe_print(f"  Containers:\n    {out.replace(chr(10), chr(10) + '    ')}")
code, out = run_sudo("10.202.101.186", "docker exec aris-redis redis-cli -a 'R3d1s_Pr0d_2024!vN7wQ' ping 2>/dev/null")
safe_print(f"  Redis PING: {out}")
code, out = run_sudo("10.202.101.186", "curl -sf http://localhost:9200/_cluster/health?pretty 2>/dev/null")
safe_print(f"  OpenSearch: {out[:200] if out else 'NOT READY'}")

# Cross-VM connectivity test (from VM-APP perspective)
safe_print("\n--- Cross-VM Connectivity (from VM-APP 10.202.101.183) ---")
tests = [
    ("PostgreSQL (PgBouncer)", "timeout 3 bash -c 'echo > /dev/tcp/10.202.101.185/6432' 2>/dev/null && echo OK || echo FAIL"),
    ("Kafka broker 1",        "timeout 3 bash -c 'echo > /dev/tcp/10.202.101.184/9092' 2>/dev/null && echo OK || echo FAIL"),
    ("Kafka broker 2",        "timeout 3 bash -c 'echo > /dev/tcp/10.202.101.184/9094' 2>/dev/null && echo OK || echo FAIL"),
    ("Kafka broker 3",        "timeout 3 bash -c 'echo > /dev/tcp/10.202.101.184/9096' 2>/dev/null && echo OK || echo FAIL"),
    ("Redis",                 "timeout 3 bash -c 'echo > /dev/tcp/10.202.101.186/6379' 2>/dev/null && echo OK || echo FAIL"),
    ("OpenSearch",            "curl -sf http://10.202.101.186:9200 >/dev/null 2>&1 && echo OK || echo FAIL"),
]
for name, cmd in tests:
    code, out = run_sudo("10.202.101.183", cmd)
    safe_print(f"  {name}: {out}")

safe_print("\n" + "=" * 60)
safe_print("  Infrastructure verification complete!")
safe_print("=" * 60)
