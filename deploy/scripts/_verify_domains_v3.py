#!/usr/bin/env python3
"""
ARIS -- Final verification: check for DB vs fallback descriptions
"""

import paramiko
import sys
from datetime import datetime

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

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
    print(f"  HTML length: {len(html)} chars")

    # DB descriptions (long, from seed-settings.ts)
    db_markers = [
        ("animal-health", "Disease surveillance, outbreak management"),
        ("livestock-prod", "Livestock census, production systems"),
        ("governance", "Legal frameworks, veterinary services evaluation"),
        ("fisheries", "Capture fisheries, fishing fleet management"),
    ]

    # Fallback descriptions (short, from public-data.ts)
    fallback_markers = [
        ("animal-health", "Surveillance, outbreaks, AMR"),
        ("livestock-prod", "Census & production systems"),
        ("governance", "Legal frameworks & PVS"),
        ("fisheries", "Captures & aquaculture"),
    ]

    db_found = 0
    fallback_found = 0

    for domain, marker in db_markers:
        if marker in html:
            db_found += 1
            print(f"  [DB] {domain}: '{marker}' FOUND")

    for domain, marker in fallback_markers:
        if marker in html:
            fallback_found += 1
            print(f"  [FALLBACK] {domain}: '{marker}' FOUND")

    if db_found > 0 and fallback_found == 0:
        print(f"\n  RESULT: Using DATABASE descriptions ({db_found}/4 markers found)")
    elif fallback_found > 0 and db_found == 0:
        print(f"\n  RESULT: Using FALLBACK descriptions ({fallback_found}/4 markers found)")
    elif db_found > 0 and fallback_found > 0:
        print(f"\n  RESULT: MIXED - {db_found} DB + {fallback_found} fallback markers")
    else:
        print(f"\n  RESULT: Neither DB nor fallback markers found")
        # Check if domains appear at all
        if "Animal Health" in html:
            print(f"  (Domain names ARE present in HTML)")
        else:
            print(f"  (No domain names found either)")

    client.close()


def main():
    print(f"{'#'*70}")
    print(f"  ARIS -- Domain Source Verification")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    check_env("STAGING", "10.202.101.146")
    check_env("PRODUCTION", "10.202.101.183")

    print(f"\n{'#'*70}")
    print(f"  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
