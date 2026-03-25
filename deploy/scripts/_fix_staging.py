#!/usr/bin/env python3
"""Fix staging deployment issues: Kafka permissions + SSL cert copy."""
import sys, os, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import paramiko
from ssh_config import ssh, step, VM_PASS, VM_USER

PROD_APP  = "10.202.101.183"
STG_APP   = "10.202.101.146"
STG_KAFKA = "10.202.101.147"

def sftp_relay(src_host, src_path, dst_host, dst_path):
    """Download from src via SFTP, upload to dst via SFTP to /tmp, then sudo mv."""
    pw = VM_PASS
    filename = os.path.basename(dst_path)
    tmp_remote = f"/tmp/{filename}"

    # Download from source
    c1 = paramiko.SSHClient()
    c1.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c1.connect(src_host, port=22, username=VM_USER, password=pw, timeout=15, allow_agent=False, look_for_keys=False)
    sftp1 = c1.open_sftp()
    local_tmp = tempfile.mktemp()
    print(f"  Download: {src_host}:{src_path}")
    sftp1.get(src_path, local_tmp)
    sftp1.close()
    c1.close()

    # Upload to dest /tmp/
    c2 = paramiko.SSHClient()
    c2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c2.connect(dst_host, port=22, username=VM_USER, password=pw, timeout=15, allow_agent=False, look_for_keys=False)
    sftp2 = c2.open_sftp()
    print(f"  Upload:   {dst_host}:/tmp/{filename}")
    sftp2.put(local_tmp, tmp_remote)
    sftp2.close()
    c2.close()
    os.unlink(local_tmp)

    # sudo mv from /tmp to final location
    print(f"  Move:     /tmp/{filename} -> {dst_path}")
    code, out, err = ssh(dst_host, f"cp {tmp_remote} {dst_path} && rm {tmp_remote}", timeout=15)
    if code != 0:
        print(f"  ERROR: {err.strip()}")
    return code


# ── Fix 1: Kafka data directory permissions ──
step("Fix 1: Kafka data directory permissions (chown to uid 1000)")
code, out, err = ssh(STG_KAFKA, "chown -R 1000:1000 /kafka-data && ls -la /kafka-data/", timeout=30)
print(out.strip())

step("Restart Kafka brokers")
code, out, err = ssh(STG_KAFKA,
    "cd /opt/aris-deploy/vm-kafka-stg && docker compose --env-file .env restart kafka-1 kafka-2 kafka-3 2>&1",
    timeout=120)
print(out.strip())

import time
print("  Waiting 30s for Kafka to stabilize...")
time.sleep(30)

# Check Kafka status
code, out, err = ssh(STG_KAFKA, "docker logs aris-stg-kafka-1 --tail 5 2>&1", timeout=15)
print("  kafka-1 last logs:")
for line in out.strip().splitlines():
    print(f"    {line}")


# ── Fix 2: Copy SSL cert from production to staging ──
step("Fix 2: Copy SSL certificate from production to staging")

sftp_relay(PROD_APP, "/opt/aris-deploy/vm-app/certs/fullchain.pem",
           STG_APP,  "/opt/aris-deploy/vm-app-stg/certs/fullchain.pem")

sftp_relay(PROD_APP, "/opt/aris-deploy/vm-app/certs/private.key",
           STG_APP,  "/opt/aris-deploy/vm-app-stg/certs/private.key")

# Set permissions
step("Set cert permissions")
code, out, err = ssh(STG_APP,
    "chmod 600 /opt/aris-deploy/vm-app-stg/certs/private.key && "
    "chmod 644 /opt/aris-deploy/vm-app-stg/certs/fullchain.pem && "
    "ls -la /opt/aris-deploy/vm-app-stg/certs/", timeout=15)
print(out.strip())

print("\n  All fixes applied!")
