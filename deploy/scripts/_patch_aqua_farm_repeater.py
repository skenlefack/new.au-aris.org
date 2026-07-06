#!/usr/bin/env python3
"""
Patch 'Aquaculture Farm Registration' template:
Replace simple 'production_nodes' select field with a repeater
containing production_node + production_system per row.
"""
import paramiko, json, sys, uuid
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"

REPEATER_FIELD = {
    "id": str(uuid.uuid4()),
    "code": "production_nodes",
    "type": "repeater",
    "label": {
        "en": "Production Nodes",
        "fr": "Nœuds de Production",
        "pt": "Nós de Produção",
        "ar": "عقد الإنتاج"
    },
    "order": 7,
    "column": 1,
    "columnSpan": 2,
    "hidden": False,
    "readOnly": False,
    "required": True,
    "conditions": [],
    "validation": {},
    "properties": {
        "minRows": 1,
        "maxRows": 10,
        "addLabel": {
            "en": "Add production node",
            "fr": "Ajouter un nœud de production",
            "pt": "Adicionar nó de produção",
            "ar": "إضافة عقدة إنتاج"
        },
        "fields": [
            {
                "type": "select",
                "code": "production_node",
                "label": {
                    "en": "Production Node",
                    "fr": "Nœud de Production",
                    "pt": "Nó de Produção",
                    "ar": "عقدة الإنتاج"
                },
                "required": True,
                "properties": {
                    "options": [
                        {"value": "HATCHERY", "label": {"en": "Hatchery", "fr": "Écloserie", "pt": "Incubadora", "ar": "مفرخة"}},
                        {"value": "OUT_GROWER", "label": {"en": "Out-grower", "fr": "Sous-traitant grossissement", "pt": "Produtor externo", "ar": "مزارع خارجي"}},
                        {"value": "BROODSTOCK", "label": {"en": "Broodstock Production", "fr": "Production de géniteurs", "pt": "Produção de reprodutores", "ar": "إنتاج أمهات"}},
                        {"value": "OFFSHORE_CAGES", "label": {"en": "Marine aquaculture in offshore cages", "fr": "Aquaculture marine en cages offshore", "pt": "Aquicultura marinha em gaiolas offshore", "ar": "استزراع بحري في أقفاص بعيدة"}},
                    ]
                }
            },
            {
                "type": "select",
                "code": "production_system",
                "label": {
                    "en": "Production System",
                    "fr": "Système de Production",
                    "pt": "Sistema de Produção",
                    "ar": "نظام الإنتاج"
                },
                "required": True,
                "properties": {
                    "options": [
                        {"value": "POND_CULTURE", "label": {"en": "Pond culture", "fr": "Pisciculture en étang", "pt": "Cultura em tanque", "ar": "استزراع في أحواض"}},
                        {"value": "CAGE_CULTURE", "label": {"en": "Cage culture", "fr": "Élevage en cage", "pt": "Cultura em gaiola", "ar": "استزراع في أقفاص"}},
                        {"value": "RACEWAY_CULTURE", "label": {"en": "Raceway culture", "fr": "Élevage en raceway", "pt": "Cultura em canal", "ar": "استزراع في مجاري"}},
                        {"value": "RAS_CULTURE", "label": {"en": "RAS culture", "fr": "Élevage en RAS", "pt": "Cultura em RAS", "ar": "نظام إعادة تدوير المياه"}},
                        {"value": "PEN_CULTURE", "label": {"en": "Pen culture", "fr": "Élevage en enclos", "pt": "Cultura em cercado", "ar": "استزراع في حظائر"}},
                        {"value": "INTEGRATED", "label": {"en": "Integrated aquaculture", "fr": "Aquaculture intégrée", "pt": "Aquicultura integrada", "ar": "استزراع متكامل"}},
                    ]
                }
            }
        ]
    }
}


def patch_template(host, label, pg_container):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username='arisadmin', password=SSH_PASS, timeout=15)
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")

    # 1. Load template schema
    sql = "SELECT id, schema::text FROM form_builder.form_templates WHERE name='Aquaculture Farm Registration' AND status='PUBLISHED' LIMIT 1;"
    cmd = f"echo '{SSH_PASS}' | sudo -S docker exec {pg_container} psql -U aris -d aris -t -A -c \"{sql}\""
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    raw = stdout.read().decode().strip()
    lines = [l for l in raw.split('\n') if '|' in l and '[sudo]' not in l]

    if not lines:
        print("  ERROR: Template 'Aquaculture Farm Registration' not found!")
        c.close()
        return

    tid, schema_json = lines[0].split('|', 1)
    schema = json.loads(schema_json)
    print(f"  Template ID: {tid}")

    # 2. Find Farm Information section
    target_section = None
    for section in schema.get('sections', []):
        sec_name = section.get('name', {})
        if isinstance(sec_name, dict) and sec_name.get('en', '') == 'Farm Information':
            target_section = section
            break

    if not target_section:
        print("  ERROR: 'Farm Information' section not found!")
        c.close()
        return

    fields = target_section.get('fields', [])
    existing_codes = {f.get('code', '') for f in fields}
    print(f"  Existing fields: {sorted(existing_codes)}")

    # 3. Remove old production_nodes field (simple select) if present
    old_count = len(fields)
    fields = [f for f in fields if f.get('code') != 'production_nodes']
    if len(fields) < old_count:
        print("  Removed old 'production_nodes' simple select field")

    # 4. Insert repeater after main_species (or at position 7)
    insert_idx = None
    for i, f in enumerate(fields):
        if f.get('code') == 'main_species':
            insert_idx = i + 1
            break
    if insert_idx is None:
        insert_idx = min(7, len(fields))

    fields.insert(insert_idx, REPEATER_FIELD)
    print(f"  Inserted repeater at position {insert_idx}")

    # 5. Re-number field orders
    for i, f in enumerate(fields):
        f['order'] = i

    target_section['fields'] = fields

    # 6. Update in DB — write SQL to temp file to avoid bash escaping issues
    new_schema_json = json.dumps(schema, ensure_ascii=False).replace("'", "''")
    update_sql = f"UPDATE form_builder.form_templates SET schema = '{new_schema_json}'::jsonb, updated_at = now() WHERE id = '{tid}'::uuid;"

    # Write SQL to temp file on remote, then execute via psql -f
    sftp = c.open_sftp()
    tmp_path = '/tmp/_patch_aqua_farm.sql'
    with sftp.file(tmp_path, 'w') as f:
        f.write(update_sql)
    sftp.close()

    cmd2 = f"echo '{SSH_PASS}' | sudo -S docker cp {tmp_path} {pg_container}:{tmp_path} && echo '{SSH_PASS}' | sudo -S docker exec {pg_container} psql -U aris -d aris -f {tmp_path}"
    stdin2, stdout2, stderr2 = c.exec_command(cmd2, timeout=30)
    result = stdout2.read().decode().strip()
    err = stderr2.read().decode().strip()

    if 'UPDATE 1' in result:
        print("  SUCCESS: Template updated with production_nodes repeater")
    else:
        print(f"  Result: {result}")
        if err:
            err_lines = [l for l in err.split('\n') if '[sudo]' not in l]
            if err_lines:
                print(f"  Errors: {''.join(err_lines)}")

    # 7. Verify
    verify_sql = f"SELECT jsonb_array_length(s->'fields') FROM form_builder.form_templates, jsonb_array_elements(schema->'sections') s WHERE id='{tid}'::uuid AND s->>'name' IS NOT NULL AND (s->'name'->>'en')='Farm Information';"
    cmd3 = f"echo '{SSH_PASS}' | sudo -S docker exec {pg_container} psql -U aris -d aris -t -A -c \"{verify_sql}\""
    stdin3, stdout3, stderr3 = c.exec_command(cmd3, timeout=30)
    count = stdout3.read().decode().strip().split('\n')[-1].strip()
    print(f"  Farm Information now has {count} fields (was {old_count})")

    c.close()


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'both'

    if target in ('staging', 'stg', 'both'):
        patch_template('10.202.101.148', 'STAGING', 'aris-stg-postgres')

    if target in ('prod', 'production', 'both'):
        patch_template('10.202.101.185', 'PRODUCTION', 'aris-postgres')

    print("\nDone!")
