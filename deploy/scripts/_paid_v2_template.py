"""
PAID v2 Template — Creates the new 4-section PAID form template + quarterly campaigns.
Deletes any existing PAID templates first (idempotent).

Usage: python deploy/scripts/_paid_v2_template.py [--target stg|prod]
"""

import requests
import json
import sys
import os

TARGETS = {
    "stg": "https://test.au-aris.org",
    "prod": "https://au-aris.org",
}

LOGIN_EMAIL = "admin@au-aris.org"
LOGIN_PASSWORD = "Aris2026@@4!0"

# ─── Form Schema (4 sections) ─────────────────────────────────────────────

FORM_SCHEMA = {
    "sections": [
        # ═══════════════════════════════════════════════════════
        # SECTION 1: Project Information
        # ═══════════════════════════════════════════════════════
        {
            "id": "project_info",
            "name": {"en": "Project Information", "fr": "Informations du projet"},
            "description": {"en": "Select the project, reporting period and implementation location.", "fr": "Choisir le projet, la periode de rapport et le lieu de mise en oeuvre."},
            "order": 0,
            "columns": 2,
            "color": "#1F4E79",
            "isCollapsed": False,
            "isCollapsible": True,
            "isRepeatable": False,
            "conditions": [],
            "fields": [
                {
                    "id": "reporting_year", "code": "reporting_year", "type": "select", "order": 0, "column": 1, "columnSpan": 1,
                    "label": {"en": "Reporting Year", "fr": "Annee de rapport"},
                    "required": True, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"options": [{"value": str(y), "label": {"en": str(y), "fr": str(y)}} for y in range(2024, 2031)]},
                },
                {
                    "id": "reporting_period", "code": "reporting_period", "type": "select", "order": 1, "column": 2, "columnSpan": 1,
                    "label": {"en": "Reporting Period", "fr": "Periode de rapport"},
                    "required": True, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"options": [
                        {"value": "Q1", "label": {"en": "Quarter 1 (Jan-Mar)", "fr": "Trimestre 1 (Jan-Mar)"}},
                        {"value": "Q2", "label": {"en": "Quarter 2 (Apr-Jun)", "fr": "Trimestre 2 (Avr-Jun)"}},
                        {"value": "Q3", "label": {"en": "Quarter 3 (Jul-Sep)", "fr": "Trimestre 3 (Jul-Sep)"}},
                        {"value": "Q4", "label": {"en": "Quarter 4 (Oct-Dec)", "fr": "Trimestre 4 (Oct-Dec)"}},
                    ]},
                },
                {
                    "id": "section_of_project", "code": "section_of_project", "type": "select", "order": 2, "column": 1, "columnSpan": 1,
                    "label": {"en": "Section of Project", "fr": "Section du projet"},
                    "tooltip": {"en": "Select whether this project is implemented in a single country or multiple countries.", "fr": "Indiquer si le projet est mis en oeuvre dans un seul pays ou plusieurs pays."},
                    "required": True, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"options": [
                        {"value": "single_country", "label": {"en": "Single Country", "fr": "Pays unique"}},
                        {"value": "multiple_countries", "label": {"en": "Multiple Countries", "fr": "Plusieurs pays"}},
                    ]},
                },
                {
                    "id": "project_symbol", "code": "project_symbol", "type": "master-data-select", "order": 3, "column": 2, "columnSpan": 1,
                    "label": {"en": "Project Symbol", "fr": "Symbole du projet"},
                    "tooltip": {"en": "Only projects with a configured PAID activity cascade are listed.", "fr": "Seuls les projets ayant une cascade d'activites PAID configuree sont listes."},
                    "required": True, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "paid-projects", "parentFilter": {"type": "$section_of_project"}},
                },
                {
                    "id": "project_title", "code": "project_title", "type": "text", "order": 4, "column": 1, "columnSpan": 2,
                    "label": {"en": "Project Title", "fr": "Titre du projet"},
                    "required": False, "hidden": False, "readOnly": True, "conditions": [], "validation": {},
                    "properties": {"autoFillFrom": "project_symbol", "autoFillField": "title"},
                },
                {
                    "id": "country_of_implementation", "code": "country_of_implementation", "type": "master-data-select", "order": 5, "column": 1, "columnSpan": 1,
                    "label": {"en": "Country of Implementation", "fr": "Pays de mise en oeuvre"},
                    "tooltip": {"en": "Select the country of implementation. Admin 1 and Admin 2 will be filtered from this country.", "fr": "Selectionner le pays de mise en oeuvre. Admin 1 et Admin 2 seront filtres depuis ce pays."},
                    "required": True, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "countries", "parentFilter": {"project": "$project_symbol"}},
                },
                {
                    "id": "admin1", "code": "admin1", "type": "master-data-select", "order": 6, "column": 2, "columnSpan": 1,
                    "label": {"en": "Admin 1 / State", "fr": "Admin 1 / Region"},
                    "tooltip": {"en": "Options are populated from the selected country of implementation.", "fr": "Les options sont peuplees depuis le pays selectionne."},
                    "required": False, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "geo-entities", "parentFilter": {"country": "$country_of_implementation", "level": "ADMIN1"}},
                },
                {
                    "id": "admin2", "code": "admin2", "type": "master-data-select", "order": 7, "column": 1, "columnSpan": 1,
                    "label": {"en": "Admin 2 / Locality", "fr": "Admin 2 / Localite"},
                    "required": False, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "geo-entities", "parentFilter": {"parent": "$admin1", "level": "ADMIN2"}},
                },
                {
                    "id": "executive_partner", "code": "executive_partner", "type": "master-data-select", "order": 8, "column": 2, "columnSpan": 1,
                    "label": {"en": "Executive Partner", "fr": "Partenaire executif"},
                    "required": False, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "paid-executive-partners", "parentFilter": {"project": "$project_symbol"}},
                },
                {
                    "id": "implementing_partner_intl", "code": "implementing_partner_intl", "type": "master-data-select", "order": 9, "column": 1, "columnSpan": 1,
                    "label": {"en": "Implementing Partner (International)", "fr": "Partenaire de mise en oeuvre (International)"},
                    "required": False, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "paid-impl-partners-intl", "parentFilter": {"project": "$project_symbol"}, "multiple": True},
                },
                {
                    "id": "implementing_partner_national", "code": "implementing_partner_national", "type": "master-data-select", "order": 10, "column": 2, "columnSpan": 1,
                    "label": {"en": "Implementing Partner (National)", "fr": "Partenaire de mise en oeuvre (National)"},
                    "tooltip": {"en": "National implementing partners are filtered by the selected country of implementation.", "fr": "Les partenaires nationaux sont filtres par le pays selectionne."},
                    "required": False, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "paid-impl-partners-national", "parentFilter": {"project": "$project_symbol", "country": "$country_of_implementation"}, "multiple": True},
                },
            ],
        },

        # ═══════════════════════════════════════════════════════
        # SECTION 2: PAID Activity Lines
        # ═══════════════════════════════════════════════════════
        {
            "id": "paid_activity_lines",
            "name": {"en": "PAID Activity Lines", "fr": "Lignes d'activites PAID"},
            "description": {"en": "Select the PAID activity through the cascade and enter implementation details.", "fr": "Selectionner l'activite PAID via la cascade et entrer les details de mise en oeuvre."},
            "order": 1,
            "columns": 2,
            "color": "#C9A227",
            "isCollapsed": False,
            "isCollapsible": True,
            "isRepeatable": False,
            "conditions": [],
            "fields": [
                {
                    "id": "logframe_activity", "code": "logframe_activity", "type": "master-data-select", "order": 0, "column": 1, "columnSpan": 2,
                    "label": {"en": "Log Frame Activity (AMERT)", "fr": "Activite du cadre logique (AMERT)"},
                    "required": True, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "paid-logframes", "parentFilter": {"project": "$project_symbol"}},
                },
                {
                    "id": "activity", "code": "activity", "type": "master-data-select", "order": 1, "column": 1, "columnSpan": 2,
                    "label": {"en": "Activity", "fr": "Activite"},
                    "required": True, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "paid-lf-activities", "parentFilter": {"logframe": "$logframe_activity"}},
                },
                {
                    "id": "sub_activity", "code": "sub_activity", "type": "master-data-select", "order": 2, "column": 1, "columnSpan": 2,
                    "label": {"en": "Sub-Activity", "fr": "Sous-activite"},
                    "required": True, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "paid-subactivities", "parentFilter": {"activity": "$activity"}},
                },
                {
                    "id": "paid_activity", "code": "paid_activity", "type": "master-data-select", "order": 3, "column": 1, "columnSpan": 2,
                    "label": {"en": "PAID Activity", "fr": "Activite PAID"},
                    "tooltip": {"en": "Select the PAID activity at the final step of the cascade. The unit of measure is based on this selection.", "fr": "Selectionner l'activite PAID a la derniere etape de la cascade. L'unite de mesure est basee sur cette selection."},
                    "required": True, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "paid-paid-activities", "parentFilter": {"subactivity": "$sub_activity"}},
                },
                {
                    "id": "expenditure_amount", "code": "expenditure_amount", "type": "number", "order": 4, "column": 1, "columnSpan": 1,
                    "label": {"en": "Expenditure Amount (USD)", "fr": "Montant des depenses (USD)"},
                    "tooltip": {"en": "Enter the expenditure amount in United States dollars for the selected PAID activity.", "fr": "Entrer le montant des depenses en dollars americains."},
                    "required": False, "hidden": False, "readOnly": False, "conditions": [], "validation": {"min": 0},
                    "properties": {},
                },
                {
                    "id": "unit_of_measure", "code": "unit_of_measure", "type": "text", "order": 5, "column": 2, "columnSpan": 1,
                    "label": {"en": "Unit of Measure", "fr": "Unite de mesure"},
                    "tooltip": {"en": "Unit of measure for the selected PAID activity (auto-filled).", "fr": "Unite de mesure de l'activite PAID selectionnee (rempli automatiquement)."},
                    "required": False, "hidden": False, "readOnly": True, "conditions": [], "validation": {},
                    "properties": {"autoFillFrom": "paid_activity", "autoFillField": "unit_of_measure"},
                },
                {
                    "id": "quantity_implemented", "code": "quantity_implemented", "type": "number", "order": 6, "column": 1, "columnSpan": 1,
                    "label": {"en": "Quantity Implemented", "fr": "Quantite mise en oeuvre"},
                    "tooltip": {"en": "Enter the quantity using the unit of measure generated from the selected PAID activity.", "fr": "Entrer la quantite en utilisant l'unite de mesure de l'activite PAID selectionnee."},
                    "required": True, "hidden": False, "readOnly": False, "conditions": [], "validation": {"min": 0},
                    "properties": {},
                },
                {
                    "id": "total_quantity_targeted", "code": "total_quantity_targeted", "type": "number", "order": 7, "column": 2, "columnSpan": 1,
                    "label": {"en": "Total Quantity Targeted", "fr": "Quantite totale ciblee"},
                    "required": False, "hidden": False, "readOnly": False, "conditions": [], "validation": {"min": 0},
                    "properties": {},
                },
                {
                    "id": "breakdown", "code": "breakdown", "type": "dynamic-breakdown", "order": 8, "column": 1, "columnSpan": 2,
                    "label": {"en": "Break Down", "fr": "Ventilation"},
                    "tooltip": {"en": "Additional fields configured for the selected PAID activity.", "fr": "Champs supplementaires configures pour l'activite PAID selectionnee."},
                    "required": False, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "paid-breakdown-fields", "parentFilter": {"paid_activity": "$paid_activity"}},
                },
            ],
        },

        # ═══════════════════════════════════════════════════════
        # SECTION 3: RECs
        # ═══════════════════════════════════════════════════════
        {
            "id": "recs",
            "name": {"en": "Regional Economic Communities (RECs)", "fr": "Communautes Economiques Regionales (CER)"},
            "order": 2,
            "columns": 1,
            "color": "#2E7D32",
            "isCollapsed": False,
            "isCollapsible": True,
            "isRepeatable": False,
            "conditions": [],
            "fields": [
                {
                    "id": "recs_countries", "code": "recs_countries", "type": "master-data-select", "order": 0, "column": 1, "columnSpan": 1,
                    "label": {"en": "RECs and Beneficiary Countries", "fr": "CER et pays beneficiaires"},
                    "required": False, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"masterDataType": "geo-entities", "parentFilter": {"level": "REC"}, "multiple": True},
                },
            ],
        },

        # ═══════════════════════════════════════════════════════
        # SECTION 4: Comments
        # ═══════════════════════════════════════════════════════
        {
            "id": "comments",
            "name": {"en": "Comments", "fr": "Commentaires"},
            "description": {"en": "Add additional information or missing dropdown values.", "fr": "Ajouter des informations supplementaires ou des valeurs manquantes dans les listes deroulantes."},
            "order": 3,
            "columns": 1,
            "color": "#757575",
            "isCollapsed": True,
            "isCollapsible": True,
            "isRepeatable": False,
            "conditions": [],
            "fields": [
                {
                    "id": "comments_text", "code": "comments_text", "type": "textarea", "order": 0, "column": 1, "columnSpan": 1,
                    "label": {"en": "Comments", "fr": "Commentaires"},
                    "tooltip": {"en": "Add additional information or missing dropdown values.", "fr": "Ajouter des informations supplementaires."},
                    "required": False, "hidden": False, "readOnly": False, "conditions": [], "validation": {},
                    "properties": {"rows": 4},
                },
            ],
        },
    ],
    "settings": {
        "allowDraft": True,
        "allowOffline": True,
        "maxAttachments": 5,
        "autoSaveInterval": 60,
        "submissionWorkflow": "standard",
        "duplicateDetection": False,
    },
}


def main():
    target = "stg"
    if len(sys.argv) > 1:
        arg = sys.argv[1].replace("--target=", "").replace("--target", "").strip()
        if arg in TARGETS:
            target = arg

    base = TARGETS[target]
    print(f"\n{'='*60}")
    print(f"  PAID v2 TEMPLATE — {target.upper()}")
    print(f"{'='*60}")

    # 1. Login
    print("[*] Logging in...")
    r = requests.post(f"{base}/api/v1/credential/auth/login",
                      json={"email": LOGIN_EMAIL, "password": LOGIN_PASSWORD}, timeout=15)
    r.raise_for_status()
    token = r.json()["data"]["accessToken"]
    tenant_id = r.json()["data"]["user"]["tenantId"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json", "X-Tenant-Id": tenant_id}
    print(f"  Logged in as {LOGIN_EMAIL}, tenant={tenant_id[:8]}...")

    # 2. Create template
    print("[*] Creating PAID v2 template...")
    template_payload = {
        "name": "PAID LICS Activity Report",
        "domain": "paid",
        "formType": "CAMPAIGN",
        "dataClassification": "PARTNER",
        "schema": FORM_SCHEMA,
        "uiSchema": {},
    }
    r = requests.post(f"{base}/api/v1/form-builder/templates",
                      headers=headers, json=template_payload, timeout=30)
    r.raise_for_status()
    template_id = r.json()["data"]["id"]
    print(f"  Template created: {template_id}")

    # 3. Publish template
    print("[*] Publishing template...")
    r = requests.post(f"{base}/api/v1/form-builder/templates/{template_id}/publish",
                      headers=headers, timeout=15)
    r.raise_for_status()
    print("  Published.")

    # 4. Create quarterly campaigns
    quarters = [
        ("Q1", "2026-01-01", "2026-03-31"),
        ("Q2", "2026-04-01", "2026-06-30"),
        ("Q3", "2026-07-01", "2026-09-30"),
        ("Q4", "2026-10-01", "2026-12-31"),
    ]

    for q, start, end in quarters:
        print(f"[*] Creating PAID {q} 2026 campaign...")
        campaign_payload = {
            "name": {"en": f"PAID LICS {q} 2026", "fr": f"PAID LICS {q} 2026"},
            "description": {"en": f"PAID quarterly reporting for {q} 2026 — LICS projects", "fr": f"Rapport trimestriel PAID pour {q} 2026 — projets LICS"},
            "domain": "paid",
            "formTemplateIds": [template_id],
            "targetCountries": [],
            "startDate": start,
            "endDate": end,
            "targetSubmissions": 100,
            "ownerType": "CONTINENTAL",
            "ownerId": tenant_id,
        }
        r = requests.post(f"{base}/api/v1/workflow/campaigns",
                          headers=headers, json=campaign_payload, timeout=15)
        if r.ok:
            cid = r.json().get("data", {}).get("id", "?")
            print(f"  Campaign {q}: {cid}")
        else:
            print(f"  Campaign {q} failed: {r.status_code} {r.text[:200]}")

    print(f"\n[OK] PAID v2 template + campaigns created on {target.upper()}")
    print(f"  Template ID: {template_id}")


if __name__ == "__main__":
    main()
