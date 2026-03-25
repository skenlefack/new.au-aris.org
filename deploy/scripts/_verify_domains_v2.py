#!/usr/bin/env python3
"""
ARIS -- Verify domain descriptions + force ISR revalidation
"""

import paramiko
import json
import re
import time
import sys
from datetime import datetime

# Fix Windows encoding
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"


def run_sudo(client, cmd, timeout=30):
    full_cmd = f"sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return out, err, code


def run(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    return out


def connect(ip):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=ip, username=SSH_USER, password=SSH_PASS, timeout=15)
    return client


def check_env(label, ip, prefix):
    print(f"\n{'='*70}")
    print(f"  {label} ({ip})")
    print(f"{'='*70}")
    client = connect(ip)

    # 1. Check env var inside web container
    print(f"\n  1. Env vars in {prefix}-web:")
    out, err, code = run_sudo(client, f"docker exec {prefix}-web env 2>&1 | grep -iE 'TENANT|API_URL|INTERNAL|NODE_ENV'")
    for line in out.split("\n"):
        if "password" not in line.lower() and "secret" not in line.lower():
            print(f"    {line}")

    # 2. Test internal connectivity
    print(f"\n  2. Test {prefix}-web -> tenant:3001:")
    out, err, code = run_sudo(client, f"docker exec {prefix}-web wget -qO- http://tenant:3001/api/v1/public/domains 2>&1 | head -100")
    if out and "data" in out:
        try:
            data = json.loads(out[:2000] if len(out) > 2000 else out)
            domains = data.get("data", [])
            print(f"    OK: {len(domains)} domains returned from API")
            if domains:
                d = domains[0]
                print(f"    Sample: name={d.get('name',{}).get('en','?')[:30]}")
                print(f"    Sample: desc={d.get('description',{}).get('en','?')[:50]}")
        except json.JSONDecodeError:
            print(f"    Raw: {out[:150]}")
    else:
        print(f"    FAIL: {out[:150] if out else 'empty'}")
        # Try alternate hostname
        print(f"    Trying {prefix}-tenant:3001...")
        out2, err2, code2 = run_sudo(client, f"docker exec {prefix}-web wget -qO- http://{prefix}-tenant:3001/api/v1/public/domains 2>&1 | head -100")
        if out2 and "data" in out2:
            print(f"    OK via {prefix}-tenant:3001")
        else:
            print(f"    Also FAIL: {out2[:100] if out2 else 'empty'}")

    # 3. Check web container logs for fetch errors
    print(f"\n  3. Web container logs (last 15 lines):")
    out, err, code = run_sudo(client, f"docker logs {prefix}-web --tail 15 2>&1")
    for line in out.split("\n")[-15:]:
        print(f"    {line}")

    # 4. Fetch the HTML and check descriptions
    print(f"\n  4. HTML domain descriptions:")
    html = run(client, "curl -s http://localhost:3100/ 2>/dev/null")
    if html:
        print(f"    HTML length: {len(html)} chars")
        descs = re.findall(r'"description":\{"en":"([^"]+)"', html)
        names = re.findall(r'"name":\{"en":"([^"]+)"', html)

        # Find domain-specific entries
        domain_keywords = ["health", "livestock", "production", "trade", "fisher",
                          "wildlife", "apiculture", "governance", "climate", "knowledge",
                          "surveillance", "census", "capture", "legal", "water", "e-learn",
                          "markets", "biodiv", "pollin"]

        domain_descs = [d for d in descs if any(k in d.lower() for k in domain_keywords)]
        domain_names = [n for n in names if any(k in n.lower() for k in domain_keywords)]

        if domain_descs:
            print(f"    Descriptions ({len(domain_descs)}):")
            for d in domain_descs[:9]:
                print(f"      - {d[:70]}")
        else:
            print(f"    No domain descriptions found in HTML")

        if domain_names:
            print(f"    Names ({len(domain_names)}):")
            for n in domain_names[:9]:
                print(f"      - {n}")

        # Determine source
        if any("outbreak management" in d for d in domain_descs):
            print(f"\n    SOURCE: Database (via tenant API)")
        elif any("outbreaks, AMR" in d for d in domain_descs):
            print(f"\n    SOURCE: Static fallback")
        else:
            print(f"\n    SOURCE: Unknown")
    else:
        print(f"    [!] No HTML returned")

    client.close()


def main():
    print(f"{'#'*70}")
    print(f"  ARIS -- Domain Description Verification v2")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    check_env("STAGING", "10.202.101.146", "aris-stg")
    check_env("PRODUCTION", "10.202.101.183", "aris")

    print(f"\n{'#'*70}")
    print(f"  Done -- {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
