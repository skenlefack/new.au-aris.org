#!/usr/bin/env python3
"""
Invalidate all refresh tokens in Redis on prod + staging.
Users will be forced to re-login and receive the new hierarchical JWT format.

Run this AFTER deploying the credential service with hierarchical JWT support.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import ssh, step

TARGETS = [
    ("STAGING", "10.202.101.149", "aris-stg-redis", "R3d1s_Stg_2024!vN7wQ"),
    ("PRODUCTION", "10.202.101.186", "aris-redis", "R3d1s_Pr0d_2024!vN7wQ"),
]

ONLY = sys.argv[1] if len(sys.argv) > 1 else None

for name, host, container, password in TARGETS:
    if ONLY == "--stg" and name != "STAGING":
        continue
    if ONLY == "--prod" and name != "PRODUCTION":
        continue

    step(f"{name} — Invalidate all sessions")

    # Count existing refresh tokens
    print("  Counting refresh tokens...")
    code, out, err = ssh(host,
        f'docker exec {container} redis-cli -a {password} --no-auth-warning KEYS "refresh:*" 2>/dev/null | wc -l',
        timeout=15)
    count = out.strip()
    print(f"  Found {count} refresh tokens")

    if count == "0":
        print("  Nothing to invalidate.")
        continue

    # Delete all refresh tokens
    print("  Deleting all refresh:* keys...")
    code, out, err = ssh(host,
        f'docker exec {container} redis-cli -a {password} --no-auth-warning --scan --pattern "refresh:*" | '
        f'xargs -r docker exec -i {container} redis-cli -a {password} --no-auth-warning DEL 2>/dev/null',
        timeout=30)
    print(f"  {out.strip()}")

    # Also delete blacklisted tokens (they reference old format)
    print("  Deleting blacklist:* keys...")
    code, out, err = ssh(host,
        f'docker exec {container} redis-cli -a {password} --no-auth-warning --scan --pattern "blacklist:*" | '
        f'xargs -r docker exec -i {container} redis-cli -a {password} --no-auth-warning DEL 2>/dev/null',
        timeout=30)
    print(f"  {out.strip()}")

    # Verify
    code, out, err = ssh(host,
        f'docker exec {container} redis-cli -a {password} --no-auth-warning KEYS "refresh:*" 2>/dev/null | wc -l',
        timeout=15)
    print(f"  Remaining refresh tokens: {out.strip()}")

print("\nDone! All users must re-login to get new hierarchical JWT.")
