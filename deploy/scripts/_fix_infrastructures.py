#!/usr/bin/env python3
"""
ARIS 4.0 — Fix infrastructure types: remove duplicates + insert missing.
Uses direct SQL via psql on the DB server for reliability.
"""
import sys
import json
from ssh_config import get_client, VM_DB, VM_PASS


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(VM_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, out, err


def run_psql(sql, timeout=30):
    """Run SQL on production DB via psql in the postgres container."""
    # Escape double quotes in SQL
    escaped_sql = sql.replace('"', '\\"')
    c = get_client(VM_DB)
    cmd = f'''docker exec aris-postgres psql -U aris -d aris -t -A -c "{escaped_sql}"'''
    code, out, err = run_sudo(c, cmd, timeout=timeout)
    c.close()
    return code, out, err


safe_print("=" * 60)
safe_print("  ARIS 4.0 — Fix Infrastructure Types")
safe_print("=" * 60)

# ── 1. Check current state ──
safe_print("\n=== 1. Current state ===")
code, out, err = run_psql("SELECT count(*) FROM animal_health.ref_infrastructures;")
safe_print(f"  Total rows: {out}")

code, out, err = run_psql("SELECT category, count(*) FROM animal_health.ref_infrastructures GROUP BY category ORDER BY category;")
safe_print(f"  By category:\n{out}")

# ── 2. Check for duplicates ──
safe_print("\n=== 2. Check duplicates ===")
code, out, err = run_psql("SELECT code, count(*) FROM animal_health.ref_infrastructures GROUP BY code HAVING count(*) > 1;")
if out:
    safe_print(f"  Duplicates found:\n{out}")
else:
    safe_print("  No duplicates")

# ── 3. Remove duplicates (keep the first one by created_at) ──
safe_print("\n=== 3. Remove duplicates ===")
code, out, err = run_psql("""
DELETE FROM animal_health.ref_infrastructures
WHERE id NOT IN (
    SELECT DISTINCT ON (code) id
    FROM animal_health.ref_infrastructures
    ORDER BY code, created_at ASC
);
""".strip().replace("\n", " "))
safe_print(f"  Deleted duplicates: {out if out else 'none'} (exit: {code})")
if err:
    safe_print(f"  Err: {err[:300]}")

# Recount
code, out, err = run_psql("SELECT count(*) FROM animal_health.ref_infrastructures;")
safe_print(f"  Remaining rows: {out}")

# ── 4. Check what codes exist ──
safe_print("\n=== 4. Existing codes ===")
code, out, err = run_psql("SELECT code FROM animal_health.ref_infrastructures ORDER BY code;")
existing_codes = set(out.splitlines()) if out else set()
safe_print(f"  {len(existing_codes)} unique codes")

# ── 5. Insert missing infrastructure types ──
INFRASTRUCTURES = [
    ("INFRA-LAB-VET",       "Veterinary Laboratory",           "Laboratoire vétérinaire",              "laboratory",         "veterinary",            100),
    ("INFRA-LAB-RES",       "Research Laboratory",             "Laboratoire de recherche",             "laboratory",         "research",              101),
    ("INFRA-LAB-DIAG",      "Diagnostic Laboratory",           "Laboratoire de diagnostic",            "laboratory",         "diagnostic",            102),
    ("INFRA-ABAT-IND",      "Industrial Slaughterhouse",       "Abattoir industriel",                  "slaughterhouse",     "industrial",            200),
    ("INFRA-ABAT-MUN",      "Municipal Slaughterhouse",        "Abattoir municipal",                   "slaughterhouse",     "municipal",             201),
    ("INFRA-ABAT-AREA",     "Slaughter Area",                  "Aire d abattage",                      "slaughterhouse",     "slaughter_area",        202),
    ("INFRA-MKT-LIVE",      "Livestock Market",                "Marche a betail",                      "market",             "livestock",             300),
    ("INFRA-MKT-FISH",      "Fish Market",                     "Marche de poisson",                    "market",             "fish",                  301),
    ("INFRA-MKT-TERM",      "Terminal Market",                 "Marche terminal",                      "market",             "terminal",              302),
    ("INFRA-STOR-COLD",     "Cold Storage",                    "Entrepot frigorifique",                "storage",            "cold_storage",          400),
    ("INFRA-STOR-WARE",     "Warehouse",                       "Entrepot de stockage",                 "storage",            "warehouse",             401),
    ("INFRA-STOR-ROOM",     "Cold Room",                       "Chambre froide",                       "storage",            "cold_room",             402),
    ("INFRA-CHK-BORDER",    "Border Inspection Post",          "Poste d inspection frontalier",        "checkpoint",         "border_inspection",     500),
    ("INFRA-CHK-QUAR",      "Quarantine Station",              "Poste de quarantaine",                 "checkpoint",         "quarantine",            501),
    ("INFRA-CHK-VET",       "Veterinary Control Post",         "Poste de controle veterinaire",        "checkpoint",         "veterinary_control",    502),
    ("INFRA-PORT-SEA",      "Seaport",                         "Port maritime",                        "port_airport",       "seaport",               600),
    ("INFRA-PORT-FISH",     "Fishing Port",                    "Port de peche",                        "port_airport",       "fishing_port",          601),
    ("INFRA-PORT-AIR",      "Airport",                         "Aeroport",                             "port_airport",       "airport",               602),
    ("INFRA-TRAIN-AGR",     "Agricultural Training Center",    "Centre de formation agricole",         "training_center",    "agricultural_training", 700),
    ("INFRA-TRAIN-VET",     "Veterinary School",               "Ecole veterinaire",                    "training_center",    "veterinary_school",     701),
    ("INFRA-TRAIN-RES",     "Research Center",                 "Centre de recherche",                  "training_center",    "research_center",       702),
    ("INFRA-BREED-SEED",    "Seed Farm",                       "Ferme semenciere",                     "breeding_station",   "seed_farm",             800),
    ("INFRA-BREED-STAT",    "Breeding Station",                "Station d elevage",                    "breeding_station",   "breeding_station",      801),
    ("INFRA-BREED-RANCH",   "Ranch",                           "Ranch",                                "breeding_station",   "ranch",                 802),
    ("INFRA-COLL-MILK",     "Milk Collection Center",          "Centre de collecte de lait",           "collection_center",  "milk_collection",       900),
    ("INFRA-COLL-HONEY",    "Honey Collection Center",         "Centre de collecte de miel",           "collection_center",  "honey_collection",      901),
    ("INFRA-COLL-PACK",     "Packaging Center",                "Centre de conditionnement",            "collection_center",  "packaging",             902),
    ("INFRA-PARK-NAT",      "National Park",                   "Parc national",                        "protected_area",     "national_park",         1000),
    ("INFRA-PARK-RES",      "Nature Reserve",                  "Reserve naturelle",                    "protected_area",     "nature_reserve",        1001),
    ("INFRA-PARK-CONS",     "Conservation Area",               "Zone de conservation",                 "protected_area",     "conservation_area",     1002),
    ("INFRA-IND-TAN",       "Tannery",                         "Tannerie",                             "industry",           "tannery",               1100),
    ("INFRA-IND-DAIRY",     "Dairy",                           "Laiterie",                             "industry",           "dairy",                 1101),
    ("INFRA-IND-PROC",      "Processing Plant",                "Usine de transformation",              "industry",           "processing_plant",      1102),
    ("INFRA-WATER-POINT",   "Water Point",                     "Point d eau",                          "water_infrastructure","water_point",           1200),
    ("INFRA-WATER-DAM",     "Pastoral Dam",                    "Barrage pastoral",                     "water_infrastructure","pastoral_dam",           1201),
    ("INFRA-WATER-BORE",    "Borehole",                        "Forage",                               "water_infrastructure","borehole",              1202),
    ("INFRA-VETC-CLIN",     "Veterinary Clinic",               "Clinique veterinaire",                 "veterinary_center",  "veterinary_clinic",     1300),
    ("INFRA-VETC-PHARM",    "Veterinary Pharmacy",             "Pharmacie veterinaire",                "veterinary_center",  "veterinary_pharmacy",   1301),
    ("INFRA-VETC-POST",     "Veterinary Post",                 "Poste veterinaire",                    "veterinary_center",  "veterinary_post",       1302),
    ("INFRA-ADM-DIR",       "Veterinary Directorate",          "Direction des services veterinaires",  "admin_office",       "veterinary_directorate",1400),
    ("INFRA-ADM-REG",       "Regional Office",                 "Bureau regional",                      "admin_office",       "regional_office",       1401),
    ("INFRA-ADM-DIST",      "District Office",                 "Bureau de district",                   "admin_office",       "district_office",       1402),
    ("INFRA-OTH-HATCH",     "Hatchery",                        "Couvoir",                              "other",              "hatchery",              1500),
    ("INFRA-OTH-APIARY",    "Teaching Apiary",                 "Rucher ecole",                         "other",              "teaching_apiary",       1501),
    ("INFRA-OTH-FREEZONE",  "Free Zone",                       "Zone franche",                         "other",              "free_zone",             1502),
]

missing = [inf for inf in INFRASTRUCTURES if inf[0] not in existing_codes]
safe_print(f"\n=== 5. Insert {len(missing)} missing types ===")

if missing:
    # Build a single INSERT with multiple VALUES
    values_parts = []
    for code_val, name_en, name_fr, category, sub_type, sort_order in missing:
        name_json = json.dumps({"en": name_en, "fr": name_fr}).replace("'", "''")
        values_parts.append(
            f"(gen_random_uuid(), '{code_val}', '{name_json}'::jsonb, '{category}', '{sub_type}', "
            f"'operational', 'continental', 'continental', true, false, {sort_order}, NOW(), NOW())"
        )

    # Split into batches of 10 to avoid command-line length issues
    batch_size = 10
    total_inserted = 0
    for batch_start in range(0, len(values_parts), batch_size):
        batch = values_parts[batch_start:batch_start + batch_size]
        values_sql = ", ".join(batch)
        insert_sql = (
            f"INSERT INTO animal_health.ref_infrastructures "
            f"(id, code, name, category, sub_type, status, scope, owner_type, is_active, is_default, sort_order, created_at, updated_at) "
            f"VALUES {values_sql} "
            f"ON CONFLICT DO NOTHING;"
        )
        code, out, err = run_psql(insert_sql, timeout=15)
        safe_print(f"  Batch {batch_start//batch_size + 1}: exit={code}")
        if err:
            safe_print(f"    Err: {err[:300]}")
        total_inserted += len(batch)

    safe_print(f"  Inserted: {total_inserted}")
else:
    safe_print("  All 45 types already exist!")

# ── 6. Final verification ──
safe_print("\n=== 6. Final verification ===")
code, out, err = run_psql("SELECT count(*) FROM animal_health.ref_infrastructures;")
safe_print(f"  Total: {out}")

code, out, err = run_psql("SELECT category, count(*) FROM animal_health.ref_infrastructures GROUP BY category ORDER BY category;")
safe_print(f"  By category:")
for line in (out or "").splitlines():
    if line.strip():
        parts = line.split("|")
        if len(parts) == 2:
            safe_print(f"    {parts[0]:25s} {parts[1]}")
        else:
            safe_print(f"    {line}")

safe_print("\n" + "=" * 60)
safe_print("  Done!")
safe_print("=" * 60)
