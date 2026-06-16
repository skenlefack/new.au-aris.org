#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy lusophone admin divisions (ADMIN1 + ADMIN2) to PROD + STG.

Inserts/updates 466 geo entities for 5 lusophone countries:
  Angola (AO), Cabo Verde (CV), Guinea-Bissau (GW), Mozambique (MZ), São Tomé (ST)

Strategy:
  1. git pull on both environments
  2. Rebuild master-data service (picks up new seed files)
  3. Execute SQL upserts directly in PostgreSQL container
     (INSERT ... ON CONFLICT (code) DO UPDATE — handles both new + existing entries)

Usage:
  python -u _deploy_lusophone_geo.py                # Both PROD + STG
  python -u _deploy_lusophone_geo.py --env prod     # PROD only
  python -u _deploy_lusophone_geo.py --env stg      # STG only
  python -u _deploy_lusophone_geo.py --sql-only     # SQL only (skip git pull + rebuild)
"""
import sys, os, json, time, argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, VM_PASS, VM_USER

import paramiko

# ── Config ──
PROD_APP = "10.202.101.183"
PROD_DB  = "10.202.101.185"
STG_APP  = "10.202.101.146"
STG_DB   = "10.202.101.148"

PROD_DB_CONNSTR = "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@localhost:5432/aris"
STG_DB_CONNSTR  = "postgresql://aris:Ar1s_Stg_2024!xK9mZ@localhost:5432/aris"

PROD_PG_CONTAINER = "aris-postgres"
STG_PG_CONTAINER  = "aris-stg-postgres"

PROD_MASTER_CONTAINER = "aris-master-data"
STG_MASTER_CONTAINER  = "aris-stg-master-data"

SUDO = f"echo '{VM_PASS}' | sudo -S bash -c"

# Load seed data
SEED_JSON = os.path.join(os.path.dirname(__file__), "..", "..", "div_admin", "lusophone_seed_data.json")


def escape_sql(s):
    """Escape single quotes for SQL."""
    if not s:
        return ""
    return s.replace("'", "''")


def generate_sql():
    """Generate SQL upsert statements from seed JSON."""
    with open(SEED_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    statements = []
    statements.append("-- ARIS 4.0 — Lusophone geo entities upsert")
    statements.append("-- Generated from GeoNames API data")
    statements.append("BEGIN;")
    statements.append("")

    for iso in ["AO", "CV", "GW", "MZ", "ST"]:
        country = data[iso]
        all_entries = country["admin1"] + country["admin2"]
        statements.append(f"-- ── {country['name']} ({iso}): {len(country['admin1'])} ADM1 + {len(country['admin2'])} ADM2 ──")

        # First pass: ADMIN1 (need to exist before ADMIN2 references them)
        for entry in country["admin1"]:
            sql = _upsert_sql(entry, is_admin1=True)
            statements.append(sql)

        statements.append("")

        # Second pass: ADMIN2 (parentCode references ADMIN1)
        for entry in country["admin2"]:
            sql = _upsert_sql(entry, is_admin1=False)
            statements.append(sql)

        statements.append("")

    statements.append("COMMIT;")
    statements.append("")

    # Summary counts
    total_a1 = sum(len(data[iso]["admin1"]) for iso in data)
    total_a2 = sum(len(data[iso]["admin2"]) for iso in data)
    statements.append(f"-- Total: {total_a1} ADMIN1 + {total_a2} ADMIN2 = {total_a1 + total_a2}")

    return "\n".join(statements)


def _upsert_sql(entry, is_admin1):
    code = escape_sql(entry["code"])
    name = escape_sql(entry["name"])
    name_en = escape_sql(entry["nameEn"])
    name_fr = escape_sql(entry["nameFr"])
    name_pt = escape_sql(entry.get("namePt", ""))
    name_ar = escape_sql(entry.get("nameAr", ""))
    level = entry["level"]
    parent_code = escape_sql(entry["parentCode"])
    country_code = escape_sql(entry["countryCode"])
    lat = entry.get("centroidLat") or "NULL"
    lng = entry.get("centroidLng") or "NULL"

    lat_val = f"{lat}" if lat != "NULL" else "NULL"
    lng_val = f"{lng}" if lng != "NULL" else "NULL"

    return (
        f"INSERT INTO public.geo_entities (id, code, name, name_en, name_fr, name_pt, name_ar, level, parent_id, country_code, centroid_lat, centroid_lng, is_active, version, created_at, updated_at) "
        f"VALUES (gen_random_uuid(), '{code}', '{name}', '{name_en}', '{name_fr}', '{name_pt}', '{name_ar}', "
        f"'{level}'::public.\"GeoLevel\", "
        f"(SELECT id FROM public.geo_entities WHERE code = '{parent_code}'), "
        f"'{country_code}', {lat_val}, {lng_val}, true, 1, NOW(), NOW()) "
        f"ON CONFLICT (code) DO UPDATE SET "
        f"name = EXCLUDED.name, name_en = EXCLUDED.name_en, name_fr = EXCLUDED.name_fr, "
        f"name_pt = EXCLUDED.name_pt, name_ar = EXCLUDED.name_ar, "
        f"centroid_lat = EXCLUDED.centroid_lat, centroid_lng = EXCLUDED.centroid_lng, "
        f"parent_id = EXCLUDED.parent_id, "
        f"updated_at = NOW();"
    )


def ssh_exec(host, cmd, timeout=120):
    """Execute command via SSH, return output."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(host, username=VM_USER, password=VM_PASS, timeout=15)
    _, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    client.close()
    return out, err


def ssh_jump_exec(app_host, db_host, cmd, timeout=120):
    """Execute command on DB VM by jumping through APP VM."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(app_host, username=VM_USER, password=VM_PASS, timeout=15)

    jump_cmd = f"sshpass -p '{VM_PASS}' ssh -o StrictHostKeyChecking=no {VM_USER}@{db_host} \"{cmd}\""
    _, stdout, stderr = client.exec_command(jump_cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    client.close()
    return out, err


def deploy_env(env, sql, args):
    """Deploy to one environment."""
    is_prod = env == "prod"
    app_host = PROD_APP if is_prod else STG_APP
    db_host = PROD_DB if is_prod else STG_DB
    pg_container = PROD_PG_CONTAINER if is_prod else STG_PG_CONTAINER
    master_container = PROD_MASTER_CONTAINER if is_prod else STG_MASTER_CONTAINER
    deploy_dir = "/opt/aris-deploy/vm-app/" if is_prod else "/opt/aris-deploy/vm-app-stg/"
    db_connstr = PROD_DB_CONNSTR if is_prod else STG_DB_CONNSTR
    label = "PROD" if is_prod else "STG"

    print(f"\n{'='*60}")
    print(f"  Deploying to {label}")
    print(f"{'='*60}")

    if not args.sql_only:
        # Step 1: git pull
        step(f"[{label}] Git pull")
        out, err = ssh_exec(app_host, f"{SUDO} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'")
        print(f"  {out.strip()[:200]}")

        # Step 2: Rebuild master-data
        step(f"[{label}] Rebuild master-data service")
        out, err = ssh_exec(
            app_host,
            f"{SUDO} 'cd {deploy_dir} && docker compose up -d --build --no-deps master-data'",
            timeout=300
        )
        print(f"  {out.strip()[:300]}")

    # Step 3: Execute SQL via APP VM → psql inside master-data container
    # The master-data container has access to the DB network
    step(f"[{label}] Execute SQL upserts ({sql.count('INSERT')} entries)")

    # Upload SQL file to APP VM
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(app_host, username=VM_USER, password=VM_PASS, timeout=15)

    remote_sql_path = f"/tmp/lusophone_geo_{env}.sql"
    transport = client.get_transport()
    sftp = paramiko.SFTPClient.from_transport(transport)
    with sftp.open(remote_sql_path, "w") as f:
        f.write(sql)
    sftp.close()

    # Use docker run with postgres image to execute SQL against DB
    # This avoids needing psql on the host or SSH jump to DB VM
    exec_cmd = (
        f"{SUDO} 'docker run --rm --network host "
        f"-v {remote_sql_path}:/tmp/lusophone_geo.sql "
        f"postgres:16 psql \"{db_connstr}\" -f /tmp/lusophone_geo.sql'"
    )
    _, stdout2, stderr2 = client.exec_command(exec_cmd, timeout=300)
    out = stdout2.read().decode("utf-8", errors="replace")
    err = stderr2.read().decode("utf-8", errors="replace")

    # Parse results
    insert_count = out.count("INSERT")
    print(f"  SQL result: {insert_count} statements executed")

    if "ERROR" in out or "ERROR" in err:
        errors = [line for line in (out + err).split("\n") if "ERROR" in line]
        for e in errors[:10]:
            print(f"  ⚠ {e.strip()}")
    else:
        print(f"  ✓ All upserts successful")

    # Step 4: Verify counts
    step(f"[{label}] Verify geo entity counts")
    verify_sql = (
        "SELECT country_code, level, COUNT(*) FROM public.geo_entities "
        "WHERE country_code IN ('AO','CV','GW','MZ','ST') "
        "GROUP BY country_code, level ORDER BY country_code, level;"
    )
    verify_cmd = (
        f"{SUDO} 'docker run --rm --network host "
        f"postgres:16 psql \"{db_connstr}\" -t -c \"{verify_sql}\"'"
    )
    _, stdout3, stderr3 = client.exec_command(verify_cmd, timeout=60)
    out = stdout3.read().decode("utf-8", errors="replace")
    print(f"  Counts:\n{out.strip()}")

    # Also check translations
    verify_i18n_sql = (
        "SELECT country_code, "
        "COUNT(*) FILTER (WHERE name_pt != '' AND name_pt IS NOT NULL) as pt_filled, "
        "COUNT(*) FILTER (WHERE name_ar != '' AND name_ar IS NOT NULL) as ar_filled, "
        "COUNT(*) as total "
        "FROM public.geo_entities "
        "WHERE country_code IN ('AO','CV','GW','MZ','ST') AND level IN ('ADMIN1','ADMIN2') "
        "GROUP BY country_code ORDER BY country_code;"
    )
    verify_i18n_cmd = (
        f"{SUDO} 'docker run --rm --network host "
        f"postgres:16 psql \"{db_connstr}\" -t -c \"{verify_i18n_sql}\"'"
    )
    _, stdout4, stderr4 = client.exec_command(verify_i18n_cmd, timeout=60)
    out = stdout4.read().decode("utf-8", errors="replace")
    print(f"  Translations (PT/AR filled):\n{out.strip()}")

    # Cleanup
    client.exec_command(f"rm -f {remote_sql_path}")
    client.close()


def main():
    parser = argparse.ArgumentParser(description="Deploy lusophone geo data")
    parser.add_argument("--env", choices=["prod", "stg"], help="Target env (default: both)")
    parser.add_argument("--sql-only", action="store_true", help="Skip git pull + rebuild")
    parser.add_argument("--dry-run", action="store_true", help="Generate SQL but don't execute")
    args = parser.parse_args()

    step("Generating SQL from seed data")
    sql = generate_sql()

    insert_count = sql.count("INSERT")
    print(f"  Generated {insert_count} upsert statements")

    if args.dry_run:
        outpath = os.path.join(os.path.dirname(__file__), "..", "..", "div_admin", "lusophone_geo_upsert.sql")
        with open(outpath, "w", encoding="utf-8") as f:
            f.write(sql)
        print(f"  SQL written to: {outpath}")
        return

    envs = [args.env] if args.env else ["stg", "prod"]

    for env in envs:
        try:
            deploy_env(env, sql, args)
        except Exception as e:
            print(f"\n  ❌ {env.upper()} deployment failed: {e}")
            if env == "stg" and "prod" in envs:
                print("  ⚠ Continuing to PROD anyway (SQL is independent)...")
                continue
            raise

    print(f"\n{'='*60}")
    print(f"  ✅ Deployment complete!")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
