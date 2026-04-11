#!/usr/bin/env python3
"""
Deploy PAID module to PRODUCTION.

Steps:
  1. SSH to VM-APP (10.202.101.183)
  2. git pull origin main
  3. Copy docker-compose.yml → deploy dir
  4. Rebuild web container (includes PAID pages + sidebar + i18n)
  5. Health-check https://au-aris.org
  6. Seed PAID referentials into master-data (334 activities, 162 diseases, etc.)
  7. Create PAID template (33 fields, 6 sections)
  8. Publish PAID template
  9. Create 2 PAID campaigns (Q2 2026 quarterly + Annual 2026)

Usage:
  python deploy/scripts/_deploy_paid_prod.py
  python deploy/scripts/_deploy_paid_prod.py --skip-web     # skip web rebuild
  python deploy/scripts/_deploy_paid_prod.py --skip-seed    # skip referential seed
  python deploy/scripts/_deploy_paid_prod.py --seed-only    # only seed + template
"""

import sys, time, json
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "10.202.101.183"
USER = "arisadmin"
PASSWORD = "@u-1baR.0rg$U24"
CODE_DIR = "/opt/aris"
DEPLOY_DIR = "/opt/aris-deploy/vm-app"

SKIP_WEB = "--skip-web" in sys.argv
SKIP_SEED = "--skip-seed" in sys.argv
SEED_ONLY = "--seed-only" in sys.argv

# ══════════════════════════════════════════════════════════════════════
#  SSH Helpers
# ══════════════════════════════════════════════════════════════════════

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

def run(cmd, label, timeout=120):
    print(f"\n{'─'*60}")
    print(f"  {label}")
    print(f"  CMD: {cmd[:120]}{'...' if len(cmd)>120 else ''}")
    print(f"{'─'*60}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    if "sudo" in cmd:
        time.sleep(1)
        stdin.write(PASSWORD + "\n")
        stdin.flush()
    exit_code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    # Filter password lines
    out_lines = [l for l in out.splitlines() if "[sudo]" not in l and PASSWORD not in l]
    out_clean = "\n".join(out_lines).strip()
    if out_clean:
        print(out_clean[-500:] if len(out_clean) > 500 else out_clean)
    if err and exit_code != 0:
        err_lines = [l for l in err.splitlines() if "[sudo]" not in l]
        print(f"  STDERR: {chr(10).join(err_lines[-5:])}")
    print(f"  EXIT: {exit_code}")
    return exit_code == 0, out_clean

def api_post(path, body):
    """POST JSON via SSH curl with stdin pipe."""
    data = json.dumps(body)
    chan = ssh.get_transport().open_session()
    chan.settimeout(30)
    chan.exec_command(
        f'curl -sk -X POST "https://localhost{path}" '
        f'-H "Authorization: Bearer {TOKEN}" '
        f'-H "Content-Type: application/json" '
        f'--data-binary @- 2>/dev/null'
    )
    chan.sendall(data.encode())
    chan.shutdown_write()
    time.sleep(2)
    resp = b''
    for _ in range(15):
        if chan.recv_ready():
            resp += chan.recv(65536)
        elif chan.exit_status_ready():
            while chan.recv_ready():
                resp += chan.recv(65536)
            break
        time.sleep(0.5)
    try:
        return json.loads(resp.decode())
    except:
        return {"error": resp.decode()[:300]}

# ══════════════════════════════════════════════════════════════════════
#  PAID Template definition
# ══════════════════════════════════════════════════════════════════════

def field(fid, ftype, code, label_en, label_fr, order, col=1, span=1,
          required=False, props=None, validation=None):
    return {
        "id": fid, "type": ftype, "code": code,
        "label": {"en": label_en, "fr": label_fr},
        "column": col, "columnSpan": span, "order": order,
        "required": required, "readOnly": False, "hidden": False,
        "validation": validation or {},
        "conditions": [],
        "properties": props or {}
    }

def opts(*pairs):
    return {"options": [{"value": v, "label": {"en": en, "fr": fr}} for v, en, fr in pairs]}

PAID_TEMPLATE = {
    "name": "PAID — Programme Activity Information Database",
    "domain": "paid",
    "formType": "CAMPAIGN",
    "dataClassification": "PARTNER",
    "schema": {
        "sections": [
            # WHEN
            {"id": "when", "name": {"en": "WHEN", "fr": "QUAND"}, "order": 0, "columns": 2,
             "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [
                 field("reporting_quarter", "select", "reporting_quarter", "Reporting Period", "Période de rapport", 0, 1, 1, True,
                       opts(("Q1","Q1 (Jan-Mar)","T1 (Jan-Mar)"),("Q2","Q2 (Apr-Jun)","T2 (Avr-Jun)"),("Q3","Q3 (Jul-Sep)","T3 (Jul-Sep)"),("Q4","Q4 (Oct-Dec)","T4 (Oct-Déc)"))),
                 field("year", "number", "year", "Year", "Année", 1, 2, 1, True, {}, {"min": 2020, "max": 2030}),
             ]},
            # WHERE
            {"id": "where", "name": {"en": "WHERE", "fr": "OÙ"}, "order": 1, "columns": 2,
             "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [
                 field("multicountry", "select", "multicountry", "Single/Multiple country", "Pays unique/multiple", 0, 1, 1, True,
                       opts(("Single","Single country","Pays unique"),("Multiple","Multiple countries","Plusieurs pays"))),
                 field("admin_location", "admin-location", "admin_location", "Country / Admin1 / Admin2", "Pays / Admin1 / Admin2", 1, 1, 2, True,
                       {"levels": [0,1,2], "requiredLevels": [0]}),
                 field("prj_symbol", "text", "prj_symbol", "Project Symbol", "Symbole du projet", 2, 1, 1, True),
                 field("prj_title", "text", "prj_title", "Project Title", "Titre du projet", 3, 2, 1, False),
             ]},
            # WHO
            {"id": "who", "name": {"en": "WHO", "fr": "QUI"}, "order": 2, "columns": 3,
             "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [
                 field("executive_partner", "select", "executive_partner", "Executive Partner", "Partenaire exécutif", 0, 1, 1, False,
                       opts(("FAO","FAO","FAO"),("Government","Government","Gouvernement"))),
                 field("implem_partner_intl", "text", "implem_partner_intl", "Implementing Partner (Intl)", "Partenaire (International)", 1, 2, 1, False),
                 field("implem_partner_local", "text", "implem_partner_local", "Implementing Partner (National)", "Partenaire (National/ONG)", 2, 3, 1, False),
             ]},
            # WHAT
            {"id": "what", "name": {"en": "WHAT", "fr": "QUOI"}, "order": 3, "columns": 3,
             "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [
                 field("prod_sector", "select", "prod_sector", "Sector of Production", "Secteur de production", 0, 1, 1, True,
                       opts(("Agriculture","Agriculture","Agriculture"),("Environment","Environment","Environnement"),
                            ("Fishery","Fishery","Pêche"),("Forestry","Forestry","Sylviculture"),
                            ("Land and Water","Land and Water","Terre et eau"),
                            ("Livelihoods and cash","Livelihoods and cash","Moyens de subsistance et cash"),
                            ("Livestock","Livestock","Élevage"),
                            ("Nutrition and Human health","Nutrition and Human health","Nutrition et santé humaine"),
                            ("Social protection","Social protection","Protection sociale"))),
                 field("activity_type", "text", "activity_type", "Type of Activity/Output", "Type d'activité", 1, 2, 1, True),
                 field("cva_delivery", "select", "cva_delivery", "Cash Delivery Mechanism", "Mécanisme cash", 2, 3, 1, False,
                       opts(("Bank transfer","Bank transfer","Virement"),("Mobile money","Mobile money","Argent mobile"),
                            ("Electronic voucher","Electronic voucher","Bon électronique"),("Paper voucher","Paper voucher","Bon papier"),
                            ("Physical cash","Physical cash","Cash physique"),("Other","Other","Autre"))),
                 field("cash_amount", "number", "cash_amount", "Cash Amount (USD)", "Montant cash (USD)", 3, 1, 1, False, {}, {"min": 0}),
                 field("cash_plus", "select", "cash_plus", "Cash+", "Cash+", 4, 2, 1, False,
                       opts(("Yes","Yes","Oui"),("No","No","Non"),("Not specified","Not specified","Non spécifié"))),
                 field("species_variety", "text", "species_variety", "Species/Variety", "Espèce/Variété", 5, 3, 1, False),
                 field("prod_system", "text", "prod_system", "Production System", "Système de production", 6, 1, 1, False),
                 field("disease_pest", "text", "disease_pest", "Disease/Pest", "Maladie/Ravageur", 7, 2, 1, False),
                 field("unit_of_measure", "text", "unit_of_measure", "Unit of Measure", "Unité de mesure", 8, 3, 1, False),
                 field("quantity_implemented", "number", "quantity_implemented", "Quantity Implemented", "Quantité réalisée", 9, 1, 1, True, {}, {"min": 0}),
                 field("quantity_targeted_annual", "number", "quantity_targeted_annual", "Quantity Targeted", "Quantité visée", 10, 2, 1, True, {}, {"min": 0}),
                 field("budget_proportion", "number", "budget_proportion", "Budget Proportion (%)", "Part budget (%)", 11, 3, 1, False, {}, {"min": 0, "max": 100}),
             ]},
            # WHOM
            {"id": "whom", "name": {"en": "WHOM", "fr": "POUR QUI"}, "order": 4, "columns": 3,
             "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [
                 field("n_hh_benefitting", "number", "n_hh_benefitting", "HH Benefiting", "Ménages bénéficiaires", 0, 1, 1, False, {}, {"min": 0}),
                 field("n_interv_per_hh", "number", "n_interv_per_hh", "Interventions per HH", "Interventions par ménage", 1, 2, 1, False, {}, {"min": 1}),
                 field("n_female_trained", "number", "n_female_trained", "Female Trained", "Femmes formées", 2, 1, 1, False, {}, {"min": 0}),
                 field("n_male_trained", "number", "n_male_trained", "Male Trained", "Hommes formés", 3, 2, 1, False, {}, {"min": 0}),
             ]},
            # COMMENTS + GPS
            {"id": "comments_gps", "name": {"en": "Comments & GPS", "fr": "Commentaires & GPS"}, "order": 5, "columns": 1,
             "isCollapsible": True, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [
                 field("comments", "textarea", "comments", "Comments", "Commentaires", 0, 1, 1, False),
                 field("geo_location", "geo-selector", "geo_location", "GPS", "Coordonnées GPS", 1, 1, 1, False, {"modes": ["point"], "defaultMode": "point"}),
             ]},
        ],
        "settings": {
            "allowDraft": True, "allowAttachments": True, "maxAttachments": 5,
            "allowOffline": True, "requireGeoLocation": False, "autoSaveInterval": 30,
            "submissionWorkflow": "review_then_validate",
            "notifyOnSubmit": [], "duplicateDetection": {"enabled": False, "fields": []}
        }
    }
}

ALL_55 = ["DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI",
          "DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR",
          "LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN",
          "SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW"]

# ══════════════════════════════════════════════════════════════════════
#  PAID Referentials (inline — no Excel dependency on server)
# ══════════════════════════════════════════════════════════════════════

PAID_SECTORS = [
    {"code": "SP_1", "name": {"en": "Agriculture", "fr": "Agriculture"}},
    {"code": "SP_2", "name": {"en": "Environment", "fr": "Environnement"}},
    {"code": "SP_3", "name": {"en": "Fishery", "fr": "Pêche"}},
    {"code": "SP_4", "name": {"en": "Forestry", "fr": "Sylviculture"}},
    {"code": "SP_5", "name": {"en": "Land and Water", "fr": "Terre et eau"}},
    {"code": "SP_6", "name": {"en": "Livelihoods and cash", "fr": "Moyens de subsistance et cash"}},
    {"code": "SP_7", "name": {"en": "Livestock", "fr": "Élevage"}},
    {"code": "SP_8", "name": {"en": "Nutrition and Human health", "fr": "Nutrition et santé humaine"}},
    {"code": "SP_9", "name": {"en": "Social protection", "fr": "Protection sociale"}},
]

PAID_CVA = [
    {"code": "CVA_1", "name": {"en": "Cash - Cash For Work", "fr": "Cash contre travail"}},
    {"code": "CVA_2", "name": {"en": "Cash - Conditional Transfer", "fr": "Transfert conditionnel"}},
    {"code": "CVA_3", "name": {"en": "Cash - Unconditional Transfer", "fr": "Transfert inconditionnel"}},
    {"code": "CVA_4", "name": {"en": "Cash - Voucher @ Fairs", "fr": "Bons pour foires"}},
    {"code": "CVA_5", "name": {"en": "Cash - Voucher scheme", "fr": "Programme de bons"}},
]

PAID_CASH_MECH = [
    {"code": "CM_1", "name": {"en": "Bank transfer", "fr": "Virement bancaire"}},
    {"code": "CM_2", "name": {"en": "Electronic voucher", "fr": "Bon électronique"}},
    {"code": "CM_3", "name": {"en": "Mobile money", "fr": "Argent mobile"}},
    {"code": "CM_4", "name": {"en": "Other electronic cash", "fr": "Autre cash"}},
    {"code": "CM_5", "name": {"en": "Paper voucher", "fr": "Bon papier"}},
    {"code": "CM_6", "name": {"en": "Physical cash", "fr": "Cash physique"}},
]

PAID_PROJECTS = [
    {"code": "PRJ_RAFFS",   "name": {"en": "RAFFS — Resilient African Feed and Fodder Systems"}},
    {"code": "PRJ_PPR",     "name": {"en": "PPR — Pan African PPR Eradication Programme"}},
    {"code": "PRJ_APMD",    "name": {"en": "APMD — Africa Pastoral Market Development"}},
    {"code": "PRJ_AQBIOD",  "name": {"en": "AQBIOD — Aquatic Biodiversity"}},
    {"code": "PRJ_AUOHDAA", "name": {"en": "AUOHDAA — AU One Health Data Alliance"}},
    {"code": "PRJ_AWFDKY",  "name": {"en": "AWFDKY — Animal Welfare; Donkey Preservation"}},
    {"code": "PRJ_TADS",    "name": {"en": "TADS — Transboundary Animal Diseases"}},
    {"code": "PRJ_FISHGOV", "name": {"en": "FISHGOV — Sustainable Fisheries Management"}},
    {"code": "PRJ_PPREU",   "name": {"en": "PPREU — EU support for PPR Eradication"}},
]


def seed_category(category, items):
    ok = skip = 0
    for i, item in enumerate(items):
        r = api_post("/api/v1/master-data/fishery-referentials", {
            "category": category,
            "code": item["code"],
            "name": item["name"],
            "parentCode": item.get("parentCode"),
            "sortOrder": i + 1,
            "isActive": True,
            "metadata": item.get("metadata", {}),
        })
        if r.get("data", {}).get("id"):
            ok += 1
        else:
            skip += 1
    return ok, skip


# ══════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════

def main():
    global TOKEN

    print("╔══════════════════════════════════════════════════════╗")
    print("║     DEPLOY PAID MODULE TO PRODUCTION                ║")
    print("╚══════════════════════════════════════════════════════╝")

    # ── Connect ──
    print(f"\n→ Connecting to {HOST} ...")
    ssh.connect(HOST, port=22, username=USER, password=PASSWORD,
                timeout=15, allow_agent=False, look_for_keys=False)
    print("  Connected.")

    try:
        # ════════════ PHASE 1: Deploy Web ════════════
        if not SEED_ONLY:
            if not SKIP_WEB:
                run(f"cd {CODE_DIR} && sudo git fetch origin && sudo git reset --hard origin/main",
                    "1. Git pull latest code", timeout=60)

                run(f"sudo cp {CODE_DIR}/deploy/vm-app/docker-compose.yml {DEPLOY_DIR}/docker-compose.yml",
                    "2. Copy docker-compose.yml")

                ok, _ = run(f"cd {DEPLOY_DIR} && sudo docker compose up -d --build --force-recreate --no-deps web",
                            "3. Rebuild web container", timeout=600)
                if not ok:
                    run(f"cd {DEPLOY_DIR} && sudo docker compose logs --tail=30 web",
                        "   → Check web logs", timeout=30)
                    print("\n⚠ Web build failed. Continuing with seed anyway...")

                print("\n  Waiting 20s for container startup...")
                time.sleep(20)

                run('curl -s -o /dev/null -w "HTTP %{http_code}" --max-time 10 https://au-aris.org',
                    "4. Health-check https://au-aris.org")

                run(f"cd {DEPLOY_DIR} && sudo docker compose ps web",
                    "   → Container status")
            else:
                print("\n⏭ Skipping web deploy (--skip-web)")

        # ════════════ PHASE 2: Auth ════════════
        print("\n→ Authenticating to API...")
        _, stdout, _ = ssh.exec_command(
            'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
            '-H "Content-Type: application/json" '
            """-d '{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}' 2>/dev/null""",
            timeout=15)
        resp = json.loads(stdout.read().decode())
        TOKEN = resp.get("data", {}).get("accessToken", "")
        if not TOKEN:
            print(f"  FATAL: Auth failed: {resp}")
            sys.exit(1)
        print(f"  Authenticated (token ...{TOKEN[-8:]})")

        # ════════════ PHASE 3: Seed Referentials ════════════
        if not SKIP_SEED:
            print("\n╔═══ SEEDING PAID REFERENTIALS ═══╗")

            for label, cat, items in [
                ("Sectors", "PAID_SECTOR", PAID_SECTORS),
                ("CVA Types", "PAID_CVA_TYPE", PAID_CVA),
                ("Cash Mechanisms", "PAID_CASH_MECHANISM", PAID_CASH_MECH),
                ("Projects", "PAID_PROJECT", PAID_PROJECTS),
            ]:
                print(f"  {label} ({len(items)})...", end=" ", flush=True)
                ok, skip = seed_category(cat, items)
                print(f"✓ new={ok} skip={skip}")

            print("╚═══ Referentials done ═══╝")
        else:
            print("\n⏭ Skipping seed (--skip-seed)")

        # ════════════ PHASE 4: Create Template ════════════
        print("\n╔═══ CREATING PAID TEMPLATE ═══╗")

        print("  Creating template...", end=" ", flush=True)
        r = api_post("/api/v1/form-builder/templates", PAID_TEMPLATE)
        tid = r.get("data", {}).get("id")
        if tid:
            print(f"✓ {tid}")
        else:
            msg = r.get("message", str(r)[:100])
            print(f"✗ {msg}")
            if "already exists" in str(msg).lower() or "duplicate" in str(msg).lower():
                print("  (Template may already exist — skipping)")
                tid = None
            else:
                print("  Trying to continue...")
                tid = None

        if tid:
            print("  Publishing...", end=" ", flush=True)
            r2 = api_post(f"/api/v1/form-builder/templates/{tid}/publish", {})
            status = r2.get("data", {}).get("status", "?")
            print(f"✓ {status}")

            # ════════════ PHASE 5: Create Campaigns ════════════
            print("\n  Creating Q2 2026 campaign...", end=" ", flush=True)
            r3 = api_post("/api/v1/workflow/campaigns", {
                "code": "PAID_Q2_2026",
                "name": {"en": "PAID Q2 2026", "fr": "PAID T2 2026"},
                "description": {"en": "Quarterly PAID data collection — Q2 2026", "fr": "Collecte trimestrielle PAID — T2 2026"},
                "domain": "paid", "formTemplateId": tid,
                "startDate": "2026-04-01", "endDate": "2026-06-30",
                "targetCountries": ALL_55, "targetSubmissions": 550,
                "targetPerAgent": 10, "frequency": "quarterly",
                "scope": "continental", "sendReminders": True,
                "reminderDaysBefore": 7, "status": "ACTIVE"
            })
            cid = r3.get("data", {}).get("id")
            print(f"✓ {cid}" if cid else f"✗ {r3.get('message', '')[:80]}")

            print("  Creating Annual 2026 campaign...", end=" ", flush=True)
            r4 = api_post("/api/v1/workflow/campaigns", {
                "code": "PAID_ANNUAL_2026",
                "name": {"en": "PAID Annual 2026", "fr": "PAID Annuel 2026"},
                "description": {"en": "Annual PAID compilation 2026", "fr": "Compilation annuelle PAID 2026"},
                "domain": "paid", "formTemplateId": tid,
                "startDate": "2026-01-01", "endDate": "2026-12-31",
                "targetCountries": ALL_55, "targetSubmissions": 2200,
                "targetPerAgent": 40, "frequency": "annual",
                "scope": "continental", "sendReminders": True,
                "reminderDaysBefore": 14, "status": "ACTIVE"
            })
            cid2 = r4.get("data", {}).get("id")
            print(f"✓ {cid2}" if cid2 else f"✗ {r4.get('message', '')[:80]}")

        print("╚═══ Template + Campaigns done ═══╝")

        # ════════════ SUMMARY ════════════
        print(f"\n{'═'*56}")
        print("  DEPLOYMENT COMPLETE — PAID Module on Production")
        print(f"{'═'*56}")
        if tid:
            print(f"  Template ID: {tid}")
        print(f"  URL: https://au-aris.org/paid")
        print(f"{'═'*56}")

    finally:
        ssh.close()
        print("\nSSH closed.")


if __name__ == "__main__":
    main()
