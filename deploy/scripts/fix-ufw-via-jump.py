#!/usr/bin/env python3
"""Fix VM-DB UFW lockout by jumping through VM-KAFKA (which has no UFW yet).
Also check which VMs are still SSH-accessible from our machine.
"""
import paramiko
import sys
from ssh_config import VM_APP, VM_KAFKA, VM_DB, VM_CACHE, VM_USER, VM_PASS

vms = [
    ("VM-APP",   VM_APP),
    ("VM-KAFKA", VM_KAFKA),
    ("VM-DB",    VM_DB),
    ("VM-CACHE", VM_CACHE),
]

# Step 1: Check which VMs are SSH-accessible from our machine
print("=== Step 1: Testing SSH connectivity from our machine ===")
accessible_vms = []
for name, host in vms:
    try:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, VM_USER, VM_PASS, timeout=8,
                  allow_agent=False, look_for_keys=False)
        stdin, stdout, stderr = c.exec_command("hostname", timeout=5)
        hostname = stdout.read().decode().strip()
        print(f"  {name} ({host}): ACCESSIBLE (hostname: {hostname})")
        accessible_vms.append((name, host))
        c.close()
    except Exception as e:
        print(f"  {name} ({host}): BLOCKED ({type(e).__name__})")

if not accessible_vms:
    print("\nERROR: No VMs accessible! Need console/IPMI access to fix UFW.")
    sys.exit(1)

# Step 2: Use an accessible VM to jump to VM-DB and fix UFW
jump_name, jump_host = accessible_vms[0]  # Use first accessible VM
print(f"\n=== Step 2: Using {jump_name} ({jump_host}) as jump host ===")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(jump_host, 22, VM_USER, VM_PASS, timeout=15,
          allow_agent=False, look_for_keys=False)

# Check our source IP from the jump host's perspective
stdin, stdout, stderr = c.exec_command("hostname -I | awk '{print $1}'", timeout=5)
jump_ip = stdout.read().decode().strip()
print(f"  Jump host IP: {jump_ip}")

# Try to SSH from jump host to VM-DB (should work since jump is in 10.202.101.0/24)
print(f"\n=== Step 3: SSH from {jump_name} to VM-DB ===")
# Install sshpass on jump host if needed, or use python-based approach
# Actually we'll use a nested SSH approach - create an SSH command on the jump host

# First check if sshpass is available
stdin, stdout, stderr = c.exec_command("which sshpass 2>/dev/null || echo 'NOT_FOUND'", timeout=5)
sshpass = stdout.read().decode().strip()
print(f"  sshpass on jump host: {sshpass}")

# We can use Python's paramiko to create a tunnel
# But simpler: pipe password via stdin to ssh on jump host
fix_cmd = f"""sshpass -p '{VM_PASS}' ssh -o StrictHostKeyChecking=no {VM_USER}@{VM_DB} "echo '{VM_PASS}' | sudo -S bash -c 'ufw allow 22/tcp comment SSH-any && ufw status numbered'" 2>&1"""

if "NOT_FOUND" in sshpass:
    print("  sshpass not available, trying expect-style approach...")
    # Alternative: use Python paramiko to create a forwarded channel
    # Open a channel to VM-DB through the jump host
    try:
        transport = c.get_transport()
        dest_addr = (VM_DB, 22)
        local_addr = (jump_host, 0)
        channel = transport.open_channel("direct-tcpip", dest_addr, local_addr)

        # Create new SSH client over the forwarded channel
        c2 = paramiko.SSHClient()
        c2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c2.connect(VM_DB, port=22, username=VM_USER, password=VM_PASS,
                   sock=channel, timeout=15, allow_agent=False, look_for_keys=False)

        print("  Connected to VM-DB via jump host!")

        # Fix UFW: allow SSH from anywhere (or from our specific subnet)
        fix_ufw = "ufw allow 22/tcp comment 'SSH-from-any' && ufw status numbered"
        stdin2, stdout2, stderr2 = c2.exec_command(f"sudo -S bash -c '{fix_ufw}'", timeout=15)
        stdin2.write(VM_PASS + "\n")
        stdin2.flush()
        stdin2.channel.shutdown_write()

        out = stdout2.read().decode("utf-8", errors="replace").strip()
        err = stderr2.read().decode("utf-8", errors="replace").strip()
        exit_code = stdout2.channel.recv_exit_status()

        print(f"  Exit code: {exit_code}")
        print(f"  Output:\n{out}")
        if err:
            err_clean = "\n".join(l for l in err.splitlines()
                                   if "[sudo]" not in l and "password" not in l.lower())
            if err_clean.strip():
                print(f"  Stderr: {err_clean[:300]}")

        c2.close()
        print("\n  VM-DB UFW should now allow SSH from any IP!")

    except Exception as e:
        print(f"  Jump SSH failed: {e}")
        print("  You may need console access to VM-DB to fix UFW.")
else:
    # Use sshpass
    stdin, stdout, stderr = c.exec_command(fix_cmd, timeout=30)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    print(f"  Output: {out}")
    if err:
        print(f"  Stderr: {err[:300]}")

c.close()

# Step 4: Verify VM-DB is now accessible directly
print("\n=== Step 4: Verifying VM-DB direct SSH access ===")
try:
    c3 = paramiko.SSHClient()
    c3.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c3.connect(VM_DB, 22, VM_USER, VM_PASS, timeout=10,
               allow_agent=False, look_for_keys=False)
    stdin, stdout, stderr = c3.exec_command("hostname && hostname -I", timeout=5)
    print(f"  VM-DB accessible: {stdout.read().decode().strip()}")
    c3.close()
except Exception as e:
    print(f"  VM-DB still not accessible: {e}")
    print("  UFW rule may need time to take effect, or use console access.")
