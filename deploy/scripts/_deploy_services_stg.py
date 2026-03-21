#!/usr/bin/env python3
"""
Deploy backend services to staging environment.

Usage:
  export ARIS_VM_APP=10.202.101.146
  export ARIS_VM_KAFKA=10.202.101.147
  export ARIS_DEPLOY_PASS='...'
  python _deploy_services_stg.py [service1 service2 ...]

Without arguments, deploys credential + message (same as production script).
With arguments, deploys specified services:
  python _deploy_services_stg.py tenant credential master-data
"""
import sys
import time
from ssh_config import ssh, step, VM_APP, VM_KAFKA, SERVICES

# Parse target services from CLI args, default to credential + message
if len(sys.argv) > 1:
    target_services = sys.argv[1:]
else:
    target_services = ["credential", "message"]

# Resolve ports for verification
svc_ports = {name: port for name, port in SERVICES}
targets_with_ports = []
for svc in target_services:
    if svc in svc_ports:
        targets_with_ports.append((svc, svc_ports[svc]))
    else:
        print(f"  WARNING: Unknown service '{svc}', skipping health check")
        targets_with_ports.append((svc, None))

print("=" * 60)
print("  ARIS STAGING — Services Deploy")
print(f"  Target VM: {VM_APP}")
print(f"  Services: {', '.join(target_services)}")
print("=" * 60)

# Step 1: Pull latest code
step("Step 1: Pull latest code on VM-APP-STG")
code, out, _ = ssh(VM_APP, "cd /opt/aris && git pull origin main 2>&1", timeout=60)
print(out)

# Step 2: Create Kafka topic (ensure password reset topic exists)
step("Step 2: Create password reset Kafka topic (staging)")
code, out, _ = ssh(
    VM_APP,
    f"docker run --rm --network=host confluentinc/cp-kafka:7.6.1 "
    f"kafka-topics --create --if-not-exists "
    f"--bootstrap-server {VM_KAFKA}:9092,{VM_KAFKA}:9094,{VM_KAFKA}:9096 "
    f"--topic sys.credential.password.reset.v1 "
    f"--partitions 3 --replication-factor 3 2>&1",
    timeout=60)
print(out or "(no output)")
print(f"  Exit: {code}")

# Step 3: Rebuild and restart target containers
svc_list = " ".join(target_services)
step(f"Step 3: Rebuild and restart containers: {svc_list}")
code, out, _ = ssh(
    VM_APP,
    f"cd /opt/aris-deploy/vm-app-stg && docker compose --env-file .env up -d --build --no-deps {svc_list} 2>&1",
    timeout=600)
print(out)
print(f"  Exit: {code}")

# Step 4: Wait and verify health
step("Step 4: Verify services")
time.sleep(10)

for svc, port in targets_with_ports:
    if port:
        code, out, _ = ssh(VM_APP, f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{port}/health 2>&1")
        status = out.strip()
        icon = "OK" if status in ("200", "204") else "WARN"
        print(f"  {svc} (:{port}) => {status} [{icon}]")
    else:
        print(f"  {svc} => (no port, skipped)")

# Step 5: Cleanup old images and build cache
step("Step 5: Docker cleanup")
code, out, _ = ssh(VM_APP, "docker image prune -f && docker builder prune -f --keep-storage=2GB 2>&1", timeout=120)
reclaimed = [l for l in out.splitlines() if "reclaimed" in l.lower()]
for line in reclaimed:
    print(f"  {line.strip()}")
code, out, _ = ssh(VM_APP, "df -h / | tail -1")
print(f"  Disk: {out.strip()}")

print("\n" + "=" * 60)
print("  STAGING SERVICES DEPLOYED!")
print(f"  Services: {', '.join(target_services)}")
print("=" * 60)
