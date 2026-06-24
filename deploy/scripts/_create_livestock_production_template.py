"""Create Livestock Production Report template, publish it, and create a campaign."""
import paramiko, sys, json

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SSH_PASS = "@u-1baR.0rg$U24"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.183", username="arisadmin", password=SSH_PASS, timeout=15, allow_agent=False, look_for_keys=False)

_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    "-d '{\"email\":\"admin@au-aris.org\",\"password\":\"Aris2026@@4!0\"}' 2>/dev/null",
    timeout=15,
)
token = json.loads(stdout.read().decode())["data"]["accessToken"]

template = {
    "name": "Livestock Production Report",
    "domain": "livestock-prod",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            {
                "id": "location", "name": {"en": "Location", "fr": "Localisation", "pt": "Localizacao"},
                "order": 0, "columns": 2, "isCollapsible": False, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [{
                    "id": "admin_location", "type": "admin-location", "code": "admin_location",
                    "label": {"en": "Administrative Location", "fr": "Localisation administrative"},
                    "column": 1, "columnSpan": 2, "order": 0, "required": True,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {"levels": [0, 1, 2], "requiredLevels": [0]}
                }]
            },
            {
                "id": "report_info", "name": {"en": "Report Information", "fr": "Informations du rapport"},
                "order": 1, "columns": 2, "isCollapsible": False, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "report_date", "type": "date", "code": "report_date",
                     "label": {"en": "Report Date", "fr": "Date du rapport"},
                     "column": 1, "columnSpan": 1, "order": 0, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}},
                    {"id": "reporting_period", "type": "select", "code": "reporting_period",
                     "label": {"en": "Reporting Period", "fr": "Periode de rapport"},
                     "column": 2, "columnSpan": 1, "order": 1, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"options": [
                         {"label": {"en": "Q1 (Jan-Mar)", "fr": "T1 (Jan-Mar)"}, "value": "Q1"},
                         {"label": {"en": "Q2 (Apr-Jun)", "fr": "T2 (Avr-Jun)"}, "value": "Q2"},
                         {"label": {"en": "Q3 (Jul-Sep)", "fr": "T3 (Jul-Sep)"}, "value": "Q3"},
                         {"label": {"en": "Q4 (Oct-Dec)", "fr": "T4 (Oct-Dec)"}, "value": "Q4"},
                         {"label": {"en": "Annual", "fr": "Annuel"}, "value": "annual"}
                     ]}},
                    {"id": "year", "type": "number", "code": "year",
                     "label": {"en": "Year", "fr": "Annee"},
                     "column": 1, "columnSpan": 1, "order": 2, "required": True,
                     "readOnly": False, "hidden": False, "validation": {"min": 2020, "max": 2030}, "conditions": [], "properties": {}},
                    {"id": "reporting_officer", "type": "text", "code": "reporting_officer",
                     "label": {"en": "Reporting Officer", "fr": "Agent rapporteur"},
                     "column": 2, "columnSpan": 1, "order": 3, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}}
                ]
            },
            {
                "id": "production_data", "name": {"en": "Production Data", "fr": "Donnees de production"},
                "order": 2, "columns": 3, "isCollapsible": False, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "species", "type": "master-data-select", "code": "species",
                     "label": {"en": "Species", "fr": "Espece"},
                     "column": 1, "columnSpan": 1, "order": 0, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"masterDataType": "species-groups", "searchable": True}},
                    {"id": "product_type", "type": "select", "code": "product_type",
                     "label": {"en": "Product Type", "fr": "Type de produit"},
                     "column": 2, "columnSpan": 1, "order": 1, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"options": [
                         {"label": {"en": "Milk", "fr": "Lait"}, "value": "milk"},
                         {"label": {"en": "Meat", "fr": "Viande"}, "value": "meat"},
                         {"label": {"en": "Eggs", "fr": "Oeufs"}, "value": "eggs"},
                         {"label": {"en": "Wool", "fr": "Laine"}, "value": "wool"},
                         {"label": {"en": "Hides & Skins", "fr": "Cuirs et peaux"}, "value": "hides"},
                         {"label": {"en": "Honey", "fr": "Miel"}, "value": "honey"},
                         {"label": {"en": "Other", "fr": "Autre"}, "value": "other"}
                     ]}},
                    {"id": "quantity", "type": "number", "code": "quantity",
                     "label": {"en": "Quantity Produced", "fr": "Quantite produite"},
                     "column": 3, "columnSpan": 1, "order": 2, "required": True,
                     "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}},
                    {"id": "unit", "type": "select", "code": "unit",
                     "label": {"en": "Unit", "fr": "Unite"},
                     "column": 1, "columnSpan": 1, "order": 3, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"options": [
                         {"label": {"en": "Tonnes", "fr": "Tonnes"}, "value": "tonnes"},
                         {"label": {"en": "Litres", "fr": "Litres"}, "value": "litres"},
                         {"label": {"en": "Kilograms", "fr": "Kilogrammes"}, "value": "kg"},
                         {"label": {"en": "Units/Pieces", "fr": "Unites/Pieces"}, "value": "units"},
                         {"label": {"en": "Heads", "fr": "Tetes"}, "value": "heads"}
                     ]}},
                    {"id": "market_value", "type": "number", "code": "market_value",
                     "label": {"en": "Estimated Market Value (USD)", "fr": "Valeur marchande estimee (USD)"},
                     "column": 2, "columnSpan": 1, "order": 4, "required": False,
                     "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}},
                    {"id": "data_source", "type": "text", "code": "data_source",
                     "label": {"en": "Data Source", "fr": "Source des donnees"},
                     "placeholder": {"en": "e.g. National statistics, FAOSTAT", "fr": "ex. Statistiques nationales, FAOSTAT"},
                     "column": 3, "columnSpan": 1, "order": 5, "required": False,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}}
                ]
            },
            {
                "id": "observations", "name": {"en": "Observations", "fr": "Observations"},
                "order": 3, "columns": 1, "isCollapsible": True, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "observations", "type": "textarea", "code": "observations",
                     "label": {"en": "Additional Observations", "fr": "Observations complementaires"},
                     "placeholder": {"en": "Production trends, challenges, market conditions...", "fr": "Tendances de production, defis, conditions du marche..."},
                     "column": 1, "columnSpan": 1, "order": 0, "required": False,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}}
                ]
            },
            {
                "id": "gps", "name": {"en": "GPS Coordinates", "fr": "Coordonnees GPS"},
                "order": 4, "columns": 1, "isCollapsible": True, "isCollapsed": True,
                "isRepeatable": False, "conditions": [],
                "fields": [{
                    "id": "geo_location", "type": "geo-selector", "code": "geo_location",
                    "label": {"en": "Geographic Coordinates", "fr": "Coordonnees geographiques"},
                    "column": 1, "columnSpan": 1, "order": 0, "required": False,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {"modes": ["point"], "defaultMode": "point"}
                }]
            }
        ],
        "settings": {
            "allowDraft": True, "allowAttachments": True, "maxAttachments": 3,
            "allowOffline": True, "requireGeoLocation": False, "autoSaveInterval": 30,
            "submissionWorkflow": "review_then_validate", "notifyOnSubmit": [],
            "duplicateDetection": {"enabled": False, "fields": []}
        }
    }
}

# Send template directly via stdin pipe to curl
import subprocess, tempfile, os

# Write JSON to local temp file, then use paramiko exec with stdin
data = json.dumps(template)

# Use curl with --data-binary @- to read from stdin
chan = ssh.get_transport().open_session()
chan.settimeout(30)
chan.exec_command(
    f'curl -sk -X POST "https://localhost/api/v1/form-builder/templates" '
    f'-H "Authorization: Bearer {token}" -H "Content-Type: application/json" '
    f'--data-binary @- 2>/dev/null'
)
chan.sendall(data.encode())
chan.shutdown_write()

import time
time.sleep(3)
resp = b''
while chan.recv_ready() or not chan.exit_status_ready():
    if chan.recv_ready():
        resp += chan.recv(8192)
    else:
        time.sleep(0.5)
# Final read
while chan.recv_ready():
    resp += chan.recv(8192)

stdout_data = resp.decode()
result = json.loads(stdout_data)
result = json.loads(stdout.read().decode())
if result.get("data", {}).get("id"):
    tid = result["data"]["id"]
    print(f"Template created: {tid}")
    # Publish
    _, stdout2, _ = ssh.exec_command(
        f'curl -sk -X POST "https://localhost/api/v1/form-builder/templates/{tid}/publish" '
        f'-H "Authorization: Bearer {token}" 2>/dev/null', timeout=10)
    r2 = json.loads(stdout2.read().decode())
    print(f"Status: {r2.get('data', {}).get('status', '?')}")

    # Create campaign
    ALL_55 = ["DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW"]
    campaign = {
        "code": "LP_PRODUCTION_QUARTERLY_2026",
        "name": {"en": "Quarterly Livestock Production Report 2026", "fr": "Rapport trimestriel de production animale 2026", "pt": "Relatorio trimestral de producao animal 2026"},
        "description": {"en": "Quarterly collection of livestock production data covering milk, meat, eggs, wool, hides, and honey across all AU Member States", "fr": "Collecte trimestrielle des donnees de production animale couvrant lait, viande, oeufs, laine, cuirs et miel dans tous les Etats membres", "pt": "Recolha trimestral de dados de producao animal abrangendo leite, carne, ovos, la, couros e mel em todos os Estados membros"},
        "domain": "livestock-prod",
        "formTemplateId": tid,
        "startDate": "2026-01-01", "endDate": "2026-12-31",
        "targetCountries": ALL_55, "targetSubmissions": 440, "targetPerAgent": 8,
        "frequency": "quarterly", "scope": "continental",
        "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"
    }
    camp_data = json.dumps(campaign)
    camp_b64 = base64.b64encode(camp_data.encode()).decode()
    write_camp_cmd = f"python3 -c \"import base64; open('/tmp/lp_prod_campaign.json','w').write(base64.b64decode('{camp_b64}').decode())\""
    _, stdout_c, _ = ssh.exec_command(write_camp_cmd, timeout=15)
    stdout_c.read()

    _, stdout3, _ = ssh.exec_command(
        f'curl -sk -X POST "https://localhost/api/v1/workflow/campaigns" '
        f'-H "Authorization: Bearer {token}" -H "Content-Type: application/json" '
        f'-d @/tmp/lp_prod_campaign.json 2>/dev/null', timeout=15)
    r3 = json.loads(stdout3.read().decode())
    if r3.get("data", {}).get("id"):
        print(f"Campaign created: {r3['data']['id']}")
    else:
        print(f"Campaign error: {r3.get('message', '')}")
    ssh.exec_command("rm -f /tmp/lp_prod_campaign.json")
else:
    print(f"Error: {result.get('message', '')}")

ssh.exec_command("rm -f /tmp/lp_production.json")
ssh.close()
