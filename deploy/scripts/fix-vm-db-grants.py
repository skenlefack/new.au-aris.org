#!/usr/bin/env python3
"""Fix the GRANT USAGE ON ALL SCHEMAS error and verify schemas on VM-DB."""
import sys
from ssh_config import get_client, VM_DB, VM_PASS


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()

def run_sudo(client, cmd, timeout=30):
    """Run command with sudo via stdin password."""
    full_cmd = f"sudo -S {cmd}"
    stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
    stdin.write(VM_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    # Filter sudo prompt from stderr
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, out, err

safe_print(f"Connecting to VM-DB ({VM_DB})...")
c = get_client(VM_DB)

# 1. Write fix SQL to /tmp on the VM
safe_print("\n=== 1. Uploading fix SQL ===")
fix_sql = """
DO $$
DECLARE
  s TEXT;
BEGIN
  FOR s IN
    SELECT schema_name FROM information_schema.schemata
    WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
  LOOP
    EXECUTE format('GRANT USAGE ON SCHEMA %I TO aris', s);
    EXECUTE format('GRANT ALL ON ALL TABLES IN SCHEMA %I TO aris', s);
    EXECUTE format('GRANT ALL ON ALL SEQUENCES IN SCHEMA %I TO aris', s);
  END LOOP;
END $$;

-- Also create metabase database if not exists
SELECT 'CREATE DATABASE metabase OWNER aris'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'metabase')
\\gexec
"""
# Write via SFTP
sftp = c.open_sftp()
with sftp.open("/tmp/fix-grants.sql", "w") as f:
    f.write(fix_sql)
sftp.close()

# 2. Execute the fix SQL
safe_print("\n=== 2. Executing fix SQL ===")
code, out, err = run_sudo(c, "docker cp /tmp/fix-grants.sql aris-postgres:/tmp/fix-grants.sql")
safe_print(f"  Copy: {code}")
code, out, err = run_sudo(c, "docker exec aris-postgres psql -U aris -d aris -f /tmp/fix-grants.sql")
safe_print(f"  Exit: {code}")
safe_print(f"  Output: {out}")
if err.strip():
    safe_print(f"  Stderr: {err[:300]}")

# 3. List schemas
safe_print("\n=== 3. Schema list ===")
list_sql = "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema' ORDER BY schema_name;"
sftp = c.open_sftp()
with sftp.open("/tmp/list-schemas.sql", "w") as f:
    f.write(list_sql)
sftp.close()
code, out, err = run_sudo(c, "docker cp /tmp/list-schemas.sql aris-postgres:/tmp/list-schemas.sql")
code, out, err = run_sudo(c, "docker exec aris-postgres psql -U aris -d aris -t -f /tmp/list-schemas.sql")
schemas = [s.strip() for s in out.splitlines() if s.strip()]
safe_print(f"  Schemas ({len(schemas)}): {', '.join(schemas)}")

# 4. Container status
safe_print("\n=== 4. Container status ===")
code, out, err = run_sudo(c, "docker ps --format 'table {{.Names}}\t{{.Status}}'")
safe_print(out)

# 5. PgBouncer connectivity
safe_print("\n=== 5. PgBouncer connectivity ===")
code, out, err = run_sudo(c, "docker exec aris-pgbouncer pg_isready -h 127.0.0.1 -p 6432 -U aris -d aris")
safe_print(out)

# 6. Check metabase database
safe_print("\n=== 6. Databases ===")
code, out, err = run_sudo(c, "docker exec aris-postgres psql -U aris -l -t")
safe_print(out)

c.close()
safe_print("\nVM-DB verification complete.")
