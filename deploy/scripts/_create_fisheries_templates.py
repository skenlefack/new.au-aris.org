"""
Create 5 Fisheries form-builder templates + publish + campaigns via SSH API.

Templates:
  1. Monthly Captures Report
  2. Vessel Registry
  3. Aquaculture Farm Report
  4. Fishing Effort Quarterly
  5. Fish Trade Report

After running, update the TEMPLATE_IDs in:
  apps/web/src/app/(dashboard)/fisheries/{captures,vessels,aquaculture,efforts,trade}/page.tsx
"""
import paramiko, json, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Connection ──────────────────────────────────────────────
SSH_HOST = "10.202.101.183"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
LOGIN_EMAIL = "admin@au-aris.org"
LOGIN_PASS = "Aris2026@@4!0"

ALL_55 = [
    "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ",
    "EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG",
    "MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN","SC","SL","SO",
    "ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW"
]

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f"Connecting to {SSH_HOST}...")
ssh.connect(SSH_HOST, username=SSH_USER, password=SSH_PASS, timeout=15,
            allow_agent=False, look_for_keys=False)

# ── Auth token ──────────────────────────────────────────────
_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    f"-d '{{\"email\":\"{LOGIN_EMAIL}\",\"password\":\"{LOGIN_PASS}\"}}' 2>/dev/null",
    timeout=15)
token = json.loads(stdout.read().decode())["data"]["accessToken"]
print("Authenticated.\n")

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
            resp += chan.recv(16384)
        elif chan.exit_status_ready():
            while chan.recv_ready():
                resp += chan.recv(16384)
            break
        time.sleep(0.5)
    return json.loads(resp.decode())


# ════════════════════════════════════════════════════════════════
# FIELD HELPERS
# ════════════════════════════════════════════════════════════════

def f_admin_location(order=0):
    return {"id": "admin_location", "type": "admin-location", "code": "admin_location",
            "label": {"en": "Administrative Location", "fr": "Localisation administrative"},
            "column": 1, "columnSpan": 2, "order": order, "required": True,
            "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
            "properties": {"levels": [0, 1, 2], "requiredLevels": [0]}}

def f_text(id, en, fr, order, required=True, col=1, span=1):
    return {"id": id, "type": "text", "code": id,
            "label": {"en": en, "fr": fr}, "column": col, "columnSpan": span,
            "order": order, "required": required, "readOnly": False, "hidden": False,
            "validation": {}, "conditions": [], "properties": {}}

def f_number(id, en, fr, order, required=True, col=1, span=1, min_val=None, max_val=None):
    v = {}
    if min_val is not None: v["min"] = min_val
    if max_val is not None: v["max"] = max_val
    return {"id": id, "type": "number", "code": id,
            "label": {"en": en, "fr": fr}, "column": col, "columnSpan": span,
            "order": order, "required": required, "readOnly": False, "hidden": False,
            "validation": v, "conditions": [], "properties": {}}

def f_date(id, en, fr, order, required=True, col=1, span=1):
    return {"id": id, "type": "date", "code": id,
            "label": {"en": en, "fr": fr}, "column": col, "columnSpan": span,
            "order": order, "required": required, "readOnly": False, "hidden": False,
            "validation": {}, "conditions": [], "properties": {}}

def f_select(id, en, fr, order, options, required=True, col=1, span=1):
    opts = [{"label": {"en": o[0], "fr": o[1] if len(o) > 1 else o[0]}, "value": o[0].lower().replace(" ", "_")} for o in options]
    return {"id": id, "type": "select", "code": id,
            "label": {"en": en, "fr": fr}, "column": col, "columnSpan": span,
            "order": order, "required": required, "readOnly": False, "hidden": False,
            "validation": {}, "conditions": [],
            "properties": {"options": opts}}

def f_select_v(id, en, fr, order, options, required=True, col=1, span=1):
    """Select with explicit value."""
    return {"id": id, "type": "select", "code": id,
            "label": {"en": en, "fr": fr}, "column": col, "columnSpan": span,
            "order": order, "required": required, "readOnly": False, "hidden": False,
            "validation": {}, "conditions": [],
            "properties": {"options": options}}

def f_textarea(id, en, fr, order, required=False, col=1, span=1):
    return {"id": id, "type": "textarea", "code": id,
            "label": {"en": en, "fr": fr}, "column": col, "columnSpan": span,
            "order": order, "required": required, "readOnly": False, "hidden": False,
            "validation": {}, "conditions": [], "properties": {}}

def f_geo(order=0):
    return {"id": "geo_location", "type": "geo-selector", "code": "geo_location",
            "label": {"en": "GPS Coordinates", "fr": "Coordonnées GPS"},
            "column": 1, "columnSpan": 1, "order": order, "required": False,
            "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
            "properties": {"modes": ["point"], "defaultMode": "point"}}

def section(id, en, fr, order, cols, fields, collapsible=False, collapsed=False):
    return {"id": id, "name": {"en": en, "fr": fr}, "order": order,
            "columns": cols, "isCollapsible": collapsible, "isCollapsed": collapsed,
            "isRepeatable": False, "conditions": [], "fields": fields}

SETTINGS = {
    "allowDraft": True, "allowAttachments": True, "maxAttachments": 5,
    "allowOffline": True, "requireGeoLocation": False, "autoSaveInterval": 30,
    "submissionWorkflow": "review_then_validate",
    "notifyOnSubmit": [], "duplicateDetection": {"enabled": False, "fields": []}
}

QUARTER_OPTIONS = [
    {"label": {"en": "Q1 (Jan-Mar)", "fr": "T1 (Jan-Mar)"}, "value": "Q1"},
    {"label": {"en": "Q2 (Apr-Jun)", "fr": "T2 (Avr-Jun)"}, "value": "Q2"},
    {"label": {"en": "Q3 (Jul-Sep)", "fr": "T3 (Jul-Sep)"}, "value": "Q3"},
    {"label": {"en": "Q4 (Oct-Dec)", "fr": "T4 (Oct-Déc)"}, "value": "Q4"},
]


# ════════════════════════════════════════════════════════════════
# 1. MONTHLY CAPTURES REPORT
# ════════════════════════════════════════════════════════════════

captures_template = {
    "name": "Monthly Captures Report",
    "domain": "fisheries",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            section("location", "Location", "Localisation", 0, 2, [f_admin_location()]),
            section("capture_info", "Capture Information", "Informations de capture", 1, 3, [
                f_text("species", "Species (scientific name)", "Espèce (nom scientifique)", 0, col=1),
                f_text("species_common", "Common Name", "Nom commun", 1, required=False, col=2),
                f_select("fishing_environment", "Environment", "Environnement", 2, [
                    ("Marine",), ("Inland", "Eaux continentales"), ("Brackish", "Saumâtre")
                ], col=3),
                f_text("fao_area", "FAO Area Code", "Code zone FAO", 3, col=1),
                f_select("catch_method", "Catch Method / Gear", "Méthode de pêche / Engin", 4, [
                    ("Purse seine", "Senne coulissante"), ("Gillnet", "Filet maillant"),
                    ("Longline", "Palangre"), ("Beach seine", "Senne de plage"),
                    ("Bottom trawl", "Chalut de fond"), ("Trawl", "Chalut"),
                    ("Hand line", "Ligne à main"), ("Trap", "Nasse"), ("Other", "Autre")
                ], col=2),
                f_select("production_type", "Production Type", "Type de production", 5, [
                    ("Artisanal",), ("Industrial", "Industrielle"), ("Subsistence",)
                ], col=3),
            ]),
            section("quantity_period", "Quantity & Period", "Quantité et période", 2, 3, [
                f_number("quantity_kg", "Quantity (kg)", "Quantité (kg)", 0, min_val=0, col=1),
                f_select_v("unit", "Unit", "Unité", 1, [
                    {"label": {"en": "kg"}, "value": "kg"},
                    {"label": {"en": "Tonnes"}, "value": "tonnes"},
                ], col=2),
                f_number("capture_year", "Year", "Année", 2, min_val=2020, max_val=2030, col=3),
                f_select_v("quarter", "Quarter", "Trimestre", 3, QUARTER_OPTIONS, required=False, col=1),
                f_text("landing_site", "Landing Site", "Site de débarquement", 4, required=False, col=2),
                f_date("capture_date", "Capture Date", "Date de capture", 5, required=False, col=3),
            ]),
            section("observations", "Observations", "Observations", 3, 1, [
                f_textarea("observations", "Additional Observations", "Observations", 0)
            ], collapsible=True),
            section("gps", "GPS", "GPS", 4, 1, [f_geo()], collapsible=True, collapsed=True),
        ],
        "settings": SETTINGS
    }
}


# ════════════════════════════════════════════════════════════════
# 2. VESSEL REGISTRY
# ════════════════════════════════════════════════════════════════

vessels_template = {
    "name": "Vessel Registry",
    "domain": "fisheries",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            section("location", "Location", "Localisation", 0, 2, [f_admin_location()]),
            section("vessel_id", "Vessel Identification", "Identification du navire", 1, 2, [
                f_text("vessel_name", "Vessel Name", "Nom du navire", 0, col=1),
                f_text("registration_number", "Registration Number", "Numéro d'immatriculation", 1, col=2),
                f_text("flag", "Flag State", "État du pavillon", 2, col=1),
                f_text("flag_code", "Flag Code (ISO)", "Code pavillon (ISO)", 3, required=False, col=2),
                f_select("vessel_type", "Vessel Type", "Type de navire", 4, [
                    ("Trawler", "Chalutier"), ("Purse seiner", "Senneur"),
                    ("Longliner", "Palangrier"), ("Gillnetter", "Fileyeur"),
                    ("Pole and line", "Canneur"), ("Other", "Autre")
                ], col=1),
                f_text("home_port", "Home Port", "Port d'attache", 5, col=2),
            ]),
            section("vessel_specs", "Specifications", "Caractéristiques", 2, 3, [
                f_number("length_meters", "Length (m)", "Longueur (m)", 0, col=1, min_val=0),
                f_number("tonnage", "Gross Tonnage (GT)", "Jauge brute (GT)", 1, col=2, min_val=0),
                f_number("engine_power", "Engine Power (HP)", "Puissance moteur (CV)", 2, required=False, col=3, min_val=0),
                f_number("crew_capacity", "Crew Capacity", "Capacité équipage", 3, required=False, col=1, min_val=0),
                f_number("year_built", "Year Built", "Année de construction", 4, required=False, col=2, min_val=1950, max_val=2030),
            ]),
            section("license", "License", "Licence", 3, 2, [
                f_select("license_status", "License Status", "Statut de licence", 0, [
                    ("Valid", "Valide"), ("Expired", "Expirée"),
                    ("Suspended", "Suspendue"), ("Pending", "En attente")
                ], col=1),
                f_date("license_expiry", "License Expiry Date", "Date d'expiration", 1, required=False, col=2),
                f_text("license_number", "License Number", "Numéro de licence", 2, required=False, col=1),
            ]),
            section("observations", "Observations", "Observations", 4, 1, [
                f_textarea("observations", "Additional Notes", "Notes complémentaires", 0)
            ], collapsible=True),
            section("gps", "GPS", "GPS", 5, 1, [f_geo()], collapsible=True, collapsed=True),
        ],
        "settings": SETTINGS
    }
}


# ════════════════════════════════════════════════════════════════
# 3. AQUACULTURE FARM REPORT
# ════════════════════════════════════════════════════════════════

aquaculture_template = {
    "name": "Aquaculture Farm Report",
    "domain": "fisheries",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            section("location", "Location", "Localisation", 0, 2, [f_admin_location()]),
            section("farm_info", "Farm Information", "Informations de la ferme", 1, 2, [
                f_text("farm_name", "Farm Name", "Nom de la ferme", 0, col=1),
                f_text("species", "Cultured Species", "Espèce cultivée", 1, col=2),
                f_select("farm_type", "Farm Type", "Type de ferme", 2, [
                    ("Pond", "Étang"), ("Cage",), ("Raceway", "Canal"),
                    ("Recirculating", "Recirculant"), ("Tank", "Bassin"), ("Other", "Autre")
                ], col=1),
                f_select("farm_status", "Operational Status", "Statut opérationnel", 3, [
                    ("Active", "Actif"), ("Inactive", "Inactif"),
                    ("Under construction", "En construction")
                ], col=2),
            ]),
            section("production", "Production & Area", "Production et superficie", 2, 3, [
                f_number("production_tonnes", "Annual Production (tonnes)", "Production annuelle (tonnes)", 0, col=1, min_val=0),
                f_number("area_hectares", "Area (hectares)", "Superficie (hectares)", 1, col=2, min_val=0),
                f_number("year", "Year", "Année", 2, col=3, min_val=2020, max_val=2030),
                f_number("stocking_density", "Stocking Density (fish/m²)", "Densité de peuplement (poissons/m²)", 3, required=False, col=1, min_val=0),
                f_number("feed_conversion_ratio", "Feed Conversion Ratio", "Taux de conversion alimentaire", 4, required=False, col=2, min_val=0),
                f_text("water_source", "Water Source", "Source d'eau", 5, required=False, col=3),
            ]),
            section("observations", "Observations", "Observations", 3, 1, [
                f_textarea("observations", "Additional Notes", "Notes complémentaires", 0)
            ], collapsible=True),
            section("gps", "GPS", "GPS", 4, 1, [f_geo()], collapsible=True, collapsed=True),
        ],
        "settings": SETTINGS
    }
}


# ════════════════════════════════════════════════════════════════
# 4. FISHING EFFORT QUARTERLY
# ════════════════════════════════════════════════════════════════

efforts_template = {
    "name": "Fishing Effort Quarterly",
    "domain": "fisheries",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            section("location", "Location", "Localisation", 0, 2, [f_admin_location()]),
            section("effort_info", "Effort Information", "Informations sur l'effort", 1, 3, [
                f_text("vessel_name", "Vessel Name", "Nom du navire", 0, col=1),
                f_select("effort_type", "Effort Type", "Type d'effort", 1, [
                    ("Days at Sea", "Jours en mer"), ("Hours Fished", "Heures de pêche"),
                    ("Trawl Hours", "Heures de chalutage"), ("Set Operations", "Opérations de calée"),
                    ("Number of Hooks", "Nombre d'hameçons"), ("Net Length", "Longueur de filet")
                ], col=2),
                f_number("effort_value", "Effort Value", "Valeur de l'effort", 2, col=3, min_val=0),
                f_select_v("effort_unit", "Unit", "Unité", 3, [
                    {"label": {"en": "Days", "fr": "Jours"}, "value": "days"},
                    {"label": {"en": "Hours", "fr": "Heures"}, "value": "hours"},
                    {"label": {"en": "Sets", "fr": "Calées"}, "value": "sets"},
                    {"label": {"en": "Hooks", "fr": "Hameçons"}, "value": "hooks"},
                    {"label": {"en": "Meters", "fr": "Mètres"}, "value": "meters"},
                ], col=1),
                f_select("gear_type", "Gear Type", "Type d'engin", 4, [
                    ("Purse seine", "Senne coulissante"), ("Gillnet", "Filet maillant"),
                    ("Longline", "Palangre"), ("Bottom trawl", "Chalut de fond"),
                    ("Beach seine", "Senne de plage"), ("Trap", "Nasse"), ("Other", "Autre")
                ], col=2),
                f_number("crew_size", "Crew Size", "Taille de l'équipage", 5, required=False, col=3, min_val=0),
            ]),
            section("period", "Period", "Période", 2, 3, [
                f_date("start_date", "Start Date", "Date de début", 0, col=1),
                f_date("end_date", "End Date", "Date de fin", 1, col=2),
                f_select_v("quarter", "Quarter", "Trimestre", 2, QUARTER_OPTIONS, required=False, col=3),
                f_number("year", "Year", "Année", 3, col=1, min_val=2020, max_val=2030),
            ]),
            section("catch_data", "Associated Catch Data", "Données de capture associées", 3, 2, [
                f_number("total_catch_kg", "Total Catch (kg)", "Capture totale (kg)", 0, required=False, col=1, min_val=0),
                f_text("target_species", "Target Species", "Espèces cibles", 1, required=False, col=2),
            ], collapsible=True),
            section("observations", "Observations", "Observations", 4, 1, [
                f_textarea("observations", "Additional Notes", "Notes complémentaires", 0)
            ], collapsible=True),
            section("gps", "GPS", "GPS", 5, 1, [f_geo()], collapsible=True, collapsed=True),
        ],
        "settings": SETTINGS
    }
}


# ════════════════════════════════════════════════════════════════
# 5. FISH TRADE REPORT
# ════════════════════════════════════════════════════════════════

trade_template = {
    "name": "Fish Trade Report",
    "domain": "fisheries",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            section("location", "Location", "Localisation", 0, 2, [f_admin_location()]),
            section("trade_flow", "Trade Flow", "Flux commercial", 1, 2, [
                f_select_v("flow_direction", "Direction", "Direction", 0, [
                    {"label": {"en": "Export", "fr": "Exportation"}, "value": "EXPORT"},
                    {"label": {"en": "Import", "fr": "Importation"}, "value": "IMPORT"},
                ], col=1),
                f_text("export_country", "Exporting Country", "Pays exportateur", 1, col=2),
                f_text("import_country", "Importing Country", "Pays importateur", 2, col=1),
                f_text("commodity", "Commodity / Species", "Produit / Espèce", 3, col=2),
                f_select("product_state", "Product State", "État du produit", 4, [
                    ("Fresh", "Frais"), ("Frozen", "Congelé"), ("Dried", "Séché"),
                    ("Smoked", "Fumé"), ("Canned", "En conserve"), ("Salted", "Salé"),
                    ("Filleted", "Fileté"), ("Live", "Vivant")
                ], col=1),
                f_text("hs_code", "HS Code", "Code SH", 5, required=False, col=2),
            ]),
            section("values", "Quantity & Value", "Quantité et valeur", 2, 3, [
                f_number("quantity", "Quantity", "Quantité", 0, col=1, min_val=0),
                f_select_v("unit", "Unit", "Unité", 1, [
                    {"label": {"en": "Tonnes"}, "value": "tonnes"},
                    {"label": {"en": "kg"}, "value": "kg"},
                ], col=2),
                f_number("value_fob", "FOB Value (USD)", "Valeur FOB (USD)", 2, col=3, min_val=0),
                f_select_v("currency", "Currency", "Devise", 3, [
                    {"label": {"en": "USD"}, "value": "USD"},
                    {"label": {"en": "EUR"}, "value": "EUR"},
                    {"label": {"en": "Local currency", "fr": "Monnaie locale"}, "value": "LOCAL"},
                ], required=False, col=1),
                f_select_v("sps_status", "SPS Status", "Statut SPS", 4, [
                    {"label": {"en": "Compliant", "fr": "Conforme"}, "value": "COMPLIANT"},
                    {"label": {"en": "Non-compliant", "fr": "Non conforme"}, "value": "NON_COMPLIANT"},
                    {"label": {"en": "Pending", "fr": "En attente"}, "value": "PENDING"},
                ], required=False, col=2),
            ]),
            section("period", "Period", "Période", 3, 2, [
                f_date("period_start", "Period Start", "Début de période", 0, col=1),
                f_date("period_end", "Period End", "Fin de période", 1, col=2),
                f_number("year", "Year", "Année", 2, col=1, min_val=2020, max_val=2030),
            ]),
            section("observations", "Observations", "Observations", 4, 1, [
                f_textarea("observations", "Additional Notes", "Notes complémentaires", 0)
            ], collapsible=True),
        ],
        "settings": SETTINGS
    }
}


# ════════════════════════════════════════════════════════════════
# CREATE + PUBLISH + CAMPAIGNS
# ════════════════════════════════════════════════════════════════

TEMPLATES = [
    ("captures",    captures_template,    "FISH_CAPTURES_MONTHLY_2026",
     {"en": "Monthly Fish Captures Report 2026", "fr": "Rapport mensuel des captures 2026"},
     {"en": "Monthly collection of marine and inland capture data", "fr": "Collecte mensuelle des données de captures maritimes et continentales"},
     "monthly", 660),

    ("vessels",     vessels_template,      "FISH_VESSEL_REGISTRY_2026",
     {"en": "Vessel Registry Campaign 2026", "fr": "Campagne de registre des navires 2026"},
     {"en": "Registration of fishing vessels across AU Member States", "fr": "Enregistrement des navires de pêche des États membres"},
     "annual", 550),

    ("aquaculture", aquaculture_template,  "FISH_AQUACULTURE_FARMS_2026",
     {"en": "Aquaculture Farm Reporting 2026", "fr": "Rapport des fermes aquacoles 2026"},
     {"en": "Annual reporting of aquaculture farms and production", "fr": "Rapport annuel des fermes et de la production aquacole"},
     "annual", 440),

    ("efforts",     efforts_template,      "FISH_EFFORT_QUARTERLY_2026",
     {"en": "Quarterly Fishing Effort Report 2026", "fr": "Rapport trimestriel de l'effort de pêche 2026"},
     {"en": "Quarterly collection of fishing effort data", "fr": "Collecte trimestrielle des données d'effort de pêche"},
     "quarterly", 440),

    ("trade",       trade_template,        "FISH_TRADE_REPORT_2026",
     {"en": "Fish Trade Report 2026", "fr": "Rapport du commerce de poisson 2026"},
     {"en": "Reporting of fish commodity trade flows", "fr": "Déclaration des flux commerciaux de produits halieutiques"},
     "quarterly", 440),
]

created_ids = {}
print("=" * 60)
print("CREATING 5 FISHERIES TEMPLATES")
print("=" * 60)

for (key, tmpl, campaign_code, camp_name, camp_desc, freq, target) in TEMPLATES:
    print(f"\n── {key.upper()} ──")

    # Create
    print(f"  Creating template: {tmpl['name']}...")
    r = api_post("/api/v1/form-builder/templates", tmpl)
    tid = r.get("data", {}).get("id")
    if not tid:
        print(f"  ❌ ERROR: {r.get('message', json.dumps(r)[:200])}")
        continue

    created_ids[key] = tid
    print(f"  ✅ Template ID: {tid}")

    # Publish
    r2 = api_post(f"/api/v1/form-builder/templates/{tid}/publish", {})
    status = r2.get("data", {}).get("status", "?")
    print(f"  📄 Status: {status}")

    # Campaign
    print(f"  Creating campaign: {campaign_code}...")
    r3 = api_post("/api/v1/workflow/campaigns", {
        "code": campaign_code,
        "name": camp_name,
        "description": camp_desc,
        "domain": "fisheries",
        "formTemplateId": tid,
        "startDate": "2026-01-01",
        "endDate": "2026-12-31",
        "targetCountries": ALL_55,
        "targetSubmissions": target,
        "targetPerAgent": 8,
        "frequency": freq,
        "scope": "continental",
        "sendReminders": True,
        "reminderDaysBefore": 7,
        "status": "ACTIVE"
    })
    cid = r3.get("data", {}).get("id")
    if cid:
        print(f"  ✅ Campaign ID: {cid}")
    else:
        print(f"  ⚠️  Campaign: {r3.get('message', '')[:100]}")

ssh.close()

# ════════════════════════════════════════════════════════════════
# SUMMARY — Copy these IDs to the frontend pages
# ════════════════════════════════════════════════════════════════

print("\n" + "=" * 60)
print("TEMPLATE IDs — Update in frontend pages:")
print("=" * 60)
for key, tid in created_ids.items():
    page = f"apps/web/src/app/(dashboard)/fisheries/{key}/page.tsx"
    print(f"  {key:15s} → {tid}")
    print(f"    File: {page}")
print()
print("Replace the placeholder TEMPLATE_IDs in each page.tsx file.")
print("=" * 60)
print("DONE")
