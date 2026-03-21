#!/usr/bin/env python3
"""
ARIS 4.0 — Initial Staging Environment Deployment
===================================================
Deploys the complete staging environment (test.au-aris.org) on 4 VMs.

This script:
  1. Checks SSH connectivity to all 4 VMs
  2. Installs Docker on each VM (if not present)
  3. Clones the ARIS repo on each VM
  4. Deploys VM-DB-STG   (PostgreSQL + PgBouncer)
  5. Deploys VM-CACHE-STG (Redis + OpenSearch)
  6. Deploys VM-KAFKA-STG (3 Kafka brokers + Schema Registry)
  7. Deploys VM-APP-STG   (30+ containers: services, frontend, monitoring, BI)
  8. Generates JWT keys for staging
  9. Seeds the database
  10. Verifies the deployment

Prerequisites:
  - SSH access to all 4 VMs as arisadmin
  - VMs have internet access (for Docker install + git clone + image pulls)

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python deploy/scripts/_initial_deploy_stg.py

  # Resume from a specific phase (skip completed phases):
  python deploy/scripts/_initial_deploy_stg.py --from=kafka

  # Skip Docker install (already installed):
  python deploy/scripts/_initial_deploy_stg.py --skip-docker
"""
import sys
import time
import os

# Add scripts directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import ssh, ssh_stream, step, VM_USER, VM_PASS

# ═══════════════════════════════════════════════════════════════
#  STAGING VM IPs
# ═══════════════════════════════════════════════════════════════
STG_APP   = "10.202.101.146"   # nbo-aris05
STG_KAFKA = "10.202.101.147"   # nbo-brk02
STG_DB    = "10.202.101.148"   # nbo-dbms03
STG_CACHE = "10.202.101.149"   # nbo-cch02

GIT_REPO = "https://github.com/skenlefack/new.au-aris.org.git"

PHASE_ORDER = ["connectivity", "docker", "clone", "db", "cache", "kafka", "app", "jwt", "seed", "verify"]

# ═══════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════
def banner(msg):
    print(f"\n{'#' * 70}")
    print(f"#  {msg}")
    print(f"{'#' * 70}\n")

def run(host, cmd, timeout=300, label=None):
    """Run a command via SSH and print output. Returns (code, stdout)."""
    if label:
        print(f"  [{label}] {cmd[:80]}...")
    code, out, err = ssh(host, cmd, timeout=timeout)
    if out.strip():
        for line in out.strip().splitlines()[:30]:
            print(f"    {line}")
        if len(out.strip().splitlines()) > 30:
            print(f"    ... ({len(out.strip().splitlines()) - 30} more lines)")
    if code != 0 and err.strip():
        for line in err.strip().splitlines()[:10]:
            print(f"    ERR: {line}")
    return code, out

def run_check(host, cmd, timeout=300, label=None):
    """Run a command and abort on failure."""
    code, out = run(host, cmd, timeout=timeout, label=label)
    if code != 0:
        print(f"\n  FATAL: Command failed (exit {code})")
        print(f"  Host: {host}")
        print(f"  Cmd:  {cmd[:120]}")
        sys.exit(1)
    return out

def wait_for(host, check_cmd, description, max_wait=180, interval=10):
    """Poll a command until it succeeds or timeout."""
    print(f"  Waiting for {description} (max {max_wait}s)...")
    elapsed = 0
    while elapsed < max_wait:
        code, out, _ = ssh(host, check_cmd, timeout=15)
        if code == 0:
            print(f"  {description} ready! ({elapsed}s)")
            return True
        time.sleep(interval)
        elapsed += interval
        print(f"    ... {elapsed}s elapsed")
    print(f"  TIMEOUT: {description} not ready after {max_wait}s")
    return False


# ═══════════════════════════════════════════════════════════════
#  PHASE 1: Connectivity Check
# ═══════════════════════════════════════════════════════════════
def phase_connectivity():
    banner("PHASE 1: SSH Connectivity Check")
    vms = [
        ("VM-APP-STG",   STG_APP,   "nbo-aris05"),
        ("VM-KAFKA-STG", STG_KAFKA, "nbo-brk02"),
        ("VM-DB-STG",    STG_DB,    "nbo-dbms03"),
        ("VM-CACHE-STG", STG_CACHE, "nbo-cch02"),
    ]
    all_ok = True
    for name, ip, hostname in vms:
        try:
            code, out, _ = ssh(ip, "hostname && uname -r && cat /etc/os-release | head -2", timeout=15)
            if code == 0:
                h = out.strip().splitlines()[0] if out.strip() else "?"
                print(f"  OK  {name} ({ip}) — hostname: {h}")
            else:
                print(f"  FAIL {name} ({ip}) — exit code {code}")
                all_ok = False
        except Exception as e:
            print(f"  FAIL {name} ({ip}) — {e}")
            all_ok = False

    if not all_ok:
        print("\n  FATAL: Cannot reach all VMs. Fix connectivity before continuing.")
        sys.exit(1)
    print("\n  All 4 VMs reachable!")


# ═══════════════════════════════════════════════════════════════
#  PHASE 2: Docker Installation
# ═══════════════════════════════════════════════════════════════
def phase_docker():
    banner("PHASE 2: Docker Installation")
    vms = [
        ("VM-APP-STG",   STG_APP),
        ("VM-KAFKA-STG", STG_KAFKA),
        ("VM-DB-STG",    STG_DB),
        ("VM-CACHE-STG", STG_CACHE),
    ]

    for name, ip in vms:
        step(f"Checking Docker on {name} ({ip})")
        code, out, _ = ssh(ip, "docker --version 2>&1", timeout=15)
        if code == 0 and "Docker version" in out:
            print(f"  Docker already installed: {out.strip()}")
            # Ensure Docker service is running
            run(ip, "systemctl enable docker && systemctl start docker", label=name)
            continue

        print(f"  Docker not found on {name}. Installing...")
        # Install Docker using official convenience script
        run_check(ip, "apt-get update -qq && apt-get install -y -qq curl ca-certificates gnupg lsb-release 2>&1 | tail -3", timeout=120, label=f"{name}/deps")
        run_check(ip, "curl -fsSL https://get.docker.com | sh 2>&1 | tail -10", timeout=300, label=f"{name}/docker-install")
        run_check(ip, "systemctl enable docker && systemctl start docker", timeout=30, label=f"{name}/docker-start")
        # Add arisadmin to docker group
        run(ip, f"usermod -aG docker {VM_USER}", label=f"{name}/docker-group")

        # Install Docker Compose plugin
        run_check(ip, "docker compose version 2>&1 || (apt-get install -y docker-compose-plugin 2>&1 | tail -3)", timeout=120, label=f"{name}/compose")

        code, out, _ = ssh(ip, "docker --version && docker compose version", timeout=15)
        print(f"  {out.strip()}")

    # Configure sysctl on all VMs (required for OpenSearch and Kafka)
    step("Configuring sysctl on all VMs")
    sysctl_cmds = (
        "sysctl -w vm.max_map_count=262144 && "
        "sysctl -w vm.swappiness=1 && "
        "grep -q 'vm.max_map_count' /etc/sysctl.conf || echo 'vm.max_map_count=262144' >> /etc/sysctl.conf && "
        "grep -q 'vm.swappiness' /etc/sysctl.conf || echo 'vm.swappiness=1' >> /etc/sysctl.conf"
    )
    for name, ip in vms:
        run(ip, sysctl_cmds, label=name)

    print("\n  Docker ready on all VMs!")


# ═══════════════════════════════════════════════════════════════
#  PHASE 3: Clone Repository
# ═══════════════════════════════════════════════════════════════
def phase_clone():
    banner("PHASE 3: Clone ARIS Repository")
    vms = [
        ("VM-APP-STG",   STG_APP),
        ("VM-KAFKA-STG", STG_KAFKA),
        ("VM-DB-STG",    STG_DB),
        ("VM-CACHE-STG", STG_CACHE),
    ]

    for name, ip in vms:
        step(f"Setting up repo on {name} ({ip})")

        # Create directories
        run_check(ip, "mkdir -p /opt/aris /opt/aris-deploy", label=f"{name}/mkdir")

        # Check if repo already exists
        code, out, _ = ssh(ip, "test -d /opt/aris/.git && echo 'exists'", timeout=10)
        if "exists" in out:
            print(f"  Repo already cloned, pulling latest...")
            run_check(ip, "cd /opt/aris && git fetch origin && git reset --hard origin/main 2>&1", timeout=120, label=f"{name}/pull")
        else:
            print(f"  Cloning {GIT_REPO}...")
            run_check(ip, f"cd /opt/aris && git clone {GIT_REPO} . 2>&1 | tail -5", timeout=300, label=f"{name}/clone")
            run_check(ip, "cd /opt/aris && git checkout main 2>&1", timeout=30, label=f"{name}/checkout")

    print("\n  Repository cloned on all VMs!")


# ═══════════════════════════════════════════════════════════════
#  PHASE 4: Deploy VM-DB-STG
# ═══════════════════════════════════════════════════════════════
def phase_db():
    banner("PHASE 4: Deploy VM-DB-STG (PostgreSQL + PgBouncer)")

    step("4.1: Prepare DB config files")
    # Create deploy directory and copy config files from the repo
    cmds = " && ".join([
        "mkdir -p /opt/aris-deploy/vm-db-stg",
        "cp /opt/aris/deploy/vm-db-stg/docker-compose.yml /opt/aris-deploy/vm-db-stg/",
        "cp /opt/aris/deploy/vm-db-stg/postgresql.conf    /opt/aris-deploy/vm-db-stg/",
        "cp /opt/aris/deploy/vm-db-stg/pgbouncer.ini      /opt/aris-deploy/vm-db-stg/",
        "cp /opt/aris/deploy/vm-db-stg/userlist.txt        /opt/aris-deploy/vm-db-stg/",
        "cp /opt/aris/deploy/vm-db-stg/init-databases.sql  /opt/aris-deploy/vm-db-stg/",
        "cp /opt/aris/deploy/vm-db-stg/init-bi-user.sql    /opt/aris-deploy/vm-db-stg/",
        "cp /opt/aris/deploy/vm-db-stg/init-metabase-db.sql /opt/aris-deploy/vm-db-stg/",
        "ls -la /opt/aris-deploy/vm-db-stg/",
    ])
    run_check(STG_DB, cmds, label="DB/copy-configs")

    step("4.2: Create data directories")
    run_check(STG_DB, "mkdir -p /var/lib/postgresql/data", label="DB/data-dir")

    step("4.3: Start PostgreSQL + PgBouncer")
    run_check(STG_DB,
        "cd /opt/aris-deploy/vm-db-stg && docker compose up -d 2>&1",
        timeout=300, label="DB/start")

    step("4.4: Wait for PostgreSQL to be healthy")
    ok = wait_for(STG_DB,
        "docker exec aris-stg-postgres pg_isready -U aris -d aris 2>&1",
        "PostgreSQL", max_wait=120)
    if not ok:
        print("  WARNING: PostgreSQL may not be ready. Check logs.")
        run(STG_DB, "docker logs aris-stg-postgres --tail 30 2>&1", label="DB/logs")

    step("4.5: Verify PgBouncer")
    ok = wait_for(STG_DB,
        "docker exec aris-stg-pgbouncer pg_isready -h 127.0.0.1 -p 6432 -U aris -d aris 2>&1",
        "PgBouncer", max_wait=60)

    # Show status
    run(STG_DB, "docker ps --format 'table {{.Names}}\\t{{.Status}}' 2>&1", label="DB/status")
    print("\n  VM-DB-STG deployed!")


# ═══════════════════════════════════════════════════════════════
#  PHASE 5: Deploy VM-CACHE-STG
# ═══════════════════════════════════════════════════════════════
def phase_cache():
    banner("PHASE 5: Deploy VM-CACHE-STG (Redis + OpenSearch)")

    step("5.1: Prepare Cache config files")
    cmds = " && ".join([
        "mkdir -p /opt/aris-deploy/vm-cache-stg",
        "cp /opt/aris/deploy/vm-cache-stg/docker-compose.yml /opt/aris-deploy/vm-cache-stg/",
        "ls -la /opt/aris-deploy/vm-cache-stg/",
    ])
    run_check(STG_CACHE, cmds, label="CACHE/copy-configs")

    step("5.2: Create data directories")
    run_check(STG_CACHE, "mkdir -p /var/lib/redis /var/lib/opensearch && chown -R 1000:1000 /var/lib/opensearch", label="CACHE/data-dirs")

    step("5.3: Start Redis + OpenSearch")
    run_check(STG_CACHE,
        "cd /opt/aris-deploy/vm-cache-stg && docker compose up -d 2>&1",
        timeout=300, label="CACHE/start")

    step("5.4: Wait for Redis")
    ok = wait_for(STG_CACHE,
        "docker exec aris-stg-redis redis-cli -a 'R3d1s_Stg_2024!vN7wQ' ping 2>&1 | grep -q PONG && echo OK",
        "Redis", max_wait=60)

    step("5.5: Wait for OpenSearch")
    ok = wait_for(STG_CACHE,
        "docker exec aris-stg-opensearch curl -sf http://localhost:9200/_cluster/health 2>&1 | grep -q '\"status\"' && echo OK",
        "OpenSearch", max_wait=120)
    if not ok:
        run(STG_CACHE, "docker logs aris-stg-opensearch --tail 30 2>&1", label="CACHE/os-logs")

    run(STG_CACHE, "docker ps --format 'table {{.Names}}\\t{{.Status}}' 2>&1", label="CACHE/status")
    print("\n  VM-CACHE-STG deployed!")


# ═══════════════════════════════════════════════════════════════
#  PHASE 6: Deploy VM-KAFKA-STG
# ═══════════════════════════════════════════════════════════════
def phase_kafka():
    banner("PHASE 6: Deploy VM-KAFKA-STG (Kafka KRaft x3 + Schema Registry)")

    step("6.1: Prepare Kafka config files")
    cmds = " && ".join([
        "mkdir -p /opt/aris-deploy/vm-kafka-stg",
        "cp /opt/aris/deploy/vm-kafka-stg/docker-compose.yml /opt/aris-deploy/vm-kafka-stg/",
        # Create .env with KAFKA_HOST
        f"echo 'KAFKA_HOST={STG_KAFKA}' > /opt/aris-deploy/vm-kafka-stg/.env",
        "ls -la /opt/aris-deploy/vm-kafka-stg/",
    ])
    run_check(STG_KAFKA, cmds, label="KAFKA/copy-configs")

    step("6.2: Create data directories")
    run_check(STG_KAFKA, "mkdir -p /kafka-data/broker-1 /kafka-data/broker-2 /kafka-data/broker-3", label="KAFKA/data-dirs")

    step("6.3: Start Kafka brokers + Schema Registry + UI")
    run_check(STG_KAFKA,
        "cd /opt/aris-deploy/vm-kafka-stg && docker compose --env-file .env up -d 2>&1",
        timeout=300, label="KAFKA/start")

    step("6.4: Wait for Kafka broker-1")
    ok = wait_for(STG_KAFKA,
        "docker exec aris-stg-kafka-1 kafka-broker-api-versions --bootstrap-server localhost:29092 2>&1 | head -1 | grep -q 'ApiVersion' && echo OK",
        "Kafka broker-1", max_wait=120)
    if not ok:
        # Try an alternative check
        time.sleep(15)
        run(STG_KAFKA, "docker logs aris-stg-kafka-1 --tail 20 2>&1", label="KAFKA/logs")

    step("6.5: Wait for topic creation (kafka-init container)")
    # kafka-init runs once and exits, wait for it
    ok = wait_for(STG_KAFKA,
        "docker inspect aris-stg-kafka-init --format='{{.State.ExitCode}}' 2>&1 | grep -q '^0$' && echo OK",
        "kafka-init (topic creation)", max_wait=180, interval=15)
    if not ok:
        run(STG_KAFKA, "docker logs aris-stg-kafka-init --tail 30 2>&1", label="KAFKA/init-logs")

    step("6.6: Verify topics created")
    run(STG_KAFKA,
        "docker exec aris-stg-kafka-1 kafka-topics --list --bootstrap-server localhost:29092 2>&1 | wc -l",
        label="KAFKA/topic-count")

    run(STG_KAFKA, "docker ps --format 'table {{.Names}}\\t{{.Status}}' 2>&1", label="KAFKA/status")
    print("\n  VM-KAFKA-STG deployed!")


# ═══════════════════════════════════════════════════════════════
#  PHASE 7: Deploy VM-APP-STG
# ═══════════════════════════════════════════════════════════════
def phase_app():
    banner("PHASE 7: Deploy VM-APP-STG (All Services + Frontend + Monitoring)")

    step("7.1: Prepare APP directory structure")
    cmds = " && ".join([
        "mkdir -p /opt/aris-deploy/vm-app-stg/certs",
        "mkdir -p /opt/aris/keys-stg",
    ])
    run_check(STG_APP, cmds, label="APP/mkdir")

    step("7.2: Copy config files")
    cmds = " && ".join([
        # .env.staging → .env
        "cp /opt/aris/deploy/vm-app-stg/.env.staging /opt/aris-deploy/vm-app-stg/.env",
        # Traefik TLS config
        "mkdir -p /opt/aris-deploy/vm-app-stg/traefik",
        "cp /opt/aris/deploy/vm-app-stg/traefik/tls.yml /opt/aris-deploy/vm-app-stg/traefik/",
        # Prometheus config
        "cp /opt/aris/deploy/vm-app-stg/prometheus-staging.yml /opt/aris-deploy/vm-app-stg/prometheus-staging.yml",
        # Grafana datasources
        "cp /opt/aris/deploy/vm-app-stg/grafana-datasources.yml /opt/aris-deploy/vm-app-stg/grafana-datasources.yml",
        # Docker compose (note: compose reads from /opt/aris-deploy/vm-app-stg/ but
        # builds from /opt/aris/ context)
        "cp /opt/aris/deploy/vm-app-stg/docker-compose.yml /opt/aris-deploy/vm-app-stg/",
        "ls -la /opt/aris-deploy/vm-app-stg/",
    ])
    run_check(STG_APP, cmds, label="APP/copy-configs")

    step("7.3: Copy SSL certificate (wildcard *.au-aris.org)")
    cmds = " && ".join([
        "cp /opt/aris/certificat/fullchain.pem /opt/aris-deploy/vm-app-stg/certs/fullchain.pem",
        "cp /opt/aris/certificat/au-aris.org.key /opt/aris-deploy/vm-app-stg/certs/private.key",
        "chmod 600 /opt/aris-deploy/vm-app-stg/certs/private.key",
        "ls -la /opt/aris-deploy/vm-app-stg/certs/",
    ])
    run_check(STG_APP, cmds, label="APP/ssl-cert")

    step("7.4: Start all containers (this will take several minutes for initial build)")
    code, out = run(STG_APP,
        "cd /opt/aris-deploy/vm-app-stg && docker compose --env-file .env up -d --build 2>&1 | tail -50",
        timeout=600, label="APP/start")
    if code != 0:
        print(f"  WARNING: docker compose returned exit {code}")
        run(STG_APP, "cd /opt/aris-deploy/vm-app-stg && docker compose --env-file .env ps 2>&1", label="APP/ps")

    step("7.5: Wait for key services to be ready")
    time.sleep(20)  # Give containers time to start

    services_to_check = [
        ("aris-stg-traefik", "traefik", None),
        ("aris-stg-credential", "credential", 3002),
        ("aris-stg-tenant", "tenant", 3001),
        ("aris-stg-master-data", "master-data", 3003),
        ("aris-stg-message", "message", 3006),
        ("aris-stg-web", "web", 3100),
    ]

    for container, name, port in services_to_check:
        code, out, _ = ssh(STG_APP, f"docker inspect {container} --format='{{{{.State.Status}}}}' 2>&1", timeout=10)
        status = out.strip()
        if port:
            code2, out2, _ = ssh(STG_APP, f"curl -sf -o /dev/null -w '%{{http_code}}' http://localhost:{port}/ 2>&1", timeout=10)
            http = out2.strip()
            print(f"  {name:20s} container={status:10s} http={http}")
        else:
            print(f"  {name:20s} container={status}")

    run(STG_APP,
        "docker ps --format 'table {{.Names}}\\t{{.Status}}' | grep aris-stg | sort 2>&1",
        label="APP/all-containers")

    print("\n  VM-APP-STG deployed!")


# ═══════════════════════════════════════════════════════════════
#  PHASE 8: Generate JWT Keys
# ═══════════════════════════════════════════════════════════════
def phase_jwt():
    banner("PHASE 8: Generate JWT Keys for Staging")

    # Check if keys already exist
    code, out, _ = ssh(STG_APP, "test -f /opt/aris/keys-stg/private.pem && echo 'exists'", timeout=10)
    if "exists" in out:
        print("  JWT keys already exist at /opt/aris/keys-stg/")
        print("  Skipping generation (delete keys manually to regenerate)")
        return

    step("8.1: Generate RSA 4096 key pair")
    cmds = " && ".join([
        "mkdir -p /opt/aris/keys-stg",
        "openssl genrsa -out /opt/aris/keys-stg/private.pem 4096 2>&1",
        "openssl rsa -in /opt/aris/keys-stg/private.pem -pubout -out /opt/aris/keys-stg/public.pem 2>&1",
        "chmod 600 /opt/aris/keys-stg/private.pem",
        "chmod 644 /opt/aris/keys-stg/public.pem",
        "ls -la /opt/aris/keys-stg/",
    ])
    run_check(STG_APP, cmds, timeout=60, label="JWT/generate")

    step("8.2: Restart credential service to pick up new keys")
    run(STG_APP,
        "cd /opt/aris-deploy/vm-app-stg && docker compose --env-file .env restart credential 2>&1",
        timeout=120, label="JWT/restart-credential")
    time.sleep(10)

    print("\n  JWT keys generated!")


# ═══════════════════════════════════════════════════════════════
#  PHASE 9: Seed Database
# ═══════════════════════════════════════════════════════════════
def phase_seed():
    banner("PHASE 9: Seed Staging Database")

    step("9.1: Run Prisma migrations")
    code, out = run(STG_APP,
        "docker exec aris-stg-credential npx prisma migrate deploy --schema=prisma 2>&1",
        timeout=180, label="SEED/migrate")
    if code != 0:
        print(f"  WARNING: Migration returned exit {code}")
        # Try generating prisma client first
        run(STG_APP,
            "docker exec aris-stg-credential npx prisma generate --schema=prisma 2>&1",
            timeout=60, label="SEED/generate")
        run(STG_APP,
            "docker exec aris-stg-credential npx prisma migrate deploy --schema=prisma 2>&1",
            timeout=180, label="SEED/migrate-retry")

    seed_services = ["tenant", "credential", "master-data", "animal-health"]

    for i, svc in enumerate(seed_services, 1):
        container = f"aris-stg-{svc}"
        step(f"9.{i+1}: Seed {svc}")

        # Check container is running
        code, out, _ = ssh(STG_APP, f"docker ps --filter name={container} --format '{{{{.Names}}}}' 2>&1", timeout=10)
        if container not in out:
            print(f"  SKIP: Container {container} not running")
            continue

        code, out = run(STG_APP,
            f"docker exec {container} npx tsx src/seed.ts 2>&1",
            timeout=180, label=f"SEED/{svc}")
        status = "OK" if code == 0 else "FAILED"
        print(f"  Seed {svc}: {status} (exit {code})")

    print("\n  Database seeded!")


# ═══════════════════════════════════════════════════════════════
#  PHASE 10: Verify Deployment
# ═══════════════════════════════════════════════════════════════
def phase_verify():
    banner("PHASE 10: Verify Staging Deployment")

    step("10.1: Container status on VM-APP-STG")
    code, out = run(STG_APP,
        "docker ps --format 'table {{.Names}}\\t{{.Status}}\\t{{.Ports}}' | grep aris-stg | sort 2>&1",
        label="VERIFY/containers")
    running = [l for l in out.splitlines() if "Up" in l]
    total = len([l for l in out.splitlines() if "aris-stg" in l])
    print(f"\n  Running: {len(running)}/{total} containers")

    step("10.2: Service health checks")
    health_checks = [
        ("credential", 3002, "/health"),
        ("tenant",     3001, "/health"),
        ("master-data",3003, "/health"),
        ("message",    3006, "/health"),
        ("drive",      3007, "/health"),
        ("animal-health", 3020, "/health"),
        ("web",        3100, "/"),
    ]
    for name, port, path in health_checks:
        code, out, _ = ssh(STG_APP, f"curl -sf -o /dev/null -w '%{{http_code}}' http://localhost:{port}{path} 2>&1", timeout=10)
        status = out.strip()
        icon = "OK" if status in ("200", "204", "302", "304") else "!!"
        print(f"  {name:20s} :{port}{path:10s} => {status} [{icon}]")

    step("10.3: Infrastructure checks")
    # PostgreSQL
    code, out, _ = ssh(STG_DB, "docker exec aris-stg-postgres psql -U aris -c 'SELECT count(*) FROM pg_database' 2>&1", timeout=15)
    pg_ok = "OK" if code == 0 else "FAIL"
    print(f"  PostgreSQL:  {pg_ok}")

    # PgBouncer
    code, out, _ = ssh(STG_DB, "docker exec aris-stg-pgbouncer pg_isready -h 127.0.0.1 -p 6432 -U aris -d aris 2>&1", timeout=15)
    pgb_ok = "OK" if code == 0 else "FAIL"
    print(f"  PgBouncer:   {pgb_ok}")

    # Redis
    code, out, _ = ssh(STG_CACHE, "docker exec aris-stg-redis redis-cli -a 'R3d1s_Stg_2024!vN7wQ' ping 2>&1", timeout=15)
    redis_ok = "OK" if "PONG" in out else "FAIL"
    print(f"  Redis:       {redis_ok}")

    # OpenSearch
    code, out, _ = ssh(STG_CACHE, "docker exec aris-stg-opensearch curl -sf http://localhost:9200/ 2>&1 | head -1", timeout=15)
    os_ok = "OK" if code == 0 else "FAIL"
    print(f"  OpenSearch:  {os_ok}")

    # Kafka
    code, out, _ = ssh(STG_KAFKA, "docker exec aris-stg-kafka-1 kafka-topics --list --bootstrap-server localhost:29092 2>&1 | wc -l", timeout=15)
    topic_count = out.strip()
    kafka_ok = "OK" if code == 0 else "FAIL"
    print(f"  Kafka:       {kafka_ok} ({topic_count} topics)")

    step("10.4: Traefik routing check")
    code, out, _ = ssh(STG_APP, "curl -sf -o /dev/null -w '%{http_code}' --resolve test.au-aris.org:443:127.0.0.1 https://test.au-aris.org/ -k 2>&1", timeout=10)
    traefik_ok = out.strip()
    print(f"  Traefik HTTPS → web: {traefik_ok}")

    # Final summary
    print("\n" + "=" * 70)
    print("  STAGING DEPLOYMENT COMPLETE!")
    print("=" * 70)
    print(f"""
  Infrastructure:
    VM-APP-STG:   {STG_APP} (nbo-aris05)
    VM-KAFKA-STG: {STG_KAFKA} (nbo-brk02)
    VM-DB-STG:    {STG_DB} (nbo-dbms03)
    VM-CACHE-STG: {STG_CACHE} (nbo-cch02)

  URLs (available after DNS publication on Monday):
    ARIS:       https://test.au-aris.org/
    Mailpit:    http://{STG_APP}:8025
    Grafana:    http://{STG_APP}:3200
    Traefik:    http://{STG_APP}:8090
    Kafka UI:   http://{STG_KAFKA}:8080
    MinIO:      http://{STG_APP}:9001
    Jaeger:     http://{STG_APP}:16686
    Superset:   http://{STG_APP}:8088
    Metabase:   http://{STG_APP}:3035

  Login:
    admin@au-aris.org / Aris2024!

  Next steps:
    1. DNS: Publish test.au-aris.org → {STG_APP} (Monday)
    2. Verify: https://test.au-aris.org/
    3. Test login and navigation
""")


# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════
def main():
    args = sys.argv[1:]
    skip_docker = "--skip-docker" in args
    args = [a for a in args if not a.startswith("--skip")]

    # Determine starting phase
    start_from = "connectivity"
    for a in args:
        if a.startswith("--from="):
            start_from = a.split("=", 1)[1]

    if start_from not in PHASE_ORDER:
        print(f"  Unknown phase: {start_from}")
        print(f"  Valid phases: {', '.join(PHASE_ORDER)}")
        sys.exit(1)

    start_idx = PHASE_ORDER.index(start_from)

    print("=" * 70)
    print("  ARIS 4.0 — Initial Staging Deployment")
    print(f"  Target: test.au-aris.org")
    print(f"  VMs: APP={STG_APP} KAFKA={STG_KAFKA} DB={STG_DB} CACHE={STG_CACHE}")
    if start_from != "connectivity":
        print(f"  Resuming from phase: {start_from}")
    if skip_docker:
        print(f"  Skipping Docker installation")
    print("=" * 70)

    phases = {
        "connectivity": phase_connectivity,
        "docker": phase_docker,
        "clone": phase_clone,
        "db": phase_db,
        "cache": phase_cache,
        "kafka": phase_kafka,
        "app": phase_app,
        "jwt": phase_jwt,
        "seed": phase_seed,
        "verify": phase_verify,
    }

    for phase_name in PHASE_ORDER[start_idx:]:
        if phase_name == "docker" and skip_docker:
            print(f"\n  Skipping phase: {phase_name}")
            continue
        phases[phase_name]()

    print("\n  ALL DONE!")


if __name__ == "__main__":
    main()
