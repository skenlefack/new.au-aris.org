#!/usr/bin/env python3
"""Test sudo command execution on VMs with proper password escaping."""
import paramiko

SSH_PASS = "@u-1baR.0rg$U24"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("10.202.101.185", 22, "arisadmin", SSH_PASS, timeout=10,
          allow_agent=False, look_for_keys=False)

# Method 1: Use stdin to pipe password (avoids shell escaping)
stdin, stdout, stderr = c.exec_command("sudo -S whoami", timeout=15)
stdin.write(SSH_PASS + "\n")
stdin.flush()
stdin.channel.shutdown_write()
result = stdout.read().decode().strip()
err = stderr.read().decode().strip()
print(f"Method 1 (stdin): stdout='{result}' stderr='{err}'")

c.close()

# Method 2: Try with get_pty
c2 = paramiko.SSHClient()
c2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c2.connect("10.202.101.185", 22, "arisadmin", SSH_PASS, timeout=10,
           allow_agent=False, look_for_keys=False)

stdin2, stdout2, stderr2 = c2.exec_command("sudo -S ls /opt/aris-deploy/", timeout=15, get_pty=True)
stdin2.write(SSH_PASS + "\n")
stdin2.flush()
import time
time.sleep(2)
result2 = stdout2.read().decode().strip()
print(f"Method 2 (pty): '{result2}'")

c2.close()
