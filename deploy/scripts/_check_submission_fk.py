#!/usr/bin/env python3
"""Check and fix FK constraint on submissions.campaign_id."""

import paramiko
import sys

VM_DB = "10.202.101.185"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S"


def ssh_cmd(client, cmd, timeout=30):
    chan = client.get_transport().open_session()
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
    return out.decode(errors="replace").strip()


def psql(client, sql):
    """Run SQL via psql in the postgres container."""
    escaped_sql = sql.replace('"', '\\"')
    cmd = f'{SUDO} docker exec aris-postgres psql -U aris -d aris -t -A -c "{escaped_sql}"'
    return ssh_cmd(client, cmd)


def main():
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VM_DB, username=SSH_USER, password=SSH_PASS, timeout=15)
    print(f"Connected to {VM_DB}")

    # 1. Check FK constraints on submissions
    print("\n[1] FK constraints on submissions:")
    out = psql(client, """
        SELECT conname, pg_get_constraintdef(oid)
        FROM pg_constraint
        WHERE conrelid = 'public.submissions'::regclass AND contype = 'f'
    """)
    print(f"  {out or '(none)'}")

    # 2. Table counts
    print("\n[2] Table counts:")
    out = psql(client, "SELECT count(*) FROM public.campaigns")
    print(f"  campaigns: {out}")
    out = psql(client, "SELECT count(*) FROM public.collection_campaigns")
    print(f"  collection_campaigns: {out}")
    out = psql(client, "SELECT count(*) FROM public.submissions")
    print(f"  submissions: {out}")

    # 3. Check if the constraint references 'campaigns' table
    out = psql(client, """
        SELECT conname
        FROM pg_constraint
        WHERE conrelid = 'public.submissions'::regclass
          AND contype = 'f'
          AND confrelid = 'public.campaigns'::regclass
    """)
    if out:
        constraint_name = out.strip().split("\n")[0]
        print(f"\n[3] Found FK to campaigns table: {constraint_name}")
        print(f"    This prevents submissions for collection_campaigns!")

        # Drop the constraint
        print(f"\n[4] Dropping constraint {constraint_name}...")
        drop_result = psql(client, f"ALTER TABLE public.submissions DROP CONSTRAINT IF EXISTS {constraint_name}")
        print(f"  Result: {drop_result or 'OK'}")

        # Verify
        out2 = psql(client, """
            SELECT conname FROM pg_constraint
            WHERE conrelid = 'public.submissions'::regclass
              AND contype = 'f'
              AND confrelid = 'public.campaigns'::regclass
        """)
        if out2:
            print(f"  WARN: Constraint still exists: {out2}")
        else:
            print(f"  OK — Constraint dropped successfully")
    else:
        print("\n[3] No FK constraint to campaigns table found")
        # Check all FKs for debugging
        out = psql(client, """
            SELECT conname, confrelid::regclass
            FROM pg_constraint
            WHERE conrelid = 'public.submissions'::regclass AND contype = 'f'
        """)
        print(f"  All FKs: {out or '(none)'}")

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
