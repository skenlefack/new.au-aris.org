#!/usr/bin/env python3
"""Deploy backend services (credential, message) to production."""
import sys, io, time, paramiko
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

VM_APP = "10.202.101.183"
VM_KAFKA = "10.202.101.181"
USER = "arisadmin"
PASS = "@u-1baR.0rg$U24"

def ssh(host, cmd, timeout=600):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=22, username=USER, password=PASS, timeout=15, allow_agent=False, look_for_keys=False)
    stdin, stdout, stderr = c.exec_command(f"sudo -S bash -c '{cmd}'", timeout=timeout)
    stdin.write(PASS + "\n"); stdin.flush(); stdin.channel.shutdown_write()
    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode('utf-8', errors='replace')
    err = stderr.read().decode('utf-8', errors='replace')
    c.close()
    return code, out, err

def step(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")

# Step 1: Create Kafka topic on VM-KAFKA
step("Step 1: Create password reset Kafka topic on VM-KAFKA")
code, out, err = ssh(VM_KAFKA,
    "docker exec aris-kafka-1 kafka-topics --create --if-not-exists "
    "--bootstrap-server localhost:29092 "
    "--topic sys.credential.password.reset.v1 "
    "--partitions 3 --replication-factor 3 2>&1",
    timeout=30)
print(out or err)
print(f"  Exit: {code}")

# Step 2: Pull latest code on VM-APP
step("Step 2: Pull latest code on VM-APP")
code, out, _ = ssh(VM_APP, "cd /opt/aris && git pull origin main 2>&1", timeout=60)
print(out)

# Step 3: Rebuild and restart credential + message containers
step("Step 3: Rebuild and restart credential + message containers")
code, out, _ = ssh(VM_APP,
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
