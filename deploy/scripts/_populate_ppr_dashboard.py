#!/usr/bin/env python3
"""Populate PPR dashboard widgets with real data from submissions."""
import paramiko
import json
import sys
import tempfile
import os

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
DASHBOARD_ID = "a68e2cdf-4d5e-5a0d-9571-6d8f6b99e1d6"

CAMPAIGN_A = "6cbd4272-d213-4096-87b9-2952e7e13f65"  # Surveillance
CAMPAIGN_B = "73e7b3be-9679-46fe-9163-948dd34e271c"  # Diagnostics
CAMPAIGN_C = "8fad5186-6549-48fd-aea7-d1ae83d66ef6"  # Kit Allocation


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
            if not ch: break
            out += ch
    except: pass
    return out.decode(errors="replace").strip()


def compute_data(c, db_host, db_pass):
    """Query submissions and compute all widget data."""
    data = {}

    # KPI 1: Countries surveyed (Surveillance)
    r = run_query(c, db_host, db_pass,
        f"SELECT count(DISTINCT data->>'country') FROM submissions WHERE campaign_id = '{CAMPAIGN_A}'")
    data["kpi_countries_surv"] = int(r) if r.isdigit() else 0

    # KPI 2: Countries surveyed (Diagnostics)
    r = run_query(c, db_host, db_pass,
        f"SELECT count(DISTINCT data->>'country') FROM submissions WHERE campaign_id = '{CAMPAIGN_B}'")
    data["kpi_countries_diag"] = int(r) if r.isdigit() else 0

    # KPI 3: Total kits shipped
    r = run_query(c, db_host, db_pass,
        f"SELECT COALESCE(SUM(CASE WHEN data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int ELSE 0 END), 0) FROM submissions WHERE campaign_id = '{CAMPAIGN_C}'")
    data["kpi_total_kits"] = int(r) if r.lstrip('-').isdigit() else 0

    # KPI 4: Countries receiving kits
    r = run_query(c, db_host, db_pass,
        f"SELECT count(DISTINCT data->>'destination_country') FROM submissions WHERE campaign_id = '{CAMPAIGN_C}' AND data->>'destination_country' IS NOT NULL")
    data["kpi_countries_kits"] = int(r) if r.isdigit() else 0

    # Pie: Has surveillance system
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'has_surveillance' AS lbl, count(*) AS cnt FROM submissions WHERE campaign_id = '{CAMPAIGN_A}' AND data->>'has_surveillance' IS NOT NULL GROUP BY 1")
    surv_data = []
    for line in r.split("\n"):
        if "|" in line:
            parts = line.split("|")
            label = "Yes" if parts[0].strip() == "yes" else "No" if parts[0].strip() == "no" else parts[0].strip()
            surv_data.append({"name": label, "value": int(parts[1].strip())})
    data["pie_surveillance"] = surv_data

    # Pie: Uses digital tools
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'uses_digital_tool' AS lbl, count(*) AS cnt FROM submissions WHERE campaign_id = '{CAMPAIGN_A}' AND data->>'uses_digital_tool' IS NOT NULL GROUP BY 1")
    digital_data = []
    for line in r.split("\n"):
        if "|" in line:
            parts = line.split("|")
            label = "Yes" if parts[0].strip() == "yes" else "No" if parts[0].strip() == "no" else parts[0].strip()
            digital_data.append({"name": label, "value": int(parts[1].strip())})
    data["pie_digital"] = digital_data

    # Table: Digital tools by country
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'country', data->>'institution', data->>'tool_name', data->>'tool_developer' FROM submissions WHERE campaign_id = '{CAMPAIGN_A}' AND data->>'tool_name' IS NOT NULL ORDER BY 1")
    tools_rows = []
    for line in r.split("\n"):
        if "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if parts[0]:
                tools_rows.append({"country": parts[0], "institution": parts[1], "tool": parts[2], "developer": parts[3]})
    data["table_tools"] = tools_rows

    # Pie: PPR status
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'ppr_status' AS lbl, count(*) AS cnt FROM submissions WHERE campaign_id = '{CAMPAIGN_B}' AND data->>'ppr_status' IS NOT NULL GROUP BY 1")
    ppr_status = []
    for line in r.split("\n"):
        if "|" in line:
            parts = line.split("|")
            ppr_status.append({"name": parts[0].strip(), "value": int(parts[1].strip())})
    data["pie_ppr_status"] = ppr_status

    # Bar: PMAT stages
    r = run_query(c, db_host, db_pass,
        f"SELECT 'Stage ' || data->>'pmat_stage' AS lbl, count(*) AS cnt FROM submissions WHERE campaign_id = '{CAMPAIGN_B}' AND data->>'pmat_stage' IS NOT NULL GROUP BY 1 ORDER BY 1")
    pmat_data = []
    for line in r.split("\n"):
        if "|" in line:
            parts = line.split("|")
            pmat_data.append({"stage": parts[0].strip(), "count": int(parts[1].strip())})
    data["bar_pmat"] = pmat_data

    # Bar: Kits requested by country
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'country', COALESCE((data->>'kits_requested')::int, 0) FROM submissions WHERE campaign_id = '{CAMPAIGN_B}' AND data->>'kits_requested' IS NOT NULL ORDER BY 2 DESC")
    kits_req = []
    for line in r.split("\n"):
        if "|" in line:
            parts = line.split("|")
            if parts[0].strip():
                kits_req.append({"country": parts[0].strip(), "kits": int(parts[1].strip())})
    data["bar_kits_requested"] = kits_req

    # Bar: Kits shipped by country
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'destination_country', SUM(CASE WHEN data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int ELSE 0 END) FROM submissions WHERE campaign_id = '{CAMPAIGN_C}' GROUP BY 1 ORDER BY 2 DESC")
    kits_shipped = []
    for line in r.split("\n"):
        if "|" in line:
            parts = line.split("|")
            if parts[0].strip():
                kits_shipped.append({"country": parts[0].strip(), "kits": int(parts[1].strip())})
    data["bar_kits_shipped"] = kits_shipped

    # Pie: Kit format distribution
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'kit_format', count(*) FROM submissions WHERE campaign_id = '{CAMPAIGN_C}' GROUP BY 1")
    kit_format = []
    for line in r.split("\n"):
        if "|" in line:
            parts = line.split("|")
            if parts[0].strip():
                kit_format.append({"name": parts[0].strip(), "value": int(parts[1].strip())})
    data["pie_kit_format"] = kit_format

    # Table: All shipments
    r = run_query(c, db_host, db_pass,
        f"SELECT data->>'shipment_date', data->>'destination_country', data->>'kit_format', data->>'quantity', data->>'num_samples', data->>'year' FROM submissions WHERE campaign_id = '{CAMPAIGN_C}' ORDER BY 1 DESC")
    shipments = []
    for line in r.split("\n"):
        if "|" in line:
            parts = [p.strip() for p in line.split("|")]
            shipments.append({"date": parts[0], "country": parts[1], "format": parts[2], "qty": parts[3], "samples": parts[4], "year": parts[5]})
    data["table_shipments"] = shipments

    return data


def build_update_sql(data):
    """Build SQL to update widget configs with computed data."""
    sql_parts = []

    # Map widget titles to their data
    widget_configs = {
        "Countries Surveyed (Surveillance)": {
            "data_source": "MANUAL_VALUE",
            "config": {"label": "Pays enquêtés (Surveillance)", "value": data["kpi_countries_surv"], "suffix": "", "icon": "globe", "color": "#1E40AF"},
        },
        "Countries Surveyed (Diagnostics)": {
            "data_source": "MANUAL_VALUE",
            "config": {"label": "Pays enquêtés (Diagnostics)", "value": data["kpi_countries_diag"], "suffix": "", "icon": "flask-conical", "color": "#7C3AED"},
        },
        "Total Kits Shipped": {
            "data_source": "MANUAL_VALUE",
            "config": {"label": "Kits envoyés", "value": data["kpi_total_kits"], "suffix": "", "icon": "package", "color": "#EA580C"},
        },
        "Countries Receiving Kits": {
            "data_source": "MANUAL_VALUE",
            "config": {"label": "Pays recevant des kits", "value": data["kpi_countries_kits"], "suffix": f"/{data['kpi_countries_kits']}", "icon": "truck", "color": "#059669"},
        },
        "Has National Surveillance System": {
            "data_source": "MANUAL_VALUE",
            "config": {"data": data["pie_surveillance"], "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#059669", "#DC2626"]},
        },
        "Uses Digital Tools": {
            "data_source": "MANUAL_VALUE",
            "config": {"data": data["pie_digital"], "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#7C3AED", "#9CA3AF"]},
        },
        "Digital Tools by Country": {
            "data_source": "MANUAL_VALUE",
            "config": {
                "columns": [
                    {"key": "country", "label": "Pays"},
                    {"key": "institution", "label": "Institution"},
                    {"key": "tool", "label": "Outil"},
                    {"key": "developer", "label": "Développeur"},
                ],
                "rows": data["table_tools"],
            },
        },
        "PPR Status by Country": {
            "data_source": "MANUAL_VALUE",
            "config": {"data": data["pie_ppr_status"], "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#DC2626", "#059669", "#D97706"]},
        },
        "PMAT Stage Distribution": {
            "data_source": "MANUAL_VALUE",
            "config": {"data": data["bar_pmat"], "chartConfig": {"xKey": "stage", "yKeys": ["count"], "colors": ["#7C3AED"]}},
        },
        "HPPR-bELISA Kits Requested by Country": {
            "data_source": "MANUAL_VALUE",
            "config": {"data": data["bar_kits_requested"], "chartConfig": {"xKey": "country", "yKeys": ["kits"], "colors": ["#1E40AF"]}},
        },
        "Kits Shipped by Country": {
            "data_source": "MANUAL_VALUE",
            "config": {"data": data["bar_kits_shipped"], "chartConfig": {"xKey": "country", "yKeys": ["kits"], "colors": ["#EA580C"]}},
        },
        "Kit Format Distribution": {
            "data_source": "MANUAL_VALUE",
            "config": {"data": data["pie_kit_format"], "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#EA580C", "#F59E0B"]},
        },
        "All Kit Shipments": {
            "data_source": "MANUAL_VALUE",
            "config": {
                "columns": [
                    {"key": "date", "label": "Date"},
                    {"key": "country", "label": "Pays"},
                    {"key": "format", "label": "Format"},
                    {"key": "qty", "label": "Qté", "align": "right"},
                    {"key": "samples", "label": "Échantillons", "align": "right"},
                    {"key": "year", "label": "Année"},
                ],
                "rows": data["table_shipments"],
            },
        },
    }

    for title, wdata in widget_configs.items():
        config_json = json.dumps(wdata["config"], ensure_ascii=False).replace("'", "''")
        title_escaped = title.replace("'", "''")
        sql_parts.append(
            f"UPDATE dashboard_builder.dashboard_widgets "
            f"SET data_source = '{wdata['data_source']}', config = '{config_json}'::jsonb "
            f"WHERE dashboard_id = '{DASHBOARD_ID}' AND title_en = '{title_escaped}';"
        )

    return "\n".join(sql_parts)


def main():
    print("=" * 60)
    print("  POPULATE PPR DASHBOARD WITH REAL DATA")
    print("=" * 60)

    for env, host, db_host, db_pass in [
        ("PROD", "10.202.101.183", "10.202.101.185", "Ar1s_Pr0d_2024!xK9mZ"),
        ("STG", "10.202.101.146", "10.202.101.148", "Ar1s_Stg_2024!xK9mZ"),
    ]:
        print(f"\n--- {env} ---")
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)

        # Use staging campaign IDs if on staging
        global CAMPAIGN_A, CAMPAIGN_B, CAMPAIGN_C
        if env == "STG":
            # Staging campaigns have different IDs
            r = run_query(c, db_host, db_pass,
                "SELECT id FROM collection_campaigns WHERE name::text LIKE '%Surveillance%Outils%' LIMIT 1")
            if r: CAMPAIGN_A = r.strip()
            r = run_query(c, db_host, db_pass,
                "SELECT id FROM collection_campaigns WHERE name::text LIKE '%Diagnostiques%HPPR%' LIMIT 1")
            if r: CAMPAIGN_B = r.strip()
            r = run_query(c, db_host, db_pass,
                "SELECT id FROM collection_campaigns WHERE name::text LIKE '%Allocation Kits%' LIMIT 1")
            if r: CAMPAIGN_C = r.strip()
            print(f"  STG campaigns: A={CAMPAIGN_A[:8]}, B={CAMPAIGN_B[:8]}, C={CAMPAIGN_C[:8]}")

        print("  Computing data...")
        data = compute_data(c, db_host, db_pass)

        print(f"  KPIs: surv={data['kpi_countries_surv']}, diag={data['kpi_countries_diag']}, kits={data['kpi_total_kits']}, countries={data['kpi_countries_kits']}")
        print(f"  Surveillance: {len(data['pie_surveillance'])} categories")
        print(f"  Digital tools: {len(data['table_tools'])} entries")
        print(f"  PPR status: {len(data['pie_ppr_status'])} categories")
        print(f"  PMAT: {len(data['bar_pmat'])} stages")
        print(f"  Kits requested: {len(data['bar_kits_requested'])} countries")
        print(f"  Kits shipped: {len(data['bar_kits_shipped'])} countries")
        print(f"  Shipments: {len(data['table_shipments'])} records")

        sql = build_update_sql(data)
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, newline="\n", encoding="utf-8")
        tmp.write(sql)
        tmp.close()
        sftp = c.open_sftp()
        sftp.put(tmp.name, "/tmp/ppr_data.sql")
        sftp.close()
        os.unlink(tmp.name)

        chan = c.get_transport().open_session()
        chan.exec_command(
            f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
            f"-v /tmp/ppr_data.sql:/d.sql:ro "
            f"-e PGPASSWORD={db_pass} postgres:16 "
            f"psql -h {db_host} -p 5432 -U aris -d aris -f /d.sql 2>&1 | tail -5"
        )
        chan.settimeout(30)
        out = b""
        try:
            while True:
                ch = chan.recv(4096)
                if not ch: break
                out += ch
        except: pass
        result = out.decode(errors="replace").strip()
        updates = result.count("UPDATE 1")
        print(f"  Updated: {updates}/13 widgets")

        c.close()

    print("\nDONE")


if __name__ == "__main__":
    main()
