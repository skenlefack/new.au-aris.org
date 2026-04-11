"""Create Trade & SPS EVENT_ALERT template + 8 campaigns on production."""
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


# ── 1. EVENT_ALERT template ──
print("Creating Trade & SPS Event Alert template...")
alert = {
    "name": "Trade & SPS Event Alert",
    "domain": "trade_sps",
    "formType": "EVENT_ALERT",
    "schema": {
        "sections": [
            {"id": "location", "name": {"en": "Location", "fr": "Localisation"}, "order": 0, "columns": 2,
             "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [
                 {"id": "admin_location", "type": "admin-location", "code": "admin_location",
                  "label": {"en": "Location", "fr": "Localisation"},
                  "column": 1, "columnSpan": 2, "order": 0, "required": True,
                  "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                  "properties": {"levels": [0, 1, 2], "requiredLevels": [0]}}
             ]},
            {"id": "event", "name": {"en": "Event Details", "fr": "Details"}, "order": 1, "columns": 2,
             "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [
                 {"id": "event_type", "type": "select", "code": "event_type",
                  "label": {"en": "Event Type", "fr": "Type"},
                  "column": 1, "columnSpan": 1, "order": 0, "required": True,
                  "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                  "properties": {"options": [
                      {"label": {"en": "SPS Non-Compliance", "fr": "Non-conformite SPS"}, "value": "sps_non_compliance"},
                      {"label": {"en": "Trade Disruption", "fr": "Perturbation commerciale"}, "value": "trade_disruption"},
                      {"label": {"en": "Market Price Anomaly", "fr": "Anomalie de prix"}, "value": "price_anomaly"},
                      {"label": {"en": "Import Ban", "fr": "Interdiction importation"}, "value": "import_ban"},
                      {"label": {"en": "Export Restriction", "fr": "Restriction exportation"}, "value": "export_restriction"},
                      {"label": {"en": "Counterfeit Product", "fr": "Produit contrefait"}, "value": "counterfeit"},
                      {"label": {"en": "Other", "fr": "Autre"}, "value": "other"},
                  ]}},
                 {"id": "severity", "type": "select", "code": "severity",
                  "label": {"en": "Severity", "fr": "Severite"},
                  "column": 2, "columnSpan": 1, "order": 1, "required": True,
                  "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                  "properties": {"options": [
                      {"label": {"en": "Low", "fr": "Faible"}, "value": "low"},
                      {"label": {"en": "Medium", "fr": "Moyen"}, "value": "medium"},
                      {"label": {"en": "High", "fr": "Eleve"}, "value": "high"},
                      {"label": {"en": "Critical", "fr": "Critique"}, "value": "critical"},
                  ]}},
                 {"id": "date_event", "type": "date", "code": "date_event",
                  "label": {"en": "Event Date", "fr": "Date"},
                  "column": 1, "columnSpan": 1, "order": 2, "required": True,
                  "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}},
                 {"id": "description", "type": "textarea", "code": "description",
                  "label": {"en": "Description", "fr": "Description"},
                  "column": 1, "columnSpan": 2, "order": 3, "required": True,
                  "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}},
                 {"id": "affected_commodity", "type": "text", "code": "affected_commodity",
                  "label": {"en": "Affected Commodity", "fr": "Produit concerne"},
                  "column": 1, "columnSpan": 1, "order": 4, "required": False,
                  "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}},
                 {"id": "estimated_loss", "type": "number", "code": "estimated_loss",
                  "label": {"en": "Estimated Loss (USD)", "fr": "Perte estimee (USD)"},
                  "column": 2, "columnSpan": 1, "order": 5, "required": False,
                  "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}},
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

r = api_post("/api/v1/form-builder/templates", alert)
alert_id = r.get("data", {}).get("id")
if alert_id:
    print(f"  Template: {alert_id}")
    r2 = api_post(f"/api/v1/form-builder/templates/{alert_id}/publish", {})
    print(f"  Status: {r2.get('data', {}).get('status', '?')}")
else:
    print(f"  Error: {r.get('message', '')[:80]}")

# ── 2. Create campaigns ──
ALL_55 = [
    "DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ",
    "EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG",
    "MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN","SC","SL","SO",
    "ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW"
]

# Get template IDs
_, stdout, _ = ssh.exec_command(
    f'curl -sk "https://localhost/api/v1/form-builder/templates?domain=trade_sps&limit=20&status=PUBLISHED" '
    f'-H "Authorization: Bearer {token}" 2>/dev/null', timeout=15)
templates = json.loads(stdout.read().decode()).get("data", [])
tid_by_name = {}
for t in templates:
    existing = tid_by_name.get(t["name"])
    if not existing or (t.get("version", 0) > existing.get("version", 0)):
        tid_by_name[t["name"]] = t

CAMPAIGNS = [
    ("Cost of Production",                      "TRADE_COST_PROD_2026",       "quarterly", 440),
    ("Import and Export",                        "TRADE_IMPORT_EXPORT_2026",   "monthly",   660),
    ("Market Demand",                            "TRADE_MARKET_DEMAND_2026",   "quarterly", 440),
    ("Market Price",                             "TRADE_MARKET_PRICE_2026",    "monthly",   660),
    ("Market Requirement and Location",          "TRADE_MARKET_LOCATION_2026", "annual",    550),
    ("Quality Standards (Inputs & Services)",     "TRADE_QUALITY_INPUT_2026",   "annual",    550),
    ("Quality Standards (Poultry/Hatchery)",      "TRADE_QUALITY_POULTRY_2026", "annual",    440),
    ("Volume and Availability of Transport",     "TRADE_TRANSPORT_2026",       "quarterly", 440),
]

print(f"\nCreating {len(CAMPAIGNS)} campaigns...")
for tmpl_name, code, freq, target in CAMPAIGNS:
    tmpl = tid_by_name.get(tmpl_name)
    if not tmpl:
        print(f"  SKIP {code}: template '{tmpl_name}' not found")
        continue

    r = api_post("/api/v1/workflow/campaigns", {
        "code": code,
        "name": {"en": tmpl_name + " 2026", "fr": tmpl_name + " 2026"},
        "description": {"en": f"Continental data collection — {tmpl_name}", "fr": f"Collecte continentale — {tmpl_name}"},
        "domain": "trade_sps",
        "formTemplateId": tmpl["id"],
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
    cid = r.get("data", {}).get("id")
    if cid:
        print(f"  OK {code}")
    else:
        print(f"  ERR {code}: {r.get('message', '')[:60]}")

print(f"\n{'='*50}")
print(f"TRADE_ALERT_TEMPLATE_ID = '{alert_id}'")
print("DONE")
ssh.close()
