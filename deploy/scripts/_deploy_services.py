#!/usr/bin/env python3
"""Deploy backend services (credential, message) to production."""
import time
from ssh_config import ssh, step, VM_APP

# Step 1: Pull latest code
step("Step 1: Pull latest code on VM-APP")
code, out, _ = ssh(VM_APP, "cd /opt/aris && git pull origin main 2>&1", timeout=60)
print(out)

# Step 2: Create Kafka topic from VM-APP using temporary container
step("Step 2: Create password reset Kafka topic")
code, out, _ = ssh(
    VM_APP,
    "docker run --rm --network=host confluentinc/cp-kafka:7.6.1 "
    "kafka-topics --create --if-not-exists "
    "--bootstrap-server 10.202.101.184:9092,10.202.101.184:9094,10.202.101.184:9096 "
    "--topic sys.credential.password.reset.v1 "
    "--partitions 3 --replication-factor 3 2>&1",
    timeout=60)
print(out or "(no output)")
print(f"  Exit: {code}")

# Step 3: Rebuild and restart credential + message containers
step("Step 3: Rebuild and restart credential + message containers")
code, out, _ = ssh(
    VM_APP,
    "cd /opt/aris-deploy/vm-app && docker compose up -d --build --no-deps credential message 2>&1",
    timeout=600)
print(out)
print(f"  Exit: {code}")

# Step 4: Wait and verify health
step("Step 4: Verify services")
time.sleep(10)

for svc, port in [("credential", 3002), ("message", 3006)]:
    code, out, _ = ssh(VM_APP, f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{port}/health 2>&1")
    status = out.strip()
    icon = "OK" if status in ("200", "204") else "WARN"
    print(f"  {svc} (:{port}) => {status} [{icon}]")

print("\n" + "=" * 60)
print("  SERVICES DEPLOYED!")
print("=" * 60)
