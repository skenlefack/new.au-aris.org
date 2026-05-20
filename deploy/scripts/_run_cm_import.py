#!/usr/bin/env python3
"""Upload and run CM divisions SQL on PROD + STAGING (background execution)."""

import paramiko
import time
import sys

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S bash -c"

TARGETS = [
    {
        "name": "PROD",
        "app_host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "svc": "aris-collecte",
    },
    {
        "name": "STAGING",
        "app_host": "10.202.101.146",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "svc": "aris-stg-collecte",
    },
]


def ssh_cmd(host, cmd, timeout=30):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    chan = c.get_transport().open_session()
    chan.exec_command(cmd)
    chan.settimeout(timeout)
    out = b""
    try:
        while True:
            chunk = chan.recv(4096)
            if not chunk:
                break
            out += chunk
    except Exception:
        pass
    c.close()
    return out.decode(errors="replace").strip()


def upload_file(host, local_path, remote_path):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    sftp = c.open_sftp()
    sftp.put(local_path, remote_path)
    sftp.close()
    c.close()


def main():
    sql_file = "deploy/scripts/_cm_divisions_aris.sql"

    # Phase 1: Upload and start background execution
    for t in TARGETS:
        name, host, db, pw, svc = t["name"], t["app_host"], t["db_host"], t["db_pass"], t["svc"]
        print(f"\n--- {name} ({host}) ---")

        # Upload SQL
        print("  Uploading SQL...")
        upload_file(host, sql_file, "/tmp/_cm_divisions.sql")

        # Docker cp into container
        print("  Copying to container...")
        ssh_cmd(host, f"{SUDO} 'docker cp /tmp/_cm_divisions.sql {svc}:/tmp/_cm_divisions.sql'")

        # Run psql via temporary postgres container (service containers don't have psql)
        print("  Starting psql (background via postgres:16 container)...")
        ssh_cmd(
            host,
            f"{SUDO} 'nohup docker run --rm --name cm-import "
            f"-v /tmp/_cm_divisions.sql:/tmp/_cm_divisions.sql:ro "
            f"--network host "
            f"-e PGPASSWORD={pw} "
            f"postgres:16 "
            f"psql -h {db} -p 5432 -U aris -d aris "
            f"-f /tmp/_cm_divisions.sql "
            f"> /tmp/_cm_result.log 2>&1 &'",
            timeout=10,
        )
        print("  Started!")

    # Phase 2: Poll for completion
    print("\nWaiting for imports to complete...")
    for wait in [30, 30, 30, 60, 60, 60]:
        time.sleep(wait)
        all_done = True
        for t in TARGETS:
            name, host = t["name"], t["app_host"]
            out = ssh_cmd(host, f"{SUDO} 'tail -5 /tmp/_cm_result.log 2>/dev/null'")
            if "COMMIT" in out or "commit" in out.lower():
                print(f"  {name}: DONE")
            elif "ERROR" in out:
                print(f"  {name}: ERROR - {out[-200:]}")
            else:
                print(f"  {name}: still running... ({out[-100:]})")
                all_done = False
        if all_done:
            break

    # Phase 3: Verify
    print("\n--- VERIFICATION ---")
    for t in TARGETS:
        name, host = t["name"], t["app_host"]
        out = ssh_cmd(host, f"{SUDO} 'tail -20 /tmp/_cm_result.log 2>/dev/null'")
        print(f"\n{name} (last 20 lines):")
        for line in out.strip().split("\n")[-20:]:
            print(f"  {line}")

    print("\nDONE")


if __name__ == "__main__":
    main()
