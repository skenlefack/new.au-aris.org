"""Create Livestock & Production Event Alert template and publish it."""
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
    "name": "Livestock & Production Event Alert",
    "domain": "livestock-prod",
    "formType": "EVENT_ALERT",
    "schema": {
        "sections": [
            {
                "id": "location", "name": {"en": "Location", "fr": "Localisation", "pt": "Localizacao"},
                "order": 0, "columns": 2, "isCollapsible": False, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [{
                    "id": "admin_location", "type": "admin-location", "code": "admin_location",
                    "label": {"en": "Administrative Location", "fr": "Localisation administrative", "pt": "Localizacao administrativa"},
                    "column": 1, "columnSpan": 2, "order": 0, "required": True,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {"levels": [0, 1, 2], "requiredLevels": [0]}
                }]
            },
            {
                "id": "event_info", "name": {"en": "Event Information", "fr": "Informations sur l'evenement", "pt": "Informacoes do evento"},
                "order": 1, "columns": 2, "isCollapsible": False, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "event_type", "type": "select", "code": "event_type",
                     "label": {"en": "Event Type", "fr": "Type d'evenement", "pt": "Tipo de evento"},
                     "column": 1, "columnSpan": 1, "order": 0, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"options": [
                         {"label": {"en": "Census Discrepancy", "fr": "Ecart de recensement"}, "value": "census_discrepancy"},
                         {"label": {"en": "Movement Restriction", "fr": "Restriction de mouvement"}, "value": "movement_restriction"},
                         {"label": {"en": "Feed Shortage", "fr": "Penurie alimentaire"}, "value": "feed_shortage"},
                         {"label": {"en": "Market Disruption", "fr": "Perturbation du marche"}, "value": "market_disruption"},
                         {"label": {"en": "Transhumance Conflict", "fr": "Conflit de transhumance"}, "value": "transhumance_conflict"},
                         {"label": {"en": "Production Decline", "fr": "Baisse de production"}, "value": "production_decline"},
                         {"label": {"en": "Other", "fr": "Autre"}, "value": "other"}
                     ]}},
                    {"id": "severity", "type": "select", "code": "severity",
                     "label": {"en": "Severity", "fr": "Gravite", "pt": "Gravidade"},
                     "column": 2, "columnSpan": 1, "order": 1, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"options": [
                         {"label": {"en": "Low", "fr": "Faible"}, "value": "low"},
                         {"label": {"en": "Medium", "fr": "Moyen"}, "value": "medium"},
                         {"label": {"en": "High", "fr": "Eleve"}, "value": "high"},
                         {"label": {"en": "Critical", "fr": "Critique"}, "value": "critical"}
                     ]}},
                    {"id": "date_event", "type": "date", "code": "date_event",
                     "label": {"en": "Date of Event", "fr": "Date de l'evenement"},
                     "column": 1, "columnSpan": 1, "order": 2, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}},
                    {"id": "species", "type": "master-data-select", "code": "species",
                     "label": {"en": "Species Affected", "fr": "Especes affectees"},
                     "column": 2, "columnSpan": 1, "order": 3, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"masterDataType": "species-groups", "searchable": True}}
                ]
            },
            {
                "id": "impact", "name": {"en": "Impact", "fr": "Impact", "pt": "Impacto"},
                "order": 2, "columns": 3, "isCollapsible": False, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "animals_affected", "type": "number", "code": "animals_affected",
                     "label": {"en": "Animals Affected", "fr": "Animaux affectes"},
                     "column": 1, "columnSpan": 1, "order": 0, "required": True,
                     "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}},
                    {"id": "animals_lost", "type": "number", "code": "animals_lost",
                     "label": {"en": "Animals Lost", "fr": "Animaux perdus"},
                     "column": 2, "columnSpan": 1, "order": 1, "required": False,
                     "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}},
                    {"id": "production_system", "type": "master-data-select", "code": "production_system",
                     "label": {"en": "Production System", "fr": "Systeme de production"},
                     "column": 3, "columnSpan": 1, "order": 2, "required": False,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"masterDataType": "production-systems", "searchable": True}}
                ]
            },
            {
                "id": "details", "name": {"en": "Details & Actions", "fr": "Details et actions"},
                "order": 3, "columns": 1, "isCollapsible": True, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "description", "type": "textarea", "code": "description",
                     "label": {"en": "Event Description", "fr": "Description de l'evenement"},
                     "placeholder": {"en": "Describe the situation, affected areas, and context...", "fr": "Decrivez la situation, les zones affectees et le contexte..."},
                     "column": 1, "columnSpan": 1, "order": 0, "required": True,
                     "readOnly": False, "hidden": False, "validation": {"min": 10}, "conditions": [], "properties": {}},
                    {"id": "actions_taken", "type": "textarea", "code": "actions_taken",
                     "label": {"en": "Actions Taken", "fr": "Mesures prises"},
                     "column": 1, "columnSpan": 1, "order": 1, "required": False,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}}
                ]
            },
            {
                "id": "gps", "name": {"en": "GPS Coordinates", "fr": "Coordonnees GPS"},
                "order": 4, "columns": 1, "isCollapsible": True, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [{
                    "id": "geo_location", "type": "geo-selector", "code": "geo_location",
                    "label": {"en": "Geographic Coordinates", "fr": "Coordonnees geographiques"},
                    "column": 1, "columnSpan": 1, "order": 0, "required": False,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {"modes": ["point", "line", "polygon"], "defaultMode": "point"}
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

sftp = ssh.open_sftp()
with sftp.open("/tmp/livestock_alert.json", "w") as f:
    f.write(json.dumps(template))
sftp.close()

_, stdout, _ = ssh.exec_command(
    f'curl -sk -X POST "https://localhost/api/v1/form-builder/templates" '
    f'-H "Authorization: Bearer {token}" -H "Content-Type: application/json" '
    f'-d @/tmp/livestock_alert.json 2>/dev/null', timeout=15)
result = json.loads(stdout.read().decode())
if result.get("data", {}).get("id"):
    tid = result["data"]["id"]
    print(f"Template created: {tid}")
    _, stdout2, _ = ssh.exec_command(
        f'curl -sk -X POST "https://localhost/api/v1/form-builder/templates/{tid}/publish" '
        f'-H "Authorization: Bearer {token}" 2>/dev/null', timeout=10)
    r2 = json.loads(stdout2.read().decode())
    print(f"Status: {r2.get('data', {}).get('status', '?')}")
else:
    print(f"Error: {result.get('message', '')}")

ssh.exec_command("rm -f /tmp/livestock_alert.json")
ssh.close()
