#!/usr/bin/env python3
"""Quick check of all 4 staging VMs: SSH, Docker, disk space."""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import ssh

VMS = [
    ("APP",   "10.202.101.146"),
    ("KAFKA", "10.202.101.147"),
    ("DB",    "10.202.101.148"),
    ("CACHE", "10.202.101.149"),
]

print("=" * 60)
print("  ARIS Staging VMs — Status Check")
print("=" * 60)

for name, ip in VMS:
    print(f"\n--- {name} ({ip}) ---")
    code, out, err = ssh(ip, "hostname && docker --version 2>&1 && docker compose version 2>&1 && df -h / | tail -1 && free -h | head -2", timeout=20)
    if code == 0:
        for line in out.strip().splitlines():
            print(f"  {line}")
    else:
        print(f"  exit={code}")
        if err.strip():
            for line in err.strip().splitlines()[:5]:
                print(f"  ERR: {line}")

print("\n" + "=" * 60)
