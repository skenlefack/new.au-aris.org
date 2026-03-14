#!/usr/bin/env python3
"""Test running a setup script on VM-DB with proper sudo + streaming."""
from ssh_config import get_client, VM_DB, VM_PASS

c = get_client(VM_DB)

# First, check script is there
cmd = "sudo -S ls -la /opt/aris-deploy/scripts/"
stdin, stdout, stderr = c.exec_command(cmd, timeout=15)
stdin.write(VM_PASS + "\n")
stdin.flush()
stdin.channel.shutdown_write()
print("Files:", stdout.read().decode().strip())
c.close()

# Now try running just the first few lines of the script (apt update)
print("\n--- Testing setup script execution ---")
c2 = get_client(VM_DB)

# Run a simple Docker install test
test_cmd = "export DEBIAN_FRONTEND=noninteractive && apt-get update -qq 2>&1 | tail -3 && echo DONE"
full_cmd = f"sudo -S bash -c '{test_cmd}'"
print(f"Running: {full_cmd}")

stdin2, stdout2, stderr2 = c2.exec_command(full_cmd, timeout=120)
stdin2.write(VM_PASS + "\n")
stdin2.flush()
stdin2.channel.shutdown_write()

# Read output line by line
print("Output:")
for line in iter(stdout2.readline, ""):
    print(f"  {line.rstrip()}")

exit_code = stdout2.channel.recv_exit_status()
err = stderr2.read().decode()
err_clean = [l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower()]
if err_clean:
    print("Stderr:", "\n".join(err_clean[:5]))
print(f"Exit code: {exit_code}")
c2.close()
