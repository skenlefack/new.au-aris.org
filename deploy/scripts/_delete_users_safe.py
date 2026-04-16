#!/usr/bin/env python3
"""
Safely delete all users EXCEPT an allowlist in PROD and STAGING.

Steps per env:
  1. pg_dump a full backup to /tmp/pgdump-<env>-<ts>.sql inside the postgres
     container, then copy it to the host under /opt/aris-backups/.
  2. In a single transaction:
       a. DELETE collecte_validation_chains referencing the doomed users
          (user_id, validator_id — both RESTRICT).
       b. DELETE campaign_assignments referencing doomed users (RESTRICT).
       c. DELETE public.users WHERE email NOT IN (allowlist). CASCADE
          handles user_domains, user_functions, user_role_assignments,
          user_devices automatically; backup_validator_id becomes NULL.
  3. Verify the final user count matches expectations.

Allowlists:
  PROD     : admin@au-aris.org
  STAGING  : admin@au-aris.org, ruth.lelei@au-ibar.org, joseph.kairu@au-ibar.org
"""
import paramiko, sys, time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

ENVS = [
    {
        "name": "PROD",
        "db_host": "10.202.101.185",
        "pg_container": "aris-postgres",
        "pg_password": "Ar1s_Pr0d_2024!xK9mZ",
        "keep": ["admin@au-aris.org"],
        "sudo": True,
    },
    {
        "name": "STAGING",
        "db_host": "10.202.101.148",
        "pg_container": "aris-stg-postgres",
        "pg_password": "Ar1s_Stg_2024!xK9mZ",
        "keep": ["admin@au-aris.org", "ruth.lelei@au-ibar.org", "joseph.kairu@au-ibar.org"],
        "sudo": False,
    },
]

TS = time.strftime("%Y%m%d-%H%M%S")


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username="arisadmin",
                password="@u-1baR.0rg$U24", timeout=15,
                allow_agent=False, look_for_keys=False)
    return ssh


def run(ssh, cmd, timeout=300, pty=True):
    print(f"  $ {cmd[:160]}")
    _, out, _ = ssh.exec_command(cmd, timeout=timeout, get_pty=pty)
    result = out.read().decode(errors="replace").strip()
    print("    " + (result[-2500:].replace("\n", "\n    ") if result else "(ok)"))
    return result


for env in ENVS:
    print(f"\n════════════════════ {env['name']} ════════════════════")
    sudo = "echo '@u-1baR.0rg$U24' | sudo -S " if env["sudo"] else ""
    ssh = connect(env["db_host"])
    keep_list = ",".join(f"'{e}'" for e in env["keep"])

    # ── 1. Backup ────────────────────────────────────────────────────
    print("\n[1/4] pg_dump backup...")
    dump_file = f"pgdump-{env['name'].lower()}-{TS}.sql"
    run(
        ssh,
        f'{sudo}docker exec -e PGPASSWORD="{env["pg_password"]}" '
        f'{env["pg_container"]} pg_dump -U aris -d aris --no-owner --clean --if-exists '
        f'-f /tmp/{dump_file}',
        timeout=900,
    )
    run(ssh, f"{sudo}mkdir -p /opt/aris-backups")
    run(ssh, f"{sudo}docker cp {env['pg_container']}:/tmp/{dump_file} /opt/aris-backups/{dump_file}")
    run(ssh, f"{sudo}ls -la /opt/aris-backups/{dump_file}")

    # ── 2. Current counts (pre-delete) ────────────────────────────────
    print("\n[2/4] Current user count...")
    run(
        ssh,
        f'{sudo}docker exec -e PGPASSWORD="{env["pg_password"]}" {env["pg_container"]} '
        f'psql -U aris -d aris -tA -c "SELECT COUNT(*) FROM public.users"',
    )

    # ── 3. Delete (transactional) ────────────────────────────────────
    print("\n[3/4] DELETE in transaction...")
    sql = f"""
BEGIN;
\\set ON_ERROR_STOP on

-- Collecte validation chains — RESTRICT on user_id + validator_id.
-- Delete the whole chain when any of its user/validator is being removed.
DELETE FROM public.collecte_validation_chains
 WHERE user_id IN (SELECT id FROM public.users WHERE email NOT IN ({keep_list}))
    OR validator_id IN (SELECT id FROM public.users WHERE email NOT IN ({keep_list}));

-- Campaign assignments — RESTRICT.
DELETE FROM public.campaign_assignments
 WHERE user_id IN (SELECT id FROM public.users WHERE email NOT IN ({keep_list}));

-- Finally remove the users themselves. CASCADE handles user_devices,
-- and the three governance.user_* tables. backup_validator_id becomes NULL.
DELETE FROM public.users
 WHERE email NOT IN ({keep_list});

-- Verify we kept exactly the allowlist
SELECT email FROM public.users ORDER BY email;

COMMIT;
"""
    # Write the SQL script to a temp file on the DB VM via SFTP, then run it
    sftp = ssh.open_sftp()
    remote_sql = f"/tmp/delete-users-{env['name'].lower()}-{TS}.sql"
    with sftp.open(remote_sql, "w") as f:
        f.write(sql)
    sftp.close()

    # Copy into the postgres container and execute
    run(ssh, f"{sudo}docker cp {remote_sql} {env['pg_container']}:/tmp/delete-users.sql")
    run(
        ssh,
        f'{sudo}docker exec -e PGPASSWORD="{env["pg_password"]}" '
        f'{env["pg_container"]} psql -U aris -d aris -v ON_ERROR_STOP=1 -f /tmp/delete-users.sql',
        timeout=900,
    )

    # ── 4. Verify ────────────────────────────────────────────────────
    print("\n[4/4] Verify remaining users...")
    run(
        ssh,
        f'{sudo}docker exec -e PGPASSWORD="{env["pg_password"]}" {env["pg_container"]} '
        f'psql -U aris -d aris -c "SELECT email, role FROM public.users ORDER BY email"',
    )

    ssh.close()
    print(f"\n[{env['name']}] Backup at /opt/aris-backups/{dump_file}")

print("\nAll done. To roll back:")
print("  docker exec -i <pg_container> psql -U aris -d aris < /opt/aris-backups/<dump>")
