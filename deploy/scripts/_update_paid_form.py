#!/usr/bin/env python3
"""
Update the PAID form template schema to Phase 2 spec:
- D1: prj_symbol → master-data-select (paid-projects)
- D2: prj_title → readonly text
- D3: implem_partner_intl → master-data-select (paid-partners-intl)
- D4: implem_partner_local → master-data-select (paid-partners-national)
- D5: prod_sector → master-data-select (paid-sectors)
- D6: activity_type → master-data-select (paid-activities, cascade by sector)
- D7: species_variety → master-data-select (paid-species, cascade by sector)
- D8: prod_system → master-data-select (paid-production-systems, cascade by sector+species)
- D9: disease_pest → master-data-select (paid-diseases, cascade by sector+species)
- D10: cash_amount → rename to expenditure_amount
- D11: NEW project_status select
- D12: Remove budget_proportion
- D13-D18: New beneficiary fields
- Section titles
"""

import paramiko
import sys
import json
import copy

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
FORM_ID = "6ca5e44b-a7a0-4b90-8276-9600e3bf4783"

TARGETS = {
    "STAGING": {"db_host": "10.202.101.148", "container": "aris-stg-postgres", "db_pass": "Ar1s_Stg_2024!xK9mZ"},
    "PROD":    {"db_host": "10.202.101.185", "container": "aris-postgres",     "db_pass": "Ar1s_Pr0d_2024!xK9mZ"},
}


def ml(en, fr='', pt='', ar=''):
    """Create multilingual text."""
    return {"en": en, "fr": fr or en, "pt": pt or '', "ar": ar or ''}


def make_field(code, label_en, label_fr, ftype, required=False, **props):
    """Create a form field dict."""
    import uuid
    return {
        "id": str(uuid.uuid4()),
        "code": code,
        "label": ml(label_en, label_fr),
        "type": ftype,
        "required": required,
        "properties": props,
    }


def update_schema(schema):
    """Apply all Phase 2 modifications to the schema."""
    sections = schema.get("sections", [])

    # ── S0: Project Information (reporting) ──
    if len(sections) > 0:
        sections[0]["title"] = ml("Project Information", "Informations du projet")

    # ── S1: Project & Location ──
    if len(sections) > 1:
        sections[1]["title"] = ml("Project & Location", "Projet et localisation")
        for f in sections[1]["fields"]:
            # D1: prj_symbol → master-data-select
            if f["code"] == "prj_symbol":
                f["type"] = "master-data-select"
                f["label"] = ml("Project Symbol", "Symbole du projet")
                f["required"] = True
                f["properties"] = {
                    "masterDataType": "paid-projects",
                    "searchable": True,
                    "multiple": False,
                    "parentFilter": {"country": "$admin_location"},
                }

            # D2: prj_title → readonly
            if f["code"] == "prj_title":
                f["properties"] = {**f.get("properties", {}), "readonly": True}
                f["label"] = ml("Project Title (auto-filled)", "Titre du projet (auto)")

    # ── S2: Partners ──
    if len(sections) > 2:
        sections[2]["title"] = ml("Implementing Partners", "Partenaires de mise en oeuvre")
        for f in sections[2]["fields"]:
            # D3: implem_partner_intl → master-data-select
            if f["code"] == "implem_partner_intl":
                f["type"] = "master-data-select"
                f["label"] = ml("Implementing Partner (International)", "Partenaire (International)")
                f["properties"] = {
                    "masterDataType": "paid-partners-intl",
                    "searchable": True,
                    "multiple": False,
                }

            # D4: implem_partner_local → master-data-select
            if f["code"] == "implem_partner_local":
                f["type"] = "master-data-select"
                f["label"] = ml("Implementing Partner (National)", "Partenaire (National)")
                f["properties"] = {
                    "masterDataType": "paid-partners-national",
                    "searchable": True,
                    "multiple": False,
                    "parentFilter": {"country": "$admin_location"},
                }

    # ── S3: Activity/Output Information ──
    if len(sections) > 3:
        sections[3]["title"] = ml("Activity / Output Information", "Information sur les activites")
        new_fields = []
        for f in sections[3]["fields"]:
            # D5: prod_sector → master-data-select (paid-sectors)
            if f["code"] == "prod_sector":
                f["type"] = "master-data-select"
                f["label"] = ml("Sector of Production", "Secteur de production")
                f["required"] = True
                f["properties"] = {
                    "masterDataType": "paid-sectors",
                    "searchable": False,
                    "multiple": False,
                }
                new_fields.append(f)

            # D6: activity_type → master-data-select (paid-activities)
            elif f["code"] == "activity_type":
                f["type"] = "master-data-select"
                f["label"] = ml("Type of Activity / Output", "Type d'activite / produit")
                f["required"] = True
                f["properties"] = {
                    "masterDataType": "paid-activities",
                    "searchable": True,
                    "multiple": False,
                    "parentFilter": {"sector": "$prod_sector"},
                }
                new_fields.append(f)

            # D10: cash_amount → expenditure_amount
            elif f["code"] == "cash_amount":
                f["code"] = "expenditure_amount"
                f["label"] = ml("Expenditure Amount (USD)", "Montant des depenses (USD)")
                new_fields.append(f)

            # D7: species_variety → master-data-select
            elif f["code"] == "species_variety":
                f["type"] = "master-data-select"
                f["label"] = ml("Species / Variety", "Espece / Variete")
                f["properties"] = {
                    "masterDataType": "paid-species",
                    "searchable": True,
                    "multiple": False,
                    "parentFilter": {"sector": "$prod_sector"},
                }
                new_fields.append(f)

            # D8: prod_system → master-data-select
            elif f["code"] == "prod_system":
                f["type"] = "master-data-select"
                f["label"] = ml("Production System", "Systeme de production")
                f["properties"] = {
                    "masterDataType": "paid-production-systems",
                    "searchable": True,
                    "multiple": False,
                    "parentFilter": {"sector": "$prod_sector", "species": "$species_variety"},
                }
                new_fields.append(f)

            # D9: disease_pest → master-data-select
            elif f["code"] == "disease_pest":
                f["type"] = "master-data-select"
                f["label"] = ml("Disease / Pest", "Maladie / Ravageur")
                f["properties"] = {
                    "masterDataType": "paid-diseases",
                    "searchable": True,
                    "multiple": False,
                    "parentFilter": {"sector": "$prod_sector", "species": "$species_variety"},
                }
                new_fields.append(f)

            # D12: Remove budget_proportion
            elif f["code"] == "budget_proportion":
                continue  # skip

            else:
                new_fields.append(f)

        # D11: Add project_status after cva_delivery
        import uuid
        project_status = {
            "id": str(uuid.uuid4()),
            "code": "project_status",
            "label": ml("Project Status", "Statut du projet"),
            "type": "select",
            "required": False,
            "options": [
                {"value": "ongoing", "label": ml("Ongoing", "En cours")},
                {"value": "completed", "label": ml("Completed", "Termine")},
                {"value": "on_hold", "label": ml("On Hold", "En attente")},
            ],
            "properties": {},
        }

        # Insert project_status after cash_plus
        idx = next((i for i, f in enumerate(new_fields) if f["code"] == "cash_plus"), len(new_fields))
        new_fields.insert(idx + 1, project_status)

        sections[3]["fields"] = new_fields

    # ── S4: Beneficiary Information ──
    if len(sections) > 4:
        sections[4]["title"] = ml("Beneficiary Information", "Informations sur les beneficiaires")

        existing_codes = {f["code"] for f in sections[4]["fields"]}

        # D13-D18: Add new beneficiary fields
        new_benef = []
        if "avg_hh_size" not in existing_codes:
            new_benef.append(make_field("avg_hh_size", "Average HH Size", "Taille moyenne du menage", "number"))
        if "n_individual_benefiting" not in existing_codes:
            new_benef.append(make_field("n_individual_benefiting", "Individuals Benefiting", "Individus beneficiaires", "number"))
        if "n_beneficiaries_per_project" not in existing_codes:
            new_benef.append(make_field("n_beneficiaries_per_project", "Beneficiaries per Project", "Beneficiaires par projet", "number"))
        if "n_individual_trained" not in existing_codes:
            new_benef.append(make_field("n_individual_trained", "Total Individuals Trained", "Total individus formes", "number"))
        if "pct_disability" not in existing_codes:
            new_benef.append(make_field("pct_disability", "% Population with Disability", "% Population handicapee", "number"))
        if "n_disability_beneficiaries" not in existing_codes:
            new_benef.append(make_field("n_disability_beneficiaries", "Beneficiaries with Disability", "Beneficiaires handicapes", "number"))

        sections[4]["fields"].extend(new_benef)

    # ── S5: Comments ──
    if len(sections) > 5:
        sections[5]["title"] = ml("Comments & Location", "Commentaires et localisation")

    schema["sections"] = sections
    return schema


def deploy(target_name, schema_json):
    """Update form template on target DB."""
    cfg = TARGETS[target_name]
    print(f"\n  Updating PAID form on {target_name}...")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(cfg['db_host'], username=SSH_USER, password=SSH_PASS, timeout=15)

    # Write schema to temp file
    sftp = ssh.open_sftp()
    sftp.open('/tmp/paid_schema.json', 'w').write(schema_json)
    sftp.close()

    # Copy to container + update
    update_sql = f"UPDATE form_builder.form_templates SET schema = (SELECT pg_read_file('/tmp/paid_schema.json')::jsonb), updated_at = now() WHERE id = '{FORM_ID}'"

    # Alternative: use psql with file content
    escaped = schema_json.replace("'", "''")
    # Use the file approach
    cmds = [
        f"echo '{SSH_PASS}' | sudo -S docker cp /tmp/paid_schema.json {cfg['container']}:/tmp/paid_schema.json",
        f"echo '{SSH_PASS}' | sudo -S docker exec -e PGPASSWORD={cfg['db_pass']} {cfg['container']} psql -h localhost -U aris -d aris -c \"UPDATE form_builder.form_templates SET schema = (SELECT convert_from(pg_read_binary_file('/tmp/paid_schema.json'), 'UTF8'))::jsonb, updated_at = now() WHERE id = '{FORM_ID}'\"",
    ]

    for cmd in cmds:
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=30)
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode(errors='replace')
        err = stderr.read().decode(errors='replace')
        if 'UPDATE 1' in out:
            print(f"  OK - Form updated on {target_name}")
        if 'ERROR' in err:
            print(f"  ERROR: {err.split('ERROR:')[-1][:200]}")

    # Verify
    cmd = f"echo '{SSH_PASS}' | sudo -S docker exec -e PGPASSWORD={cfg['db_pass']} {cfg['container']} psql -h localhost -U aris -d aris -t -A -c \"SELECT jsonb_array_length(schema->'sections') as sections, (SELECT sum(jsonb_array_length(s->'fields')) FROM jsonb_array_elements(schema->'sections') s) as total_fields FROM form_builder.form_templates WHERE id = '{FORM_ID}'\""
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=10)
    stdout.channel.recv_exit_status()
    out = stdout.read().decode(errors='replace').strip()
    lines = [l for l in out.split('\n') if l.strip() and 'password' not in l.lower() and not l.startswith('[sudo]')]
    if lines:
        print(f"  Sections|Fields: {lines[-1]}")

    ssh.close()


if __name__ == '__main__':
    # Load backup schema
    with open('deploy/scripts/_paid_form_schema_backup.json', 'r', encoding='utf-8') as f:
        schema = json.load(f)

    print("Applying Phase 2 modifications...")
    updated = update_schema(copy.deepcopy(schema))

    # Summary
    for i, sec in enumerate(updated.get("sections", [])):
        title = sec.get("title", {})
        if isinstance(title, dict):
            title = title.get("en", "")
        fields = sec.get("fields", [])
        print(f"  S{i}: '{title}' ({len(fields)} fields)")
        for f in fields:
            fl = f.get("label", {})
            if isinstance(fl, dict):
                fl = fl.get("en", "")
            print(f"    {f.get('type','?'):<22} {f.get('code','?'):<35} {fl}")

    schema_json = json.dumps(updated, ensure_ascii=False)
    print(f"\nSchema size: {len(schema_json)} chars")

    targets = sys.argv[1:] if len(sys.argv) > 1 else ['STAGING', 'PROD']
    for t in targets:
        t = t.upper()
        if t in TARGETS:
            deploy(t, schema_json)
