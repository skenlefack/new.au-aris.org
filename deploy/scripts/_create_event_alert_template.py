"""Create the Animal Health Event Alert form template and publish it."""
import paramiko, sys, json

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SSH_PASS = "@u-1baR.0rg$U24"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.183", username="arisadmin", password=SSH_PASS, timeout=15, allow_agent=False, look_for_keys=False)

# Login
_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    '-d \'{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}\' 2>/dev/null',
    timeout=15,
)
token = json.loads(stdout.read().decode())["data"]["accessToken"]

template = {
    "name": "Animal Health Event Alert",
    "domain": "animal_health",
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
                    "helpText": {"en": "Select country, region and district", "fr": "Selectionnez le pays, la region et le district"},
                    "column": 1, "columnSpan": 2, "order": 0, "required": True,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {"levels": [0, 1, 2], "requiredLevels": [0]}
                }]
            },
            {
                "id": "disease_info", "name": {"en": "Disease Information", "fr": "Informations sur la maladie", "pt": "Informacoes sobre a doenca"},
                "order": 1, "columns": 2, "isCollapsible": False, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "disease", "type": "master-data-select", "code": "disease",
                     "label": {"en": "Disease (WOAH list)", "fr": "Maladie (liste WOAH)", "pt": "Doenca (lista WOAH)"},
                     "column": 1, "columnSpan": 1, "order": 0, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"masterDataType": "diseases", "searchable": True}},
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
                    {"id": "event_type", "type": "select", "code": "event_type",
                     "label": {"en": "Event Type", "fr": "Type d'evenement", "pt": "Tipo de evento"},
                     "column": 1, "columnSpan": 1, "order": 2, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"options": [
                         {"label": {"en": "Suspected outbreak", "fr": "Foyer suspecte"}, "value": "suspected"},
                         {"label": {"en": "Confirmed outbreak", "fr": "Foyer confirme"}, "value": "confirmed"},
                         {"label": {"en": "Unusual mortality", "fr": "Mortalite inhabituelle"}, "value": "unusual_mortality"},
                         {"label": {"en": "Emerging disease", "fr": "Maladie emergente"}, "value": "emerging"}
                     ]}},
                    {"id": "date_onset", "type": "date", "code": "date_onset",
                     "label": {"en": "Date of Onset", "fr": "Date d'apparition", "pt": "Data de inicio"},
                     "column": 2, "columnSpan": 1, "order": 3, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}}
                ]
            },
            {
                "id": "impact", "name": {"en": "Impact", "fr": "Impact", "pt": "Impacto"},
                "order": 2, "columns": 3, "isCollapsible": False, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "species_affected", "type": "master-data-select", "code": "species_affected",
                     "label": {"en": "Species Affected", "fr": "Especes affectees", "pt": "Especies afetadas"},
                     "column": 1, "columnSpan": 1, "order": 0, "required": True,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"masterDataType": "species-groups", "searchable": True}},
                    {"id": "cases", "type": "number", "code": "cases",
                     "label": {"en": "Number of Cases", "fr": "Nombre de cas", "pt": "Numero de casos"},
                     "column": 2, "columnSpan": 1, "order": 1, "required": True,
                     "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}},
                    {"id": "deaths", "type": "number", "code": "deaths",
                     "label": {"en": "Number of Deaths", "fr": "Nombre de deces", "pt": "Numero de mortes"},
                     "column": 3, "columnSpan": 1, "order": 2, "required": False,
                     "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}},
                    {"id": "susceptible", "type": "number", "code": "susceptible",
                     "label": {"en": "Susceptible Population", "fr": "Population sensible"},
                     "column": 1, "columnSpan": 1, "order": 3, "required": False,
                     "readOnly": False, "hidden": False, "validation": {"min": 0}, "conditions": [], "properties": {}},
                    {"id": "source_infection", "type": "master-data-select", "code": "source_infection",
                     "label": {"en": "Source of Infection", "fr": "Source d'infection"},
                     "column": 2, "columnSpan": 1, "order": 4, "required": False,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"masterDataType": "contamination-sources", "searchable": True}},
                    {"id": "diagnosis_basis", "type": "master-data-select", "code": "diagnosis_basis",
                     "label": {"en": "Basis of Diagnosis", "fr": "Base du diagnostic"},
                     "column": 3, "columnSpan": 1, "order": 5, "required": False,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                     "properties": {"masterDataType": "sample-types", "searchable": True}}
                ]
            },
            {
                "id": "details", "name": {"en": "Details & Measures", "fr": "Details et mesures", "pt": "Detalhes e medidas"},
                "order": 3, "columns": 1, "isCollapsible": True, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [
                    {"id": "description", "type": "textarea", "code": "description",
                     "label": {"en": "Event Description", "fr": "Description de l'evenement"},
                     "placeholder": {"en": "Describe clinical signs, epidemiological context...", "fr": "Decrire les signes cliniques, le contexte epidemiologique..."},
                     "column": 1, "columnSpan": 1, "order": 0, "required": True,
                     "readOnly": False, "hidden": False, "validation": {"min": 10}, "conditions": [], "properties": {}},
                    {"id": "control_measures", "type": "textarea", "code": "control_measures",
                     "label": {"en": "Control Measures Taken", "fr": "Mesures de lutte prises"},
                     "placeholder": {"en": "Movement restrictions, vaccination, quarantine...", "fr": "Restrictions de mouvement, vaccination, quarantaine..."},
                     "column": 1, "columnSpan": 1, "order": 1, "required": False,
                     "readOnly": False, "hidden": False, "validation": {}, "conditions": [], "properties": {}}
                ]
            },
            {
                "id": "gps", "name": {"en": "GPS Coordinates", "fr": "Coordonnees GPS", "pt": "Coordenadas GPS"},
                "order": 4, "columns": 1, "isCollapsible": True, "isCollapsed": False,
                "isRepeatable": False, "conditions": [],
                "fields": [{
                    "id": "geo_location", "type": "geo-selector", "code": "geo_location",
                    "label": {"en": "Geographic Coordinates", "fr": "Coordonnees geographiques"},
                    "helpText": {"en": "Mark the event location on the map (point, line or polygon)", "fr": "Marquez la localisation sur la carte (point, trace ou polygone)"},
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

# Write to server
sftp = ssh.open_sftp()
with sftp.open("/tmp/event_alert.json", "w") as f:
    f.write(json.dumps(template))
sftp.close()

# Create
_, stdout, _ = ssh.exec_command(
    f'curl -sk -X POST "https://localhost/api/v1/form-builder/templates" '
    f'-H "Authorization: Bearer {token}" '
    f'-H "Content-Type: application/json" '
    f'-d @/tmp/event_alert.json 2>/dev/null',
    timeout=15,
)
out = stdout.read().decode()
result = json.loads(out)
if result.get("data", {}).get("id"):
    tid = result["data"]["id"]
    print(f"Template created: {tid}")

    # Publish
    _, stdout2, _ = ssh.exec_command(
        f'curl -sk -X POST "https://localhost/api/v1/form-builder/templates/{tid}/publish" '
        f'-H "Authorization: Bearer {token}" 2>/dev/null',
        timeout=10,
    )
    r2 = json.loads(stdout2.read().decode())
    print(f"Status: {r2.get('data', {}).get('status', '?')}")
else:
    print(f"Error: {result.get('message', out[:300])}")

ssh.exec_command("rm -f /tmp/event_alert.json")
ssh.close()
