#!/usr/bin/env python3
"""Sync form template select options with translated fishery_referentials."""
import paramiko, json, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"

# Map template field codes to referential categories
FIELD_TO_CATEGORY = {
    'production_node': 'PRODUCTION_NODE',
    'production_nodes': 'PRODUCTION_NODE',
    'fishing_system': 'FISHING_SYSTEM',
    'holding_facility': 'FARM_TYPE',
    'fishery_type': 'FISHERY_TYPE',
    'operational_size': 'OPERATIONAL_SIZE',
    'farm_ownership': None,  # static, not from referentials
    'production_year': None,  # years, not from referentials
    'trade_year': None,  # years, not from referentials
}

def run(host, label, container):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username='arisadmin', password=SSH_PASS, timeout=15)
    print(f"\n=== {label} ===")

    # Load all referentials
    stdin, stdout, stderr = c.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -t -A -c "
        "\"SELECT category || '|' || code || '|' || name::text FROM public.fishery_referentials WHERE is_active=true ORDER BY category, sort_order;\"",
        timeout=30)
    refs = {}
    for line in stdout.read().decode().strip().split('\n'):
        if '|' not in line or '[sudo]' in line:
            continue
        parts = line.split('|', 2)
        if len(parts) == 3:
            cat, code, name_json = parts
            refs.setdefault(cat.strip(), []).append({
                'value': code.strip(),
                'label': json.loads(name_json.strip()),
            })

    # Load all fisheries templates
    stdin, stdout, stderr = c.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -t -A -c "
        "\"SELECT json_agg(json_build_object('id', id, 'name', name, 'schema', schema)) FROM form_builder.form_templates WHERE domain='fisheries' AND status='PUBLISHED';\"",
        timeout=30)
    raw = stdout.read().decode().strip()
    if raw.startswith('[sudo]'):
        raw = raw.split('\n', 1)[-1].strip()
    templates = json.loads(raw)

    updated = 0
    for t in templates:
        tid = t['id']
        name = t['name']
        schema = t['schema']
        modified = False

        for section in schema.get('sections', []):
            for field in section.get('fields', []):
                code = field.get('code', '')
                if code not in FIELD_TO_CATEGORY:
                    continue
                cat = FIELD_TO_CATEGORY[code]
                if cat is None:
                    continue  # skip static fields
                if cat not in refs:
                    continue

                props = field.get('properties', {})
                old_opts = props.get('options', [])
                new_opts = refs[cat]

                # Check if update needed (compare first option's PT)
                if old_opts and isinstance(old_opts[0], dict):
                    old_pt = old_opts[0].get('label', {}).get('pt', '')
                    new_pt = new_opts[0].get('label', {}).get('pt', '') if new_opts else ''
                    if old_pt == new_pt and old_pt:
                        continue  # already translated

                props['options'] = new_opts
                field['properties'] = props
                modified = True

        if modified:
            schema_json = json.dumps(schema, ensure_ascii=False).replace("'", "''")
            update_sql = f"UPDATE form_builder.form_templates SET schema = '{schema_json}'::jsonb, updated_at = now() WHERE id = '{tid}';"

            sftp = c.open_sftp()
            with sftp.open('/tmp/sync.sql', 'w') as f:
                f.write(update_sql)
            sftp.close()

            stdin2, stdout2, stderr2 = c.exec_command(
                f"echo '{SSH_PASS}' | sudo -S docker cp /tmp/sync.sql {container}:/tmp/sync.sql && "
                f"echo '{SSH_PASS}' | sudo -S docker exec {container} psql -U aris -d aris -f /tmp/sync.sql 2>&1",
                timeout=30)
            result = stdout2.read().decode()
            if 'UPDATE 1' in result:
                updated += 1
                print(f"  Synced: {name}")

    print(f"  Total: {updated} templates updated")
    c.close()

run('10.202.101.148', 'STAGING', 'aris-stg-postgres')
run('10.202.101.185', 'PRODUCTION', 'aris-postgres')
print("\nDone!")
