#!/usr/bin/env python3
"""
Import Cameroon administrative divisions (5 levels) from CAHIS SQL into ARIS geo_entities.

Source: database/cahis_admin_divisions_postgresql.sql
Target: public.geo_entities + public.admin_levels on PROD + STAGING

Hierarchy: Region (10) > Département (58) > Arrondissement (359) > CZV (764) > Village (12895)
"""

import paramiko
import re
import uuid
import os
import sys
import tempfile
import time

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S"

TARGETS = [
    {"name": "PROD", "app_host": "10.202.101.183", "db_host": "10.202.101.185", "pg_container": "aris-postgres"},
    {"name": "STAGING", "app_host": "10.202.101.146", "db_host": "10.202.101.148", "pg_container": "aris-stg-postgres"},
]


def get_client(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=22, username=SSH_USER, password=SSH_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)
    return c


def run_sql_file(app_host, db_host, pg_container, sql_content):
    """Upload SQL to APP VM, run psql against DB from a service container."""
    DB_PASS = "Ar1s_Pr0d_2024!xK9mZ" if "183" in app_host else "Ar1s_Stg_2024!xK9mZ"

    c = get_client(app_host)

    # Upload SQL file to APP VM
    sftp = c.open_sftp()
    with sftp.file("/tmp/_cm_divisions.sql", "w") as f:
        f.write(sql_content)
    sftp.close()
    print("  SQL uploaded to APP VM")

    # Pick a running service container to docker cp into and run psql
    svc_container = "aris-collecte" if "183" in app_host else "aris-stg-collecte"

    # docker cp SQL into service container
    stdin, stdout, stderr = c.exec_command(
        f"{SUDO} bash -c 'docker cp /tmp/_cm_divisions.sql {svc_container}:/tmp/_cm_divisions.sql'",
        timeout=30,
    )
    if SSH_PASS:
        stdin.write(SSH_PASS + "\n")
        stdin.flush()
    stdout.read()
    print("  SQL copied into container")

    # Run psql from inside the container, connecting to the DB VM directly (port 5432)
    psql_cmd = (
        f"PGPASSWORD={DB_PASS} psql -h {db_host} -p 5432 -U aris -d aris "
        f"-f /tmp/_cm_divisions.sql 2>&1 | tail -30"
    )
    stdin, stdout, stderr = c.exec_command(
        f"{SUDO} bash -c 'docker exec -e PGPASSWORD={DB_PASS} {svc_container} "
        f"psql -h {db_host} -p 5432 -U aris -d aris -f /tmp/_cm_divisions.sql 2>&1 | tail -30'",
        timeout=300,
    )
    if SSH_PASS:
        stdin.write(SSH_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    c.close()
    return out, err


def parse_sql_string(s):
    """Parse a PostgreSQL string value, handling escaped quotes (\\')."""
    return s.replace("\\'", "'").replace("''", "'")


def parse_cahis_sql(filepath):
    """Parse the CAHIS SQL file to extract all division data."""
    with open(filepath, "r", encoding="utf-8") as f:
        lines = f.readlines()

    regions, depts, arronds, czvs, villages = [], [], [], [], []

    for line in lines:
        line = line.strip()

        # Parse: INSERT INTO regions ... VALUES (id, 'code', 'nom_fr', 'nom_en', ...)
        if line.startswith("INSERT INTO regions"):
            m = re.search(r"VALUES\s*\((\d+),\s*'(.*?)',\s*'(.*?)'(?:,\s*'(.*?)')?", line.replace("\\'", "\x00"))
            if m:
                regions.append({
                    "id": int(m.group(1)),
                    "code": m.group(2).replace("\x00", "'"),
                    "nom_fr": m.group(3).replace("\x00", "'"),
                    "nom_en": (m.group(4) or "").replace("\x00", "'") or None,
                })

        # Parse: INSERT INTO departements ... VALUES (id, region_id, 'code', 'nom_fr', 'nom_en'|NULL, ...)
        elif line.startswith("INSERT INTO departements"):
            m = re.search(r"VALUES\s*\((\d+),\s*(\d+),\s*'(.*?)',\s*'(.*?)'", line.replace("\\'", "\x00"))
            if m:
                # nom_en may be NULL or a string
                nom_en_match = re.search(r"'(.*?)',\s*'(.*?)',\s*(NULL|'(.*?)')", line.replace("\\'", "\x00"))
                nom_en = None
                if nom_en_match and nom_en_match.group(4):
                    nom_en = nom_en_match.group(4).replace("\x00", "'")
                depts.append({
                    "id": int(m.group(1)),
                    "region_id": int(m.group(2)),
                    "code": m.group(3).replace("\x00", "'"),
                    "nom_fr": m.group(4).replace("\x00", "'"),
                    "nom_en": nom_en,
                })

        # Parse: INSERT INTO arrondissements ... VALUES (id, dept_id, 'code', 'nom_fr', ...)
        elif line.startswith("INSERT INTO arrondissements"):
            m = re.search(r"VALUES\s*\((\d+),\s*(\d+),\s*'(.*?)',\s*'(.*?)'", line.replace("\\'", "\x00"))
            if m:
                arronds.append({
                    "id": int(m.group(1)),
                    "dept_id": int(m.group(2)),
                    "code": m.group(3).replace("\x00", "'"),
                    "nom_fr": m.group(4).replace("\x00", "'"),
                    "nom_en": None,
                })

        # Parse: INSERT INTO czvs ... VALUES (id, arrond_id, 'code', 'nom_fr', ...)
        elif line.startswith("INSERT INTO czvs"):
            m = re.search(r"VALUES\s*\((\d+),\s*(\d+),\s*'(.*?)',\s*'(.*?)'", line.replace("\\'", "\x00"))
            if m:
                czvs.append({
                    "id": int(m.group(1)),
                    "arrond_id": int(m.group(2)),
                    "code": m.group(3).replace("\x00", "'"),
                    "nom_fr": m.group(4).replace("\x00", "'"),
                    "nom_en": None,
                })

        # Parse: INSERT INTO villages ... VALUES (id, czv_id, 'code', 'nom_fr', ...)
        elif line.startswith("INSERT INTO villages"):
            m = re.search(r"VALUES\s*\((\d+),\s*(\d+),\s*'(.*?)',\s*'(.*?)'", line.replace("\\'", "\x00"))
            if m:
                villages.append({
                    "id": int(m.group(1)),
                    "czv_id": int(m.group(2)),
                    "code": m.group(3).replace("\x00", "'"),
                    "nom_fr": m.group(4).replace("\x00", "'"),
                })

    return regions, depts, arronds, czvs, villages


def generate_import_sql(regions, depts, arronds, czvs, villages):
    """Generate SQL to insert into ARIS geo_entities + admin_levels."""
    lines = []

    # Pre-requisites (outside transaction)
    lines.append("-- Widen code column to support longer division codes")
    lines.append("ALTER TABLE public.geo_entities ALTER COLUMN code TYPE VARCHAR(50);")
    lines.append("")
    lines.append("-- Add ADMIN4 and ADMIN5 to geo_level enum if not exists")
    lines.append("DO $$ BEGIN")
    lines.append("  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ADMIN4' AND enumtypid = 'geo_level'::regtype) THEN")
    lines.append("    ALTER TYPE geo_level ADD VALUE 'ADMIN4';")
    lines.append("  END IF;")
    lines.append("END $$;")
    lines.append("DO $$ BEGIN")
    lines.append("  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'ADMIN5' AND enumtypid = 'geo_level'::regtype) THEN")
    lines.append("    ALTER TYPE geo_level ADD VALUE 'ADMIN5';")
    lines.append("  END IF;")
    lines.append("END $$;")
    lines.append("")

    lines.append("BEGIN;")
    lines.append("")

    # 1. Find CM country entity ID
    lines.append("-- Get CM country UUID")
    lines.append("DO $$ DECLARE cm_id UUID; BEGIN")
    lines.append("  SELECT id INTO cm_id FROM public.geo_entities WHERE code = 'CM' AND level = 'COUNTRY';")
    lines.append("  IF cm_id IS NULL THEN RAISE EXCEPTION 'CM country not found in geo_entities'; END IF;")
    lines.append("END $$;")
    lines.append("")

    # 2. Delete existing CM divisions (ADMIN1-ADMIN5)
    lines.append("-- Clean existing CM divisions")
    lines.append("DELETE FROM public.geo_entities WHERE country_code = 'CM' AND level IN ('ADMIN1','ADMIN2','ADMIN3','ADMIN4','ADMIN5');")
    lines.append("")

    # 3. Delete existing CM admin_levels
    lines.append("-- Clean and recreate admin_levels for CM")
    lines.append("DELETE FROM governance.admin_levels WHERE country_id = (SELECT id FROM governance.countries WHERE code = 'CM' LIMIT 1);")
    lines.append("")

    # Get CM tenant_id
    lines.append("DO $$")
    lines.append("DECLARE")
    lines.append("  cm_country_id UUID;")
    lines.append("  cm_tenant_id UUID;")

    # Declare UUIDs for all levels
    for r in regions:
        lines.append(f"  r{r['id']}_id UUID := gen_random_uuid();")
    for d in depts:
        lines.append(f"  d{d['id']}_id UUID := gen_random_uuid();")
    for a in arronds:
        lines.append(f"  a{a['id']}_id UUID := gen_random_uuid();")
    for z in czvs:
        lines.append(f"  z{z['id']}_id UUID := gen_random_uuid();")

    lines.append("BEGIN")
    lines.append("  SELECT id INTO cm_country_id FROM public.geo_entities WHERE code = 'CM' AND level = 'COUNTRY';")
    lines.append("  SELECT id INTO cm_tenant_id FROM governance.countries WHERE code = 'CM' LIMIT 1;")
    lines.append("")

    # 4. Insert admin_levels
    lines.append("  -- Admin Levels for Cameroon")
    admin_levels = [
        (1, "CM-AL1", '{"en":"Region","fr":"Région","pt":"Região","ar":"المنطقة"}'),
        (2, "CM-AL2", '{"en":"Department","fr":"Département","pt":"Departamento","ar":"القسم"}'),
        (3, "CM-AL3", '{"en":"Arrondissement","fr":"Arrondissement","pt":"Arrondissement","ar":"الدائرة"}'),
        (4, "CM-AL4", '{"en":"CZV","fr":"Centre Zootechnique et Vétérinaire","pt":"CZV","ar":"مركز بيطري"}'),
        (5, "CM-AL5", '{"en":"Village","fr":"Village","pt":"Aldeia","ar":"قرية"}'),
    ]
    for level, code, name_json in admin_levels:
        lines.append(
            f"  INSERT INTO governance.admin_levels (id, country_id, level, code, name, is_active, created_at, updated_at) "
            f"VALUES (gen_random_uuid(), cm_tenant_id, {level}, '{code}', '{name_json}'::jsonb, TRUE, NOW(), NOW());"
        )
    lines.append("")

    def esc(s):
        """SQL-escape a string value."""
        return (s or "").replace("'", "''")

    # 5. Insert regions (ADMIN1)
    lines.append("  -- Regions (ADMIN1)")
    for r in regions:
        nom_fr = esc(r["nom_fr"])
        nom_en = esc(r["nom_en"]) if r["nom_en"] else nom_fr
        code = f"CM-{r['code']}"
        lines.append(
            f"  INSERT INTO public.geo_entities (id, code, name, name_en, name_fr, level, parent_id, country_code, is_active, version, created_at, updated_at) "
            f"VALUES (r{r['id']}_id, '{code}', '{nom_en}', '{nom_en}', '{nom_fr}', 'ADMIN1', cm_country_id, 'CM', TRUE, 1, NOW(), NOW());"
        )
    lines.append("")

    # 6. Insert departements (ADMIN2)
    lines.append("  -- Départements (ADMIN2)")
    for d in depts:
        nom_fr = esc(d["nom_fr"])
        nom_en = esc(d["nom_en"]) if d.get("nom_en") else nom_fr
        code = f"CM-{d['code']}"
        lines.append(
            f"  INSERT INTO public.geo_entities (id, code, name, name_en, name_fr, level, parent_id, country_code, is_active, version, created_at, updated_at) "
            f"VALUES (d{d['id']}_id, '{code}', '{nom_en}', '{nom_en}', '{nom_fr}', 'ADMIN2', r{d['region_id']}_id, 'CM', TRUE, 1, NOW(), NOW());"
        )
    lines.append("")

    # 7. Insert arrondissements (ADMIN3)
    lines.append("  -- Arrondissements (ADMIN3)")
    for a in arronds:
        nom_fr = esc(a["nom_fr"])
        nom_en = esc(a["nom_en"]) if a.get("nom_en") else nom_fr
        code = f"CM-{a['code']}"
        lines.append(
            f"  INSERT INTO public.geo_entities (id, code, name, name_en, name_fr, level, parent_id, country_code, is_active, version, created_at, updated_at) "
            f"VALUES (a{a['id']}_id, '{code}', '{nom_en}', '{nom_en}', '{nom_fr}', 'ADMIN3', d{a['dept_id']}_id, 'CM', TRUE, 1, NOW(), NOW());"
        )
    lines.append("")

    # 8. Insert CZVs (ADMIN4)
    lines.append("  -- CZVs (ADMIN4)")
    for z in czvs:
        nom_fr = esc(z["nom_fr"])
        nom_en = esc(z["nom_en"]) if z.get("nom_en") else nom_fr
        code = f"CM-{z['code']}"
        lines.append(
            f"  INSERT INTO public.geo_entities (id, code, name, name_en, name_fr, level, parent_id, country_code, is_active, version, created_at, updated_at) "
            f"VALUES (z{z['id']}_id, '{code}', '{nom_en}', '{nom_en}', '{nom_fr}', 'ADMIN4', a{z['arrond_id']}_id, 'CM', TRUE, 1, NOW(), NOW());"
        )
    lines.append("")

    # 9. Villages (ADMIN5) — use direct INSERT without variables (too many for PL/pgSQL)
    lines.append("END $$;")
    lines.append("")

    # Villages inserted with subquery to find parent CZV
    lines.append("-- Villages (ADMIN5) — direct INSERT with CZV lookup")
    # Build CZV code mapping: czv_id → code
    czv_code_map = {z["id"]: f"CM-{z['code']}" for z in czvs}

    batch = []
    for v in villages:
        nom = esc(v["nom_fr"])
        code = f"CM-{v['code']}"
        parent_code = czv_code_map.get(v["czv_id"])
        if not parent_code:
            continue
        batch.append(
            f"(gen_random_uuid(), '{code}', '{nom}', '{nom}', '{nom}', 'ADMIN5', "
            f"(SELECT id FROM public.geo_entities WHERE code = '{parent_code}' AND level = 'ADMIN4' LIMIT 1), "
            f"'CM', TRUE, 1, NOW(), NOW())"
        )

    # Insert villages in batches of 500
    for i in range(0, len(batch), 500):
        chunk = batch[i:i+500]
        lines.append(
            "INSERT INTO public.geo_entities (id, code, name, name_en, name_fr, level, parent_id, country_code, is_active, version, created_at, updated_at) VALUES"
        )
        lines.append(",\n".join(chunk) + ";")
        lines.append("")

    # Verify
    lines.append("-- Verify counts")
    lines.append("SELECT level, count(*) FROM public.geo_entities WHERE country_code = 'CM' GROUP BY level ORDER BY level;")
    lines.append("SELECT count(*) AS admin_levels FROM governance.admin_levels WHERE country_id = (SELECT id FROM governance.countries WHERE code = 'CM');")

    lines.append("")
    lines.append("COMMIT;")

    return "\n".join(lines)


def main():
    sql_path = os.path.join(os.path.dirname(__file__), "..", "..", "database", "cahis_admin_divisions_postgresql.sql")
    sql_path = os.path.normpath(sql_path)

    print(f"Parsing {sql_path}...")
    regions, depts, arronds, czvs, villages = parse_cahis_sql(sql_path)
    print(f"  Regions: {len(regions)}, Départements: {len(depts)}, Arrondissements: {len(arronds)}, CZVs: {len(czvs)}, Villages: {len(villages)}")

    print("Generating ARIS import SQL...")
    import_sql = generate_import_sql(regions, depts, arronds, czvs, villages)
    print(f"  SQL: {len(import_sql)} chars, {import_sql.count(chr(10))} lines")

    # Save SQL locally for reference
    local_sql = os.path.join(os.path.dirname(__file__), "_cm_divisions_aris.sql")
    with open(local_sql, "w", encoding="utf-8") as f:
        f.write(import_sql)
    print(f"  Saved to {local_sql}")

    for target in TARGETS:
        name = target["name"]
        app_host = target["app_host"]
        db_host = target["db_host"]
        pg_container = target["pg_container"]

        print(f"\n{'='*60}")
        print(f"  Importing CM divisions -> {name} ({db_host})")
        print(f"{'='*60}")

        try:
            out, err = run_sql_file(app_host, db_host, pg_container, import_sql)
            # Show last 20 lines
            out_lines = out.strip().split("\n")
            for line in out_lines[-20:]:
                print(f"  {line}")
            if err:
                for line in err.strip().split("\n")[-5:]:
                    print(f"  ERR: {line}")
        except Exception as e:
            print(f"  FAILED: {e}")

    print(f"\n{'='*60}")
    print("  IMPORT COMPLETE")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
