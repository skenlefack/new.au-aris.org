"""Create Governance templates + campaigns + EVENT_ALERT on production."""
import paramiko, json, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.183", username="arisadmin",
            password="@u-1baR.0rg$U24", timeout=15,
            allow_agent=False, look_for_keys=False)

_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    """-d '{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}' 2>/dev/null""",
    timeout=15)
token = json.loads(stdout.read().decode())["data"]["accessToken"]
print("Authenticated\n")

ALL_55 = ["DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW"]

def api_post(path, body):
    data = json.dumps(body)
    chan = ssh.get_transport().open_session()
    chan.settimeout(30)
    chan.exec_command(
        f'curl -sk -X POST "https://localhost{path}" '
        f'-H "Authorization: Bearer {token}" '
        f'-H "Content-Type: application/json" '
        f'--data-binary @- 2>/dev/null')
    chan.sendall(data.encode())
    chan.shutdown_write()
    time.sleep(3)
    resp = b''
    for _ in range(10):
        if chan.recv_ready(): resp += chan.recv(16384)
        elif chan.exit_status_ready():
            while chan.recv_ready(): resp += chan.recv(16384)
            break
        time.sleep(0.5)
    return json.loads(resp.decode())

def f_loc():
    return {"id": "admin_location", "type": "admin-location", "code": "admin_location",
            "label": {"en": "Location", "fr": "Localisation"},
            "column": 1, "columnSpan": 2, "order": 0, "required": True,
            "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
            "properties": {"levels": [0, 1, 2], "requiredLevels": [0]}}

def sec(sid, en, fr, order, cols, fields, collapsible=False):
    return {"id": sid, "name": {"en": en, "fr": fr}, "order": order, "columns": cols,
            "isCollapsible": collapsible, "isCollapsed": False, "isRepeatable": False,
            "conditions": [], "fields": fields}

def f(fid, ftype, en, fr, order, col=1, span=1, req=True, props=None):
    return {"id": fid, "type": ftype, "code": fid, "label": {"en": en, "fr": fr},
            "column": col, "columnSpan": span, "order": order, "required": req,
            "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
            "properties": props or {}}

SETTINGS = {"allowDraft": True, "allowAttachments": True, "maxAttachments": 5,
            "allowOffline": True, "requireGeoLocation": False, "autoSaveInterval": 30,
            "submissionWorkflow": "review_then_validate",
            "notifyOnSubmit": [], "duplicateDetection": {"enabled": False, "fields": []}}

# ── Templates ──

TEMPLATES = [
    {
        "name": "Legal Framework Assessment",
        "domain": "governance",
        "formType": "CAMPAIGN",
        "schema": {"sections": [
            sec("loc", "Location", "Localisation", 0, 2, [f_loc()]),
            sec("framework", "Framework Details", "Details du cadre", 1, 2, [
                f("framework_title", "text", "Framework Title", "Titre du cadre", 0),
                f("framework_type", "select", "Type", "Type", 1, col=2, props={"options": [
                    {"label": {"en": "Law", "fr": "Loi"}, "value": "LAW"},
                    {"label": {"en": "Regulation", "fr": "Reglement"}, "value": "REGULATION"},
                    {"label": {"en": "Policy", "fr": "Politique"}, "value": "POLICY"},
                    {"label": {"en": "Standard", "fr": "Norme"}, "value": "STANDARD"},
                    {"label": {"en": "Guideline", "fr": "Directive"}, "value": "GUIDELINE"},
                ]}),
                f("domain", "select", "Domain", "Domaine", 2, props={"options": [
                    {"label": {"en": "Animal Health"}, "value": "animal_health"},
                    {"label": {"en": "Livestock Production"}, "value": "livestock"},
                    {"label": {"en": "Fisheries"}, "value": "fisheries"},
                    {"label": {"en": "Wildlife"}, "value": "wildlife"},
                    {"label": {"en": "Trade & SPS"}, "value": "trade_sps"},
                    {"label": {"en": "Veterinary Services"}, "value": "vet_services"},
                    {"label": {"en": "Food Safety"}, "value": "food_safety"},
                ]}),
                f("adoption_date", "date", "Adoption Date", "Date d'adoption", 3, col=2),
                f("status", "select", "Status", "Statut", 4, props={"options": [
                    {"label": {"en": "Draft", "fr": "Projet"}, "value": "DRAFT"},
                    {"label": {"en": "Adopted", "fr": "Adopte"}, "value": "ADOPTED"},
                    {"label": {"en": "In Force", "fr": "En vigueur"}, "value": "IN_FORCE"},
                    {"label": {"en": "Repealed", "fr": "Abroge"}, "value": "REPEALED"},
                ]}),
                f("description", "textarea", "Description", "Description", 5, span=2, req=False),
            ]),
        ], "settings": SETTINGS},
        "campaign": ("GOV_LEGAL_FRAMEWORKS_2026", "annual", 550),
    },
    {
        "name": "PVS Evaluation Report",
        "domain": "governance",
        "formType": "CAMPAIGN",
        "schema": {"sections": [
            sec("loc", "Location", "Localisation", 0, 2, [f_loc()]),
            sec("eval", "Evaluation", "Evaluation", 1, 2, [
                f("year", "number", "Year", "Annee", 0, props={"min": 2015, "max": 2030}),
                f("evaluation_type", "select", "Evaluation Type", "Type d'evaluation", 1, col=2, props={"options": [
                    {"label": {"en": "Initial PVS"}, "value": "INITIAL"},
                    {"label": {"en": "Follow-up PVS"}, "value": "FOLLOW_UP"},
                    {"label": {"en": "Gap Analysis"}, "value": "GAP_ANALYSIS"},
                    {"label": {"en": "PVS Pathway"}, "value": "PATHWAY"},
                ]}),
            ]),
            sec("scores", "PVS Scores (1-5)", "Scores PVS (1-5)", 2, 4, [
                f("score_legislation", "number", "Legislation", "Legislation", 0, props={"min": 1, "max": 5}),
                f("score_labs", "number", "Laboratories", "Laboratoires", 1, col=2, props={"min": 1, "max": 5}),
                f("score_risk_analysis", "number", "Risk Analysis", "Analyse de risque", 2, col=3, props={"min": 1, "max": 5}),
                f("score_quarantine", "number", "Quarantine", "Quarantaine", 3, col=4, props={"min": 1, "max": 5}),
                f("score_surveillance", "number", "Surveillance", "Surveillance", 4, props={"min": 1, "max": 5}),
                f("score_disease_control", "number", "Disease Control", "Controle des maladies", 5, col=2, props={"min": 1, "max": 5}),
                f("score_food_safety", "number", "Food Safety", "Securite alimentaire", 6, col=3, props={"min": 1, "max": 5}),
                f("score_vet_education", "number", "Vet Education", "Formation veterinaire", 7, col=4, props={"min": 1, "max": 5}),
            ]),
            sec("obs", "Observations", "Observations", 3, 1, [
                f("observations", "textarea", "Observations", "Observations", 0, span=1, req=False),
            ], collapsible=True),
        ], "settings": SETTINGS},
        "campaign": ("GOV_PVS_EVALUATION_2026", "annual", 55),
    },
    {
        "name": "Stakeholder Registry",
        "domain": "governance",
        "formType": "CAMPAIGN",
        "schema": {"sections": [
            sec("loc", "Location", "Localisation", 0, 2, [f_loc()]),
            sec("org", "Organization", "Organisation", 1, 2, [
                f("organization_name", "text", "Organization Name", "Nom de l'organisation", 0),
                f("organization_type", "select", "Type", "Type", 1, col=2, props={"options": [
                    {"label": {"en": "International Organization"}, "value": "INTERNATIONAL"},
                    {"label": {"en": "UN Agency"}, "value": "UN_AGENCY"},
                    {"label": {"en": "National Authority"}, "value": "NATIONAL"},
                    {"label": {"en": "REC Body"}, "value": "REC"},
                    {"label": {"en": "Development Partner"}, "value": "DEV_PARTNER"},
                    {"label": {"en": "Research Institution"}, "value": "RESEARCH"},
                    {"label": {"en": "Private Sector"}, "value": "PRIVATE"},
                ]}),
                f("sector", "text", "Sector", "Secteur", 2),
                f("contact_email", "email", "Contact Email", "Email de contact", 3, col=2, req=False),
                f("partnership_status", "select", "Partnership Status", "Statut du partenariat", 4, props={"options": [
                    {"label": {"en": "Active", "fr": "Actif"}, "value": "active"},
                    {"label": {"en": "Inactive", "fr": "Inactif"}, "value": "inactive"},
                    {"label": {"en": "Pending", "fr": "En attente"}, "value": "pending"},
                ]}),
            ]),
        ], "settings": SETTINGS},
        "campaign": ("GOV_STAKEHOLDER_REGISTRY_2026", "annual", 550),
    },
    {
        "name": "Capacity Building Report",
        "domain": "governance",
        "formType": "CAMPAIGN",
        "schema": {"sections": [
            sec("loc", "Location", "Localisation", 0, 2, [f_loc()]),
            sec("capacity", "Capacity Data", "Donnees de capacite", 1, 3, [
                f("organization_name", "text", "Organization", "Organisation", 0),
                f("year", "number", "Year", "Annee", 1, col=2, props={"min": 2020, "max": 2030}),
                f("staff_count", "number", "Staff Count", "Effectif", 2, col=3, props={"min": 0}),
                f("budget_usd", "number", "Budget (USD)", "Budget (USD)", 3, props={"min": 0}),
                f("pvs_score", "number", "PVS Score", "Score PVS", 4, col=2, props={"min": 1, "max": 5}),
                f("oie_status", "text", "OIE/WOAH Status", "Statut OIE/OMSA", 5, col=3, req=False),
            ]),
            sec("obs", "Observations", "Observations", 2, 1, [
                f("observations", "textarea", "Observations", "Observations", 0, span=1, req=False),
            ], collapsible=True),
        ], "settings": SETTINGS},
        "campaign": ("GOV_CAPACITY_BUILDING_2026", "annual", 550),
    },
]

# EVENT_ALERT
ALERT = {
    "name": "Governance Event Alert",
    "domain": "governance",
    "formType": "EVENT_ALERT",
    "schema": {"sections": [
        sec("loc", "Location", "Localisation", 0, 2, [f_loc()]),
        sec("event", "Event", "Evenement", 1, 2, [
            f("event_type", "select", "Event Type", "Type", 0, props={"options": [
                {"label": {"en": "Legislative Change", "fr": "Changement legislatif"}, "value": "legislative_change"},
                {"label": {"en": "PVS Gap Identified", "fr": "Lacune PVS identifiee"}, "value": "pvs_gap"},
                {"label": {"en": "Capacity Deficit", "fr": "Deficit de capacite"}, "value": "capacity_deficit"},
                {"label": {"en": "Institutional Reform", "fr": "Reforme institutionnelle"}, "value": "institutional_reform"},
                {"label": {"en": "Other", "fr": "Autre"}, "value": "other"},
            ]}),
            f("severity", "select", "Severity", "Severite", 1, col=2, props={"options": [
                {"label": {"en": "Low", "fr": "Faible"}, "value": "low"},
                {"label": {"en": "Medium", "fr": "Moyen"}, "value": "medium"},
                {"label": {"en": "High", "fr": "Eleve"}, "value": "high"},
                {"label": {"en": "Critical", "fr": "Critique"}, "value": "critical"},
            ]}),
            f("date_event", "date", "Event Date", "Date", 2),
            f("description", "textarea", "Description", "Description", 3, span=2),
        ]),
    ], "settings": SETTINGS},
}

# ── Execute ──
created = {}

for tmpl in TEMPLATES:
    camp_info = tmpl.pop("campaign")
    print(f"Creating: {tmpl['name']}...")
    r = api_post("/api/v1/form-builder/templates", tmpl)
    tid = r.get("data", {}).get("id")
    if not tid:
        print(f"  ERROR: {r.get('message', '')[:80]}")
        continue
    created[tmpl["name"]] = tid
    print(f"  Template: {tid}")

    r2 = api_post(f"/api/v1/form-builder/templates/{tid}/publish", {})
    print(f"  Status: {r2.get('data', {}).get('status', '?')}")

    code, freq, target = camp_info
    r3 = api_post("/api/v1/workflow/campaigns", {
        "code": code,
        "name": {"en": f"{tmpl['name']} 2026", "fr": f"{tmpl['name']} 2026"},
        "description": {"en": f"Continental — {tmpl['name']}", "fr": f"Continental — {tmpl['name']}"},
        "domain": "governance", "formTemplateId": tid,
        "startDate": "2026-01-01", "endDate": "2026-12-31",
        "targetCountries": ALL_55, "targetSubmissions": target, "targetPerAgent": 8,
        "frequency": freq, "scope": "continental",
        "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"
    })
    cid = r3.get("data", {}).get("id")
    print(f"  Campaign: {cid or r3.get('message', '')[:60]}")
    print()

# EVENT_ALERT
print("Creating: Governance Event Alert...")
r = api_post("/api/v1/form-builder/templates", ALERT)
alert_id = r.get("data", {}).get("id")
if alert_id:
    created["alert"] = alert_id
    print(f"  Template: {alert_id}")
    r2 = api_post(f"/api/v1/form-builder/templates/{alert_id}/publish", {})
    print(f"  Status: {r2.get('data', {}).get('status', '?')}")
else:
    print(f"  ERROR: {r.get('message', '')[:80]}")

print(f"\n{'='*50}")
for name, tid in created.items():
    print(f"  {name}: {tid}")
print("DONE")
ssh.close()
