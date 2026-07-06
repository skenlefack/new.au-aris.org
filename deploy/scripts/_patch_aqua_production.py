#!/usr/bin/env python3
"""
Patch 'Aquaculture Production Report' template:
- farm_name → form-data-select (loads farms from Farm Registration, filtered by country)
- production_node → dynamic select from selected farm's production_nodes
- production_system → auto-filled (read-only)
- Renames: feed→Quantité d'aliment, survival→mortalité, avg_weight→Poids unitaire moyen
- FCR split: théorique (open) + réel (calculated)
- quantity_unit auto-filled by node
"""
import paramiko, json, sys, uuid
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"

NODE_LABELS = {
    "HATCHERY": {"en": "Hatchery", "fr": "Écloserie", "pt": "Incubadora", "ar": "مفرخة"},
    "OUT_GROWER": {"en": "Out-grower", "fr": "Sous-traitant grossissement", "pt": "Produtor externo", "ar": "مزارع خارجي"},
    "BROODSTOCK": {"en": "Broodstock Production", "fr": "Production de géniteurs", "pt": "Produção de reprodutores", "ar": "إنتاج أمهات"},
    "OFFSHORE_CAGES": {"en": "Marine aquaculture in offshore cages", "fr": "Aquaculture marine en cages offshore", "pt": "Aquicultura marinha em gaiolas offshore", "ar": "استزراع بحري في أقفاص بعيدة"},
}

def mk(code, label, ftype, required=False, order=0, props=None, read_only=False, span=1):
    return {
        "id": str(uuid.uuid4()), "code": code, "type": ftype,
        "label": label, "order": order, "column": 1, "columnSpan": span,
        "hidden": False, "readOnly": read_only, "required": required,
        "conditions": [], "validation": {}, "properties": props or {},
    }


def build_new_fields():
    """Build the complete new field list for Production Details section."""
    o = 0
    fields = []

    # 1. Farm select
    fields.append(mk("farm_name", {"en": "Farm", "fr": "Ferme", "pt": "Fazenda", "ar": "المزرعة"},
        "form-data-select", required=True, order=o, props={
            "sourceTemplateName": "Aquaculture Farm Registration",
            "sourceFieldCode": "farm_name", "valueFieldCode": "farm_name",
            "filterByAdminLocation": True, "exposeDataAs": "__farm_data",
        })); o += 1

    # 2. Production node (dynamic from farm)
    fields.append(mk("production_node",
        {"en": "Production Node", "fr": "Nœud de Production", "pt": "Nó de Produção", "ar": "عقدة الإنتاج"},
        "select", required=True, order=o, props={
            "dynamicOptionsFrom": "__farm_data",
            "dynamicOptionsPath": "production_nodes",
            "dynamicOptionValue": "production_node",
            "optionLabels": NODE_LABELS,
            "autoFillOnSelect": {"production_system": "production_system"},
            "staticAutoFill": {
                "HATCHERY": {"quantity_unit": "milliers"},
                "OUT_GROWER": {"quantity_unit": "kg"},
                "BROODSTOCK": {"quantity_unit": "kg"},
                "OFFSHORE_CAGES": {"quantity_unit": "tonnes"},
            },
        })); o += 1

    # 3. Production system (auto-filled, read-only)
    fields.append(mk("production_system",
        {"en": "Production System", "fr": "Système de Production", "pt": "Sistema de Produção", "ar": "نظام الإنتاج"},
        "text", order=o, read_only=True)); o += 1

    # 4. Species
    fields.append(mk("species", {"en": "Species", "fr": "Espèce", "pt": "Espécie", "ar": "النوع"},
        "master-data-select", required=True, order=o, props={
            "searchable": True, "masterDataType": "fish-species",
            "parentFilter": {"groupId": "10000000-0000-4000-b000-000000000007"},
        })); o += 1

    # 5. Quantity harvested
    fields.append(mk("quantity_kg",
        {"en": "Quantity Harvested", "fr": "Quantité Récoltée", "pt": "Quantidade Colhida", "ar": "الكمية المحصودة"},
        "number", required=True, order=o, props={"step": 0.01, "decimals": 2})); o += 1

    # 6. Unit (auto-filled)
    fields.append(mk("quantity_unit",
        {"en": "Unit", "fr": "Unité", "pt": "Unidade", "ar": "الوحدة"},
        "text", order=o, read_only=True)); o += 1

    # 7. Harvest date
    fields.append(mk("harvest_date",
        {"en": "Harvest Date", "fr": "Date de Récolte", "pt": "Data da Colheita", "ar": "تاريخ الحصاد"},
        "date", required=True, order=o)); o += 1

    # 8. Method of culture
    fields.append(mk("method_of_culture",
        {"en": "Method of Culture", "fr": "Méthode de Culture", "pt": "Método de Cultura", "ar": "طريقة الاستزراع"},
        "select", order=o, props={"options": [
            {"value": "extensive", "label": {"en": "Extensive", "fr": "Extensif", "pt": "Extensivo", "ar": "مفتوح"}},
            {"value": "semi-intensive", "label": {"en": "Semi-intensive", "fr": "Semi-intensif", "pt": "Semi-intensivo", "ar": "شبه مكثف"}},
            {"value": "intensive", "label": {"en": "Intensive", "fr": "Intensif", "pt": "Intensivo", "ar": "مكثف"}},
            {"value": "super-intensive", "label": {"en": "Super-intensive", "fr": "Super-intensif", "pt": "Super-intensivo", "ar": "مكثف جداً"}},
        ]})); o += 1

    # 9. Feed quantity
    fields.append(mk("feed_used_kg",
        {"en": "Feed Quantity (kg)", "fr": "Quantité d'Aliment (kg)", "pt": "Quantidade de Ração (kg)", "ar": "كمية العلف (كجم)"},
        "number", order=o, props={"step": 0.01, "decimals": 2})); o += 1

    # 10. Avg unit marketing weight
    fields.append(mk("avg_harvest_weight_g",
        {"en": "Avg. Unit Marketing Weight (g)", "fr": "Poids Unitaire Moyen de Commercialisation (g)",
         "pt": "Peso Unitário Médio de Comercialização (g)", "ar": "متوسط الوزن الوحدوي للتسويق (جم)"},
        "number", order=o, props={"step": 0.01, "decimals": 2})); o += 1

    # 11. FCR théorique (open)
    fields.append(mk("fcr_theoretical",
        {"en": "Theoretical FCR", "fr": "Ratio de Conversion Alimentaire Théorique",
         "pt": "RCA Teórico", "ar": "معدل التحويل الغذائي النظري"},
        "number", order=o, props={"step": 0.01, "decimals": 2})); o += 1

    # 12. FCR réel (calculated)
    fields.append(mk("fcr_real",
        {"en": "Actual FCR", "fr": "Ratio de Conversion Alimentaire Réel",
         "pt": "RCA Real", "ar": "معدل التحويل الغذائي الفعلي"},
        "calculated", order=o, read_only=True, props={
            "formula": "{feed_used_kg} / {avg_harvest_weight_g}",
            "decimals": 1,
        })); o += 1

    # 13. Batch ID
    fields.append(mk("batch_id",
        {"en": "Batch / Cycle ID", "fr": "ID du Lot / Cycle", "pt": "ID do Lote / Ciclo", "ar": "رقم الدُفعة / الدورة"},
        "text", order=o)); o += 1

    # 14. Stocking date
    fields.append(mk("stocking_date",
        {"en": "Stocking Date", "fr": "Date d'Ensemencement", "pt": "Data de Estocagem", "ar": "تاريخ التخزين"},
        "date", order=o)); o += 1

    # 15. Mortality rate
    fields.append(mk("mortality_rate",
        {"en": "Mortality Rate (%)", "fr": "Taux de Mortalité (%)", "pt": "Taxa de Mortalidade (%)", "ar": "معدل الوفيات (%)"},
        "number", order=o, props={"step": 0.01, "decimals": 2})); o += 1

    # 16. Remarks
    fields.append(mk("remarks",
        {"en": "Remarks", "fr": "Remarques", "pt": "Observações", "ar": "ملاحظات"},
        "textarea", order=o, span=2, props={"rows": 4})); o += 1

    return fields


def patch_template(host, label, pg_container):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username='arisadmin', password=SSH_PASS, timeout=15)
    print(f"\n{'='*60}")
    print(f"  {label}")
    print(f"{'='*60}")

    sql = "SELECT id, schema::text FROM form_builder.form_templates WHERE name='Aquaculture Production Report' AND status='PUBLISHED' LIMIT 1;"
    cmd = f"echo '{SSH_PASS}' | sudo -S docker exec {pg_container} psql -U aris -d aris -t -A -c \"{sql}\""
    stdin, stdout, stderr = c.exec_command(cmd, timeout=30)
    raw = stdout.read().decode().strip()
    lines = [l for l in raw.split('\n') if '|' in l and '[sudo]' not in l]

    if not lines:
        print("  ERROR: Template not found!")
        c.close()
        return

    tid, schema_json = lines[0].split('|', 1)
    schema = json.loads(schema_json)
    print(f"  Template ID: {tid}")

    # Find Production Details section and replace fields
    for section in schema.get('sections', []):
        sec_name = section.get('name', {})
        if isinstance(sec_name, dict) and sec_name.get('en', '') == 'Production Details':
            old_count = len(section.get('fields', []))
            section['fields'] = build_new_fields()
            print(f"  Replaced {old_count} fields with {len(section['fields'])} new fields")
            break
    else:
        print("  ERROR: 'Production Details' section not found!")
        c.close()
        return

    # Write SQL to temp file
    new_json = json.dumps(schema, ensure_ascii=False).replace("'", "''")
    update_sql = f"UPDATE form_builder.form_templates SET schema = '{new_json}'::jsonb, updated_at = now() WHERE id = '{tid}'::uuid;"

    sftp = c.open_sftp()
    with sftp.file('/tmp/_patch_aqua_prod.sql', 'w') as fp:
        fp.write(update_sql)
    sftp.close()

    cmd2 = f"echo '{SSH_PASS}' | sudo -S docker cp /tmp/_patch_aqua_prod.sql {pg_container}:/tmp/_patch_aqua_prod.sql && echo '{SSH_PASS}' | sudo -S docker exec {pg_container} psql -U aris -d aris -f /tmp/_patch_aqua_prod.sql"
    stdin2, stdout2, stderr2 = c.exec_command(cmd2, timeout=30)
    result = stdout2.read().decode().strip()

    if 'UPDATE 1' in result:
        print("  SUCCESS")
    else:
        print(f"  Result: {result}")
        err = stderr2.read().decode().strip()
        if err:
            err_lines = [l for l in err.split('\n') if '[sudo]' not in l]
            if err_lines:
                print(f"  Errors: {''.join(err_lines)}")
    c.close()


if __name__ == '__main__':
    target = sys.argv[1] if len(sys.argv) > 1 else 'both'

    if target in ('staging', 'stg', 'both'):
        patch_template('10.202.101.148', 'STAGING', 'aris-stg-postgres')

    if target in ('prod', 'production', 'both'):
        patch_template('10.202.101.185', 'PRODUCTION', 'aris-postgres')

    print("\nDone!")
