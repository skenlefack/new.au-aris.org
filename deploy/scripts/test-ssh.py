#!/usr/bin/env python3
"""Quick SSH test for all 4 VMs — sudo + Docker check."""
import paramiko

SSH_PASS = "@u-1baR.0rg$U24"
vms = [
    ("VM-DB",    "10.202.101.185"),
    ("VM-KAFKA", "10.202.101.184"),
    ("VM-APP",   "10.202.101.183"),
    ("VM-CACHE", "10.202.101.186"),
]

for name, host in vms:
    try:
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, 22, "arisadmin", SSH_PASS, timeout=10,
                  allow_agent=False, look_for_keys=False)

        # Test sudo
        cmd = f"echo '{SSH_PASS}' | sudo -S whoami 2>/dev/null"
        _, out, err = c.exec_command(cmd, timeout=10)
        sudo_result = out.read().decode().strip()

        # Test Docker
        cmd2 = f"echo '{SSH_PASS}' | sudo -S docker --version 2>/dev/null"
        _, out2, err2 = c.exec_command(cmd2, timeout=10)
        docker_result = out2.read().decode().strip()

        # Test disk
        cmd3 = f"echo '{SSH_PASS}' | sudo -S df -h / 2>/dev/null | tail -1"
        _, out3, _ = c.exec_command(cmd3, timeout=10)
        disk_result = out3.read().decode().strip()

        print(f"{name} ({host}):")
        print(f"  sudo: {sudo_result}")
        print(f"  docker: {docker_result or 'NOT INSTALLED'}")
        print(f"  disk: {disk_result}")
        c.close()
    except Exception as e:
        print(f"{name} ({host}): FAILED — {e}")
