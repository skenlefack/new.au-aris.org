"""
PAID v2 Seed — Parse AMERT Excel and populate new PAID tables.
Creates schema + inserts 4 LICS projects with full hierarchy.

Usage: python deploy/scripts/_paid_v2_seed.py [--target stg|prod]
"""

import paramiko
import openpyxl
import sys
import os

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

TARGETS = {
    "stg": {"host": "10.202.101.148", "db_pass": "Ar1s_Stg_2024!xK9mZ", "db_user": "aris"},
    "prod": {"host": "10.202.101.185", "db_pass": "Ar1s_Pr0d_2024!xK9mZ", "db_user": "aris"},
}

EXCEL_PATH = os.path.join(os.path.dirname(__file__), "..", "..",
    "form", "LICS",
    "AMERT SUB- ACTIVITY BREAKDOWN FOR LICS - 2026 - OHDAA, ANGR, LIVESYS, VET GOV.xlsx")

# Project metadata
PROJECT_META = {
    "ANGR": {
        "title": "Animal Genetics Resources (AnGR)",
        "type": "multiple_countries",
        "countries": ["KE", "ET", "NG", "TZ", "UG", "SN", "CM", "ZA"],
    },
    "LIVESYS": {
        "title": "Climate Resilient and Sustainable Livestock Systems",
        "type": "multiple_countries",
        "countries": ["KE", "ET", "NG", "TZ", "UG", "SN", "NE", "ML", "BF", "TD"],
    },
    "OHDAA": {
        "title": "One Health, Disease Control, Animal Health & Veterinary Governance",
        "type": "multiple_countries",
        "countries": ["KE", "ET", "NG", "TZ", "UG", "SN", "CM", "GH", "ZA", "MZ"],
    },
    "VET_GOV": {
        "title": "Veterinary Governance and Animal Welfare",
        "type": "multiple_countries",
        "countries": ["KE", "ET", "NG", "TZ", "UG", "SN", "CM", "GH", "ZA", "MZ"],
    },
}

# Executive partners (per project)
EXEC_PARTNERS = {
    "ANGR": ["AU-IBAR"],
    "LIVESYS": ["AU-IBAR"],
    "OHDAA": ["AU-IBAR", "FAO"],
    "VET_GOV": ["AU-IBAR"],
}

# Breakdown fields for training activities
TRAINING_BREAKDOWN = [
    ("n_female_trained", "Number of females trained", "number", 0, False),
    ("n_male_trained", "Number of males trained", "number", 1, False),
]


def esc(s):
    """Escape single quotes for SQL."""
    if s is None:
        return ""
    return str(s).replace("'", "''").strip()


def parse_excel():
    """Parse the AMERT Excel and return structured hierarchy."""
    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
    ws = wb["Sheet1"]

    current_project = None
    current_output_code = None
    current_logframe_code = None
    current_activity_code = None

    projects = {}

    for row in ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True):
        col_a = str(row[0] or "").strip()
        col_b = str(row[1] or "").strip()
        col_c = str(row[2] or "").strip()
        col_d = str(row[3] or "").strip()
        col_e = str(row[4] or "").strip()  # sub-activity unit
        col_f = str(row[5] or "").strip()  # PAID activity label
        col_g = str(row[6] or "").strip()  # PAID activity unit

        # Project header (no dots, no other columns)
        if col_a and "." not in col_a and not col_b and not col_c:
            # Map Excel name to our project codes
            name_upper = col_a.upper().strip()
            if "VET" in name_upper or "AH" in name_upper:
                current_project = "OHDAA"
            elif name_upper == "ANGR":
                current_project = "ANGR"
            elif name_upper == "LIVESYS":
                current_project = "LIVESYS"
            else:
                current_project = col_a.upper().replace(" ", "_")
            if current_project not in projects:
                projects[current_project] = {"logframes": {}}
            continue

        if not current_project:
            continue

        dots = col_a.count(".")

        # Output (e.g. 2.2) — we skip this level, use logframe directly
        if dots == 1 and col_b:
            current_output_code = col_a
            continue

        # Logframe (e.g. 2.2.1)
        if dots == 2 and col_b:
            current_logframe_code = col_a
            projects[current_project]["logframes"][col_a] = {
                "label": col_b,
                "activities": {},
            }
            continue

        # Activity (e.g. 2.2.1.01)
        if dots == 3 and col_c:
            current_activity_code = col_a
            lf_key = ".".join(col_a.split(".")[:3])
            if lf_key in projects[current_project]["logframes"]:
                projects[current_project]["logframes"][lf_key]["activities"][col_a] = {
                    "label": col_c,
                    "subactivities": {},
                }
            continue

        # Sub-activity (e.g. 2.2.1.01.01)
        if dots == 4 and col_d:
            lf_key = ".".join(col_a.split(".")[:3])
            act_key = ".".join(col_a.split(".")[:4])
            try:
                projects[current_project]["logframes"][lf_key]["activities"][act_key]["subactivities"][col_a] = {
                    "label": col_d,
                    "unit": col_e,
                    "paid_activity": col_f,
                    "paid_unit": col_g,
                }
            except KeyError:
                pass

    wb.close()
    return projects


def generate_sql(projects):
    """Generate INSERT SQL from parsed hierarchy."""
    lines = []

    # Read and include schema SQL
    schema_path = os.path.join(os.path.dirname(__file__), "_paid_v2_schema.sql")
    with open(schema_path, "r", encoding="utf-8") as f:
        lines.append(f.read())
    lines.append("")

    # Insert projects
    lines.append("-- ============================================================")
    lines.append("-- SEED DATA")
    lines.append("-- ============================================================")
    lines.append("")

    for code, meta in PROJECT_META.items():
        countries_sql = "'{" + ",".join(meta["countries"]) + "}'"
        lines.append(
            f"INSERT INTO animal_health.paid_projects (code, title, type, countries) "
            f"VALUES ('{esc(code)}', '{esc(meta['title'])}', '{meta['type']}', {countries_sql}) "
            f"ON CONFLICT (code) DO NOTHING;"
        )

    lines.append("")

    # Executive partners
    for proj, partners in EXEC_PARTNERS.items():
        for p in partners:
            lines.append(
                f"INSERT INTO animal_health.paid_executive_partners (project_code, name) "
                f"VALUES ('{proj}', '{esc(p)}');"
            )
    lines.append("")

    # Logframes, activities, sub-activities, PAID activities
    paid_activity_codes_seen = set()

    for proj_code, proj_data in projects.items():
        # Map project codes if needed
        if proj_code not in PROJECT_META:
            print(f"  [WARN] Skipping unknown project: {proj_code}")
            continue

        lines.append(f"-- Project: {proj_code}")

        for lf_code, lf_data in proj_data["logframes"].items():
            lines.append(
                f"INSERT INTO animal_health.paid_logframes (code, project_code, label) "
                f"VALUES ('{esc(lf_code)}', '{esc(proj_code)}', '{esc(lf_data['label'][:500])}') "
                f"ON CONFLICT (code) DO NOTHING;"
            )

            for act_code, act_data in lf_data["activities"].items():
                lines.append(
                    f"INSERT INTO animal_health.paid_lf_activities (code, logframe_code, label) "
                    f"VALUES ('{esc(act_code)}', '{esc(lf_code)}', '{esc(act_data['label'][:500])}') "
                    f"ON CONFLICT (code) DO NOTHING;"
                )

                for sa_code, sa_data in act_data["subactivities"].items():
                    lines.append(
                        f"INSERT INTO animal_health.paid_subactivities (code, activity_code, label, unit_of_measure) "
                        f"VALUES ('{esc(sa_code)}', '{esc(act_code)}', '{esc(sa_data['label'][:500])}', '{esc(sa_data['unit'])}') "
                        f"ON CONFLICT (code) DO NOTHING;"
                    )

                    # PAID activity (may be empty)
                    pa_label = sa_data["paid_activity"]
                    pa_unit = sa_data["paid_unit"]
                    if pa_label:
                        pa_code = f"{sa_code}_PA"
                        lines.append(
                            f"INSERT INTO animal_health.paid_paid_activities (code, subactivity_code, label, unit_of_measure) "
                            f"VALUES ('{esc(pa_code)}', '{esc(sa_code)}', '{esc(pa_label)}', '{esc(pa_unit)}') "
                            f"ON CONFLICT (code) DO NOTHING;"
                        )

                        # Add breakdown fields for training activities
                        pa_lower = pa_label.lower()
                        if "training" in pa_lower or "sensitization" in pa_lower or "capacity" in pa_lower:
                            if pa_code not in paid_activity_codes_seen:
                                paid_activity_codes_seen.add(pa_code)
                                for fc, fl, ft, so, req in TRAINING_BREAKDOWN:
                                    lines.append(
                                        f"INSERT INTO animal_health.paid_breakdown_fields "
                                        f"(paid_activity_code, field_code, field_label, field_type, sort_order, is_required) "
                                        f"VALUES ('{esc(pa_code)}', '{fc}', '{fl}', '{ft}', {so}, {str(req).lower()}) "
                                        f"ON CONFLICT (paid_activity_code, field_code) DO NOTHING;"
                                    )

        lines.append("")

    return "\n".join(lines)


def deploy_sql(sql, target_key):
    """Deploy SQL to target database via SSH."""
    t = TARGETS[target_key]
    print(f"\n{'='*60}")
    print(f"  PAID v2 SEED — {target_key.upper()} ({t['host']})")
    print(f"{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(t["host"], username=SSH_USER, password=SSH_PASS, timeout=15)

    # Write SQL to temp file on server
    sftp = ssh.open_sftp()
    remote_path = "/tmp/_paid_v2_seed.sql"
    with sftp.file(remote_path, "w") as f:
        f.write(sql)
    sftp.close()

    db_url = f"postgresql://{t['db_user']}:{t['db_pass']}@localhost:5432/aris"
    cmd = f'psql "{db_url}" -f {remote_path}'

    print("[*] Running seed SQL...")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=120)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")

    # Count inserts
    insert_count = out.count("INSERT")
    create_count = out.count("CREATE")
    print(f"  Created {create_count} tables, inserted {insert_count} rows")

    if err.strip():
        err_clean = "\n".join(
            l for l in err.strip().split("\n")
            if "NOTICE" not in l and "password" not in l.lower()
        )
        if err_clean.strip():
            print(f"  Errors:\n{err_clean[:500]}")

    # Verify counts
    verify_sql = """
SELECT 'projects' AS entity, count(*) FROM animal_health.paid_projects
UNION ALL SELECT 'logframes', count(*) FROM animal_health.paid_logframes
UNION ALL SELECT 'activities', count(*) FROM animal_health.paid_lf_activities
UNION ALL SELECT 'subactivities', count(*) FROM animal_health.paid_subactivities
UNION ALL SELECT 'paid_activities', count(*) FROM animal_health.paid_paid_activities
UNION ALL SELECT 'breakdown_fields', count(*) FROM animal_health.paid_breakdown_fields
UNION ALL SELECT 'exec_partners', count(*) FROM animal_health.paid_executive_partners;
"""
    _, stdout2, _ = ssh.exec_command(f'psql "{db_url}" -t -c "{verify_sql}"', timeout=15)
    verify = stdout2.read().decode("utf-8", errors="replace").strip()
    print(f"\n  Verification:\n{verify}")

    # Cleanup
    ssh.exec_command(f"rm -f {remote_path}")
    ssh.close()
    print(f"\n[OK] Seed complete on {target_key.upper()}")


def main():
    target = "stg"
    if len(sys.argv) > 1:
        arg = sys.argv[1].replace("--target=", "").replace("--target", "").strip()
        if arg in TARGETS:
            target = arg

    print("[*] Parsing AMERT Excel...")
    projects = parse_excel()

    total_lf = sum(len(p["logframes"]) for p in projects.values())
    total_act = sum(
        len(a["activities"])
        for p in projects.values()
        for a in p["logframes"].values()
    )
    total_sa = sum(
        len(s["subactivities"])
        for p in projects.values()
        for a in p["logframes"].values()
        for s in a["activities"].values()
    )

    print(f"  Projects: {len(projects)}")
    print(f"  LogFrames: {total_lf}")
    print(f"  Activities: {total_act}")
    print(f"  Sub-Activities: {total_sa}")

    for proj, data in projects.items():
        lfs = len(data["logframes"])
        acts = sum(len(a["activities"]) for a in data["logframes"].values())
        sas = sum(
            len(s["subactivities"])
            for a in data["logframes"].values()
            for s in a["activities"].values()
        )
        print(f"    {proj}: {lfs} logframes, {acts} activities, {sas} sub-activities")

    print("\n[*] Generating SQL...")
    sql = generate_sql(projects)
    print(f"  Generated {len(sql)} chars, {sql.count('INSERT')} inserts")

    # Save locally for inspection
    local_path = os.path.join(os.path.dirname(__file__), "_paid_v2_seed_generated.sql")
    with open(local_path, "w", encoding="utf-8") as f:
        f.write(sql)
    print(f"  Saved to {local_path}")

    deploy_sql(sql, target)


if __name__ == "__main__":
    main()
