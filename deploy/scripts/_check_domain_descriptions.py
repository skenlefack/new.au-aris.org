#!/usr/bin/env python3
"""
ARIS — Check domain descriptions on production and staging
Verify that name ≠ description in both API responses and DB
"""

import paramiko
import json
import sys
from datetime import datetime

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = [
    {
        "label": "PRODUCTION",
        "app_ip": "10.202.101.183",
        "db_ip": "10.202.101.185",
        "container_prefix": "aris",
        "db_container": "aris-postgresql",
        "db_password": "Ar1s_Pr0d_2024!vN7wQ",
    },
    {
        "label": "STAGING",
        "app_ip": "10.202.101.146",
        "db_ip": "10.202.101.148",
        "container_prefix": "aris-stg",
        "db_container": "aris-stg-postgresql",
        "db_password": "Ar1s_Stg_2024!xK9mZ",
    },
]


def run_sudo(client, cmd, password, timeout=30):
    full_cmd = f"sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    stdin.write(password + "\n")
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
    print(f"  ARIS — Domain Description Check")
    print(f"  {datetime.now().isoformat()}")
    print(f"{'#'*70}")

    for env in ENVS:
        print(f"\n{'='*70}")
        print(f"  {env['label']}")
        print(f"{'='*70}")

        # 1. Check API response
        try:
            app = connect(env["app_ip"])
            print(f"\n  --- API: GET /api/v1/public/domains ---")
            out, err, code = run(app, "curl -s http://localhost:3001/api/v1/public/domains 2>&1")
            if out:
                try:
                    data = json.loads(out)
                    domains = data.get("data", [])
                    print(f"  Got {len(domains)} domains from API")
                    print(f"\n  {'Code':<18} {'Name (en)':<35} {'Description (en)'}")
                    print(f"  {'-'*18} {'-'*35} {'-'*50}")
                    for d in domains:
                        name_en = d.get("name", {}).get("en", "—")
                        desc_en = d.get("description", {}).get("en", "—") if d.get("description") else "NULL"
                        same = " *** SAME ***" if name_en == desc_en else ""
                        print(f"  {d.get('code', '?'):<18} {name_en:<35} {desc_en[:50]}{same}")
                except json.JSONDecodeError:
                    print(f"  [!] Not JSON: {out[:200]}")
            app.close()
        except Exception as e:
            print(f"  [!] API check failed: {e}")

        # 2. Check DB directly
        try:
            db = connect(env["db_ip"])
            print(f"\n  --- DB: SELECT from governance.domains ---")
            sql = "SELECT code, name, description FROM governance.domains ORDER BY sort_order;"
            out, err, code = run_sudo(
                db,
                f'docker exec {env["db_container"]} psql -U aris -d aris -t -A -F "|" -c "{sql}" 2>&1',
                SSH_PASS,
                timeout=15,
            )
            if out:
                lines = [l for l in out.split("\n") if "|" in l]
                print(f"  Got {len(lines)} rows from DB")
                for line in lines:
                    parts = line.split("|", 2)
                    if len(parts) >= 3:
                        code_val = parts[0].strip()
                        try:
                            name_obj = json.loads(parts[1].strip())
                            name_en = name_obj.get("en", "?")
                        except:
                            name_en = parts[1].strip()[:30]
                        try:
                            desc_obj = json.loads(parts[2].strip())
                            desc_en = desc_obj.get("en", "?")
                        except:
                            desc_en = parts[2].strip()[:50]
                        same = " *** SAME ***" if name_en == desc_en else ""
                        print(f"  {code_val:<18} name={name_en[:30]:<32} desc={desc_en[:50]}{same}")
            if err and "[sudo]" not in err and "password" not in err.lower():
                print(f"  [STDERR] {err[:300]}")
            db.close()
        except Exception as e:
            print(f"  [!] DB check failed: {e}")

        # 3. Check Redis cache
        try:
            if env["label"] == "PRODUCTION":
                cache_ip = "10.202.101.186"
                cache_container = "aris-redis"
                redis_pass = "R3d1s_Pr0d_2024!vN7wQ"
            else:
                cache_ip = "10.202.101.149"
                cache_container = "aris-stg-redis"
                redis_pass = "R3d1s_Stg_2024!vN7wQ"

            cache = connect(cache_ip)
            print(f"\n  --- Redis: GET aris:public:domains ---")
            out, err, code = run_sudo(
                cache,
                f"docker exec {cache_container} redis-cli -a {redis_pass} GET aris:public:domains 2>&1",
                SSH_PASS,
                timeout=15,
            )
            if out:
                # Filter out redis warning
                lines = [l for l in out.split("\n") if "Warning" not in l]
                raw = "\n".join(lines).strip()
                if raw and raw != "(nil)":
                    try:
                        data = json.loads(raw)
                        domains = data.get("data", [])
                        print(f"  Cached {len(domains)} domains")
                        for d in domains:
                            name_en = d.get("name", {}).get("en", "—")
                            desc_en = d.get("description", {}).get("en", "—") if d.get("description") else "NULL"
                            same = " *** SAME ***" if name_en == desc_en else ""
                            print(f"  {d.get('code', '?'):<18} name={name_en[:25]:<27} desc={desc_en[:40]}{same}")
                    except json.JSONDecodeError:
                        print(f"  [!] Not JSON: {raw[:200]}")
                else:
                    print(f"  Cache is empty (nil)")
            cache.close()
        except Exception as e:
            print(f"  [!] Redis check failed: {e}")

    print(f"\n{'#'*70}")
    print(f"  Done — {datetime.now().isoformat()}")
    print(f"{'#'*70}")


if __name__ == "__main__":
    main()
