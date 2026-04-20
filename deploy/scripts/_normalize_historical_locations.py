#!/usr/bin/env python3
"""
ARIS 4.0 — Normalize location data in Monthly Animal Health Reports
────────────────────────────────────────────────────────────────────
Adds `country` and `admin1` columns, parsed from the heterogeneous
`admin_location` field. Normalizes country names, ISO codes, and
resolves garbage values via source_file country detection.

Usage:
    python deploy/scripts/_normalize_historical_locations.py --dry-run
    python deploy/scripts/_normalize_historical_locations.py
    python deploy/scripts/_normalize_historical_locations.py --env prod
"""
from __future__ import annotations

import argparse
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import paramiko

SSH_USER = os.environ.get("ARIS_DEPLOY_USER", "arisadmin")
SSH_PASS = os.environ.get("ARIS_DEPLOY_PASS", "@u-1baR.0rg$U24")

ENV_CONFIG = {
    "prod": {"db_host": "10.202.101.185", "db_container": "aris-postgres"},
    "stg":  {"db_host": "10.202.101.148", "db_container": "aris-stg-postgres"},
}
DB_USER = "aris"
DB_PASS_MAP = {"prod": "Ar1s_Pr0d_2024!xK9mZ", "stg": "Ar1s_Stg_2024!xK9mZ"}

TABLE = "historical.hist_monthly_animal_health_reports_2008_2025_animal_health"

# ── ISO code → country name ──────────────────────────────────────────
ISO_MAP = {
    "ZA": "South Africa",
    "CD": "DR Congo",
    "ZM": "Zambia",
    "BW": "Botswana",
    "TOG": "Togo",
    "DRC": "DR Congo",
    "CAR": "Central African Republic",
    "SZ": "Eswatini",
    "SZL": "Eswatini",
}

# ── admin1 → country (for 0.0 / X patterns) ─────────────────────────
ADMIN1_COUNTRY = {
    # Zimbabwe provinces
    "MIDLANDS": "Zimbabwe", "MANICALAND": "Zimbabwe", "MASVINGO": "Zimbabwe",
    "MASHONALAND CENTRAL": "Zimbabwe", "MASHONALAND WEST": "Zimbabwe",
    "MASHONALAND EAST": "Zimbabwe", "MATABELELAND SOUTH": "Zimbabwe",
    "MATABELELAND NORTH": "Zimbabwe", "MATEBELELAND NORTH": "Zimbabwe",
    "MATEBELELAND SOUTH": "Zimbabwe", "MATABELELAND NRTH": "Zimbabwe",
    "MATEBELELAND NRTH": "Zimbabwe", "MATEBELAND SOUTH": "Zimbabwe",
    # Eswatini (Swaziland) districts
    "Lubombo": "Eswatini", "Manzini": "Eswatini", "Hhohho": "Eswatini",
    "Shiselweni": "Eswatini",
    # Ethiopia regions
    "OROMIA": "Ethiopia", "AMHARA": "Ethiopia", "SNNP": "Ethiopia",
    "TIGRAY": "Ethiopia", "SOMALI": "Ethiopia", "AFAR": "Ethiopia",
    "BENISHANGUL-GUMUZ": "Ethiopia", "GAMBELLA": "Ethiopia",
    "HARARI": "Ethiopia", "SIDAMA": "Ethiopia",
    "DIRE DAWA": "Ethiopia", "ADDIS ABABA": "Ethiopia",
    # Tanzania regions
    "Tanga": "Tanzania", "Rukwa": "Tanzania", "Iringa": "Tanzania",
    "Mbeya": "Tanzania", "Kilimanjaro": "Tanzania", "Arusha": "Tanzania",
    "Morogoro": "Tanzania", "Dodoma": "Tanzania", "Mtwara": "Tanzania",
    "Lindi": "Tanzania", "Singida": "Tanzania", "Tabora": "Tanzania",
    "Shinyanga": "Tanzania", "Mwanza": "Tanzania", "Kagera": "Tanzania",
    "Kigoma": "Tanzania", "Mara": "Tanzania", "Pwani": "Tanzania",
    "Dar es Salaam": "Tanzania", "Ruvuma": "Tanzania",
    # Lesotho districts
    "Maseru": "Lesotho", "Leribe": "Lesotho", "Berea": "Lesotho",
    "Mafeteng": "Lesotho", "Mohale's Hoek": "Lesotho", "Butha-Buthe": "Lesotho",
    "Qacha's Nek": "Lesotho", "Quthing": "Lesotho", "Mokhotlong": "Lesotho",
    "Thaba-Tseka": "Lesotho",
    # South Africa
    "NORTH WEST PROVINCE": "South Africa", "MPUMALANGA": "South Africa",
    "EASTERN CAPE PROVINCE": "South Africa", "GAUTENG": "South Africa",
    "NORTHERN CAPE": "South Africa", "FREE STATE": "South Africa",
    "LIMPOPO": "South Africa", "WESTERN CAPE": "South Africa",
    "KWAZULU-NATAL": "South Africa", "KWAZULU NATAL": "South Africa",
    "NORTHERN CAPE PROVINCE": "South Africa", "WESTERN CAPE PROVINCE": "South Africa",
    "EASTERN CAPE PROVINCE": "South Africa",
    # Zambia provinces
    "Southern": "Zambia", "Central": "Zambia", "Eastern": "Zambia",
    "Western": "Zambia", "Copperbelt": "Zambia", "Muchinga": "Zambia",
    "Northern": "Zambia", "NorthWest": "Zambia", "North-Western": "Zambia",
    "Luapula": "Zambia", "Lusaka": "Zambia",
    # Mozambique
    "Centro": "Mozambique", "Norte": "Mozambique", "Sul": "Mozambique",
    "Gaza": "Mozambique", "Inhambane": "Mozambique", "Sofala": "Mozambique",
    "Manica": "Mozambique", "Zambezia": "Mozambique", "Nampula": "Mozambique",
    "Cabo Delgado": "Mozambique", "Niassa": "Mozambique", "Maputo": "Mozambique",
    # Cameroon
    "Centre": "Cameroon", "Est": "Cameroon", "Littoral": "Cameroon",
    "Nord": "Cameroon", "Nord-Ouest": "Cameroon", "Nord -Ouest": "Cameroon",
    "Ouest": "Cameroon", "Sud": "Cameroon", "Sud-Ouest": "Cameroon",
    "Sud Ouest": "Cameroon", "Extrême-Nord": "Cameroon",
    "Extrême - Nord": "Cameroon", "Ext. Nord": "Cameroon",
    "Extrême Nord": "Cameroon", "Adamaoua": "Cameroon",
    # Nigeria states (for numeric / state patterns)
    "Kaduna": "Nigeria", "Plateau": "Nigeria", "Benue": "Nigeria",
    "Taraba": "Nigeria", "Kano": "Nigeria", "Lagos": "Nigeria",
    "Rivers": "Nigeria", "Oyo": "Nigeria", "Delta": "Nigeria",
    "Enugu": "Nigeria", "Ondo": "Nigeria", "Kwara": "Nigeria",
    "Kebbi": "Nigeria", "Ekiti": "Nigeria", "Osun": "Nigeria",
    "Jigawa": "Nigeria", "Bauchi": "Nigeria", "Abia": "Nigeria",
    "Ogun": "Nigeria", "Adamawa": "Nigeria", "Nasarawa": "Nigeria",
    "Ebonyi": "Nigeria", "Kogi": "Nigeria", "Bayelsa": "Nigeria",
    "Niger": "Nigeria", "Imo": "Nigeria", "Anambra": "Nigeria",
    "Akwa Ibom": "Nigeria", "Cross River": "Nigeria",
    "Federal Capital Territory": "Nigeria",
    "Sokoto": "Nigeria", "Katsina": "Nigeria", "Zamfara": "Nigeria",
    "Yobe": "Nigeria", "Borno": "Nigeria", "Gombe": "Nigeria",
    "Edo": "Nigeria",
    # Namibia
    "Khomas": "Namibia", "Otjozondjupa": "Namibia", "Oshana": "Namibia",
    "Erongo": "Namibia", "Kunene": "Namibia", "Omusati": "Namibia",
    "Omaheke": "Namibia", "Kavango East": "Namibia", "Kavango West": "Namibia",
    "Hardap": "Namibia", "Karas": "Namibia", "Oshikoto": "Namibia",
    "Ohangwena": "Namibia", "Zambezi": "Namibia",
    # Botswana
    "North West": "Botswana", "South East": "Botswana",
    "Central District": "Botswana", "Kgalagadi": "Botswana",
    "Kweneng": "Botswana", "Southern District": "Botswana",
    "North East": "Botswana", "Ghanzi": "Botswana", "Chobe": "Botswana",
}

# ── source_file patterns → country ──────────────────────────────────
SOURCE_COUNTRY_PATTERNS = [
    (r"(?i)\bethiopia\b", "Ethiopia"),
    (r"(?i)\bkenya\b", "Kenya"),
    (r"(?i)\bnigeria\b", "Nigeria"),
    (r"(?i)\bzimbabwe|zimbawe\b", "Zimbabwe"),
    (r"(?i)\bsouth.?africa\b", "South Africa"),
    (r"(?i)\bghana\b", "Ghana"),
    (r"(?i)\btanzania\b", "Tanzania"),
    (r"(?i)\buganda\b", "Uganda"),
    (r"(?i)\bsenegal\b", "Senegal"),
    (r"(?i)\bbotswana\b", "Botswana"),
    (r"(?i)\bnamibia\b", "Namibia"),
    (r"(?i)\bmozambique\b", "Mozambique"),
    (r"(?i)\blesotho\b", "Lesotho"),
    (r"(?i)\bchad|tchad\b", "Chad"),
    (r"(?i)\bbenin|b[eé]nin\b", "Benin"),
    (r"(?i)\bzambia\b", "Zambia"),
    (r"(?i)\bsudan\b", "Sudan"),
    (r"(?i)\bcameroon|cameroun\b", "Cameroon"),
    (r"(?i)\bmali\b", "Mali"),
    (r"(?i)\bgambia\b", "The Gambia"),
    (r"(?i)\bburundi\b", "Burundi"),
    (r"(?i)\bgabon\b", "Gabon"),
    (r"(?i)\bsomalia\b", "Somalia"),
    (r"(?i)\bniger\b", "Niger"),
    (r"(?i)\btogo\b", "Togo"),
    (r"(?i)\btunisia|tunisie\b", "Tunisia"),
    (r"(?i)\bcongo\b", "DR Congo"),
    (r"(?i)\beswatini|swazi\b", "Eswatini"),
    (r"(?i)\bmadagascar\b", "Madagascar"),
    (r"(?i)\bburkina\b", "Burkina Faso"),
    (r"(?i)\bguinea.?bissau\b", "Guinea-Bissau"),
    (r"(?i)\bSADC\b", None),  # SADC reports — multi-country, needs admin1
    (r"(?i)^ZW_|^ZW\b", "Zimbabwe"),
    (r"(?i)^SZ_|^SZ\b", "Eswatini"),
    (r"(?i)^ZM_|^ZM\b", "Zambia"),
    (r"(?i)^LS_|^LS\b", "Lesotho"),
    (r"(?i)^BW_|^BW\b", "Botswana"),
    (r"(?i)^NA_|^NA\b", "Namibia"),
    (r"(?i)^MZ_|^MZ\b", "Mozambique"),
    (r"(?i)^TZ_|^TZ\b", "Tanzania"),
    (r"(?i)^KE_|^KE\b", "Kenya"),
    (r"(?i)^ET_|^ET\b", "Ethiopia"),
    (r"(?i)^NG_|^NG\b", "Nigeria"),
    (r"(?i)^GH_|^GH\b", "Ghana"),
]

# ── Country name normalization ───────────────────────────────────────
COUNTRY_ALIASES = {
    "swaziland": "Eswatini",
    "dr congo": "DR Congo",
    "drc": "DR Congo",
    "the gambia": "The Gambia",
    "gambia": "The Gambia",
    "guinea-bissau": "Guinea-Bissau",
    "guinea bissau": "Guinea-Bissau",
    "burkina faso": "Burkina Faso",
    "south africa": "South Africa",
    "central african republic": "Central African Republic",
    "sénégal": "Senegal",
    "senegal": "Senegal",
    "guinée": "Guinea",
    "guinee": "Guinea",
    "guinea conackry": "Guinea",
    "guinea conakry": "Guinea",
    "guinee conakry": "Guinea",
    "guinea": "Guinea",
    "tunisa": "Tunisia",
    "tunisie": "Tunisia",
    "cote d'ivore": "Cote d'Ivoire",
    "cote d'ivoire": "Cote d'Ivoire",
    "côte d'ivoire": "Cote d'Ivoire",
    "ivory coast": "Cote d'Ivoire",
    "democratic republic of the congo": "DR Congo",
    "republic of the congo": "Republic of Congo",
    "republique du congo": "Republic of Congo",
    "sierra leone": "Sierra Leone",
    "south sudan": "South Sudan",
    "equatorial guinea": "Equatorial Guinea",
    "sao tome and principe": "Sao Tome and Principe",
    "cabo verde": "Cabo Verde",
    "cap vert": "Cabo Verde",
    "cap-vert": "Cabo Verde",
    "rwanda": "Rwanda",
    "malawi": "Malawi",
    "angola": "Angola",
    "liberia": "Liberia",
    "eritrea": "Eritrea",
    "libya": "Libya",
    "libye": "Libya",
    "mauritania": "Mauritania",
    "mauritanie": "Mauritania",
    "mauritius": "Mauritius",
    "maurice": "Mauritius",
    "seychelles": "Seychelles",
    "comoros": "Comoros",
    "comores": "Comoros",
    "djibouti": "Djibouti",
    "egypt": "Egypt",
    "egypte": "Egypt",
    "morocco": "Morocco",
    "maroc": "Morocco",
    "algeria": "Algeria",
    "algérie": "Algeria",
    "algerie": "Algeria",
    "tchad": "Chad",
    "bénin": "Benin",
    "congo brazaville": "Republic of Congo",
    "congo brazzaville": "Republic of Congo",
}

# Known non-location values to skip
NON_LOCATIONS = {
    "treatment", "vaccination", "disease", "destroyed", "veterinarian",
    "aha", "...", "reporting unit:", "reporting officer", "reporting period",
    "date report:", "is there outbreak to report", "continue", "disease",
    "general surveillance", "resettlement", "stamping out", "screening",
    "precautions at the borders", "test and slaughter", "vector control",
    "control  measure", "diagnosis", "basis for", "month", "november",
    "september", "march", "state", "commercial", "urban",
    "country", "x", "reporting officer :", "reporting period :",
    "date report (dd/ mm/ yyy)", "month ( name of the month ):",
    "serotype", "prepared :", "is there outbreak to report ?",
    "-", "advisory", "nil", "//", "quarantine", "_", "# control",
    "isolation & treatment", "1*", "23*",
}


def normalize_country(name: str) -> str:
    """Normalize country name to canonical form."""
    lower = name.strip().lower()
    if lower in COUNTRY_ALIASES:
        return COUNTRY_ALIASES[lower]
    # Title case
    return name.strip().title() if len(name) > 3 else name.strip()


def ssh_connect(host: str) -> paramiko.SSHClient:
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS,
                timeout=20, allow_agent=False, look_for_keys=False)
    return ssh


def db_exec(ssh, container, db_pass, sql, timeout=120):
    escaped = sql.replace("'", "'\\''")
    cmd = (f"docker exec -e PGPASSWORD='{db_pass}' {container} "
           f"psql -U {DB_USER} -d aris -t -A -c '{escaped}'")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    if err and "warning" not in err.lower() and "notice" not in err.lower() and "already exists" not in err.lower():
        print(f"  [stderr] {err[:300]}", flush=True)
    return out


def db_exec_file(ssh, container, db_pass, sql_content, timeout=120):
    """Write SQL to host, copy into container, execute with psql -f."""
    sftp = ssh.open_sftp()
    with sftp.file('/tmp/aris_loc_norm.sql', 'w') as f:
        f.write(sql_content)
    sftp.close()
    ssh.exec_command(f"docker cp /tmp/aris_loc_norm.sql {container}:/tmp/aris_loc_norm.sql", timeout=10)[1].read()
    cmd = f"docker exec -e PGPASSWORD='{db_pass}' {container} psql -U {DB_USER} -d aris -f /tmp/aris_loc_norm.sql"
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--env", default="stg", choices=["prod", "stg"])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    cfg = ENV_CONFIG[args.env]
    db_pass = DB_PASS_MAP[args.env]
    dry = args.dry_run
    c = cfg["db_container"]

    print(f"[env] {args.env} — DB: {cfg['db_host']}")
    if dry:
        print("[mode] DRY RUN\n")

    ssh = ssh_connect(cfg["db_host"])

    # ── Step 1: Add country + admin1 columns if not exist ────────────
    print("[1] Adding country + admin1 columns...", flush=True)
    if not dry:
        db_exec(ssh, c, db_pass,
            f'ALTER TABLE {TABLE} ADD COLUMN IF NOT EXISTS country VARCHAR(100)')
        db_exec(ssh, c, db_pass,
            f'ALTER TABLE {TABLE} ADD COLUMN IF NOT EXISTS admin1 VARCHAR(200)')
        print("  Columns ensured.")

    # ── Step 2: Get all distinct admin_location + source_file combos ──
    print("\n[2] Fetching distinct admin_location values...", flush=True)
    raw = db_exec(ssh, c, db_pass,
        f"SELECT admin_location, COUNT(*) FROM {TABLE} "
        f"WHERE admin_location IS NOT NULL AND admin_location != '' "
        f"GROUP BY admin_location ORDER BY COUNT(*) DESC", timeout=120)

    locations = []
    for line in raw.split("\n"):
        if "|" in line:
            parts = line.rsplit("|", 1)
            locations.append((parts[0], int(parts[1])))

    print(f"  {len(locations)} distinct values, {sum(v[1] for v in locations):,} rows")

    # ── Step 3: Build mapping rules ──────────────────────────────────
    print("\n[3] Building normalization mapping...", flush=True)

    updates = []  # (admin_location, country, admin1, row_count)
    unresolved = []

    for loc, cnt in locations:
        country = None
        admin1 = None

        loc_stripped = loc.strip()
        loc_lower = loc_stripped.lower()

        # Skip non-location values
        if loc_lower in NON_LOCATIONS or loc_lower.startswith("["):
            continue

        # Pattern 1: "Country / Admin1" or "Country / Admin1, Country"
        if " / " in loc_stripped:
            parts = loc_stripped.split(" / ", 1)
            raw_country = parts[0].strip()
            raw_admin1 = parts[1].strip()

            # Remove ", Country" suffix from admin1
            if ", " in raw_admin1:
                raw_admin1 = raw_admin1.split(",")[0].strip()

            # Check if raw_country is "0.0" (numeric garbage)
            if re.match(r'^[\d.]+$', raw_country):
                # Try to resolve country from admin1
                admin1_title = raw_admin1.strip().upper() if raw_admin1.isupper() else raw_admin1.strip()
                for a1_key, a1_country in ADMIN1_COUNTRY.items():
                    if raw_admin1.strip().upper() == a1_key.upper():
                        country = a1_country
                        admin1 = raw_admin1.strip()
                        break
            else:
                # Normal "Country / Admin1"
                # Check if raw_country is an ISO code
                if raw_country.upper() in ISO_MAP:
                    country = ISO_MAP[raw_country.upper()]
                else:
                    country = normalize_country(raw_country)
                admin1 = raw_admin1.strip()

        # Pattern 2: Pure ISO code (ZA, CD, ZM, etc.)
        elif loc_stripped.upper() in ISO_MAP:
            country = ISO_MAP[loc_stripped.upper()]

        # Pattern 3: Numeric value — garbage
        elif re.match(r'^[\d.]+$', loc_stripped):
            # Can't resolve without source_file, skip for now
            continue

        # Pattern 4: Starts with "/ " — admin1 only, no country prefix
        elif loc_stripped.startswith("/ "):
            raw_admin1 = loc_stripped[2:].strip()
            for a1_key, a1_country in ADMIN1_COUNTRY.items():
                if raw_admin1.strip().upper() == a1_key.upper():
                    country = a1_country
                    admin1 = raw_admin1.strip()
                    break

        # Pattern 5: Simple country name
        else:
            candidate = normalize_country(loc_stripped)
            # Only accept if it looks like a real country name
            # (skip short garbage, numbers, dates, disease names, etc.)
            cand_lower = candidate.lower()
            if cand_lower in COUNTRY_ALIASES or cand_lower in {
                "nigeria", "zimbabwe", "kenya", "ethiopia", "south africa",
                "ghana", "lesotho", "chad", "benin", "mozambique", "zambia",
                "namibia", "botswana", "tanzania", "uganda", "sudan", "senegal",
                "cameroon", "mali", "gabon", "somalia", "niger", "togo",
                "tunisia", "madagascar", "burkina faso", "guinea-bissau",
                "burundi", "dr congo", "eswatini", "swaziland", "the gambia",
                "guinea", "rwanda", "malawi", "angola", "liberia", "sierra leone",
                "ivory coast", "cote d'ivoire", "equatorial guinea", "eritrea",
                "libya", "mauritania", "mauritius", "seychelles", "comoros",
                "djibouti", "cabo verde", "sao tome and principe", "south sudan",
                "egypt", "morocco", "algeria", "central african republic",
                "democratic republic of the congo", "republic of the congo",
                "cote d'ivoire", "guinea", "republic of congo",
                "sénégal", "guinée", "guinee", "tunisa", "tunisie",
                "guinea conackry", "guinea conakry", "guinee conakry",
                "cote d'ivore", "côte d'ivoire",
                "tchad", "bénin", "algérie", "algerie", "libye",
                "mauritanie", "egypte", "maroc", "comores", "maurice",
                "cap vert", "cap-vert",
                "congo brazaville", "congo brazzaville",
            }:
                country = COUNTRY_ALIASES.get(cand_lower, candidate)

        if country:
            # Fix admin1 typos for Zimbabwe
            if admin1 and country == "Zimbabwe":
                admin1_upper = admin1.upper()
                if "MATEBELELAND" in admin1_upper:
                    admin1 = admin1_upper.replace("MATEBELELAND", "MATABELELAND")
                if admin1_upper == "MATABELELAND NRTH":
                    admin1 = "MATABELELAND NORTH"
                if admin1_upper == "MATEBELAND SOUTH":
                    admin1 = "MATABELELAND SOUTH"
                if admin1 == "Total":
                    admin1 = None

            updates.append((loc, country, admin1, cnt))
        else:
            unresolved.append((loc, cnt))

    matched_rows = sum(u[3] for u in updates)
    unresolved_rows = sum(u[1] for u in unresolved)
    print(f"  Matched: {len(updates)} values ({matched_rows:,} rows)")
    print(f"  Unresolved: {len(unresolved)} values ({unresolved_rows:,} rows)")

    # Show unique country names
    countries = sorted(set(u[1] for u in updates))
    print(f"\n  {len(countries)} unique countries: {', '.join(countries[:30])}")

    if unresolved:
        print(f"\n  Top 20 unresolved:")
        for val, cnt in unresolved[:20]:
            print(f"    {cnt:>6,}  {val}")

    if dry:
        print(f"\n  Top 20 mappings:")
        for loc, country, admin1, cnt in updates[:20]:
            a1 = f" / {admin1}" if admin1 else ""
            print(f"    {cnt:>6,}  '{loc}' → {country}{a1}")
        ssh.close()
        return

    # ── Step 4: Execute UPDATEs ──────────────────────────────────────
    print(f"\n[4] Executing updates...", flush=True)

    # Build a big SQL script for efficiency
    sql_parts = []
    for loc, country, admin1, cnt in updates:
        loc_esc = loc.replace("'", "''")
        country_esc = country.replace("'", "''")
        admin1_clause = f"'{admin1.replace(chr(39), chr(39)+chr(39))}'" if admin1 else "NULL"

        sql_parts.append(
            f"UPDATE {TABLE} SET country = '{country_esc}', admin1 = {admin1_clause} "
            f"WHERE admin_location = '{loc_esc}';"
        )

    # Execute in batches of 100
    total_updated = 0
    batch_size = 100
    for i in range(0, len(sql_parts), batch_size):
        batch = sql_parts[i:i + batch_size]
        batch_sql = "\n".join(batch)
        result = db_exec_file(ssh, c, db_pass, batch_sql, timeout=300)

        # Count UPDATE N results
        batch_updated = 0
        for line in result.split("\n"):
            if line.startswith("UPDATE"):
                try:
                    batch_updated += int(line.split()[-1])
                except (ValueError, IndexError):
                    pass
        total_updated += batch_updated

        batch_num = i // batch_size + 1
        total_batches = (len(sql_parts) + batch_size - 1) // batch_size
        print(f"  Batch {batch_num}/{total_batches}: {batch_updated:,} rows", flush=True)

    # ── Step 5: Handle numeric garbage via source_file ───────────────
    print(f"\n[5] Resolving numeric admin_location via source_file...", flush=True)

    # Get distinct source_file for rows with country IS NULL
    raw = db_exec(ssh, c, db_pass,
        f"SELECT DISTINCT source_file FROM {TABLE} WHERE country IS NULL AND admin_location IS NOT NULL AND admin_location != '' LIMIT 200",
        timeout=60)

    source_files = [f.strip() for f in raw.split("\n") if f.strip()]
    print(f"  {len(source_files)} source files with unresolved locations")

    sf_updates = 0
    for sf in source_files:
        # Try to match source_file to a country
        matched_country = None
        for pattern, cname in SOURCE_COUNTRY_PATTERNS:
            if cname and re.search(pattern, sf):
                matched_country = cname
                break

        if matched_country:
            sf_esc = sf.replace("'", "''")
            country_esc = matched_country.replace("'", "''")
            result = db_exec(ssh, c, db_pass,
                f"UPDATE {TABLE} SET country = '{country_esc}' "
                f"WHERE source_file = '{sf_esc}' AND country IS NULL",
                timeout=60)
            if result.startswith("UPDATE"):
                n = int(result.split()[-1])
                if n > 0:
                    sf_updates += n

    print(f"  Resolved {sf_updates:,} additional rows via source_file")
    total_updated += sf_updates

    # ── Step 6: Set remaining NULLs to "Unknown" ────────────────────
    print(f"\n[6] Setting remaining NULL countries to 'Unknown'...", flush=True)
    result = db_exec(ssh, c, db_pass,
        f"UPDATE {TABLE} SET country = 'Unknown' WHERE country IS NULL",
        timeout=120)
    if result.startswith("UPDATE"):
        n = int(result.split()[-1])
        print(f"  {n:,} rows set to 'Unknown'")
        total_updated += n

    # ── Step 7: Create index ─────────────────────────────────────────
    print(f"\n[7] Creating index on country...", flush=True)
    db_exec(ssh, c, db_pass,
        f'CREATE INDEX IF NOT EXISTS idx_hist_mahr_country ON {TABLE} (country)')
    print("  Index created.")

    # ── Summary ──────────────────────────────────────────────────────
    print(f"\n{'='*60}")
    print("SUMMARY")
    print(f"{'='*60}")
    print(f"  Total rows updated: {total_updated:,}")

    print("\n[verify] Country distribution:", flush=True)
    r = db_exec(ssh, c, db_pass,
        f"SELECT country, COUNT(*) as cnt FROM {TABLE} GROUP BY country ORDER BY cnt DESC LIMIT 30")
    for line in r.split('\n'):
        if "|" in line:
            parts = line.split("|")
            print(f"  {int(parts[1]):>8,}  {parts[0]}")

    print(f"\n  Total distinct countries:")
    r = db_exec(ssh, c, db_pass, f"SELECT COUNT(DISTINCT country) FROM {TABLE}")
    print(f"  {r}")

    ssh.close()
    print("\n[done]")


if __name__ == "__main__":
    main()
