#!/usr/bin/env python3
"""
ARIS -- Final verification of domain descriptions after ISR refresh
"""

import paramiko
import json
import sys
from datetime import datetime

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"


def run(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    return out


def connect(ip):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=ip, username=SSH_USER, password=SSH_PASS, timeout=15)
    return client


def check_env(label, ip):
    print(f"\n  --- {label} ({ip}) ---")
    client = connect(ip)

    html = run(client, "curl -s http://localhost:3100/ 2>/dev/null")
    if not html:
        print(f"  [!] No HTML returned")
        client.close()
        return

    print(f"  HTML length: {len(html)} chars")

    # Check for DB descriptions (long) vs fallback descriptions (short)
    db_marker = "Disease surveillance, outbreak management"
    fallback_marker = "Surveillance, outbreaks, AMR"

    if db_marker in html:
        print(f"  RESULT: DB descriptions (from tenant API)")
    elif fallback_marker in html:
        print(f"  RESULT: Fallback descriptions (static data)")
    else:
        print(f"  RESULT: Unknown - checking manually...")

    # Extract all domain description snippets
    import re
    descs = re.findall(r'"description":\{"en":"([^"]+)"', html)
    if descs:
        print(f"  Found {len(descs)} description entries:")
        for d in descs[:12]:
            print(f"    - {d[:70]}")
    else:
        print(f"  No description entries found in HTML")

    # Also extract domain names to compare
    names = re.findall(r'"name":\{"en":"([^"]+)"', html)
    if names:
        # Filter to likely domain names (not REC names or meta)
        domain_names = [n for n in names if any(k in n.lower() for k in
            ["health", "livestock", "production", "trade", "fisher", "wildlife",
             "apiculture", "governance", "climate", "knowledge"])]
        if domain_names:
            print(f"\n  Domain names found:")
            for n in domain_names[:9]:
                print(f"    - {n}")

    client.close()


def main():
    print(f"{'#'*70}")
    print(f"  ARIS -- Domain Description Verification")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    check_env("STAGING", "10.202.101.146")
    check_env("PRODUCTION", "10.202.101.183")

    print(f"\n{'#'*70}")
    print(f"  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
