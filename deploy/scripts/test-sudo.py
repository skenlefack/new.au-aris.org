#!/usr/bin/env python3
"""Test sudo command execution on VMs with proper password escaping."""
import time
from ssh_config import get_client, VM_DB, VM_PASS

c = get_client(VM_DB)

# Method 1: Use stdin to pipe password (avoids shell escaping)
stdin, stdout, stderr = c.exec_command("sudo -S whoami", timeout=15)
stdin.write(VM_PASS + "\n")
stdin.flush()
stdin.channel.shutdown_write()
result = stdout.read().decode().strip()
err = stderr.read().decode().strip()
print(f"Method 1 (stdin): stdout='{result}' stderr='{err}'")

c.close()

# Method 2: Try with get_pty
c2 = get_client(VM_DB)

stdin2, stdout2, stderr2 = c2.exec_command("sudo -S ls /opt/aris-deploy/", timeout=15, get_pty=True)
stdin2.write(VM_PASS + "\n")
stdin2.flush()
time.sleep(2)
result2 = stdout2.read().decode().strip()
print(f"Method 2 (pty): '{result2}'")

c2.close()
