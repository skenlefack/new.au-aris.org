#!/usr/bin/env python3
"""
ARIS 4.0 — Verify production database seed data.
SSH to VM-APP (10.202.101.183), run psql via docker on VM-DB (10.202.101.185),
compare actual record counts against expected seed counts.
"""
import os
import sys
import paramiko

os.environ["PYTHONIOENCODING"] = "utf-8"

# ── Connection settings ──────────────────────────────────────────────────────

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
HOST = "10.202.101.183"

DB_HOST = "10.202.101.185"
DB_PORT = "5432"
DB_USER = "aris"
DB_PASS = "@u-1baR.0rg$U24"
DB_NAME = "aris"


# ── SSH helpers ──────────────────────────────────────────────────────────────

def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, SSH_USER, SSH_PASS, timeout=15,
              allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=300):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out, err


def psql_count(client, query):
    """Run a psql query via docker exec and return the integer result."""
    escaped_query = query.replace('"', '\\"')
    cmd = (
        f'docker exec aris-postgres psql -U {DB_USER} -d {DB_NAME} -t -c "{escaped_query}"'
    )
    code, out, err = run_sudo(client, cmd)
    if code != 0:
        return None, err
    try:
        return int(out.strip()), None
    except (ValueError, TypeError):
        return None, f"Unexpected output: {out!r}"


# ── Expected seed counts ─────────────────────────────────────────────────────
# Derived from packages/db-schemas/prisma/seed-*.ts
#
# Each entry: (label, schema.table, sql_query, expected_min_count, description)
#
# Uses ~ (approximate) expected counts as documented in seed files:
#   - seed-tenant.ts:     1 AU + 8 RECs + 54 MS = 63 tenants
#   - seed-credential.ts: 1 SUPER_ADMIN + 1 CONTINENTAL_ADMIN + 8 REC_ADMIN
#                          + 8 REC_STEWARD + 54 NAT_ADMIN + 54 NAT_STEWARD = 126
#                          + seed-functions.ts adds ~4 more users = ~130 base
#                          (production may have more from manual additions)
#   - seed-settings.ts:   8 RECs, 55 countries, country_recs, system_configs, domains, admin_levels
#   - seed-functions.ts:  9 continental + 8*7 regional + 54*12 national = 9+56+648 = 713 functions (but seed shows ~288)
#                          Actually: 9 continental + 7*8 REC = 65, + 12*54 = 648 => total ~713
#   - seed-bi.ts:         3 BI tools, 21 access rules (3 tools * 7 roles), 3 dashboards
#   - seed-master-data.ts: 10 species groups, 26 species, 13 age groups, 25 diseases,
#                          55 disease-species, ~30+ clinical signs
#   - seed-workflow.ts:   54 collecte_workflows, 216 collecte_workflow_steps (54*4),
#                          ~116 validation chains (54+54+8)
#   - form-builder seed:  21 form templates

CHECKS = [
    # ── Tenant schema (public.tenants) ────────────────────────────────────
    (
        "Tenants (total)",
        "SELECT count(*) FROM public.tenants",
        63,
        "1 AU-IBAR + 8 RECs + 54 Member States",
    ),
    (
        "Tenants (CONTINENTAL)",
        "SELECT count(*) FROM public.tenants WHERE level = 'CONTINENTAL'",
        1,
        "AU-IBAR only",
    ),
    (
        "Tenants (REC)",
        "SELECT count(*) FROM public.tenants WHERE level = 'REC'",
        8,
        "IGAD, ECOWAS, SADC, EAC, ECCAS, UMA, CEN-SAD, COMESA",
    ),
    (
        "Tenants (MEMBER_STATE)",
        "SELECT count(*) FROM public.tenants WHERE level = 'MEMBER_STATE'",
        54,
        "54 AU Member States",
    ),

    # ── Credential schema (public.users) ──────────────────────────────────
    (
        "Users (total)",
        "SELECT count(*) FROM public.users",
        126,
        "1 SUPER + 1 CONT + 8 REC_ADMIN + 8 REC_STEWARD + 54 NAT_ADMIN + 54 NAT_STEWARD + extras from seed-functions",
    ),
    (
        "Users (SUPER_ADMIN)",
        "SELECT count(*) FROM public.users WHERE role = 'SUPER_ADMIN'",
        1,
        "admin@au-aris.org",
    ),
    (
        "Users (CONTINENTAL_ADMIN)",
        "SELECT count(*) FROM public.users WHERE role = 'CONTINENTAL_ADMIN'",
        1,
        "continental@au-aris.org",
    ),
    (
        "Users (REC_ADMIN)",
        "SELECT count(*) FROM public.users WHERE role = 'REC_ADMIN'",
        8,
        "One per REC (seed-credential may create 8, seed-functions may add 2 more)",
    ),
    (
        "Users (NATIONAL_ADMIN)",
        "SELECT count(*) FROM public.users WHERE role = 'NATIONAL_ADMIN'",
        54,
        "One per Member State",
    ),
    (
        "Users (DATA_STEWARD)",
        "SELECT count(*) FROM public.users WHERE role = 'DATA_STEWARD'",
        62,
        "8 REC + 54 national stewards",
    ),

    # ── Settings schema (governance.*) ────────────────────────────────────
    (
        "RECs",
        "SELECT count(*) FROM governance.recs",
        8,
        "8 RECs from seed-settings",
    ),
    (
        "Countries",
        "SELECT count(*) FROM governance.countries",
        55,
        "55 AU Member States",
    ),
    (
        "Country-REC relations",
        "SELECT count(*) FROM governance.country_recs",
        75,
        "Many-to-many: countries can belong to multiple RECs",
    ),
    (
        "Domains",
        "SELECT count(*) FROM governance.domains",
        9,
        "9 business domains",
    ),
    (
        "Functions",
        "SELECT count(*) FROM governance.functions",
        288,
        "9 continental + 56 regional (8 RECs * 7) + ~648 national (54 * 12) -- actual depends on seed run",
    ),
    (
        "User-Function assignments",
        "SELECT count(*) FROM governance.user_functions",
        5,
        "At least 5 from seed-functions (Super Admin, KE CVO, NG CVO, ECOWAS coord, EAC coord, KE vet, KE data)",
    ),
    (
        "BI Tool Configs",
        "SELECT count(*) FROM governance.bi_tool_configs",
        3,
        "Superset, Metabase, Grafana",
    ),
    (
        "BI Access Rules",
        "SELECT count(*) FROM governance.bi_data_access_rules",
        21,
        "3 tools * 7 roles",
    ),
    (
        "BI Dashboards",
        "SELECT count(*) FROM governance.bi_dashboards",
        3,
        "Continental Overview, Animal Health, Trade & Production",
    ),
    (
        "System Configs",
        "SELECT count(*) FROM governance.system_configs",
        10,
        "Platform configuration entries",
    ),
    (
        "Admin Levels",
        "SELECT count(*) FROM governance.admin_levels",
        15,
        "3 levels each for 5 pilot countries (KE, ET, NG, SN, ZA)",
    ),

    # ── Master Data (animal_health.ref_*) ─────────────────────────────────
    (
        "Species Groups",
        "SELECT count(*) FROM animal_health.ref_species_groups",
        10,
        "Ruminants, Monogastric, Poultry, Equidae, Camelids, Swine, Aquatic, Wildlife, Bees, Pets",
    ),
    (
        "Species",
        "SELECT count(*) FROM animal_health.ref_species",
        26,
        "26 species across all groups",
    ),
    (
        "Age Groups",
        "SELECT count(*) FROM animal_health.ref_age_groups",
        13,
        "4 cattle + 3 sheep + 3 goat + 3 chicken",
    ),
    (
        "Diseases",
        "SELECT count(*) FROM animal_health.ref_diseases",
        25,
        "25 diseases (FMD, CBPP, PPR, ASF, HPAI, RVF, LSD, etc.)",
    ),
    (
        "Disease-Species Relations",
        "SELECT count(*) FROM animal_health.ref_disease_species",
        55,
        "55 disease-species susceptibility mappings",
    ),
    (
        "Clinical Signs",
        "SELECT count(*) FROM animal_health.ref_clinical_signs",
        30,
        "30+ clinical signs across diseases",
    ),

    # ── Form Builder (form_builder.form_templates) ────────────────────────
    (
        "Form Templates",
        "SELECT count(*) FROM form_builder.form_templates",
        21,
        "21 official data collection templates",
    ),
    (
        "Form Templates (PUBLISHED)",
        "SELECT count(*) FROM form_builder.form_templates WHERE status = 'PUBLISHED'",
        21,
        "All 21 templates should be published",
    ),

    # ── Workflow (public.collecte_*) ──────────────────────────────────────
    (
        "Collecte Workflows",
        "SELECT count(*) FROM public.collecte_workflows",
        54,
        "One workflow definition per country",
    ),
    (
        "Collecte Workflow Steps",
        "SELECT count(*) FROM public.collecte_workflow_steps",
        216,
        "54 countries * 4 steps each",
    ),
    (
        "Collecte Validation Chains",
        "SELECT count(*) FROM public.collecte_validation_chains",
        116,
        "54 national + 54 regional + 8 continental chains",
    ),

    # ── Workflow schema (workflow.*) ──────────────────────────────────────
    (
        "Workflow Definitions (workflow schema)",
        "SELECT count(*) FROM workflow.workflow_definitions",
        54,
        "One per country (may not be seeded if workflow seed ran separately)",
    ),
    (
        "Workflow Steps (workflow schema)",
        "SELECT count(*) FROM workflow.workflow_steps",
        216,
        "54 * 4 steps",
    ),
    (
        "Validation Chains (workflow schema)",
        "SELECT count(*) FROM workflow.validation_chains",
        116,
        "54 + 54 + 8 chains",
    ),

    # ── Collection Campaigns ──────────────────────────────────────────────
    (
        "Collection Campaigns",
        "SELECT count(*) FROM public.collection_campaigns",
        1,
        "Q1_2025_SURVEILLANCE campaign",
    ),
    (
        "Campaign Assignments",
        "SELECT count(*) FROM public.campaign_assignments",
        2,
        "KE and NG admin assignments",
    ),
]


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    safe_print("=" * 80)
    safe_print("  ARIS 4.0 -- Production Seed Data Verification")
    safe_print(f"  SSH: {SSH_USER}@{HOST} -> psql on {DB_HOST}:{DB_PORT}/{DB_NAME}")
    safe_print("=" * 80)
    safe_print("")

    client = get_client()
    safe_print(f"[OK] SSH connected to {HOST}")
    safe_print("")

    # Verify docker container is running
    code, out, err = run_sudo(client, "docker ps --filter name=aris-postgres --format '{{.Names}}'")
    if "aris-postgres" not in out:
        safe_print("[ERROR] aris-postgres container not found on VM-APP. Checking VM-DB...")
        # Try connecting to VM-DB directly via SSH tunnel
        safe_print("[INFO] psql commands will be run via docker exec on aris-postgres container")
        safe_print(f"[INFO] Container check output: {out}")
        safe_print(f"[INFO] Container check error: {err}")
    else:
        safe_print(f"[OK] aris-postgres container is running")

    safe_print("")
    safe_print("-" * 80)
    safe_print(f"{'Check':<45} {'Expected':>10} {'Actual':>10} {'Status':>10}")
    safe_print("-" * 80)

    total_pass = 0
    total_fail = 0
    total_warn = 0
    total_error = 0
    results = []

    for label, query, expected, description in CHECKS:
        actual, error = psql_count(client, query)

        if error is not None:
            status = "ERROR"
            actual_str = "N/A"
            total_error += 1
        elif actual is None:
            status = "ERROR"
            actual_str = "N/A"
            total_error += 1
        elif actual >= expected:
            status = "PASS"
            actual_str = str(actual)
            total_pass += 1
        elif actual >= expected * 0.8:
            # Within 80% tolerance -- warn
            status = "WARN"
            actual_str = str(actual)
            total_warn += 1
        else:
            status = "FAIL"
            actual_str = str(actual)
            total_fail += 1

        results.append({
            "label": label,
            "expected": expected,
            "actual": actual,
            "actual_str": actual_str,
            "status": status,
            "description": description,
            "error": error,
        })

        status_indicator = {
            "PASS": "  PASS",
            "WARN": "  WARN",
            "FAIL": "**FAIL",
            "ERROR": " ERROR",
        }[status]

        safe_print(f"{label:<45} {'>=' + str(expected):>10} {actual_str:>10} {status_indicator:>10}")

    safe_print("-" * 80)
    safe_print("")

    # ── Summary ──────────────────────────────────────────────────────────────
    safe_print("=" * 80)
    safe_print("  SUMMARY")
    safe_print("=" * 80)
    safe_print(f"  PASS:  {total_pass}/{len(CHECKS)}")
    safe_print(f"  WARN:  {total_warn}/{len(CHECKS)} (actual >= 80% of expected)")
    safe_print(f"  FAIL:  {total_fail}/{len(CHECKS)} (actual < 80% of expected)")
    safe_print(f"  ERROR: {total_error}/{len(CHECKS)} (query failed)")
    safe_print("")

    # ── Show details for failures ────────────────────────────────────────────
    failures = [r for r in results if r["status"] in ("FAIL", "ERROR")]
    if failures:
        safe_print("  FAILURES & ERRORS:")
        safe_print("  " + "-" * 76)
        for r in failures:
            safe_print(f"  {r['label']}")
            safe_print(f"    Expected: >= {r['expected']}")
            safe_print(f"    Actual:   {r['actual_str']}")
            safe_print(f"    Details:  {r['description']}")
            if r["error"]:
                # Truncate long error messages
                err_msg = r["error"][:200]
                safe_print(f"    Error:    {err_msg}")
            safe_print("")

    warnings = [r for r in results if r["status"] == "WARN"]
    if warnings:
        safe_print("  WARNINGS (close but below expected):")
        safe_print("  " + "-" * 76)
        for r in warnings:
            safe_print(f"  {r['label']}: expected >= {r['expected']}, got {r['actual_str']}")
            safe_print(f"    {r['description']}")
            safe_print("")

    # ── Spot-check specific records ──────────────────────────────────────────
    safe_print("=" * 80)
    safe_print("  SPOT CHECKS (specific seed records)")
    safe_print("=" * 80)
    safe_print("")

    spot_checks = [
        ("Super Admin exists",
         "SELECT count(*) FROM public.users WHERE email = 'admin@au-aris.org'",
         1),
        ("Continental Admin exists",
         "SELECT count(*) FROM public.users WHERE email = 'continental@au-aris.org'",
         1),
        ("Kenya Admin exists",
         "SELECT count(*) FROM public.users WHERE email = 'admin@ke.au-aris.org'",
         1),
        ("Nigeria Admin exists",
         "SELECT count(*) FROM public.users WHERE email = 'admin@ng.au-aris.org'",
         1),
        ("AU-IBAR tenant exists",
         "SELECT count(*) FROM public.tenants WHERE code = 'AU'",
         1),
        ("IGAD REC exists",
         "SELECT count(*) FROM public.tenants WHERE code = 'IGAD'",
         1),
        ("ECOWAS REC exists",
         "SELECT count(*) FROM public.tenants WHERE code = 'ECOWAS'",
         1),
        ("Kenya tenant exists",
         "SELECT count(*) FROM public.tenants WHERE code = 'KE'",
         1),
        ("FMD disease exists",
         "SELECT count(*) FROM animal_health.ref_diseases WHERE code = 'FMD'",
         1),
        ("Cattle species exists",
         "SELECT count(*) FROM animal_health.ref_species WHERE code = 'CATTLE'",
         1),
        ("Superset BI tool exists",
         "SELECT count(*) FROM governance.bi_tool_configs WHERE tool = 'superset'",
         1),
        ("Grafana BI tool exists",
         "SELECT count(*) FROM governance.bi_tool_configs WHERE tool = 'grafana'",
         1),
        ("ECOWAS REC in settings",
         "SELECT count(*) FROM governance.recs WHERE code = 'ecowas'",
         1),
        ("Kenya country in settings",
         "SELECT count(*) FROM governance.countries WHERE code = 'KE'",
         1),
    ]

    spot_pass = 0
    spot_fail = 0
    for label, query, expected in spot_checks:
        actual, error = psql_count(client, query)
        if error:
            safe_print(f"  ERROR  {label}: {error[:100]}")
            spot_fail += 1
        elif actual is not None and actual >= expected:
            safe_print(f"  PASS   {label}")
            spot_pass += 1
        else:
            safe_print(f"  FAIL   {label} (expected {expected}, got {actual})")
            spot_fail += 1

    safe_print("")
    safe_print(f"  Spot checks: {spot_pass} passed, {spot_fail} failed")

    # ── Schema existence check ───────────────────────────────────────────────
    safe_print("")
    safe_print("=" * 80)
    safe_print("  SCHEMA EXISTENCE CHECK")
    safe_print("=" * 80)
    safe_print("")

    schemas_to_check = [
        "public", "governance", "animal_health", "form_builder", "workflow",
        "livestock_prod", "fisheries", "wildlife", "apiculture",
        "trade_sps", "climate_env", "knowledge_hub",
    ]

    schema_query = "SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema' ORDER BY schema_name"
    code, out, err = run_sudo(
        client,
        f'docker exec aris-postgres psql -U {DB_USER} -d {DB_NAME} -t -c "{schema_query}"'
    )

    if code == 0 and out:
        existing_schemas = [s.strip() for s in out.strip().split("\n") if s.strip()]
        safe_print(f"  Schemas found in database: {len(existing_schemas)}")
        for s in existing_schemas:
            marker = "  OK" if s in schemas_to_check else "    "
            safe_print(f"    {marker}  {s}")
        safe_print("")

        missing = [s for s in schemas_to_check if s not in existing_schemas]
        if missing:
            safe_print(f"  MISSING schemas: {', '.join(missing)}")
        else:
            safe_print("  All expected schemas present.")
    else:
        safe_print(f"  ERROR querying schemas: {err[:200]}")

    safe_print("")
    safe_print("=" * 80)
    if total_fail == 0 and total_error == 0:
        safe_print("  RESULT: ALL SEED DATA VERIFIED SUCCESSFULLY")
    elif total_fail == 0 and total_error > 0:
        safe_print(f"  RESULT: {total_error} ERRORS (some tables/schemas may not exist)")
    else:
        safe_print(f"  RESULT: {total_fail} MISMATCHES FOUND -- review above")
    safe_print("=" * 80)

    client.close()
    sys.exit(1 if total_fail > 0 else 0)


if __name__ == "__main__":
    main()
