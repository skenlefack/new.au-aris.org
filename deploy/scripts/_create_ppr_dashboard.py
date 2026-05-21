#!/usr/bin/env python3
"""
1. Delete all non-system dashboards
2. Create PPR Continental Analytics Dashboard
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
SUPER_ADMIN_ID = "10000000-0000-4000-a000-000000000001"
TENANT_AU_IBAR = "00000000-0000-4000-a000-000000000001"

# Campaign IDs (PROD)
CAMPAIGN_A = "6cbd4272-d213-4096-87b9-2952e7e13f65"  # Surveillance
CAMPAIGN_B = "73e7b3be-9679-46fe-9163-948dd34e271c"  # Diagnostics
CAMPAIGN_C = "8fad5186-6549-48fd-aea7-d1ae83d66ef6"  # Kit Allocation

DASHBOARD_ID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "ppr-continental-dashboard"))


def build_ppr_dashboard_sql():
    """Build SQL to create the PPR dashboard with sections and widgets."""
    sections = [
        {
            "id": str(uuid.uuid4()),
            "title": "PPR Programme Overview",
            "order": 0,
            "columns": 4,
            "color": "#1E40AF",
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Surveillance & Digital Tools",
            "order": 1,
            "columns": 4,
            "color": "#059669",
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Diagnostic Capacity & Kits",
            "order": 2,
            "columns": 4,
            "color": "#7C3AED",
        },
        {
            "id": str(uuid.uuid4()),
            "title": "Kit Allocation Tracking",
            "order": 3,
            "columns": 4,
            "color": "#EA580C",
        },
    ]

    widgets = [
        # Section 0: Overview KPIs
        {"section": 0, "type": "KPI_CARD", "title": "Countries Surveyed (Surveillance)", "x": 0, "y": 0, "w": 1, "h": 1,
         "config": {"query": f"SELECT count(DISTINCT data->>'country') AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_A}'", "icon": "globe", "color": "#1E40AF"}},
        {"section": 0, "type": "KPI_CARD", "title": "Countries Surveyed (Diagnostics)", "x": 1, "y": 0, "w": 1, "h": 1,
         "config": {"query": f"SELECT count(DISTINCT data->>'country') AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_B}'", "icon": "flask-conical", "color": "#7C3AED"}},
        {"section": 0, "type": "KPI_CARD", "title": "Total Kits Shipped", "x": 2, "y": 0, "w": 1, "h": 1,
         "config": {"query": f"SELECT COALESCE(SUM((data->>'quantity')::int), 0) AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_C}'", "icon": "package", "color": "#EA580C"}},
        {"section": 0, "type": "KPI_CARD", "title": "Countries Receiving Kits", "x": 3, "y": 0, "w": 1, "h": 1,
         "config": {"query": f"SELECT count(DISTINCT data->>'destination_country') AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_C}'", "icon": "truck", "color": "#059669"}},

        # Section 1: Surveillance
        {"section": 1, "type": "PIE_CHART", "title": "Has National Surveillance System", "x": 0, "y": 0, "w": 2, "h": 2,
         "config": {"query": f"SELECT data->>'has_surveillance' AS label, count(*) AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_A}' AND data->>'has_surveillance' IS NOT NULL GROUP BY 1", "colors": ["#059669", "#DC2626"]}},
        {"section": 1, "type": "PIE_CHART", "title": "Uses Digital Tools", "x": 2, "y": 0, "w": 2, "h": 2,
         "config": {"query": f"SELECT data->>'uses_digital_tool' AS label, count(*) AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_A}' AND data->>'uses_digital_tool' IS NOT NULL GROUP BY 1", "colors": ["#7C3AED", "#9CA3AF"]}},
        {"section": 1, "type": "TABLE", "title": "Digital Tools by Country", "x": 0, "y": 2, "w": 4, "h": 3,
         "config": {"query": f"SELECT data->>'country' AS \"Country\", data->>'institution' AS \"Institution\", data->>'tool_name' AS \"Tool\", data->>'tool_developer' AS \"Developer\" FROM submissions WHERE campaign_id = '{CAMPAIGN_A}' AND data->>'tool_name' IS NOT NULL ORDER BY 1"}},

        # Section 2: Diagnostics
        {"section": 2, "type": "PIE_CHART", "title": "PPR Status by Country", "x": 0, "y": 0, "w": 2, "h": 2,
         "config": {"query": f"SELECT data->>'ppr_status' AS label, count(*) AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_B}' AND data->>'ppr_status' IS NOT NULL GROUP BY 1", "colors": ["#DC2626", "#059669", "#D97706"]}},
        {"section": 2, "type": "BAR_CHART", "title": "PMAT Stage Distribution", "x": 2, "y": 0, "w": 2, "h": 2,
         "config": {"query": f"SELECT 'Stage ' || data->>'pmat_stage' AS label, count(*) AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_B}' AND data->>'pmat_stage' IS NOT NULL GROUP BY 1 ORDER BY 1", "color": "#7C3AED"}},
        {"section": 2, "type": "BAR_CHART", "title": "HPPR-bELISA Kits Requested by Country", "x": 0, "y": 2, "w": 4, "h": 2,
         "config": {"query": f"SELECT data->>'country' AS label, COALESCE((data->>'kits_requested')::int, 0) AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_B}' AND data->>'kits_requested' IS NOT NULL ORDER BY value DESC", "color": "#1E40AF"}},

        # Section 3: Kit Allocation
        {"section": 3, "type": "BAR_CHART", "title": "Kits Shipped by Country", "x": 0, "y": 0, "w": 2, "h": 2,
         "config": {"query": f"SELECT data->>'destination_country' AS label, SUM((data->>'quantity')::int) AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_C}' GROUP BY 1 ORDER BY value DESC", "color": "#EA580C"}},
        {"section": 3, "type": "PIE_CHART", "title": "Kit Format Distribution", "x": 2, "y": 0, "w": 2, "h": 2,
         "config": {"query": f"SELECT data->>'kit_format' AS label, count(*) AS value FROM submissions WHERE campaign_id = '{CAMPAIGN_C}' GROUP BY 1", "colors": ["#EA580C", "#F59E0B"]}},
        {"section": 3, "type": "TABLE", "title": "All Kit Shipments", "x": 0, "y": 2, "w": 4, "h": 3,
         "config": {"query": f"SELECT data->>'shipment_date' AS \"Date\", data->>'destination_country' AS \"Country\", data->>'kit_format' AS \"Format\", data->>'quantity' AS \"Qty\", data->>'num_samples' AS \"Samples\", data->>'year' AS \"Year\" FROM submissions WHERE campaign_id = '{CAMPAIGN_C}' ORDER BY data->>'shipment_date' DESC"}},
    ]

    sql_lines = []

    # 1. Delete all non-system dashboards
    sql_lines.append("-- Delete all non-system dashboards")
    sql_lines.append("DELETE FROM dashboard_builder.dashboards WHERE ownership != 'SYSTEM_TEMPLATE';")
    sql_lines.append("")

    # 2. Create PPR dashboard
    sql_lines.append("-- Create PPR Continental Dashboard")
    sql_lines.append(f"""
INSERT INTO dashboard_builder.dashboards (
  id, title_en, title_fr, title_ar, title_pt, description,
  scope, ownership, owner_user_id,
  domain_id, is_default, grid_columns, row_height, created_at, updated_at
) VALUES (
  '{DASHBOARD_ID}',
  'PPR Programme — Continental Analytics',
  'Programme PPR — Analyse Continentale',
  'برنامج طاعون المجترات الصغيرة — تحليلات قارية',
  'Programa PPR — Analise Continental',
  'Dashboard analytique du programme PPR: Surveillance, Tests Diagnostiques, et Allocation des Kits HPPR-bELISA',
  'CONTINENTAL',
  'SYSTEM_TEMPLATE',
  '{SUPER_ADMIN_ID}',
  NULL,
  TRUE,
  4,
  120,
  NOW(), NOW()
) ON CONFLICT (id) DO UPDATE SET
  title_en = EXCLUDED.title_en,
  title_fr = EXCLUDED.title_fr,
  description = EXCLUDED.description,
  updated_at = NOW();
""")

    # 3. Create sections
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

    # 4. Create widgets
    for w in widgets:
        wid = str(uuid.uuid4())
        section_id = sections[w["section"]]["id"]
        config_json = json.dumps(w["config"], ensure_ascii=False).replace("'", "''")
        title = w["title"].replace("'", "''")
        sql_lines.append(f"""
INSERT INTO dashboard_builder.dashboard_widgets (
  id, section_id, dashboard_id, type, title_en, title_fr, title_ar, title_pt,
  grid_x, grid_y, grid_w, grid_h,
  config, created_at, updated_at
) VALUES (
  '{wid}', '{section_id}', '{DASHBOARD_ID}', '{w["type"]}', '{title}', '{title}', '{title}', '{title}',
  {w["x"]}, {w["y"]}, {w["w"]}, {w["h"]},
  '{config_json}'::jsonb, NOW(), NOW()
);
""")

    # 5. Verify
    sql_lines.append("""
SELECT 'dashboards' AS type, count(*)::text AS cnt FROM dashboard_builder.dashboards
UNION ALL SELECT 'sections', count(*)::text FROM dashboard_builder.dashboard_sections WHERE dashboard_id = '""" + DASHBOARD_ID + """'
UNION ALL SELECT 'widgets', count(*)::text FROM dashboard_builder.dashboard_widgets WHERE dashboard_id = '""" + DASHBOARD_ID + """';
""")

    return "\n".join(sql_lines)


def main():
    print("=" * 60)
    print("  PPR DASHBOARD — Cleanup + Create")
    print("=" * 60)

    sql = build_ppr_dashboard_sql()
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, newline="\n", encoding="utf-8")
    tmp.write(sql)
    tmp.close()

    for env, host, db_host, db_pass in [
        ("PROD", "10.202.101.183", "10.202.101.185", "Ar1s_Pr0d_2024!xK9mZ"),
        ("STG", "10.202.101.146", "10.202.101.148", "Ar1s_Stg_2024!xK9mZ"),
    ]:
        print(f"\n--- {env} ---")
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
        sftp = c.open_sftp()
        sftp.put(tmp.name, "/tmp/ppr_dash.sql")
        sftp.close()

        chan = c.get_transport().open_session()
        chan.exec_command(
            f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
            f"-v /tmp/ppr_dash.sql:/d.sql:ro "
            f"-e PGPASSWORD={db_pass} postgres:16 "
            f"psql -h {db_host} -p 5432 -U aris -d aris -f /d.sql"
        )
        chan.settimeout(30)
        out = b""
        try:
            while True:
                ch = chan.recv(4096)
                if not ch: break
                out += ch
        except: pass
        # Show last lines
        lines = out.decode(errors="replace").strip().split("\n")
        for line in lines[-10:]:
            print(f"  {line}")
        c.close()

    os.unlink(tmp.name)
    print(f"\nDashboard ID: {DASHBOARD_ID}")
    print("DONE")


if __name__ == "__main__":
    main()
