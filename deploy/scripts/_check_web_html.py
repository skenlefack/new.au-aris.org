#!/usr/bin/env python3
"""
ARIS — Check what the web container actually renders for domains
Fetch the HTML from the Next.js server and extract domain card content
"""

import paramiko
import json
import re
import sys
from datetime import datetime

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
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return out, err, code


def connect(ip):
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(hostname=ip, username=SSH_USER, password=SSH_PASS, timeout=15)
    return client


def main():
    print(f"{'#'*70}")
    print(f"  ARIS — Web HTML Domain Check")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    for label, ip in [("PRODUCTION", "10.202.101.183"), ("STAGING", "10.202.101.146")]:
        print(f"\n{'='*70}")
        print(f"  {label} ({ip})")
        print(f"{'='*70}")

        try:
            client = connect(ip)

            # 1. Check what web container returns for the landing page HTML
            print(f"\n  --- 1. Fetch landing page HTML from web container ---")
            out, err, code = run(client, "curl -s http://localhost:3100/ 2>&1 | head -500")
            if out:
                # Extract domain-related content from HTML
                # Look for text that appears in the domain cards
                domain_names = [
                    "Animal Health", "Livestock", "Production", "Pastoralism",
                    "Fisheries", "Trade", "Wildlife", "Apiculture",
                    "Governance", "Climate", "Knowledge",
                ]

                print(f"  HTML length: {len(out)} chars")

                # Check if the page contains domain cards
                for name in domain_names:
                    if name in out:
                        # Find context around the name
                        idx = out.find(name)
                        start = max(0, idx - 80)
                        end = min(len(out), idx + 120)
                        snippet = out[start:end].replace("\n", " ").strip()
                        print(f"  Found '{name}' at pos {idx}: ...{snippet}...")
                        break
                else:
                    print(f"  No domain names found in HTML — might be client-side rendered")

            # 2. Check __NEXT_DATA__ or RSC payload for domain data
            print(f"\n  --- 2. Check Next.js server data (RSC / __NEXT_DATA__) ---")
            out2, err2, code2 = run(client,
                'curl -s http://localhost:3100/ 2>&1 | grep -o \'__NEXT_DATA__[^<]*\' | head -5',
                timeout=15)
            if out2:
                print(f"  Found __NEXT_DATA__: {out2[:200]}...")
            else:
                print(f"  No __NEXT_DATA__ found (likely RSC streaming)")

            # 3. Check the RSC payload specifically
            print(f"\n  --- 3. Fetch RSC payload with domain data ---")
            # Next.js App Router uses RSC - let's check the full HTML for domain descriptions
            out3, err3, code3 = run(client,
                'curl -s http://localhost:3100/ 2>&1 | grep -oP \'description[^}]+\' | head -20',
                timeout=15)
            if out3:
                print(f"  Description fragments in HTML:")
                for line in out3.split("\n")[:15]:
                    print(f"    {line[:100]}")
            else:
                print(f"  No description fragments found in grep")

            # 4. Try to find the serialized domain data in the HTML
            print(f"\n  --- 4. Search for domain serialized data ---")
            out4, err4, code4 = run(client,
                'curl -s http://localhost:3100/ 2>&1 | grep -oP \'animal-health[^"]{0,200}\' | head -10',
                timeout=15)
            if out4:
                for line in out4.split("\n")[:5]:
                    print(f"    {line[:150]}")
            else:
                print(f"  No 'animal-health' text in HTML")

            # 5. Check if web can reach tenant API internally
            print(f"\n  --- 5. Test web→tenant connectivity ---")
            prefix = "aris" if label == "PRODUCTION" else "aris-stg"
            out5, err5, code5 = run_sudo(client,
                f'docker exec {prefix}-web wget -qO- http://{prefix}-tenant:3001/api/v1/public/domains 2>&1 | head -200',
                SSH_PASS, timeout=15)
            if not out5:
                # Try with curl
                out5, err5, code5 = run_sudo(client,
                    f'docker exec {prefix}-web curl -s http://{prefix}-tenant:3001/api/v1/public/domains 2>&1 | head -200',
                    SSH_PASS, timeout=15)
            if out5:
                try:
                    data = json.loads(out5)
                    domains = data.get("data", [])
                    print(f"  Web container can reach tenant API: {len(domains)} domains")
                    for d in domains[:3]:
                        name_en = d.get("name", {}).get("en", "?")
                        desc_en = d.get("description", {}).get("en", "?") if d.get("description") else "NULL"
                        print(f"    {d.get('code')}: name='{name_en[:30]}' desc='{desc_en[:40]}'")
                except:
                    print(f"  Raw output: {out5[:200]}")
            else:
                print(f"  [!] Web container CANNOT reach tenant API")

            # 6. Check environment variables in web container
            print(f"\n  --- 6. Web container env vars ---")
            out6, err6, code6 = run_sudo(client,
                f"docker exec {prefix}-web env 2>&1 | grep -iE 'TENANT|API_URL|INTERNAL' | sort",
                SSH_PASS, timeout=10)
            if out6:
                for line in out6.split("\n"):
                    if "password" not in line.lower() and "secret" not in line.lower():
                        print(f"    {line}")
            else:
                print(f"  No matching env vars found")

            client.close()
        except Exception as e:
            print(f"  [!] Error: {e}")

    print(f"\n{'#'*70}")
    print(f"  Done — {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
