#!/usr/bin/env python3
"""Populate PPR dashboard widgets with real data (v2 - matching new layout)."""
import paramiko
import json
import sys
import tempfile
import os

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
DASHBOARD_ID = "a68e2cdf-4d5e-5a0d-9571-6d8f6b99e1d6"

def run_q(c, db_host, db_pass, sql):
    chan = c.get_transport().open_session()
    chan.exec_command(
        "echo '{}' | sudo -S docker run --rm --network host "
        "-e PGPASSWORD={} postgres:16 "
        "psql -h {} -p 5432 -U aris -d aris -t -A -c \"{}\"".format(
            SSH_PASS, db_pass, db_host, sql.replace('"', '\\"'))
    )
    chan.settimeout(15)
    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch:
                break
            out += ch
    except Exception:
        pass
    return out.decode(errors="replace").strip()

def parse_rows(raw):
    rows = []
    for line in raw.split("\n"):
        if "|" in line:
            rows.append([p.strip() for p in line.split("|")])
    return rows

def main():
    print("=" * 60)
    print("  POPULATE PPR DASHBOARD v2")
    print("=" * 60)

    for env, host, db_host, db_pass in [
        ("PROD", "10.202.101.183", "10.202.101.185", "Ar1s_Pr0d_2024!xK9mZ"),
        ("STG", "10.202.101.146", "10.202.101.148", "Ar1s_Stg_2024!xK9mZ"),
    ]:
        print("\n--- {} ---".format(env))
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)

        # Get campaign IDs
        ca = run_q(c, db_host, db_pass, "SELECT id FROM collection_campaigns WHERE name::text LIKE '%Surveillance%Outils%' LIMIT 1") or ""
        cb = run_q(c, db_host, db_pass, "SELECT id FROM collection_campaigns WHERE name::text LIKE '%Diagnostiques%HPPR%' LIMIT 1") or ""
        cc = run_q(c, db_host, db_pass, "SELECT id FROM collection_campaigns WHERE name::text LIKE '%Allocation Kits%' LIMIT 1") or ""
        if not ca or not cb or not cc:
            print("  Campaigns not found, skipping")
            c.close()
            continue

        # Compute data
        kpi_surv = run_q(c, db_host, db_pass, "SELECT count(DISTINCT data->>'country') FROM submissions WHERE campaign_id='{}'".format(ca))
        kpi_diag = run_q(c, db_host, db_pass, "SELECT count(DISTINCT data->>'country') FROM submissions WHERE campaign_id='{}'".format(cb))
        kpi_kits = run_q(c, db_host, db_pass, "SELECT COALESCE(SUM(CASE WHEN data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int ELSE 0 END),0) FROM submissions WHERE campaign_id='{}'".format(cc))
        kpi_ckits = run_q(c, db_host, db_pass, "SELECT count(DISTINCT data->>'destination_country') FROM submissions WHERE campaign_id='{}' AND data->>'destination_country' IS NOT NULL".format(cc))

        pie_surv = [{"name": r[0].replace("yes", "Oui").replace("no", "Non"), "value": int(r[1])} for r in parse_rows(run_q(c, db_host, db_pass, "SELECT data->>'has_surveillance', count(*) FROM submissions WHERE campaign_id='{}' AND data->>'has_surveillance' IS NOT NULL GROUP BY 1".format(ca)))]
        pie_digi = [{"name": r[0].replace("yes", "Oui").replace("no", "Non"), "value": int(r[1])} for r in parse_rows(run_q(c, db_host, db_pass, "SELECT data->>'uses_digital_tool', count(*) FROM submissions WHERE campaign_id='{}' AND data->>'uses_digital_tool' IS NOT NULL GROUP BY 1".format(ca)))]
        pie_ppr = [{"name": r[0], "value": int(r[1])} for r in parse_rows(run_q(c, db_host, db_pass, "SELECT data->>'ppr_status', count(*) FROM submissions WHERE campaign_id='{}' AND data->>'ppr_status' IS NOT NULL GROUP BY 1".format(cb)))]
        bar_pmat = [{"stage": r[0], "count": int(r[1])} for r in parse_rows(run_q(c, db_host, db_pass, "SELECT 'Stage '||data->>'pmat_stage', count(*) FROM submissions WHERE campaign_id='{}' AND data->>'pmat_stage' IS NOT NULL GROUP BY 1 ORDER BY 1".format(cb)))]
        bar_kreq = [{"country": r[0], "kits": int(r[1])} for r in parse_rows(run_q(c, db_host, db_pass, "SELECT data->>'country', COALESCE((data->>'kits_requested')::int,0) FROM submissions WHERE campaign_id='{}' AND data->>'kits_requested' IS NOT NULL ORDER BY 2 DESC".format(cb)))]
        bar_kship = [{"country": r[0], "kits": int(r[1])} for r in parse_rows(run_q(c, db_host, db_pass, "SELECT data->>'destination_country', SUM(CASE WHEN data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int ELSE 0 END) FROM submissions WHERE campaign_id='{}' GROUP BY 1 ORDER BY 2 DESC".format(cc))) if r[0]]
        pie_fmt = [{"name": r[0], "value": int(r[1])} for r in parse_rows(run_q(c, db_host, db_pass, "SELECT data->>'kit_format', count(*) FROM submissions WHERE campaign_id='{}' GROUP BY 1".format(cc))) if r[0]]

        print("  KPIs: surv={} diag={} kits={} countries={}".format(kpi_surv, kpi_diag, kpi_kits, kpi_ckits))

        # Build updates
        updates = [
            ("Countries Surveyed (Surveillance)", {"label": "Pays (Surveillance)", "value": int(kpi_surv) if kpi_surv.isdigit() else 0, "icon": "globe", "color": "#1E40AF"}),
            ("Countries Surveyed (Diagnostics)", {"label": "Pays (Diagnostics)", "value": int(kpi_diag) if kpi_diag.isdigit() else 0, "icon": "flask-conical", "color": "#7C3AED"}),
            ("Total Kits Shipped", {"label": "Kits envoy\u00e9s", "value": int(kpi_kits) if kpi_kits.lstrip("-").isdigit() else 0, "icon": "package", "color": "#EA580C"}),
            ("Countries Receiving Kits", {"label": "Pays destinataires", "value": int(kpi_ckits) if kpi_ckits.isdigit() else 0, "icon": "truck", "color": "#059669"}),
            ("Has National Surveillance System", {"data": pie_surv, "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#059669", "#DC2626"]}),
            ("Uses Digital Tools", {"data": pie_digi, "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#7C3AED", "#9CA3AF"]}),
            ("PPR Status by Country", {"data": pie_ppr, "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#DC2626", "#059669", "#D97706"]}),
            ("PMAT Stage Distribution", {"data": bar_pmat, "chartConfig": {"xKey": "stage", "yKeys": ["count"], "colors": ["#7C3AED"]}}),
            ("HPPR-bELISA Kits Requested by Country", {"data": bar_kreq, "chartConfig": {"xKey": "country", "yKeys": ["kits"], "colors": ["#1E40AF"]}}),
            ("Kits Shipped by Country", {"data": bar_kship, "chartConfig": {"xKey": "country", "yKeys": ["kits"], "colors": ["#EA580C"]}}),
            ("Kit Format Distribution", {"data": pie_fmt, "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#EA580C", "#F59E0B"]}),
        ]

        sql_lines = []
        for title, cfg in updates:
            cfg_json = json.dumps(cfg, ensure_ascii=False).replace("'", "''")
            t = title.replace("'", "''")
            sql_lines.append(
                "UPDATE dashboard_builder.dashboard_widgets SET data_source='MANUAL_VALUE', "
                "config='{}' WHERE dashboard_id='{}' AND title_en='{}';".format(
                    cfg_json, DASHBOARD_ID, t)
            )

        sql = "\n".join(sql_lines)
        tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, newline="\n", encoding="utf-8")
        tmp.write(sql)
        tmp.close()
        sftp = c.open_sftp()
        sftp.put(tmp.name, "/tmp/ppr_d2.sql")
        sftp.close()
        os.unlink(tmp.name)

        chan = c.get_transport().open_session()
        chan.exec_command(
            "echo '{}' | sudo -S docker run --rm --network host "
            "-v /tmp/ppr_d2.sql:/d.sql:ro "
            "-e PGPASSWORD={} postgres:16 "
            "psql -h {} -p 5432 -U aris -d aris -f /d.sql".format(SSH_PASS, db_pass, db_host)
        )
        chan.settimeout(30)
        out = b""
        try:
            while True:
                ch = chan.recv(4096)
                if not ch:
                    break
                out += ch
        except Exception:
            pass
        count = out.decode(errors="replace").count("UPDATE 1")
        print("  Updated: {}/11 widgets".format(count))
        c.close()

    print("\nDONE")

if __name__ == "__main__":
    main()
