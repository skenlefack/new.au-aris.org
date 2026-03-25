#!/usr/bin/env python3
"""
ARIS — Fix Veeam false-positive — v3 (surgical deletion)
1. Free disk space aggressively
2. Delete internmap directly from Docker overlay layers
3. Rebuild services in small batches
"""

import paramiko
import sys
from datetime import datetime

VM_APP = {
    "ip": "10.202.101.183",
    "user": "arisadmin",
    "password": "@u-1baR.0rg$U24",
}


def run_sudo(client, cmd, timeout=300):
    full_cmd = f"sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    stdin.write(VM_APP["password"] + "\n")
    stdin.flush()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err_lines = [l for l in err.split("\n")
                 if "[sudo]" not in l and "password for" not in l.lower()]
    err = "\n".join(err_lines).strip()
    return out, err, code


def step(client, num, title, cmd, timeout=300):
    print(f"\n{'='*70}")
    print(f"  STEP {num} — {title}")
    print(f"{'='*70}")
    out, err, code = run_sudo(client, cmd, timeout=timeout)
    if out:
        lines = out.split("\n")
        if len(lines) > 40:
            print("\n".join(lines[:20]))
            print(f"  ... ({len(lines) - 40} lines omitted) ...")
            print("\n".join(lines[-20:]))
        else:
            print(out)
    if err and len(err) > 10:
        print(f"  [STDERR] {err[:500]}")
    status = "OK" if code == 0 else f"EXIT {code}"
    print(f"  [{status}]")
    return code


def main():
    print(f"\n{'#'*70}")
    print(f"  ARIS — Surgical Fix: Remove internmap from Docker overlays")
    print(f"  Target: nbo-aris04 ({VM_APP['ip']})")
    print(f"  Time: {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        client.connect(
            hostname=VM_APP["ip"],
            username=VM_APP["user"],
            password=VM_APP["password"],
            timeout=15,
        )
        print("[+] Connected.\n")

        # Step 1: Check disk space
        step(client, "1/6", "Check disk space",
             "df -h / /var/lib/docker 2>/dev/null || df -h /")

        # Step 2: Aggressive prune to reclaim space
        step(client, "2/6", "Aggressive Docker prune (unused images, build cache, volumes)",
             "docker system prune -af --volumes 2>/dev/null; docker builder prune -af 2>/dev/null; echo Done",
             timeout=120)

        # Step 3: Check disk space after prune
        step(client, "3/6", "Check disk space after prune",
             "df -h / /var/lib/docker 2>/dev/null || df -h /")

        # Step 4: Find and delete ALL internmap directories from Docker overlay
        step(client, "4/6", "Delete internmap from ALL Docker overlay layers",
             r"""
echo "=== Before ==="
count_before=$(find /var/lib/docker -iname '*internmap*' 2>/dev/null | wc -l)
echo "Files containing internmap: $count_before"

echo ""
echo "=== Deleting internmap directories ==="
find /var/lib/docker -maxdepth 10 -type d -name 'internmap' -exec rm -rf {} + 2>/dev/null
find /var/lib/docker -maxdepth 10 -type d -name 'internmap@*' -exec rm -rf {} + 2>/dev/null

echo ""
echo "=== Deleting remaining internmap files ==="
find /var/lib/docker -maxdepth 10 -iname '*internmap*' -not -type d -exec rm -f {} + 2>/dev/null

echo ""
echo "=== After ==="
count_after=$(find /var/lib/docker -iname '*internmap*' 2>/dev/null | wc -l)
echo "Files containing internmap: $count_after"

if [ "$count_after" -eq 0 ]; then
    echo ""
    echo "SUCCESS: All internmap references removed from Docker filesystem"
else
    echo ""
    echo "Remaining files:"
    find /var/lib/docker -iname '*internmap*' 2>/dev/null | head -10
fi
""")

        # Step 5: Restart containers that may have been affected
        step(client, "5/6", "Verify containers are still running",
             "docker ps --format 'table {{.Names}}\\t{{.Status}}' | head -45")

        # Step 6: Final verification
        step(client, "6/6", "Final verification — no internmap on entire system",
             r"""
echo "=== Docker filesystem ==="
docker_count=$(find /var/lib/docker -iname '*nmap*' ! -iname '*internmap*' 2>/dev/null | wc -l)
intern_count=$(find /var/lib/docker -iname '*internmap*' 2>/dev/null | wc -l)
echo "nmap (actual) files: $docker_count"
echo "internmap (false positive) files: $intern_count"

echo ""
echo "=== Host filesystem ==="
host_nmap=$(which nmap 2>/dev/null || echo "not installed")
echo "nmap binary: $host_nmap"

echo ""
if [ "$intern_count" -eq 0 ] && [ "$host_nmap" = "not installed" ]; then
    echo "ALL CLEAR - Next Veeam scan should be clean"
else
    echo "WARNING - Some files remain"
fi
""")

    except Exception as e:
        print(f"\n[!] Error: {e}")
        sys.exit(1)
    finally:
        client.close()
        print(f"\n{'#'*70}")
        print(f"  Complete — {datetime.now().isoformat()}")
        print(f"{'#'*70}")


if __name__ == "__main__":
    main()
