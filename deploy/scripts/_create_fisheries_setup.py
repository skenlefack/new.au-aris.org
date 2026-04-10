"""Create Fisheries Event Alert template + 6 campaigns."""
import paramiko, json, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SSH_PASS = "@u-1baR.0rg$U24"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.183", username="arisadmin", password=SSH_PASS, timeout=15, allow_agent=False, look_for_keys=False)

_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    "-d '{\"email\":\"admin@au-aris.org\",\"password\":\"Aris2026@@4!0\"}' 2>/dev/null", timeout=15)
token = json.loads(stdout.read().decode())["data"]["accessToken"]

def api_post(path, body):
    data = json.dumps(body)
    chan = ssh.get_transport().open_session()
    chan.settimeout(30)
    chan.exec_command(
        f'curl -sk -X POST "https://localhost{path}" '
        f'-H "Authorization: Bearer {token}" '
        f'-H "Content-Type: application/json" --data-binary @- 2>/dev/null')
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

# ── EVENT_ALERT template ──
alert_tpl = {
    "name": "Fisheries & Aquaculture Event Alert",
    "domain": "fisheries",
    "formType": "EVENT_ALERT",
    "schema": {
        "sections": [
            {"id": "location", "name": {"en": "Location", "fr": "Localisation"}, "order": 0, "columns": 2, "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [{"id": "admin_location", "type": "admin-location", "code": "admin_location", "label": {"en": "Administrative Location", "fr": "Localisation administrative"}, "column": 1, "columnSpan": 2, "order": 0, "required": True, "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {"levels": [0, 1, 2], "requiredLevels": [0]}}]},
            {"id": "event_info", "name": {"en": "Event Information", "fr": "Informations sur l'evenement"}, "order": 1, "columns": 2, "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [
                 {"id": "event_type", "type": "select", "code": "event_type", "label": {"en": "Event Type", "fr": "Type d'evenement"}, "column": 1, "columnSpan": 1, "order": 0, "required": True, "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {"options": [{"label": {"en": "IUU Fishing", "fr": "Peche INN"}, "value": "iuu_fishing"}, {"label": {"en": "Stock Depletion", "fr": "Epuisement des stocks"}, "value": "stock_depletion"}, {"label": {"en": "Aquatic Disease", "fr": "Maladie aquatique"}, "value": "aquatic_disease"}, {"label": {"en": "License Violation", "fr": "Violation de licence"}, "value": "license_violation"}, {"label": {"en": "Environmental Impact", "fr": "Impact environnemental"}, "value": "environmental"}, {"label": {"en": "Vessel Incident", "fr": "Incident de navire"}, "value": "vessel_incident"}, {"label": {"en": "Other", "fr": "Autre"}, "value": "other"}]}},
                 {"id": "severity", "type": "select", "code": "severity", "label": {"en": "Severity", "fr": "Gravite"}, "column": 2, "columnSpan": 1, "order": 1, "required": True, "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {"options": [{"label": {"en": "Low"}, "value": "low"}, {"label": {"en": "Medium"}, "value": "medium"}, {"label": {"en": "High"}, "value": "high"}, {"label": {"en": "Critical"}, "value": "critical"}]}},
                 {"id": "date_event", "type": "date", "code": "date_event", "label": {"en": "Date of Event", "fr": "Date de l'evenement"}, "column": 1, "columnSpan": 1, "order": 2, "required": True, "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}},
                 {"id": "species", "type": "master-data-select", "code": "species", "label": {"en": "Species Affected", "fr": "Especes affectees"}, "column": 2, "columnSpan": 1, "order": 3, "required": False, "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {"masterDataType": "species-groups", "searchable": True}},
                 {"id": "vessels_involved", "type": "number", "code": "vessels_involved", "label": {"en": "Vessels Involved", "fr": "Navires impliques"}, "column": 1, "columnSpan": 1, "order": 4, "required": False, "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}},
                 {"id": "quantity_affected", "type": "number", "code": "quantity_affected", "label": {"en": "Quantity Affected (tonnes)", "fr": "Quantite affectee (tonnes)"}, "column": 2, "columnSpan": 1, "order": 5, "required": False, "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}}
             ]},
            {"id": "details", "name": {"en": "Details", "fr": "Details"}, "order": 2, "columns": 1, "isCollapsible": True, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [
                 {"id": "description", "type": "textarea", "code": "description", "label": {"en": "Event Description", "fr": "Description de l'evenement"}, "column": 1, "columnSpan": 1, "order": 0, "required": True, "readOnly": False, "hidden": False, "validation": {"min": 10}, "conditions": [], "properties": {}},
                 {"id": "actions_taken", "type": "textarea", "code": "actions_taken", "label": {"en": "Actions Taken", "fr": "Mesures prises"}, "column": 1, "columnSpan": 1, "order": 1, "required": False, "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}}
             ]},
            {"id": "gps", "name": {"en": "GPS Coordinates", "fr": "Coordonnees GPS"}, "order": 3, "columns": 1, "isCollapsible": True, "isCollapsed": False, "isRepeatable": False, "conditions": [],
             "fields": [{"id": "geo_location", "type": "geo-selector", "code": "geo_location", "label": {"en": "Geographic Coordinates", "fr": "Coordonnees geographiques"}, "column": 1, "columnSpan": 1, "order": 0, "required": False, "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {"modes": ["point", "polygon"], "defaultMode": "point"}}]}
        ],
        "settings": {"allowDraft": True, "allowAttachments": True, "maxAttachments": 5, "allowOffline": True, "requireGeoLocation": False, "autoSaveInterval": 30, "submissionWorkflow": "review_then_validate", "notifyOnSubmit": [], "duplicateDetection": {"enabled": False, "fields": []}}
    }
}

print("Creating Event Alert template...")
r = api_post("/api/v1/form-builder/templates", alert_tpl)
alert_id = r.get("data", {}).get("id")
if alert_id:
    print(f"  Template: {alert_id}")
    r2 = api_post(f"/api/v1/form-builder/templates/{alert_id}/publish", {})
    print(f"  Status: {r2.get('data', {}).get('status', '?')}")
else:
    print(f"  Error: {r.get('message', '')}")

# ── Campaigns ──
ALL_55 = ["DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW"]
COASTAL = ["AO","BJ","CV","CM","KM","CG","CD","CI","DJ","EG","GQ","ER","GA","GM","GH","GN","GW","KE","LR","LY","MG","MR","MU","MA","MZ","NA","NG","ST","SN","SC","SL","SO","ZA","SD","TZ","TG","TN"]

campaigns = [
    {"code": "FI_CAPTURE_MONTHLY_2026", "name": {"en": "Monthly Capture Fisheries Report 2026", "fr": "Rapport mensuel de peche de capture 2026", "pt": "Relatorio mensal de pesca de captura 2026"}, "description": {"en": "Monthly collection of marine and inland capture data", "fr": "Collecte mensuelle des donnees de peche marine et continentale"}, "domain": "fisheries", "formTemplateId": "7de1ef69-e845-4767-8af6-25038fa86514", "startDate": "2026-01-01", "endDate": "2026-12-31", "targetCountries": COASTAL, "targetSubmissions": 444, "targetPerAgent": 12, "frequency": "monthly", "scope": "continental", "sendReminders": True, "reminderDaysBefore": 5, "status": "ACTIVE"},
    {"code": "FI_VESSEL_REGISTRY_2026", "name": {"en": "Fishing Vessel Registry Update 2026", "fr": "Mise a jour du registre des navires de peche 2026", "pt": "Atualizacao do registo de embarcacoes de pesca 2026"}, "description": {"en": "Annual vessel registration and license status update", "fr": "Mise a jour annuelle de l'immatriculation et des licences"}, "domain": "fisheries", "formTemplateId": "bd1bcea3-42ad-4930-9b64-faf4a869597f", "startDate": "2026-01-01", "endDate": "2026-12-31", "targetCountries": COASTAL, "targetSubmissions": 200, "targetPerAgent": 5, "frequency": "annual", "scope": "continental", "sendReminders": True, "reminderDaysBefore": 14, "status": "ACTIVE"},
    {"code": "FI_EFFORT_QUARTERLY_2026", "name": {"en": "Quarterly Fishing Effort Report 2026", "fr": "Rapport trimestriel d'effort de peche 2026"}, "description": {"en": "Quarterly reporting of fishing effort metrics", "fr": "Rapportage trimestriel des indicateurs d'effort de peche"}, "domain": "fisheries", "formTemplateId": "d0184b73-de13-4c51-bae9-ea427bdcab03", "startDate": "2026-01-01", "endDate": "2026-12-31", "targetCountries": COASTAL, "targetSubmissions": 148, "targetPerAgent": 4, "frequency": "quarterly", "scope": "continental", "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"},
    {"code": "FI_AQUACULTURE_FARMS_2026", "name": {"en": "Aquaculture Farm Registration 2026", "fr": "Enregistrement des fermes aquacoles 2026"}, "description": {"en": "Annual registration and status update of aquaculture farms", "fr": "Enregistrement annuel et mise a jour du statut des fermes aquacoles"}, "domain": "fisheries", "formTemplateId": "89a7aa9a-0740-4470-97fd-3a91709df5d9", "startDate": "2026-01-01", "endDate": "2026-12-31", "targetCountries": COASTAL, "targetSubmissions": 200, "targetPerAgent": 5, "frequency": "annual", "scope": "continental", "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"},
    {"code": "FI_AQUACULTURE_PROD_2026", "name": {"en": "Quarterly Aquaculture Production Report 2026", "fr": "Rapport trimestriel de production aquacole 2026"}, "description": {"en": "Quarterly collection of aquaculture production data", "fr": "Collecte trimestrielle des donnees de production aquacole"}, "domain": "fisheries", "formTemplateId": "25a65b38-6404-4d5c-84bf-a81ccb964a02", "startDate": "2026-01-01", "endDate": "2026-12-31", "targetCountries": COASTAL, "targetSubmissions": 148, "targetPerAgent": 4, "frequency": "quarterly", "scope": "continental", "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"},
    {"code": "FI_TRADE_QUARTERLY_2026", "name": {"en": "Quarterly Fish Trade Report 2026", "fr": "Rapport trimestriel du commerce du poisson 2026"}, "description": {"en": "Quarterly collection of fish trade flows and SPS data", "fr": "Collecte trimestrielle des flux commerciaux et donnees SPS"}, "domain": "fisheries", "formTemplateId": "c1533f8a-bb8b-42e0-b666-dac5263b4a53", "startDate": "2026-01-01", "endDate": "2026-12-31", "targetCountries": COASTAL, "targetSubmissions": 148, "targetPerAgent": 4, "frequency": "quarterly", "scope": "continental", "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"},
]

print(f"\nCreating {len(campaigns)} campaigns...")
for i, camp in enumerate(campaigns, 1):
    r = api_post("/api/v1/workflow/campaigns", camp)
    if r.get("data", {}).get("id"):
        print(f"  {i}. OK  {camp['name']['en']}")
    else:
        print(f"  {i}. ERR {camp['name']['en']}: {r.get('message','')}")

ssh.close()
print("\nDONE")
