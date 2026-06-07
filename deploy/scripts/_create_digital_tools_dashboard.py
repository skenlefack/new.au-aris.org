#!/usr/bin/env python3
"""
Create "Utilisation des Outils Numériques" dashboard linked to the
Surveillance campaign, with real data from submissions.
"""
import paramiko
import json
import sys
import uuid
import tempfile
import os

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
CAMPAIGN_A = "6cbd4272-d213-4096-87b9-2952e7e13f65"
SUPER_ADMIN_ID = "10000000-0000-4000-a000-000000000001"
DASHBOARD_ID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "ppr-digital-tools-dashboard"))


def run_query(c, db_host, db_pass, sql):
    chan = c.get_transport().open_session()
    chan.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
        f"-e PGPASSWORD={db_pass} postgres:16 "
        f"psql -h {db_host} -p 5432 -U aris -d aris -t -A -c \"{sql}\""
    )
    chan.settimeout(15)
    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch:
                break
            out += ch
    except:
        pass
    return out.decode(errors="replace").strip()


def compute_data(c, db_host, db_pass, campaign_id):
    """Query submissions and compute digital tools widget data."""
    data = {}

    # Total countries surveyed
    r = run_query(c, db_host, db_pass,
        f"SELECT count(DISTINCT data->>'country') FROM submissions WHERE campaign_id = '{campaign_id}'")
    data["total_surveyed"] = int(r) if r.isdigit() else 0

    # Countries using digital tools
    r = run_query(c, db_host, db_pass,
        f"SELECT count(*) FROM submissions WHERE campaign_id = '{campaign_id}' AND data->>'uses_digital_tool' = 'yes'")
    data["with_digital"] = int(r) if r.isdigit() else 0

    # Countries NOT using digital tools
    r = run_query(c, db_host, db_pass,
        f"SELECT count(*) FROM submissions WHERE campaign_id = '{campaign_id}' AND data->>'uses_digital_tool' = 'no'")
    data["without_digital"] = int(r) if r.isdigit() else 0

    # Countries with own system (have tool_name)
    r = run_query(c, db_host, db_pass,
        f"SELECT count(*) FROM submissions WHERE campaign_id = '{campaign_id}' AND data->>'tool_name' IS NOT NULL AND data->>'tool_name' != ''")
    data["with_own_system"] = int(r) if r.isdigit() else 0

    # Countries with surveillance system
    r = run_query(c, db_host, db_pass,
        f"SELECT count(*) FROM submissions WHERE campaign_id = '{campaign_id}' AND data->>'has_surveillance' = 'yes'")
    data["with_surveillance"] = int(r) if r.isdigit() else 0

    # Pie: Digital tool adoption (yes/no)
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'uses_digital_tool' AS lbl, count(*) AS cnt "
        f"FROM submissions WHERE campaign_id = '{campaign_id}' AND data->>'uses_digital_tool' IS NOT NULL GROUP BY 1")
    pie_digital = []
    for line in r.split("\n"):
        if "|" in line:
            parts = line.split("|")
            label = "Oui" if parts[0].strip() == "yes" else "Non" if parts[0].strip() == "no" else parts[0].strip()
            pie_digital.append({"name": label, "value": int(parts[1].strip())})
    data["pie_digital"] = pie_digital

    # Pie: Surveillance system (yes/no)
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'has_surveillance' AS lbl, count(*) AS cnt "
        f"FROM submissions WHERE campaign_id = '{campaign_id}' AND data->>'has_surveillance' IS NOT NULL GROUP BY 1")
    pie_surveillance = []
    for line in r.split("\n"):
        if "|" in line:
            parts = line.split("|")
            label = "Oui" if parts[0].strip() == "yes" else "Non" if parts[0].strip() == "no" else parts[0].strip()
            pie_surveillance.append({"name": label, "value": int(parts[1].strip())})
    data["pie_surveillance"] = pie_surveillance

    # Table: Countries WITH digital tools (country, tool, developer)
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'country', data->>'institution', data->>'tool_name', data->>'tool_developer' "
        f"FROM submissions WHERE campaign_id = '{campaign_id}' AND data->>'uses_digital_tool' = 'yes' ORDER BY 1")
    tools_rows = []
    for line in r.split("\n"):
        if "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if parts[0]:
                tools_rows.append({
                    "country": parts[0], "institution": parts[1],
                    "tool": parts[2] if len(parts) > 2 else "", "developer": parts[3] if len(parts) > 3 else ""
                })
    data["table_with_digital"] = tools_rows

    # Table: Countries WITHOUT digital tools (country, institution, surveillance)
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'country', data->>'institution', data->>'has_surveillance' "
        f"FROM submissions WHERE campaign_id = '{campaign_id}' AND data->>'uses_digital_tool' = 'no' ORDER BY 1")
    no_tools_rows = []
    for line in r.split("\n"):
        if "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if parts[0]:
                surv = "Oui" if len(parts) > 2 and parts[2] == "yes" else "Non"
                no_tools_rows.append({"country": parts[0], "institution": parts[1] if len(parts) > 1 else "", "surveillance": surv})
    data["table_without_digital"] = no_tools_rows

    # Bar: Tools by developer
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'tool_developer' AS dev, count(*) AS cnt "
        f"FROM submissions WHERE campaign_id = '{campaign_id}' AND data->>'tool_developer' IS NOT NULL AND data->>'tool_developer' != '' "
        f"GROUP BY 1 ORDER BY 2 DESC")
    dev_data = []
    for line in r.split("\n"):
        if "|" in line:
            parts = line.split("|")
            if parts[0].strip():
                dev_data.append({"developer": parts[0].strip(), "count": int(parts[1].strip())})
    data["bar_developers"] = dev_data

    # Map data: country + digital status (for MAP_AFRICA widget)
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'country', data->>'uses_digital_tool' "
        f"FROM submissions WHERE campaign_id = '{campaign_id}' ORDER BY 1")
    map_countries = []
    for line in r.split("\n"):
        if "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if parts[0]:
                val = 10 if len(parts) > 1 and parts[1] == "yes" else 1
                map_countries.append({"countryCode": parts[0][:2].upper() if len(parts[0]) == 2 else parts[0], "value": val, "label": "Statut"})
    data["map_countries"] = map_countries

    return data


def build_dashboard_sql(data, campaign_id):
    """Build SQL to create dashboard + sections + widgets with data."""
    sections = [
        {"id": str(uuid.uuid4()), "title": "Indicateurs Clés", "order": 0, "columns": 5, "color": "#1E40AF"},
        {"id": str(uuid.uuid4()), "title": "Adoption des Outils Numériques", "order": 1, "columns": 4, "color": "#059669"},
        {"id": str(uuid.uuid4()), "title": "Pays utilisant les Outils Numériques", "order": 2, "columns": 4, "color": "#7C3AED"},
        {"id": str(uuid.uuid4()), "title": "Pays sans Système Numérique", "order": 3, "columns": 4, "color": "#DC2626"},
    ]

    widgets = [
        # Section 0: KPIs
        {"section": 0, "type": "KPI_CARD", "title_fr": "Pays enquêtés", "title_en": "Countries Surveyed",
         "x": 0, "y": 0, "w": 1, "h": 1,
         "config": {"label": "Pays enquêtés", "value": data["total_surveyed"], "icon": "clipboard-check", "color": "#1E40AF"}},
        {"section": 0, "type": "KPI_CARD", "title_fr": "Utilisent les outils numériques", "title_en": "Using Digital Tools",
         "x": 1, "y": 0, "w": 1, "h": 1,
         "config": {"label": "Utilisent les outils numériques", "value": data["with_digital"], "icon": "monitor", "color": "#059669"}},
        {"section": 0, "type": "KPI_CARD", "title_fr": "Ont leur propre système", "title_en": "With Own System",
         "x": 2, "y": 0, "w": 1, "h": 1,
         "config": {"label": "Ont leur propre système", "value": data["with_own_system"], "icon": "server", "color": "#7C3AED"}},
        {"section": 0, "type": "KPI_CARD", "title_fr": "Sans système numérique", "title_en": "Without Digital System",
         "x": 3, "y": 0, "w": 1, "h": 1,
         "config": {"label": "Sans système numérique", "value": data["without_digital"], "icon": "monitor-off", "color": "#DC2626"}},
        {"section": 0, "type": "KPI_CARD", "title_fr": "Avec système de surveillance", "title_en": "With Surveillance System",
         "x": 4, "y": 0, "w": 1, "h": 1,
         "config": {"label": "Avec système de surveillance", "value": data["with_surveillance"], "icon": "shield-check", "color": "#EA580C"}},

        # Section 1: Charts
        {"section": 1, "type": "PIE_CHART", "title_fr": "Adoption des Outils Numériques", "title_en": "Digital Tools Adoption",
         "x": 0, "y": 0, "w": 2, "h": 2,
         "config": {"data": data["pie_digital"], "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#059669", "#DC2626"]}},
        {"section": 1, "type": "PIE_CHART", "title_fr": "Système de Surveillance National", "title_en": "National Surveillance System",
         "x": 2, "y": 0, "w": 2, "h": 2,
         "config": {"data": data["pie_surveillance"], "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#1E40AF", "#F59E0B"]}},
        {"section": 1, "type": "BAR_CHART", "title_fr": "Outils par Développeur", "title_en": "Tools by Developer",
         "x": 0, "y": 2, "w": 2, "h": 2,
         "config": {"data": data["bar_developers"], "chartConfig": {"xKey": "developer", "yKeys": ["count"], "colors": ["#7C3AED"]}}},
        {"section": 1, "type": "MAP_AFRICA", "title_fr": "Carte des Outils Numériques", "title_en": "Digital Tools Map",
         "x": 2, "y": 2, "w": 2, "h": 2,
         "config": {"data": {"byCountry": data["map_countries"]}, "unit": "", "valueLabel": "Statut"}},

        # Section 2: Table — with digital tools
        {"section": 2, "type": "TABLE", "title_fr": "Pays utilisant les outils numériques", "title_en": "Countries Using Digital Tools",
         "x": 0, "y": 0, "w": 4, "h": 3,
         "config": {
             "columns": [
                 {"key": "country", "label": "Pays"},
                 {"key": "institution", "label": "Institution"},
                 {"key": "tool", "label": "Outil numérique"},
                 {"key": "developer", "label": "Développeur"},
             ],
             "rows": data["table_with_digital"],
         }},

        # Section 3: Table — without digital tools
        {"section": 3, "type": "TABLE", "title_fr": "Pays sans système numérique", "title_en": "Countries Without Digital System",
         "x": 0, "y": 0, "w": 4, "h": 3,
         "config": {
             "columns": [
                 {"key": "country", "label": "Pays"},
                 {"key": "institution", "label": "Institution"},
                 {"key": "surveillance", "label": "Système de surveillance"},
             ],
             "rows": data["table_without_digital"],
         }},
    ]

    sql_lines = []

    # Delete existing dashboard if any
    sql_lines.append(f"DELETE FROM dashboard_builder.dashboards WHERE id = '{DASHBOARD_ID}';")

    # Create dashboard
    sql_lines.append(f"""
INSERT INTO dashboard_builder.dashboards (
  id, title_en, title_fr, title_ar, title_pt, description,
  scope, ownership, owner_user_id, campaign_id,
  domain_id, is_default, grid_columns, row_height, created_at, updated_at
) VALUES (
  '{DASHBOARD_ID}',
  'PPR Programme — Digital Tools Usage',
  'Programme PPR — Utilisation des Outils Numériques',
  'برنامج PPR — استخدام الأدوات الرقمية',
  'Programa PPR — Utilização de Ferramentas Digitais',
  'Tableau de bord analytique: adoption des outils numériques pour la surveillance en santé animale à travers les pays africains',
  'CONTINENTAL',
  'SYSTEM_TEMPLATE',
  '{SUPER_ADMIN_ID}',
  '{campaign_id}',
  NULL,
  FALSE,
  4,
  120,
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_fr = EXCLUDED.title_fr,
  campaign_id = EXCLUDED.campaign_id,
  description = EXCLUDED.description,
  updated_at = NOW();
""")

    # Create sections
    for s in sections:
        sql_lines.append(f"""
INSERT INTO dashboard_builder.dashboard_sections (
  id, dashboard_id, title_en, title_fr, title_ar, title_pt,
  column_count, sort_order, is_collapsed, config, created_at, updated_at
) VALUES (
  '{s["id"]}', '{DASHBOARD_ID}', '{s["title"]}', '{s["title"]}', '{s["title"]}', '{s["title"]}',
  {s["columns"]}, {s["order"]}, FALSE, '{{"color": "{s["color"]}"}}'::jsonb, NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET title_en = EXCLUDED.title_en, updated_at = NOW();
""")

    # Create widgets
    for w in widgets:
        wid = str(uuid.uuid4())
        section_id = sections[w["section"]]["id"]
        config_json = json.dumps(w["config"], ensure_ascii=False).replace("'", "''")
        title_fr = w["title_fr"].replace("'", "''")
        title_en = w["title_en"].replace("'", "''")
        sql_lines.append(f"""
INSERT INTO dashboard_builder.dashboard_widgets (
  id, section_id, dashboard_id, type, data_source, title_en, title_fr, title_ar, title_pt,
  grid_x, grid_y, grid_w, grid_h,
  config, created_at, updated_at
) VALUES (
  '{wid}', '{section_id}', '{DASHBOARD_ID}', '{w["type"]}', 'MANUAL_VALUE',
  '{title_en}', '{title_fr}', '{title_fr}', '{title_fr}',
  {w["x"]}, {w["y"]}, {w["w"]}, {w["h"]},
  '{config_json}'::jsonb, NOW(), NOW()
);
""")

    # Verify
    sql_lines.append(f"""
SELECT 'sections' AS type, count(*)::text AS cnt FROM dashboard_builder.dashboard_sections WHERE dashboard_id = '{DASHBOARD_ID}'
UNION ALL SELECT 'widgets', count(*)::text FROM dashboard_builder.dashboard_widgets WHERE dashboard_id = '{DASHBOARD_ID}';
""")

    return "\n".join(sql_lines)


def main():
    print("=" * 60)
    print("  PPR — DIGITAL TOOLS DASHBOARD")
    print("=" * 60)

    for env, host, db_host, db_pass in [
        ("PROD", "10.202.101.183", "10.202.101.185", "Ar1s_Pr0d_2024!xK9mZ"),
        ("STG", "10.202.101.146", "10.202.101.148", "Ar1s_Stg_2024!xK9mZ"),
    ]:
        print(f"\n--- {env} ---")
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)

        # Find campaign on this server
        campaign_id = CAMPAIGN_A
        if env == "STG":
            r = run_query(c, db_host, db_pass,
                "SELECT id FROM collection_campaigns WHERE name::text ILIKE '%Surveillance%Num%' LIMIT 1")
            if r and len(r.split("\n")[-1].strip()) == 36:
                campaign_id = r.split("\n")[-1].strip()
            print(f"  Campaign: {campaign_id[:8]}...")

        # Step 1: Compute data
        print("  Computing data from submissions...")
        data = compute_data(c, db_host, db_pass, campaign_id)
        print(f"  Surveyed: {data['total_surveyed']}, Digital: {data['with_digital']}, No digital: {data['without_digital']}")
        print(f"  Own system: {data['with_own_system']}, Surveillance: {data['with_surveillance']}")
        print(f"  Tools table: {len(data['table_with_digital'])} rows, No-tools: {len(data['table_without_digital'])} rows")
        print(f"  Developers: {len(data['bar_developers'])}, Map points: {len(data['map_countries'])}")

        # Step 2: Build + execute SQL
        print("  Creating dashboard...")
        sql = build_dashboard_sql(data, campaign_id)

        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, newline="\n", encoding="utf-8")
        tmp.write(sql)
        tmp.close()
        sftp = c.open_sftp()
        sftp.put(tmp.name, "/tmp/digital_tools_dash.sql")
        sftp.close()
        os.unlink(tmp.name)

        chan = c.get_transport().open_session()
        chan.exec_command(
            f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
            f"-v /tmp/digital_tools_dash.sql:/d.sql:ro "
            f"-e PGPASSWORD={db_pass} postgres:16 "
            f"psql -h {db_host} -p 5432 -U aris -d aris -f /d.sql 2>&1 | tail -10"
        )
        chan.settimeout(30)
        out = b""
        try:
            while True:
                ch = chan.recv(4096)
                if not ch:
                    break
                out += ch
        except:
            pass
        result = out.decode(errors="replace").strip()
        for line in result.split("\n")[-6:]:
            print(f"  {line}")

        c.close()

    print(f"\nDashboard ID: {DASHBOARD_ID}")
    print("DONE")


if __name__ == "__main__":
    main()
