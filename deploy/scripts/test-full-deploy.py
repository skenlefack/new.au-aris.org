#!/usr/bin/env python3
"""Test running the full setup-vm-db.sh script on VM-DB."""
import paramiko
import sys
import time

SSH_PASS = "@u-1baR.0rg$U24"
HOST = "10.202.101.185"

print(f"Connecting to {HOST}...")
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(HOST, 22, "arisadmin", SSH_PASS, timeout=15,
          allow_agent=False, look_for_keys=False)

# Run the actual setup script
cmd = "sudo -S bash /opt/aris-deploy/scripts/setup-vm-db.sh"
print(f"Running: {cmd}")
print("=" * 60)

stdin, stdout, stderr = c.exec_command(cmd, timeout=600)
stdin.write(SSH_PASS + "\n")
stdin.flush()
stdin.channel.shutdown_write()

# Stream output (handle Windows encoding)
for line in iter(stdout.readline, ""):
    line = line.rstrip()
    try:
        print(line)
    except UnicodeEncodeError:
        print(line.encode("ascii", errors="replace").decode())
    sys.stdout.flush()

exit_code = stdout.channel.recv_exit_status()
err = stderr.read().decode()
err_lines = [l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower()]
if err_lines:
    print("\n--- STDERR ---")
    for l in err_lines[:20]:
        print(l)

print(f"\n{'='*60}")
print(f"Exit code: {exit_code}")
c.close()
