"""
Create PAID (Programme Activity Information Database) template + campaign via API.
Full 5W form: WHEN, WHERE, WHO, WHAT, WHOM — 33 fields matching AU-IBAR PAID Excel.
Computed fields (Y, AA, AD, AF) handled client-side in apps/web/src/lib/paid/.
"""
import paramiko, json, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SSH_PASS = "@u-1baR.0rg$U24"

# ── Connect ──
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.183", username="arisadmin", password=SSH_PASS,
            timeout=15, allow_agent=False, look_for_keys=False)

# ── Auth ──
_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    """-d '{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}' 2>/dev/null""",
    timeout=15)
token = json.loads(stdout.read().decode())["data"]["accessToken"]
print(f"Authenticated (token ...{token[-8:]})")

def api_post(path, body):
    data = json.dumps(body)
    chan = ssh.get_transport().open_session()
    chan.settimeout(30)
    chan.exec_command(
        f'curl -sk -X POST "https://localhost{path}" '
        f'-H "Authorization: Bearer {token}" '
        f'-H "Content-Type: application/json" '
        f'--data-binary @- 2>/dev/null'
    )
    chan.sendall(data.encode())
    chan.shutdown_write()
    time.sleep(3)
    resp = b''
    for _ in range(10):
        if chan.recv_ready():
            resp += chan.recv(65536)
        elif chan.exit_status_ready():
            while chan.recv_ready():
                resp += chan.recv(65536)
            break
        time.sleep(0.5)
    return json.loads(resp.decode())

# ── Helper: field builder ──
def field(fid, ftype, code, label_en, label_fr, order, col=1, span=1,
          required=False, props=None, validation=None, conditions=None):
    return {
        "id": fid, "type": ftype, "code": code,
        "label": {"en": label_en, "fr": label_fr},
        "column": col, "columnSpan": span, "order": order,
        "required": required, "readOnly": False, "hidden": False,
        "validation": validation or {},
        "conditions": conditions or [],
        "properties": props or {}
    }

def select_opts(*pairs):
    """Build select options: [("val", "EN", "FR"), ...]"""
    return {"options": [{"value": v, "label": {"en": en, "fr": fr}} for v, en, fr in pairs]}

# ── PAID Sectors ──
SECTORS = select_opts(
    ("Agriculture", "Agriculture", "Agriculture"),
    ("Environment", "Environment", "Environnement"),
    ("Fishery", "Fishery", "Pêche"),
    ("Forestry", "Forestry", "Sylviculture"),
    ("Land and Water", "Land and Water", "Terre et eau"),
    ("Livelihoods and cash", "Livelihoods and cash", "Moyens de subsistance et cash"),
    ("Livestock", "Livestock", "Élevage"),
    ("Nutrition and Human health", "Nutrition and Human health", "Nutrition et santé humaine"),
    ("Social protection", "Social protection", "Protection sociale"),
)

QUARTERS = select_opts(
    ("Q1", "Q1 (Jan-Mar)", "T1 (Jan-Mar)"),
    ("Q2", "Q2 (Apr-Jun)", "T2 (Avr-Jun)"),
    ("Q3", "Q3 (Jul-Sep)", "T3 (Jul-Sep)"),
    ("Q4", "Q4 (Oct-Dec)", "T4 (Oct-Déc)"),
)

MULTI_COUNTRY = select_opts(
    ("Single", "Single country", "Pays unique"),
    ("Multiple", "Multiple countries", "Plusieurs pays"),
)

EXEC_PARTNERS = select_opts(
    ("FAO", "FAO", "FAO"),
    ("Government", "Government", "Gouvernement"),
)

CASH_PLUS = select_opts(
    ("Yes", "Yes", "Oui"),
    ("No", "No", "Non"),
    ("Not specified", "Not specified", "Non spécifié"),
)

CASH_MECHANISMS = select_opts(
    ("Bank transfer", "Bank transfer", "Virement bancaire"),
    ("Electronic voucher", "Electronic voucher", "Bon électronique"),
    ("Mobile money", "Mobile money", "Argent mobile"),
    ("Other electronic cash", "Other electronic cash", "Autre cash électronique"),
    ("Paper voucher", "Paper voucher", "Bon papier"),
    ("Physical cash", "Physical cash", "Cash physique"),
)

# ══════════════════════════════════════════════════════════════════════
#  PAID Template — 33 fields, 6 sections (5W + Comments)
# ══════════════════════════════════════════════════════════════════════

template = {
    "name": "PAID — Programme Activity Information Database",
    "domain": "paid",
    "formType": "CAMPAIGN",
    "dataClassification": "PARTNER",
    "schema": {
        "sections": [
            # ═══════ SECTION 1: WHEN ═══════
            {
                "id": "when", "name": {"en": "WHEN", "fr": "QUAND"},
                "order": 0, "columns": 2,
                "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [
                    field("reporting_quarter", "select", "reporting_quarter",
                          "Reporting Period", "Période de rapport", 0, 1, 1, True, QUARTERS),
                    field("year", "number", "year",
                          "Year", "Année", 1, 2, 1, True, {}, {"min": 2020, "max": 2030}),
                ]
            },

            # ═══════ SECTION 2: WHERE ═══════
            {
                "id": "where", "name": {"en": "WHERE", "fr": "OÙ"},
                "order": 1, "columns": 2,
                "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [
                    field("multicountry", "select", "multicountry",
                          "Project with Single/Multiple country",
                          "Le projet couvre un seul/plusieurs pays",
                          0, 1, 1, True, MULTI_COUNTRY),
                    field("admin_location", "admin-location", "admin_location",
                          "Country / Admin1 / Admin2",
                          "Pays / Admin1 / Admin2",
                          1, 1, 2, True,
                          {"levels": [0, 1, 2], "requiredLevels": [0]}),
                    field("prj_symbol", "text", "prj_symbol",
                          "Project Symbol", "Symbole du projet",
                          2, 1, 1, True),
                    field("prj_title", "text", "prj_title",
                          "Project Title", "Titre du projet",
                          3, 2, 1, False),
                ]
            },

            # ═══════ SECTION 3: WHO ═══════
            {
                "id": "who", "name": {"en": "WHO", "fr": "QUI"},
                "order": 2, "columns": 3,
                "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [
                    field("executive_partner", "select", "executive_partner",
                          "Executive Partner", "Partenaire exécutif",
                          0, 1, 1, False, EXEC_PARTNERS),
                    field("implem_partner_intl", "text", "implem_partner_intl",
                          "Implementing Partner (International)",
                          "Partenaire de mise en œuvre (International)",
                          1, 2, 1, False),
                    field("implem_partner_local", "text", "implem_partner_local",
                          "Implementing Partner (National/NGO)",
                          "Partenaire de mise en œuvre (National/ONG)",
                          2, 3, 1, False),
                ]
            },

            # ═══════ SECTION 4: WHAT ═══════
            {
                "id": "what", "name": {"en": "WHAT", "fr": "QUOI"},
                "order": 3, "columns": 3,
                "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [
                    field("prod_sector", "select", "prod_sector",
                          "Sector of Production", "Secteur de production",
                          0, 1, 1, True, SECTORS),
                    field("activity_type", "text", "activity_type",
                          "Type of Activity/Output", "Type d'activité/sortie",
                          1, 2, 1, True),
                    field("cva_delivery", "select", "cva_delivery",
                          "Cash and Voucher Delivery Mechanism",
                          "Mécanisme de distribution cash et bons",
                          2, 3, 1, False, CASH_MECHANISMS),
                    field("cash_amount", "number", "cash_amount",
                          "Cash Amount Distributed (USD)",
                          "Montant cash distribué (USD)",
                          3, 1, 1, False, {}, {"min": 0}),
                    field("cash_plus", "select", "cash_plus",
                          "Cash+", "Cash+",
                          4, 2, 1, False, CASH_PLUS),
                    field("species_variety", "text", "species_variety",
                          "Species/Variety Related",
                          "Espèce/Variété associée",
                          5, 3, 1, False),
                    field("prod_system", "text", "prod_system",
                          "Production System (FAO)",
                          "Système de production (FAO)",
                          6, 1, 1, False),
                    field("disease_pest", "text", "disease_pest",
                          "Disease/Pest Related",
                          "Maladie/Ravageur associé",
                          7, 2, 1, False),
                    field("unit_of_measure", "text", "unit_of_measure",
                          "Unit of Measure", "Unité de mesure",
                          8, 3, 1, False),
                    field("quantity_implemented", "number", "quantity_implemented",
                          "Quantity Implemented (n)",
                          "Quantité réalisée (n)",
                          9, 1, 1, True, {}, {"min": 0}),
                    field("quantity_targeted_annual", "number", "quantity_targeted_annual",
                          "Total Annual Quantity Targeted (n)",
                          "Quantité annuelle totale visée (n)",
                          10, 2, 1, True, {}, {"min": 0}),
                    field("budget_proportion", "number", "budget_proportion",
                          "Budget Proportion for Activity (%)",
                          "Part du budget pour l'activité (%)",
                          11, 3, 1, False, {}, {"min": 0, "max": 100}),
                ]
            },

            # ═══════ SECTION 5: WHOM ═══════
            {
                "id": "whom", "name": {"en": "WHOM", "fr": "POUR QUI"},
                "order": 4, "columns": 3,
                "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [
                    # Manual entry fields
                    field("n_hh_benefitting", "number", "n_hh_benefitting",
                          "No. of HH Benefiting from Intervention",
                          "Nombre de ménages bénéficiant de l'intervention",
                          0, 1, 1, False, {}, {"min": 0}),
                    field("n_interv_per_hh", "number", "n_interv_per_hh",
                          "# Interventions per HH (anti-double-counting)",
                          "# Interventions par ménage (anti-double-comptage)",
                          1, 2, 1, False, {}, {"min": 1}),
                    field("n_female_trained", "number", "n_female_trained",
                          "# Female Trained",
                          "# Femmes formées",
                          2, 1, 1, False, {}, {"min": 0}),
                    field("n_male_trained", "number", "n_male_trained",
                          "# Male Trained",
                          "# Hommes formés",
                          3, 2, 1, False, {}, {"min": 0}),
                    # NOTE: Computed fields (Y, AA, AD, AE, AF) are calculated
                    # client-side by apps/web/src/lib/paid/computed-fields.ts
                    # They don't need form fields — they're computed on display.
                ]
            },

            # ═══════ SECTION 6: COMMENTS + GPS ═══════
            {
                "id": "comments_gps", "name": {"en": "Comments & Location", "fr": "Commentaires & Localisation"},
                "order": 5, "columns": 1,
                "isCollapsible": True, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [
                    field("comments", "textarea", "comments",
                          "Comments", "Commentaires",
                          0, 1, 1, False),
                    field("geo_location", "geo-selector", "geo_location",
                          "GPS Coordinates", "Coordonnées GPS",
                          1, 1, 1, False,
                          {"modes": ["point"], "defaultMode": "point"}),
                ]
            },
        ],
        "settings": {
            "allowDraft": True,
            "allowAttachments": True,
            "maxAttachments": 5,
            "allowOffline": True,
            "requireGeoLocation": False,
            "autoSaveInterval": 30,
            "submissionWorkflow": "review_then_validate",
            "notifyOnSubmit": [],
            "duplicateDetection": {"enabled": False, "fields": []}
        }
    }
}

# ══════════════════════════════════════════════════════════════════════
#  Create template + publish + create campaign
# ══════════════════════════════════════════════════════════════════════

ALL_55 = [
    "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI",
    "DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR",
    "LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN",
    "SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW"
]

print("\n1. Creating PAID template...")
r = api_post("/api/v1/form-builder/templates", template)
if not r.get("data", {}).get("id"):
    print(f"   FAILED: {r.get('message', r)}")
    ssh.close()
    sys.exit(1)

tid = r["data"]["id"]
print(f"   Template ID: {tid}")

print("2. Publishing template...")
r2 = api_post(f"/api/v1/form-builder/templates/{tid}/publish", {})
print(f"   Status: {r2.get('data', {}).get('status', '?')}")

print("3. Creating PAID Q2 2026 campaign...")
r3 = api_post("/api/v1/workflow/campaigns", {
    "code": "PAID_Q2_2026",
    "name": {
        "en": "PAID Q2 2026 — Programme Activity Information Database",
        "fr": "PAID T2 2026 — Base de données d'information sur les activités",
        "pt": "PAID Q2 2026 — Base de dados de informação sobre actividades"
    },
    "description": {
        "en": "Quarterly collection of AU-IBAR programme activity data using the 5W methodology (When, Where, Who, What, Whom). Covers all 9 sectors across 55 AU Member States.",
        "fr": "Collecte trimestrielle des données d'activités des programmes AU-IBAR selon la méthodologie 5W. Couvre les 9 secteurs pour les 55 États membres de l'UA."
    },
    "domain": "paid",
    "formTemplateId": tid,
    "startDate": "2026-04-01",
    "endDate": "2026-06-30",
    "targetCountries": ALL_55,
    "targetSubmissions": 550,    # ~10 submissions per country (multiple projects)
    "targetPerAgent": 10,
    "frequency": "quarterly",
    "scope": "continental",
    "sendReminders": True,
    "reminderDaysBefore": 7,
    "status": "ACTIVE"
})
if r3.get("data", {}).get("id"):
    cid = r3["data"]["id"]
    print(f"   Campaign ID: {cid}")
else:
    print(f"   Campaign error: {r3.get('message', r3)}")

# Also create the annual campaign
print("4. Creating PAID Annual 2026 campaign...")
r4 = api_post("/api/v1/workflow/campaigns", {
    "code": "PAID_ANNUAL_2026",
    "name": {
        "en": "PAID 2026 — Annual Programme Activity Report",
        "fr": "PAID 2026 — Rapport annuel d'activités des programmes"
    },
    "description": {
        "en": "Annual compilation of all programme activities across AU-IBAR projects for 2026.",
        "fr": "Compilation annuelle de toutes les activités des programmes AU-IBAR pour 2026."
    },
    "domain": "paid",
    "formTemplateId": tid,
    "startDate": "2026-01-01",
    "endDate": "2026-12-31",
    "targetCountries": ALL_55,
    "targetSubmissions": 2200,
    "targetPerAgent": 40,
    "frequency": "annual",
    "scope": "continental",
    "sendReminders": True,
    "reminderDaysBefore": 14,
    "status": "ACTIVE"
})
if r4.get("data", {}).get("id"):
    print(f"   Annual Campaign ID: {r4['data']['id']}")
else:
    print(f"   Annual campaign error: {r4.get('message', r4)}")

ssh.close()
print("\nDONE — PAID template + 2 campaigns created.")
print(f"Template ID: {tid}")
print("Next: update apps/web/src/app/(dashboard)/paid/page.tsx with this template ID if needed.")
