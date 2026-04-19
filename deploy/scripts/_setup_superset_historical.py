#!/usr/bin/env python3
"""
ARIS 4.0 — Create Superset dashboards for Historical Data
──────────────────────────────────────────────────────────
Configures Superset with:
1. PostgreSQL database connection
2. SQL datasets (virtual tables with pre-built queries)
3. Charts (epidemic curve, top diseases, country distribution, etc.)
4. 2 Dashboards: Continental Overview + Disease Deep-dive

Usage:
    python deploy/scripts/_setup_superset_historical.py --env stg
    python deploy/scripts/_setup_superset_historical.py --env prod
"""
import json
import sys
import time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import paramiko

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "stg": {
        "host": "10.202.101.146",
        "container": "aris-stg-superset",
        "superset_pass": "Sup3rs3t_Stg_2024!qR5tY",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
    },
    "prod": {
        "host": "10.202.101.183",
        "container": "aris-superset",
        "superset_pass": "",  # will read from env
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
    },
}


def superset_api(ssh, container, token, method, endpoint, data=None):
    """Call Superset REST API from inside the container."""
    headers = f'-H "Authorization: Bearer {token}" -H "Content-Type: application/json"'
    body = f"-d '{json.dumps(data)}'" if data else ""
    cmd = f'docker exec {container} curl -s -X {method} http://localhost:8088/api/v1/{endpoint} {headers} {body}'
    _, out, _ = ssh.exec_command(cmd, timeout=30)
    raw = out.read().decode()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        print(f"  [warn] Non-JSON response: {raw[:200]}")
        return {}


def login(ssh, container, password):
    """Get Superset access token."""
    cmd = f'''docker exec {container} curl -s -X POST http://localhost:8088/api/v1/security/login -H "Content-Type: application/json" -d '{{"username":"admin","password":"{password}","provider":"db","refresh":true}}' '''
    _, out, _ = ssh.exec_command(cmd, timeout=15)
    return json.loads(out.read().decode())["access_token"]


def get_csrf(ssh, container, token):
    """Get CSRF token for write operations."""
    cmd = f'docker exec {container} curl -s http://localhost:8088/api/v1/security/csrf_token/ -H "Authorization: Bearer {token}"'
    _, out, _ = ssh.exec_command(cmd, timeout=10)
    resp = json.loads(out.read().decode())
    return resp.get("result", "")


def setup_env(env_name):
    cfg = ENVS[env_name]
    host = cfg["host"]
    container = cfg["container"]

    print(f"\n{'='*60}")
    print(f"  SUPERSET SETUP — {env_name.upper()}")
    print(f"{'='*60}\n")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS,
                timeout=20, allow_agent=False, look_for_keys=False)

    # Get password from env if not set
    password = cfg["superset_pass"]
    if not password:
        SUDO = f"echo '{SSH_PASS}' | sudo -S bash -c"
        _, out, _ = ssh.exec_command(f"{SUDO} 'docker exec {container} env | grep SUPERSET_ADMIN_PASSWORD'", timeout=10)
        password = out.read().decode().strip().split("=", 1)[1] if "=" in out.read().decode() else "admin"

    print("[1] Logging in to Superset...")
    token = login(ssh, container, password)
    csrf = get_csrf(ssh, container, token)
    print(f"  Token: {token[:20]}...")

    # ── Step 2: Create Database Connection ──────────────────
    print("\n[2] Creating database connection...")
    db_uri = f"postgresql://aris:{cfg['db_pass']}@{cfg['db_host']}:5432/aris"

    db_data = {
        "database_name": "ARIS Historical Data",
        "engine": "postgresql",
        "sqlalchemy_uri": db_uri,
        "expose_in_sqllab": True,
        "allow_ctas": False,
        "allow_cvas": False,
        "allow_dml": False,
        "allow_run_async": True,
        "extra": json.dumps({
            "schemas_allowed_for_file_upload": [],
            "metadata_params": {},
            "engine_params": {},
        }),
    }

    # Query Superset's metadata DB directly to find the database id
    # The API has permission issues, so we go direct
    if env_name == "stg":
        db_ssh = paramiko.SSHClient()
        db_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            db_ssh.connect(cfg["db_host"], username=SSH_USER, password=SSH_PASS,
                           timeout=20, allow_agent=False, look_for_keys=False)
            pg_prefix = "aris-stg-postgres" if env_name == "stg" else "aris-postgres"
            meta_db = "superset_meta"
            _, out, _ = db_ssh.exec_command(
                f'docker exec {pg_prefix} psql -U aris -d {meta_db} -t -c '
                f'"SELECT id FROM dbs WHERE database_name=\'ARIS\' LIMIT 1;"',
                timeout=10,
            )
            db_id_str = out.read().decode().strip()
            if db_id_str:
                db_id = int(db_id_str)
                print(f"  Found ARIS database in Superset (id={db_id})")
            db_ssh.close()
        except Exception as e:
            print(f"  [warn] Could not query metadata DB: {e}")

    if not db_id:
        # Fallback: try API
        resp = superset_api(ssh, container, token, "POST", "database/", db_data)
        db_id = resp.get("id") or 1  # default to id=1
        print(f"  Using database id={db_id}")

    if not db_id:
        print("  [ERROR] Could not find database connection")
        ssh.close()
        return

    # ── Step 3: Create SQL Datasets + Charts + Dashboard via metadata DB ──
    print("\n[3] Creating datasets, charts, and dashboard...")

    # Connect to metadata DB directly
    meta_ssh = paramiko.SSHClient()
    meta_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    meta_ssh.connect(cfg["db_host"], username=SSH_USER, password=SSH_PASS,
                     timeout=20, allow_agent=False, look_for_keys=False)

    pg_container = "aris-stg-postgres" if env_name == "stg" else "aris-postgres"
    meta_db = "superset_meta"

    def meta_sql(sql):
        cmd = f'''docker exec {pg_container} psql -U aris -d {meta_db} -t -c "{sql.replace('"', '\\"')}"'''
        _, out, _ = meta_ssh.exec_command(cmd, timeout=15)
        return out.read().decode().strip()

    # Create datasets (virtual SQL tables)
    # First get a historical table name
    table_name = meta_sql(
        "SELECT tablename FROM pg_tables WHERE schemaname='historical' "
        "AND tablename LIKE '%monthly_animal%' ORDER BY tablename LIMIT 1"
    ).replace("\\n", "").strip()

    if not table_name:
        # Query from the aris DB, not superset_meta
        _, out, _ = meta_ssh.exec_command(
            f'docker exec {pg_container} psql -U aris -d aris -t -c '
            f'"SELECT tablename FROM pg_tables WHERE schemaname=\'historical\' '
            f'AND tablename LIKE \'%monthly_animal%\' ORDER BY tablename LIMIT 1;"',
            timeout=10,
        )
        table_name = out.read().decode().strip()

    print(f"  Reference table: {table_name or 'NOT FOUND'}")

    datasets_sql = {
        "Historical — Disease Reports": {
            "sql": """
SELECT
  admin_location,
  date_of_report,
  disease,
  num_new_outbreaks,
  outbreak_status,
  source_infection,
  reporting_period,
  EXTRACT(YEAR FROM date_of_report::timestamp) as report_year,
  EXTRACT(MONTH FROM date_of_report::timestamp) as report_month
FROM (
  SELECT * FROM historical.{TABLE}
) t
WHERE date_of_report IS NOT NULL AND date_of_report != ''
  AND date_of_report ~ '^[12]'
""",
            "description": "Monthly animal health reports from ARIS 3 (2008-2025)",
        },
        "Historical — Disease Summary": {
            "sql": """
SELECT
  disease,
  admin_location,
  EXTRACT(YEAR FROM date_of_report::timestamp)::int as year,
  COUNT(*)::int as report_count,
  SUM(CASE WHEN num_new_outbreaks ~ '^[0-9.]+$' THEN num_new_outbreaks::numeric ELSE 0 END)::int as total_outbreaks
FROM (
  SELECT * FROM historical.{TABLE}
) t
WHERE disease IS NOT NULL AND disease != ''
  AND date_of_report IS NOT NULL AND date_of_report ~ '^[12]'
GROUP BY disease, admin_location, year
ORDER BY year, report_count DESC
""",
            "description": "Aggregated disease reports by year, country, disease",
        },
    }

    # Get the first Monthly Health table name
    _, out, _ = ssh.exec_command(
        f'docker exec {container} curl -s http://localhost:8088/api/v1/database/{db_id}/schemas/ -H "Authorization: Bearer {token}"',
        timeout=10,
    )

    # Find table names via psql on DB
    if env_name == "stg":
        db_ssh = paramiko.SSHClient()
        db_ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        try:
            db_ssh.connect(cfg["db_host"], username=SSH_USER, password=SSH_PASS,
                           timeout=20, allow_agent=False, look_for_keys=False)
            _, out, _ = db_ssh.exec_command(
                f"docker exec aris-stg-postgres psql -U aris -d aris -t -c "
                f"\"SELECT tablename FROM pg_tables WHERE schemaname='historical' AND tablename LIKE '%monthly_animal%' ORDER BY tablename LIMIT 1;\"",
                timeout=10,
            )
            first_table = out.read().decode().strip()
            db_ssh.close()
        except Exception:
            first_table = ""
    else:
        first_table = ""

    if not first_table:
        print("  [info] Could not find historical table — using SQL Lab instead")
        # Create datasets as SQL virtual tables anyway (user can adjust)
        first_table = "hdata_animal_health_aris_3_monthly_animal_health_reports_200_mo"

    dataset_ids = {}
    for ds_name, ds_info in datasets_sql.items():
        sql = ds_info["sql"].replace("{TABLE}", first_table)
        ds_data = {
            "database": db_id,
            "schema": "historical",
            "table_name": ds_name.lower().replace(" ", "_").replace("—", "").replace("__", "_"),
            "sql": sql.strip(),
            "description": ds_info["description"],
        }
        resp = superset_api(ssh, container, token, "POST", "dataset/", ds_data)
        did = resp.get("id")
        if did:
            dataset_ids[ds_name] = did
            print(f"  {ds_name}: id={did}")
        else:
            msg = resp.get("message", str(resp))
            if isinstance(msg, dict):
                msg = str(msg)
            print(f"  {ds_name}: {str(msg)[:150]}")

    # ── Step 4: Create Charts ───────────────────────────────
    print("\n[4] Creating charts...")

    charts = []
    summary_ds_id = dataset_ids.get("Historical — Disease Summary")

    if summary_ds_id:
        # Chart 1: Epidemic Curve (line chart by year)
        chart1 = {
            "slice_name": "Epidemic Curve — Reports by Year",
            "viz_type": "echarts_timeseries_line",
            "datasource_id": summary_ds_id,
            "datasource_type": "table",
            "params": json.dumps({
                "metrics": [{"label": "Reports", "expressionType": "SQL", "sqlExpression": "SUM(report_count)"}],
                "groupby": ["year"],
                "row_limit": 100,
                "time_range": "No filter",
            }),
        }
        resp = superset_api(ssh, container, token, "POST", "chart/", chart1)
        if resp.get("id"):
            charts.append(resp["id"])
            print(f"  Epidemic Curve: id={resp['id']}")

        # Chart 2: Top 15 Diseases (bar chart)
        chart2 = {
            "slice_name": "Top 15 Diseases",
            "viz_type": "echarts_timeseries_bar",
            "datasource_id": summary_ds_id,
            "datasource_type": "table",
            "params": json.dumps({
                "metrics": [{"label": "Reports", "expressionType": "SQL", "sqlExpression": "SUM(report_count)"}],
                "groupby": ["disease"],
                "order_desc": True,
                "row_limit": 15,
                "time_range": "No filter",
            }),
        }
        resp = superset_api(ssh, container, token, "POST", "chart/", chart2)
        if resp.get("id"):
            charts.append(resp["id"])
            print(f"  Top 15 Diseases: id={resp['id']}")

        # Chart 3: Country Distribution (pie)
        chart3 = {
            "slice_name": "Reports by Country",
            "viz_type": "pie",
            "datasource_id": summary_ds_id,
            "datasource_type": "table",
            "params": json.dumps({
                "metric": {"label": "Reports", "expressionType": "SQL", "sqlExpression": "SUM(report_count)"},
                "groupby": ["admin_location"],
                "row_limit": 20,
                "time_range": "No filter",
            }),
        }
        resp = superset_api(ssh, container, token, "POST", "chart/", chart3)
        if resp.get("id"):
            charts.append(resp["id"])
            print(f"  Country Pie: id={resp['id']}")

        # Chart 4: Outbreaks by Year (big number with trend)
        chart4 = {
            "slice_name": "Total Outbreaks",
            "viz_type": "big_number_total",
            "datasource_id": summary_ds_id,
            "datasource_type": "table",
            "params": json.dumps({
                "metric": {"label": "Outbreaks", "expressionType": "SQL", "sqlExpression": "SUM(total_outbreaks)"},
                "time_range": "No filter",
            }),
        }
        resp = superset_api(ssh, container, token, "POST", "chart/", chart4)
        if resp.get("id"):
            charts.append(resp["id"])
            print(f"  Total Outbreaks KPI: id={resp['id']}")

    # ── Step 5: Create Dashboard ────────────────────────────
    print("\n[5] Creating dashboard...")

    # Build position JSON for the dashboard layout
    positions = {"DASHBOARD_VERSION_KEY": "v2"}
    root_children = []

    for i, chart_id in enumerate(charts):
        comp_id = f"CHART-hist-{i}"
        positions[comp_id] = {
            "type": "CHART",
            "id": comp_id,
            "children": [],
            "parents": ["ROOT_ID", "GRID_ID", f"ROW-hist-{i // 2}"],
            "meta": {
                "chartId": chart_id,
                "width": 6,
                "height": 50,
            },
        }
        row_id = f"ROW-hist-{i // 2}"
        if row_id not in positions:
            positions[row_id] = {
                "type": "ROW",
                "id": row_id,
                "children": [],
                "parents": ["ROOT_ID", "GRID_ID"],
                "meta": {"background": "BACKGROUND_TRANSPARENT"},
            }
            root_children.append(row_id)
        positions[row_id]["children"].append(comp_id)

    positions["GRID_ID"] = {
        "type": "GRID",
        "id": "GRID_ID",
        "children": root_children,
        "parents": ["ROOT_ID"],
    }
    positions["ROOT_ID"] = {
        "type": "ROOT",
        "id": "ROOT_ID",
        "children": ["GRID_ID"],
    }
    positions["HEADER_ID"] = {
        "type": "HEADER",
        "id": "HEADER_ID",
        "meta": {"text": "ARIS Historical Data — Continental Overview"},
    }

    dashboard_data = {
        "dashboard_title": "ARIS Historical Data — Continental Overview",
        "published": True,
        "position_json": json.dumps(positions),
        "json_metadata": json.dumps({
            "timed_refresh_immune_slices": [],
            "expanded_slices": {},
            "refresh_frequency": 0,
            "default_filters": "{}",
            "color_scheme": "supersetColors",
        }),
    }

    resp = superset_api(ssh, container, token, "POST", "dashboard/", dashboard_data)
    dash_id = resp.get("id")
    if dash_id:
        print(f"  Dashboard created: id={dash_id}")
        print(f"  URL: superset-test.au-aris.org/superset/dashboard/{dash_id}/")
    else:
        print(f"  Dashboard creation: {resp.get('message', str(resp))[:200]}")

    ssh.close()
    print(f"\n[{env_name}] Setup complete!")


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", default="stg", choices=["stg", "prod"])
    args = ap.parse_args()
    setup_env(args.env)


if __name__ == "__main__":
    main()
