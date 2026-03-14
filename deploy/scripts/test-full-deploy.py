#!/usr/bin/env python3
"""Test running the full setup-vm-db.sh script on VM-DB."""
import sys
from ssh_config import get_client, VM_DB, VM_PASS

print(f"Connecting to {VM_DB}...")
c = get_client(VM_DB)

# Run the actual setup script
cmd = "sudo -S bash /opt/aris-deploy/scripts/setup-vm-db.sh"
print(f"Running: {cmd}")
print("=" * 60)

stdin, stdout, stderr = c.exec_command(cmd, timeout=600)
stdin.write(VM_PASS + "\n")
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
