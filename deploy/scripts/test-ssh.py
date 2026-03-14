#!/usr/bin/env python3
"""Quick SSH test for all 4 VMs — sudo + Docker check."""
from ssh_config import get_client, VM_APP, VM_KAFKA, VM_DB, VM_CACHE, VM_PASS

vms = [
    ("VM-DB",    VM_DB),
    ("VM-KAFKA", VM_KAFKA),
    ("VM-APP",   VM_APP),
    ("VM-CACHE", VM_CACHE),
]

for name, host in vms:
    try:
        c = get_client(host)

        # Test sudo
        cmd = "sudo -S whoami"
        stdin, stdout, stderr = c.exec_command(cmd, timeout=10)
        stdin.write(VM_PASS + "\n")
        stdin.flush()
        stdin.channel.shutdown_write()
        sudo_result = stdout.read().decode().strip()

        # Test Docker
        c2 = get_client(host)
        cmd2 = "sudo -S docker --version"
        stdin2, stdout2, stderr2 = c2.exec_command(cmd2, timeout=10)
        stdin2.write(VM_PASS + "\n")
        stdin2.flush()
        stdin2.channel.shutdown_write()
        docker_result = stdout2.read().decode().strip()
        c2.close()

        # Test disk
        c3 = get_client(host)
        cmd3 = "sudo -S df -h / 2>/dev/null | tail -1"
        stdin3, stdout3, stderr3 = c3.exec_command(cmd3, timeout=10)
        stdin3.write(VM_PASS + "\n")
        stdin3.flush()
        stdin3.channel.shutdown_write()
        disk_result = stdout3.read().decode().strip()
        c3.close()

        print(f"{name} ({host}):")
        print(f"  sudo: {sudo_result}")
        print(f"  docker: {docker_result or 'NOT INSTALLED'}")
        print(f"  disk: {disk_result}")
        c.close()
    except Exception as e:
        print(f"{name} ({host}): FAILED — {e}")
