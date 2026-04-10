"""Create Transhumance Corridor Report template, publish it, and create campaign."""
import paramiko, json, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SSH_PASS = "@u-1baR.0rg$U24"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.183", username="arisadmin", password=SSH_PASS, timeout=15, allow_agent=False, look_for_keys=False)

_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    "-d '{\"email\":\"admin@au-aris.org\",\"password\":\"Aris2026@@4!0\"}' 2>/dev/null",
    timeout=15)
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
        if chan.recv_ready():
            resp += chan.recv(16384)
        elif chan.exit_status_ready():
            while chan.recv_ready():
                resp += chan.recv(16384)
            break
        time.sleep(0.5)
    return json.loads(resp.decode())

template = {
    "name": "Transhumance Corridor Report",
    "domain": "livestock",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            {
                "id": "origin", "name": {"en": "Origin Location", "fr": "Lieu d'origine", "pt": "Local de origem"},
                "order": 0, "columns": 2, "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [{
                    "id": "origin_location", "type": "admin-location", "code": "origin_location",
                    "label": {"en": "Origin Country & Region", "fr": "Pays et region d'origine"},
                    "helpText": {"en": "Where the corridor starts", "fr": "Point de depart du corridor"},
                    "column": 1, "columnSpan": 2, "order": 0, "required": True,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {"levels": [0, 1], "requiredLevels": [0]}
                }]
            },
            {
                "id": "destination", "name": {"en": "Destination Location", "fr": "Lieu de destination"},
                "order": 1, "columns": 2, "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [{
                    "id": "destination_location", "type": "admin-location", "code": "destination_location",
                    "label": {"en": "Destination Country & Region", "fr": "Pays et region de destination"},
                    "helpText": {"en": "Where the corridor ends", "fr": "Point d'arrivee du corridor"},
                    "column": 1, "columnSpan": 2, "order": 0, "required": True,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {"levels": [0, 1], "requiredLevels": [0]}
                }]
            },
            {
                "id": "corridor_info", "name": {"en": "Corridor Information", "fr": "Informations sur le corridor"},
                "order": 2, "columns": 2, "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "corridor_name", "type": "text", "code": "corridor_name",
                     "label": {"en": "Corridor Name", "fr": "Nom du corridor"},
                     "placeholder": {"en": "e.g. Sahel Central Corridor", "fr": "ex. Corridor Central du Sahel"},
                     "column": 1, "columnSpan": 2, "order": 0, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}},
                    {"id": "species", "type": "master-data-select", "code": "species",
                     "label": {"en": "Species", "fr": "Espece"},
                     "column": 1, "columnSpan": 1, "order": 1, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"masterDataType": "species-groups", "searchable": True}},
                    {"id": "estimated_animals", "type": "number", "code": "estimated_animals",
                     "label": {"en": "Estimated Animals", "fr": "Animaux estimes"},
                     "column": 2, "columnSpan": 1, "order": 2, "required": True,
                     "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}},
                    {"id": "cross_border", "type": "select", "code": "cross_border",
                     "label": {"en": "Cross-border Movement", "fr": "Mouvement transfrontalier"},
                     "column": 1, "columnSpan": 1, "order": 3, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"options": [
                         {"label": {"en": "Yes", "fr": "Oui"}, "value": "true"},
                         {"label": {"en": "No", "fr": "Non"}, "value": "false"}
                     ]}},
                    {"id": "corridor_status", "type": "select", "code": "corridor_status",
                     "label": {"en": "Corridor Status", "fr": "Statut du corridor"},
                     "column": 2, "columnSpan": 1, "order": 4, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"options": [
                         {"label": {"en": "Active", "fr": "Actif"}, "value": "active"},
                         {"label": {"en": "Inactive", "fr": "Inactif"}, "value": "inactive"},
                         {"label": {"en": "Disrupted", "fr": "Perturbe"}, "value": "disrupted"}
                     ]}}
                ]
            },
            {
                "id": "season", "name": {"en": "Season & Period", "fr": "Saison et periode"},
                "order": 3, "columns": 2, "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "season_start", "type": "date", "code": "season_start",
                     "label": {"en": "Season Start", "fr": "Debut de saison"},
                     "column": 1, "columnSpan": 1, "order": 0, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}},
                    {"id": "season_end", "type": "date", "code": "season_end",
                     "label": {"en": "Season End", "fr": "Fin de saison"},
                     "column": 2, "columnSpan": 1, "order": 1, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}},
                    {"id": "year", "type": "number", "code": "year",
                     "label": {"en": "Year", "fr": "Annee"},
                     "column": 1, "columnSpan": 1, "order": 2, "required": True,
                     "readOnly": False, "hidden": False, "validation": {"min": 2020, "max": 2030}, "conditions": [], "properties": {}}
                ]
            },
            {
                "id": "observations", "name": {"en": "Observations", "fr": "Observations"},
                "order": 4, "columns": 1, "isCollapsible": True, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "challenges", "type": "textarea", "code": "challenges",
                     "label": {"en": "Challenges & Conflicts", "fr": "Defis et conflits"},
                     "placeholder": {"en": "Security issues, resource conflicts, access restrictions...", "fr": "Problemes de securite, conflits de ressources, restrictions d'acces..."},
                     "column": 1, "columnSpan": 1, "order": 0, "required": False,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}},
                    {"id": "observations", "type": "textarea", "code": "observations",
                     "label": {"en": "Additional Observations", "fr": "Observations complementaires"},
                     "column": 1, "columnSpan": 1, "order": 1, "required": False,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}}
                ]
            },
            {
                "id": "route_gps", "name": {"en": "Corridor Route (GPS)", "fr": "Trace du corridor (GPS)"},
                "order": 5, "columns": 1, "isCollapsible": False, "isCollapsed": False, "isRepeatable": False, "conditions": [],
                "fields": [{
                    "id": "corridor_route", "type": "geo-selector", "code": "corridor_route",
                    "label": {"en": "Corridor Route", "fr": "Trace du corridor"},
                    "helpText": {"en": "Draw the corridor route on the map using the line tool", "fr": "Tracez le corridor sur la carte avec l'outil ligne"},
                    "column": 1, "columnSpan": 1, "order": 0, "required": False,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {"modes": ["line", "point"], "defaultMode": "line"}
                }]
            }
        ],
        "settings": {
            "allowDraft": True, "allowAttachments": True, "maxAttachments": 5,
            "allowOffline": True, "requireGeoLocation": False, "autoSaveInterval": 30,
            "submissionWorkflow": "review_then_validate", "notifyOnSubmit": [],
            "duplicateDetection": {"enabled": False, "fields": []}
        }
    }
}

print("Creating template...")
r = api_post("/api/v1/form-builder/templates", template)
if r.get("data", {}).get("id"):
    tid = r["data"]["id"]
    print(f"  Template: {tid}")
    r2 = api_post(f"/api/v1/form-builder/templates/{tid}/publish", {})
    print(f"  Status: {r2.get('data', {}).get('status', '?')}")

    ALL_55 = ["DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW"]
    print("Creating campaign...")
    r3 = api_post("/api/v1/workflow/campaigns", {
        "code": "LP_TRANSHUMANCE_CORRIDORS_2026",
        "name": {"en": "Transhumance Corridors Mapping 2026", "fr": "Cartographie des corridors de transhumance 2026", "pt": "Mapeamento dos corredores de transumancia 2026"},
        "description": {"en": "Annual mapping and monitoring of transhumance corridors, seasonal movements, and cross-border livestock flows", "fr": "Cartographie et suivi annuel des corridors de transhumance, mouvements saisonniers et flux transfrontaliers de betail", "pt": "Mapeamento e monitoramento anual dos corredores de transumancia, movimentos sazonais e fluxos transfronteiricos de gado"},
        "domain": "livestock", "formTemplateId": tid,
        "startDate": "2026-01-01", "endDate": "2026-12-31",
        "targetCountries": ALL_55, "targetSubmissions": 200, "targetPerAgent": 5,
        "frequency": "annual", "scope": "continental",
        "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"
    })
    if r3.get("data", {}).get("id"):
        print(f"  Campaign: {r3['data']['id']}")
    else:
        print(f"  Campaign error: {r3.get('message', '')}")
else:
    print(f"  Error: {r.get('message', '')}")

ssh.close()
print("DONE")
