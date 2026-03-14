#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy backup scripts and crontabs to production VMs.

Copies backup scripts to VMs, creates backup directories, and installs crontabs:
  - VM-DB:    backup-postgres.sh  at 02:00 UTC daily
  - VM-CACHE: backup-redis.sh     at 02:30 UTC daily
  - VM-CACHE: backup-opensearch.sh at 03:00 UTC daily

Usage:
  export ARIS_DEPLOY_PASS='...'
  python _deploy_backups.py
"""
import os
import sys
import paramiko
from ssh_config import ssh, step, VM_DB, VM_CACHE, VM_USER, VM_PASS, VM_KEY

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))


def scp_file(host, local_path, remote_path):
    """Upload a file to a remote VM via SFTP."""
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs = dict(
        hostname=host,
        port=22,
        username=VM_USER,
        timeout=15,
        allow_agent=False,
        look_for_keys=False,
    )
    if VM_KEY:
        connect_kwargs["key_filename"] = VM_KEY
    else:
        connect_kwargs["password"] = VM_PASS

    c.connect(**connect_kwargs)
    sftp = c.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()
    c.close()
    print(f"  Uploaded {os.path.basename(local_path)} -> {host}:{remote_path}")


def install_crontab(host, entries):
    """Add crontab entries (idempotent — skips if already present)."""
    for schedule, cmd, label in entries:
        cron_line = f"{schedule} {cmd}"
        # Check if cron entry already exists
        code, out, _ = ssh(host, f"crontab -l 2>/dev/null | grep -F '{cmd}' || true")
        if out.strip():
            print(f"  Cron already exists on {host}: {label}")
        else:
            # Append to crontab
            ssh(host, f'(crontab -l 2>/dev/null; echo "{cron_line}") | crontab -')
            print(f"  Cron installed on {host}: {label} ({schedule})")


# ══════════════════════════════════════════════════════════════
# VM-DB: PostgreSQL backup
# ══════════════════════════════════════════════════════════════
step("VM-DB: Deploy PostgreSQL backup")

# Create directories
ssh(VM_DB, "mkdir -p /backups/postgres/daily /backups/postgres/weekly")
ssh(VM_DB, "mkdir -p /opt/aris-deploy/scripts")
print("  Created /backups/postgres/")

# Upload script
scp_file(VM_DB,
         os.path.join(SCRIPT_DIR, "backup-postgres.sh"),
         "/opt/aris-deploy/scripts/backup-postgres.sh")
ssh(VM_DB, "chmod +x /opt/aris-deploy/scripts/backup-postgres.sh")

# Install crontab
install_crontab(VM_DB, [
    ("0 2 * * *",
     "/opt/aris-deploy/scripts/backup-postgres.sh >> /var/log/aris-backup-postgres.log 2>&1",
     "PostgreSQL daily backup at 02:00 UTC"),
])

# ══════════════════════════════════════════════════════════════
# VM-CACHE: Redis + OpenSearch backups
# ══════════════════════════════════════════════════════════════
step("VM-CACHE: Deploy Redis & OpenSearch backups")

# Create directories
ssh(VM_CACHE, "mkdir -p /backups/redis /backups/opensearch/snapshots")
ssh(VM_CACHE, "mkdir -p /opt/aris-deploy/scripts")
print("  Created /backups/redis/ and /backups/opensearch/")

# Upload scripts
scp_file(VM_CACHE,
         os.path.join(SCRIPT_DIR, "backup-redis.sh"),
         "/opt/aris-deploy/scripts/backup-redis.sh")
scp_file(VM_CACHE,
         os.path.join(SCRIPT_DIR, "backup-opensearch.sh"),
         "/opt/aris-deploy/scripts/backup-opensearch.sh")
ssh(VM_CACHE, "chmod +x /opt/aris-deploy/scripts/backup-redis.sh /opt/aris-deploy/scripts/backup-opensearch.sh")

# Install crontabs
install_crontab(VM_CACHE, [
    ("30 2 * * *",
     "/opt/aris-deploy/scripts/backup-redis.sh >> /var/log/aris-backup-redis.log 2>&1",
     "Redis daily backup at 02:30 UTC"),
    ("0 3 * * *",
     "/opt/aris-deploy/scripts/backup-opensearch.sh >> /var/log/aris-backup-opensearch.log 2>&1",
     "OpenSearch daily backup at 03:00 UTC"),
])

# ══════════════════════════════════════════════════════════════
# Summary
# ══════════════════════════════════════════════════════════════
step("Backup deployment complete!")
print("""
  VM-DB    (10.202.101.185):
    - /backups/postgres/daily/   — 7 days retention
    - /backups/postgres/weekly/  — 4 weeks retention
    - Cron: 02:00 UTC daily

  VM-CACHE (10.202.101.186):
    - /backups/redis/            — 7 days retention
    - /backups/opensearch/       — 7 snapshots retention
    - Cron: 02:30 UTC (Redis), 03:00 UTC (OpenSearch)

  Next steps:
    1. Wait 24 hours
    2. Run: python _check_backups.py
""")
