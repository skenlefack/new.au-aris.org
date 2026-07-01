#!/usr/bin/env python3
"""
Patch fisheries form templates to add missing AFAData fields
and connect static selects to real fishery_referentials.
"""
import paramiko, json, sys, uuid
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"

def make_field(code, label_en, label_fr, ftype, required=False, order=0, props=None, options=None, hint_en="", hint_fr=""):
    field = {
        "id": str(uuid.uuid4()),
        "code": code,
        "type": ftype,
        "label": {"en": label_en, "fr": label_fr, "pt": "", "ar": ""},
        "order": order,
        "column": 1,
        "hidden": False,
        "readOnly": False,
        "required": required,
        "columnSpan": 1,
        "conditions": [],
        "properties": props or {},
        "validation": {},
    }
    if options:
        field["options"] = options
    if hint_en:
        field["properties"]["helperText"] = {"en": hint_en, "fr": hint_fr}
    return field

def make_select_options(values):
    """Create multilingual select options from a list of (value, en, fr) tuples."""
    return [{"value": v, "label": {"en": en, "fr": fr, "pt": "", "ar": ""}} for v, en, fr in values]

# Year options (2015-2030)
YEAR_OPTIONS = make_select_options([(str(y), str(y), str(y)) for y in range(2030, 2014, -1)])

# Patches per template name
PATCHES = {
    "Aquaculture Production Report": {
        "add_fields": {
            "Production Details": [
                make_field("production_node", "Production Node", "Noeud de production", "fishery-ref-select", True, 0,
                           props={"referentialCategory": "PRODUCTION_NODE"}),
                make_field("production_year", "Production Year", "Annee de production", "select", True, 1, options=YEAR_OPTIONS),
                make_field("fishing_system", "System", "Systeme", "fishery-ref-select", True, 4,
                           props={"referentialCategory": "FISHING_SYSTEM"}),
                make_field("holding_facility", "Holding Facility", "Installation", "fishery-ref-select", True, 5,
                           props={"referentialCategory": "FARM_TYPE"}),
                make_field("number_of_farms", "Number of Farms", "Nombre de fermes", "number", False, 12),
            ],
        },
    },
    "Aquaculture Farm Registration": {
        "add_fields": {
            "Farm Information": [
                make_field("operational_size", "Operational Size", "Taille operationnelle", "fishery-ref-select", True, 1,
                           props={"referentialCategory": "OPERATIONAL_SIZE"}),
                make_field("production_nodes", "Production Node(s)", "Noeud(s) de production", "fishery-ref-select", False, 2,
                           props={"referentialCategory": "PRODUCTION_NODE"}),
                make_field("farm_ownership", "Farm Ownership", "Propriete de la ferme", "select", False, 6,
                           options=make_select_options([
                               ("state", "State Owned", "Etat"),
                               ("private", "Private Ownership", "Prive"),
                           ])),
            ],
        },
    },
    "Capture Fisheries Report": {
        "add_fields": {
            "Capture Details": [
                make_field("production_year", "Production Year", "Annee de production", "select", True, 0, options=YEAR_OPTIONS),
                make_field("fishery_type", "Fishery Type", "Type de peche", "fishery-ref-select", True, 2,
                           props={"referentialCategory": "FISHERY_TYPE"}),
            ],
        },
    },
    "Fish Trade Report": {
        "add_fields": {
            "Trade Flow Details": [
                make_field("trade_year", "Trade Year", "Annee commerciale", "select", True, 1, options=YEAR_OPTIONS),
            ],
        },
    },
    "Monthly Captures Report": {
        "add_fields": {
            "Capture Information": [
                make_field("fishery_type", "Fishery Type", "Type de peche", "fishery-ref-select", False, 5,
                           props={"referentialCategory": "FISHERY_TYPE"}),
            ],
        },
    },
}

# For fishery-ref-select fields, we use select type since ARIS form-builder
# may not support fishery-ref-select natively. We need to check.
# Actually, let's use "select" with options loaded from referentials.
# The form-builder supports "master-data-select" and "select" — for fishery referentials
# we should use "select" with static options from the referentials we just imported.

def patch_schema(schema, patch):
    """Add missing fields to template schema sections."""
    modified = False
    for section in schema.get("sections", []):
        sec_name = section.get("name", {})
        sec_en = sec_name.get("en", "") if isinstance(sec_name, dict) else str(sec_name)

        if sec_en in patch.get("add_fields", {}):
            existing_codes = {f.get("code", "") for f in section.get("fields", [])}
            new_fields = patch["add_fields"][sec_en]

            for nf in new_fields:
                if nf["code"] not in existing_codes:
                    # Set order to end of existing fields
                    nf["order"] = len(section["fields"])
                    section["fields"].append(nf)
                    modified = True
                    print(f"    + Added: {nf['code']} ({nf['type']})")

    return modified

def run(host, label, container):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username='arisadmin', password=SSH_PASS, timeout=15)
    print(f"\n{'='*50}")
    print(f"  {label}")
    print(f"{'='*50}")

    # Get all fisheries templates
    stdin, stdout, stderr = c.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -t -A -c "
        "\"SELECT json_agg(json_build_object('id', id, 'name', name, 'schema', schema)) FROM form_builder.form_templates WHERE domain='fisheries' AND status='PUBLISHED';\"",
        timeout=30)
    raw = stdout.read().decode().strip()
    if raw.startswith('[sudo]'):
        raw = raw.split('\n', 1)[-1].strip()

    templates = json.loads(raw)

    for t in templates:
        name = t['name']
        tid = t['id']
        schema = t['schema']

        if name not in PATCHES:
            continue

        print(f"\n  Patching: {name}")
        patch = PATCHES[name]

        # For fishery-ref-select fields, convert to regular select with options from DB
        for sec_name, fields in patch.get("add_fields", {}).items():
            for f in fields:
                if f["type"] == "fishery-ref-select":
                    cat = f["properties"].get("referentialCategory", "")
                    # Query referentials for this category
                    stdin2, stdout2, stderr2 = c.exec_command(
                        f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -t -A -c "
                        f"\"SELECT code, name->>'en' as en, name->>'fr' as fr FROM public.fishery_referentials WHERE category='{cat}' AND is_active=true ORDER BY sort_order;\"",
                        timeout=15)
                    ref_out = stdout2.read().decode().strip()
                    options = []
                    for line in ref_out.split('\n'):
                        if '|' in line and '[sudo]' not in line:
                            parts = line.split('|')
                            if len(parts) >= 3:
                                code, en, fr = parts[0].strip(), parts[1].strip(), parts[2].strip()
                                options.append({"value": code, "label": {"en": en, "fr": fr, "pt": "", "ar": ""}})

                    if options:
                        f["type"] = "select"
                        f["options"] = options
                        f["properties"] = {"searchable": True}
                        print(f"    Loaded {len(options)} options for {cat}")
                    else:
                        print(f"    WARNING: No options for {cat}")
                        f["type"] = "select"
                        f["options"] = []

        modified = patch_schema(schema, patch)

        if modified:
            # Update template in DB
            schema_json = json.dumps(schema).replace("'", "''")
            update_sql = f"UPDATE form_builder.form_templates SET schema = '{schema_json}'::jsonb, updated_at = now() WHERE id = '{tid}';"

            sftp = c.open_sftp()
            with sftp.open('/tmp/patch.sql', 'w') as f:
                f.write(update_sql)
            sftp.close()

            stdin3, stdout3, stderr3 = c.exec_command(
                f"echo '{SSH_PASS}' | sudo -S docker cp /tmp/patch.sql {container}:/tmp/patch.sql && "
                f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -f /tmp/patch.sql 2>&1",
                timeout=30)
            result = stdout3.read().decode().strip()
            if 'UPDATE 1' in result:
                print(f"    OK — template updated")
            else:
                print(f"    Result: {result[-100:]}")
        else:
            print(f"    No changes needed")

    c.close()

run('10.202.101.148', 'STAGING', 'aris-stg-postgres')
run('10.202.101.185', 'PRODUCTION', 'aris-postgres')
print("\nAll templates patched!")
