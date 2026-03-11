#!/usr/bin/env python3
"""
ARIS 4.0 — Full verification across all 4 VMs.
VM-DB (10.202.101.185), VM-KAFKA (10.202.101.184),
VM-CACHE (10.202.101.186), VM-APP (10.202.101.183)
"""
import paramiko
import sys
import os
import json

os.environ["PYTHONIOENCODING"] = "utf-8"

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

VMS = {
    "VM-APP":   "10.202.101.183",
    "VM-KAFKA": "10.202.101.184",
    "VM-DB":    "10.202.101.185",
    "VM-CACHE": "10.202.101.186",
}


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, SSH_USER, SSH_PASS, timeout=15,
              allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=15):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


safe_print("=" * 70)
safe_print("  ARIS 4.0 — Full Deployment Verification (4 VMs)")
safe_print("=" * 70)

total_pass = 0
total_fail = 0

# ═══════════════════════════════════════════════════════════════════════
# VM-DB: PostgreSQL + PgBouncer
# ═══════════════════════════════════════════════════════════════════════
safe_print("\n" + "━" * 70)
safe_print("  VM-DB (10.202.101.185) — PostgreSQL + PgBouncer")
safe_print("━" * 70)

try:
    c = get_client(VMS["VM-DB"])

    # Docker containers
    code, out = run_sudo(c, "docker ps --format '{{.Names}}: {{.Status}}' 2>/dev/null")
    safe_print(f"\n  Containers:")
    for line in out.splitlines():
        safe_print(f"    {line}")

    # PostgreSQL connectivity
    code, out = run_sudo(c, "docker exec aris-postgres pg_isready -U aris 2>&1")
    pg_ok = "accepting" in out
    safe_print(f"\n  PostgreSQL: {'OK' if pg_ok else 'FAIL'} ({out})")
    total_pass += 1 if pg_ok else 0
    total_fail += 0 if pg_ok else 1

    # PgBouncer connectivity
    code, out = run_sudo(c, "docker exec aris-pgbouncer sh -c 'PGPASSWORD=Ar1s_Pr0d_2024!xK9mZ psql -h 127.0.0.1 -p 6432 -U aris -d aris -c \"SELECT 1\" 2>&1' | tail -3")
    pgb_ok = code == 0
    safe_print(f"  PgBouncer:  {'OK' if pgb_ok else 'FAIL'}")
    total_pass += 1 if pgb_ok else 0
    total_fail += 0 if pgb_ok else 1

    # Schema count
    code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -t -c "SELECT count(*) FROM information_schema.schemata WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast')" 2>&1""")
    schema_count = out.strip()
    safe_print(f"  Schemas:    {schema_count}")

    # Table count
    code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -t -c "SELECT count(*) FROM information_schema.tables WHERE table_schema NOT IN ('information_schema', 'pg_catalog', 'pg_toast') AND table_type='BASE TABLE'" 2>&1""")
    table_count = out.strip()
    safe_print(f"  Tables:     {table_count}")

    # User count
    code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -t -c "SELECT count(*) FROM public.users" 2>&1""")
    user_count = out.strip()
    safe_print(f"  Users:      {user_count}")

    # Tenant count
    code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -t -c "SELECT count(*) FROM public.tenants" 2>&1""")
    tenant_count = out.strip()
    safe_print(f"  Tenants:    {tenant_count}")

    # Disk
    code, out = run_sudo(c, "df -h / | tail -1")
    safe_print(f"  Disk:       {out}")

    c.close()
except Exception as e:
    safe_print(f"  CONNECTION FAILED: {e}")
    total_fail += 2

# ═══════════════════════════════════════════════════════════════════════
# VM-KAFKA: Kafka KRaft + Schema Registry
# ═══════════════════════════════════════════════════════════════════════
safe_print("\n" + "━" * 70)
safe_print("  VM-KAFKA (10.202.101.184) — Kafka KRaft + Schema Registry")
safe_print("━" * 70)

try:
    c = get_client(VMS["VM-KAFKA"])

    # Docker containers
    code, out = run_sudo(c, "docker ps --format '{{.Names}}: {{.Status}}' 2>/dev/null")
    safe_print(f"\n  Containers:")
    for line in out.splitlines():
        safe_print(f"    {line}")

    # Kafka broker health
    code, out = run_sudo(c, "docker exec kafka1 kafka-broker-api-versions --bootstrap-server localhost:9092 2>&1 | head -1")
    kafka_ok = code == 0 and "ApiVersion" in out
    safe_print(f"\n  Kafka broker: {'OK' if kafka_ok else 'FAIL'}")
    total_pass += 1 if kafka_ok else 0
    total_fail += 0 if kafka_ok else 1

    # Topic count
    code, out = run_sudo(c, "docker exec kafka1 kafka-topics --list --bootstrap-server localhost:9092 2>/dev/null | wc -l")
    topic_count = out.strip()
    safe_print(f"  Topics:       {topic_count}")

    # Schema Registry
    code, out = run_sudo(c, "curl -sf http://localhost:8081/subjects 2>/dev/null | head -c 200")
    sr_ok = code == 0
    safe_print(f"  Schema Reg:   {'OK' if sr_ok else 'FAIL'}")
    total_pass += 1 if sr_ok else 0
    total_fail += 0 if sr_ok else 1

    # Kafka UI
    code, out = run_sudo(c, "curl -sf -o /dev/null -w '%{http_code}' http://localhost:8080 2>/dev/null")
    kui_ok = out in ["200", "302", "301"]
    safe_print(f"  Kafka UI:     {'OK' if kui_ok else 'FAIL'} ({out})")
    total_pass += 1 if kui_ok else 0
    total_fail += 0 if kui_ok else 1

    # Disk
    code, out = run_sudo(c, "df -h / | tail -1")
    safe_print(f"  Disk:         {out}")

    c.close()
except Exception as e:
    safe_print(f"  CONNECTION FAILED: {e}")
    total_fail += 3

# ═══════════════════════════════════════════════════════════════════════
# VM-CACHE: Redis + OpenSearch
# ═══════════════════════════════════════════════════════════════════════
safe_print("\n" + "━" * 70)
safe_print("  VM-CACHE (10.202.101.186) — Redis + OpenSearch")
safe_print("━" * 70)

try:
    c = get_client(VMS["VM-CACHE"])

    # Docker containers
    code, out = run_sudo(c, "docker ps --format '{{.Names}}: {{.Status}}' 2>/dev/null")
    safe_print(f"\n  Containers:")
    for line in out.splitlines():
        safe_print(f"    {line}")

    # Redis PING
    code, out = run_sudo(c, "docker exec aris-redis redis-cli ping 2>&1")
    redis_ok = "PONG" in out
    safe_print(f"\n  Redis:        {'OK (PONG)' if redis_ok else 'FAIL'}")
    total_pass += 1 if redis_ok else 0
    total_fail += 0 if redis_ok else 1

    # Redis info
    code, out = run_sudo(c, "docker exec aris-redis redis-cli info keyspace 2>&1 | tail -5")
    safe_print(f"  Redis keys:   {out.strip()[:100]}")

    # OpenSearch
    code, out = run_sudo(c, "curl -sf http://localhost:9200/_cluster/health 2>&1 | head -c 200")
    os_ok = code == 0 and ("green" in out or "yellow" in out)
    safe_print(f"  OpenSearch:   {'OK' if os_ok else 'FAIL'}")
    if out:
        try:
            health = json.loads(out)
            safe_print(f"    Status:     {health.get('status', '?')}")
            safe_print(f"    Nodes:      {health.get('number_of_nodes', '?')}")
        except:
            pass
    total_pass += 1 if os_ok else 0
    total_fail += 0 if os_ok else 1

    # Disk
    code, out = run_sudo(c, "df -h / | tail -1")
    safe_print(f"  Disk:         {out}")

    c.close()
except Exception as e:
    safe_print(f"  CONNECTION FAILED: {e}")
    total_fail += 2

# ═══════════════════════════════════════════════════════════════════════
# VM-APP: All Services + Frontend + Monitoring
# ═══════════════════════════════════════════════════════════════════════
safe_print("\n" + "━" * 70)
safe_print("  VM-APP (10.202.101.183) — Microservices + Frontend + Monitoring")
safe_print("━" * 70)

try:
    c = get_client(VMS["VM-APP"])

    # Container count
    code, out = run_sudo(c, "docker ps -q 2>/dev/null | wc -l")
    running = out.strip()
    code, out = run_sudo(c, "docker ps -aq 2>/dev/null | wc -l")
    total_containers = out.strip()
    safe_print(f"\n  Containers: {running}/{total_containers} running")

    # Health checks for all services
    services = [
        # Platform
        ("Credential",       3002),
        ("Tenant",           3001),
        ("Master Data",      3003),
        ("Message",          3006),
        ("Drive",            3007),
        ("Realtime",         3008),
        # Data Hub
        ("Data Quality",     3004),
        ("Data Contract",    3005),
        # Collecte & Workflow
        ("Form Builder",     3010),
        ("Collecte",         3011),
        ("Workflow",         3012),
        # Domain Services
        ("Animal Health",    3020),
        ("Livestock Prod",   3021),
        ("Fisheries",        3022),
        ("Wildlife",         3023),
        ("Apiculture",       3024),
        ("Trade SPS",        3025),
        ("Governance",       3026),
        ("Climate Env",      3027),
        # Data & Integration
        ("Analytics",        3030),
        ("Geo Services",     3031),
        ("Interop Hub",      3032),
        ("Knowledge Hub",    3033),
        ("Datalake",         3044),
        ("Support",          3041),
        ("Interop",          3042),
        ("Offline",          3040),
        ("Analytics Worker", 3043),
    ]

    safe_print(f"\n  Microservices Health ({len(services)} services):")
    svc_up = 0
    svc_down = 0
    for name, port in services:
        cmd = f'curl -sf -o /dev/null -w "%{{http_code}}" http://localhost:{port}/health 2>/dev/null'
        code, out = run_sudo(c, f"bash -c '{cmd}'", timeout=5)
        status = out if out else "000"
        is_up = status in ["200", "204"]
        mark = "OK" if is_up else f"FAIL({status})"
        safe_print(f"    {name:20s} :{port} -> {mark}")
        if is_up:
            svc_up += 1
        else:
            svc_down += 1

    safe_print(f"\n  Services: {svc_up}/{svc_up + svc_down} healthy")
    total_pass += svc_up
    total_fail += svc_down

    # Infrastructure tools
    infra = [
        ("Frontend (Next.js)", "http://localhost:3100",        3100),
        ("Traefik Dashboard",  "http://localhost:8090/dashboard/", 8090),
        ("Grafana",            "http://localhost:3200/api/health", 3200),
        ("Prometheus",         "http://localhost:9090/-/healthy",  9090),
        ("Superset",           "http://localhost:8088/health",    8088),
        ("Metabase",           "http://localhost:3035/api/health", 3035),
        ("MinIO",              "http://localhost:9000/minio/health/live", 9000),
        ("Jaeger UI",          "http://localhost:16686/",         16686),
        ("Mailpit",            "http://localhost:8025/",          8025),
    ]

    safe_print(f"\n  Infrastructure Tools:")
    for name, url, port in infra:
        cmd = f'curl -sf -o /dev/null -w "%{{http_code}}" {url} 2>/dev/null'
        code, out = run_sudo(c, f"bash -c '{cmd}'", timeout=5)
        status = out if out else "000"
        is_up = status in ["200", "204", "301", "302", "303", "307", "308"]
        mark = "OK" if is_up else f"FAIL({status})"
        safe_print(f"    {name:20s} :{port} -> {mark}")
        if is_up:
            total_pass += 1
        else:
            total_fail += 1

    # Login test
    safe_print(f"\n  Login Test:")
    sftp = c.open_sftp()
    with sftp.open("/tmp/aris-verify-login.json", "w") as f:
        json.dump({"email": "admin@au-aris.org", "password": "Aris2024!"}, f)
    sftp.close()

    code, out = run_sudo(c, 'curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H "Content-Type: application/json" -d @/tmp/aris-verify-login.json 2>&1', timeout=10)
    # Strip [sudo] prefix if present
    json_start = out.find("{")
    if json_start >= 0:
        out = out[json_start:]
    try:
        data = json.loads(out)
        if "data" in data and "accessToken" in data["data"]:
            safe_print(f"    LOGIN SUCCESSFUL!")
            user_data = data["data"].get("user", {})
            safe_print(f"    Email: {user_data.get('email', 'admin@au-aris.org')}")
            safe_print(f"    Role:  {user_data.get('role', 'SUPER_ADMIN')}")
            safe_print(f"    JWT:   {data['data']['accessToken'][:60]}...")
            total_pass += 1
        elif "accessToken" in data:
            safe_print(f"    LOGIN SUCCESSFUL!")
            safe_print(f"    JWT: {data['accessToken'][:60]}...")
            total_pass += 1
        else:
            safe_print(f"    LOGIN FAILED: {data.get('message', out[:200])}")
            total_fail += 1
    except json.JSONDecodeError:
        safe_print(f"    Response: {out[:300]}")
        # Check if it contains a token anyway
        if "accessToken" in out or "eyJ" in out:
            safe_print(f"    (Contains JWT token — login likely successful)")
            total_pass += 1
        else:
            total_fail += 1

    run_sudo(c, "rm -f /tmp/aris-verify-login.json")

    # Problem containers
    code, out = run_sudo(c, "docker ps -a --filter 'status=exited' --filter 'status=restarting' --format '{{.Names}}: {{.Status}}' 2>/dev/null")
    if out.strip():
        safe_print(f"\n  Problem containers:")
        for line in out.strip().splitlines()[:10]:
            safe_print(f"    {line}")

    # Disk
    code, out = run_sudo(c, "df -h / | tail -1")
    safe_print(f"\n  Disk: {out}")

    c.close()
except Exception as e:
    safe_print(f"  CONNECTION FAILED: {e}")
    total_fail += 30

# ═══════════════════════════════════════════════════════════════════════
# Final Summary
# ═══════════════════════════════════════════════════════════════════════
safe_print("\n" + "=" * 70)
safe_print("  ARIS 4.0 — DEPLOYMENT VERIFICATION SUMMARY")
safe_print("=" * 70)
safe_print(f"\n  Total checks:  {total_pass + total_fail}")
safe_print(f"  Passed:        {total_pass}")
safe_print(f"  Failed:        {total_fail}")
pct = (total_pass / (total_pass + total_fail) * 100) if (total_pass + total_fail) > 0 else 0
safe_print(f"  Score:         {pct:.0f}%")
safe_print(f"\n  VM-DB:    PostgreSQL 16 + PgBouncer     10.202.101.185")
safe_print(f"  VM-KAFKA: Kafka KRaft x3 + Schema Reg   10.202.101.184")
safe_print(f"  VM-CACHE: Redis 7 + OpenSearch 2.17      10.202.101.186")
safe_print(f"  VM-APP:   38 containers (29 services)    10.202.101.183")
safe_print(f"\n  Access Points:")
safe_print(f"    Frontend:     http://10.202.101.183")
safe_print(f"    API Gateway:  http://10.202.101.183/api/v1/")
safe_print(f"    Traefik:      http://10.202.101.183:8090")
safe_print(f"    Grafana:      http://10.202.101.183:3200")
safe_print(f"    Prometheus:   http://10.202.101.183:9090")
safe_print(f"    Superset:     http://10.202.101.183:8088")
safe_print(f"    Metabase:     http://10.202.101.183:3035")
safe_print(f"    Jaeger:       http://10.202.101.183:16686")
safe_print(f"    Kafka UI:     http://10.202.101.184:8080")
safe_print(f"    MinIO:        http://10.202.101.183:9001")
safe_print(f"    OpenSearch:   http://10.202.101.186:5601")
safe_print(f"\n  Login:  admin@au-aris.org / Aris2024!")
safe_print("=" * 70)
