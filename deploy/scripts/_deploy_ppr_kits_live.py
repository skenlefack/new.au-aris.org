#!/usr/bin/env python3
"""
Re-populate PPR Kit Allocation dashboard with live data from submissions.
Also switches widgets to use full config data (not just value/label).

Targets: Production + Staging
"""
import paramiko
import json
import sys
import uuid
import tempfile
import os

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO_CMD = f"echo '{SSH_PASS}' | sudo -S bash -c"

DASH_KITS_ID = str(uuid.uuid5(uuid.NAMESPACE_DNS, "ppr-kits-dashboard"))

# Campaign IDs (PROD)
CAMPAIGN_B = "73e7b3be-9679-46fe-9163-948dd34e271c"  # Diagnostiques HPPR
CAMPAIGN_C = "8fad5186-6549-48fd-aea7-d1ae83d66ef6"  # Allocation Kits

# Country name -> ISO 3166-1 alpha-2
COUNTRY_TO_ISO = {
    "Algeria": "DZ", "Angola": "AO", "Benin": "BJ", "Botswana": "BW",
    "Burkina Faso": "BF", "Burundi": "BI", "Cabo Verde": "CV", "Cape verde": "CV",
    "Cameroon": "CM", "Central African Republic": "CF", "Chad": "TD",
    "Comoros": "KM", "Congo": "CG", "Cote d'Ivoire": "CI", "DRC": "CD",
    "DR Congo": "CD", "Djibouti": "DJ", "Egypt": "EG", "Equatorial Guinea": "GQ",
    "Eritrea": "ER", "Eswatini": "SZ", "Ethiopia": "ET", "Gabon": "GA",
    "Gambia": "GM", "Ghana": "GH", "Guinea": "GN", "Guinea-Bissau": "GW",
    "Kenya": "KE", "Lesotho": "LS", "Liberia": "LR", "Libya": "LY",
    "Madagascar": "MG", "Malawi": "MW", "Mali": "ML", "Mauritania": "MR",
    "Mauritius": "MU", "Morocco": "MA", "Mozambique": "MZ", "Namibia": "NA",
    "Niger": "NE", "Nigeria": "NG", "Rwanda": "RW", "Sao Tome": "ST",
    "Senegal": "SN", "Seychelles": "SC", "Sierra Leone": "SL", "Somalia": "SO",
    "South Africa": "ZA", "South Sudan": "SS", "Sudan": "SD", "Tanzania": "TZ",
    "Togo": "TG", "Tunisia": "TN", "Uganda": "UG", "Zambia": "ZM", "Zimbabwe": "ZW",
}

# ISO -> REC
ISO_TO_REC = {
    "DZ": "UMA", "LY": "UMA", "MA": "UMA", "MR": "UMA", "TN": "UMA",
    "BJ": "ECOWAS", "BF": "ECOWAS", "CV": "ECOWAS", "CI": "ECOWAS",
    "GM": "ECOWAS", "GH": "ECOWAS", "GN": "ECOWAS", "GW": "ECOWAS",
    "LR": "ECOWAS", "ML": "ECOWAS", "NE": "ECOWAS", "NG": "ECOWAS",
    "SN": "ECOWAS", "SL": "ECOWAS", "TG": "ECOWAS",
    "CM": "ECCAS", "CF": "ECCAS", "TD": "ECCAS", "CG": "ECCAS",
    "CD": "ECCAS", "GQ": "ECCAS", "GA": "ECCAS", "ST": "ECCAS",
    "AO": "SADC", "BW": "SADC", "SZ": "SADC", "LS": "SADC", "MW": "SADC",
    "MZ": "SADC", "NA": "SADC", "ZA": "SADC", "ZM": "SADC", "ZW": "SADC",
    "MG": "SADC", "MU": "SADC", "SC": "SADC",
    "BI": "EAC", "KE": "EAC", "RW": "EAC", "TZ": "EAC", "UG": "EAC", "SS": "EAC",
    "DJ": "IGAD", "ER": "IGAD", "ET": "IGAD", "SO": "IGAD", "SD": "IGAD",
    "EG": "COMESA", "KM": "COMESA",
}


def run_q(ssh, db_host, db_pass, sql):
    chan = ssh.get_transport().open_session()
    chan.exec_command(
        "PGPASSWORD='{}' psql -h {} -p 5432 -U aris -d aris -t -A -c \"{}\"".format(
            db_pass, db_host, sql.replace('"', '\\"'))
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
        line = line.strip()
        if "|" in line:
            rows.append([p.strip() for p in line.split("|")])
    return rows


def country_to_iso(name):
    return COUNTRY_TO_ISO.get(name, COUNTRY_TO_ISO.get(name.strip().title(), ""))


def compute_data(ssh, db_host, db_pass, cb, cc):
    """Query real submission data for all kit widgets."""
    d = {}

    # ── KPIs ──
    r = run_q(ssh, db_host, db_pass,
        f"SELECT COALESCE(SUM(CASE WHEN data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int ELSE 0 END),0) FROM submissions WHERE campaign_id = '{cc}'")
    kpi_kits = int(r) if r.lstrip('-').isdigit() else 0

    r = run_q(ssh, db_host, db_pass,
        f"SELECT count(DISTINCT data->>'destination_country') FROM submissions WHERE campaign_id = '{cc}' AND data->>'destination_country' IS NOT NULL")
    kpi_countries = int(r) if r.isdigit() else 0

    r = run_q(ssh, db_host, db_pass,
        f"SELECT count(*) FROM submissions WHERE campaign_id = '{cc}'")
    kpi_shipments = int(r) if r.isdigit() else 0

    r = run_q(ssh, db_host, db_pass,
        f"SELECT count(DISTINCT data->>'kit_format') FROM submissions WHERE campaign_id = '{cc}' AND data->>'kit_format' IS NOT NULL")
    kpi_formats = int(r) if r.isdigit() else 0

    r = run_q(ssh, db_host, db_pass,
        f"SELECT COALESCE(SUM(CASE "
        f"WHEN data->>'num_samples' ~ '^[0-9]+$' THEN (data->>'num_samples')::int "
        f"WHEN data->>'kit_format' = 'F10' AND data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int * 880 "
        f"WHEN data->>'kit_format' = 'F20' AND data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int * 1760 "
        f"ELSE 0 END),0) FROM submissions WHERE campaign_id = '{cc}'")
    kpi_samples = int(r) if r.lstrip('-').isdigit() else 0

    r = run_q(ssh, db_host, db_pass,
        f"SELECT COALESCE(SUM(CASE WHEN data->>'kits_requested' ~ '^[0-9]+$' THEN (data->>'kits_requested')::int ELSE 0 END),0) FROM submissions WHERE campaign_id = '{cb}'")
    kpi_requested = int(r) if r.lstrip('-').isdigit() else 0

    d["kpi_requested"] = {"labels": {"fr": "Kits demandes", "en": "Kits Requested", "ar": "المجموعات المطلوبة", "pt": "Kits Solicitados"}, "value": kpi_requested, "icon": "flask-conical", "color": "#DC2626"}
    d["kpi_total_kits"] = {"labels": {"fr": "Total Kits envoyes", "en": "Total Kits Shipped", "ar": "إجمالي المجموعات المرسلة", "pt": "Total de Kits Enviados"}, "value": kpi_kits, "icon": "package", "color": "#EA580C"}
    d["kpi_countries_kits"] = {"labels": {"fr": "Pays destinataires", "en": "Recipient Countries", "ar": "البلدان المستلمة", "pt": "Paises Destinatarios"}, "value": kpi_countries, "icon": "truck", "color": "#059669"}
    d["kpi_shipments"] = {"labels": {"fr": "Expeditions", "en": "Shipments", "ar": "الشحنات", "pt": "Envios"}, "value": kpi_shipments, "icon": "send", "color": "#1E40AF"}
    d["kpi_samples"] = {"labels": {"fr": "Echantillons couverts", "en": "Samples Covered", "ar": "العينات المغطاة", "pt": "Amostras Cobertas"}, "value": kpi_samples, "icon": "test-tubes", "color": "#7C3AED"}
    d["kpi_formats"] = {"labels": {"fr": "Formats de kits", "en": "Kit Formats", "ar": "أشكال المجموعات", "pt": "Formatos de Kits"}, "value": kpi_formats, "icon": "layers", "color": "#0891B2"}

    # ── MAP: kits per country with kit type breakdown in extras ──
    map_rows = parse_rows(run_q(ssh, db_host, db_pass,
        f"SELECT data->>'destination_country', "
        f"SUM(CASE WHEN data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int ELSE 0 END), "
        f"SUM(CASE "
        f"WHEN data->>'num_samples' ~ '^[0-9]+$' THEN (data->>'num_samples')::int "
        f"WHEN data->>'kit_format' = 'F10' AND data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int * 880 "
        f"WHEN data->>'kit_format' = 'F20' AND data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int * 1760 "
        f"ELSE 0 END) "
        f"FROM submissions WHERE campaign_id = '{cc}' GROUP BY 1 ORDER BY 2 DESC"))

    # Get kit type breakdown per country
    fmt_rows = parse_rows(run_q(ssh, db_host, db_pass,
        f"SELECT data->>'destination_country', data->>'kit_format', "
        f"SUM(CASE WHEN data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int ELSE 0 END) "
        f"FROM submissions WHERE campaign_id = '{cc}' AND data->>'kit_format' IS NOT NULL "
        f"GROUP BY 1, 2 ORDER BY 1, 2"))

    # Build format breakdown per country
    fmt_by_country = {}
    for r in fmt_rows:
        if r[0] and r[1]:
            country = r[0].strip()
            fmt = r[1].strip()
            qty = int(r[2]) if r[2].lstrip('-').isdigit() else 0
            if country not in fmt_by_country:
                fmt_by_country[country] = {}
            fmt_by_country[country][fmt] = qty

    map_data = []
    for r in map_rows:
        if r[0]:
            country_name = r[0].strip()
            iso = country_to_iso(country_name)
            if iso:
                kits_val = int(r[1]) if r[1].lstrip('-').isdigit() else 0
                samples_val = int(r[2]) if len(r) > 2 and r[2].lstrip('-').isdigit() else 0
                extras = {"Echantillons": samples_val}
                # Add kit type breakdown
                fmts = fmt_by_country.get(country_name, {})
                for fmt_name, fmt_qty in sorted(fmts.items()):
                    extras[f"Kits {fmt_name}"] = fmt_qty
                map_data.append({
                    "countryCode": iso,
                    "value": kits_val,
                    "label": "Kits",
                    "extras": extras,
                })

    d["map_kits"] = {"data": {"byCountry": map_data}, "unit": "kits"}

    # ── BAR: Kits by REC ──
    ALL_RECS = ["ECOWAS", "SADC", "EAC", "IGAD", "ECCAS", "UMA", "COMESA", "CEN-SAD"]
    rec_totals = {r: 0 for r in ALL_RECS}
    for r in map_rows:
        if r[0]:
            iso = country_to_iso(r[0].strip())
            rec = ISO_TO_REC.get(iso, "")
            if rec in rec_totals:
                val = int(r[1]) if r[1].lstrip('-').isdigit() else 0
                rec_totals[rec] += val
    bar_rec = [{"name": k, "value": v} for k, v in sorted(rec_totals.items(), key=lambda x: -x[1]) if v > 0]
    d["bar_kits_by_rec"] = {"data": bar_rec, "chartConfig": {"xKey": "name", "yKeys": ["value"], "colors": ["#1E40AF"], "layout": "vertical"}}

    # ── BAR: Kits shipped by country ──
    bar_kship = [{"name": r[0].strip(), "value": int(r[1]) if r[1].lstrip('-').isdigit() else 0}
                 for r in map_rows if r[0]]
    d["bar_kits_shipped"] = {"data": bar_kship, "chartConfig": {"xKey": "name", "yKeys": ["value"], "colors": ["#EA580C"], "layout": "vertical"}}

    # ── PIE: Kit format distribution ──
    pie_fmt = [{"name": r[0].strip(), "value": int(r[1]) if r[1].isdigit() else 0}
               for r in parse_rows(run_q(ssh, db_host, db_pass,
        f"SELECT data->>'kit_format', count(*) FROM submissions WHERE campaign_id = '{cc}' AND data->>'kit_format' IS NOT NULL GROUP BY 1"))
               if r[0]]
    d["pie_kit_format"] = {"data": pie_fmt, "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#EA580C", "#F59E0B", "#7C3AED", "#1E40AF"]}

    # ── PIE: Kits by year ──
    pie_year = [{"name": r[0].strip(), "value": int(r[1]) if r[1].lstrip('-').isdigit() else 0}
                for r in parse_rows(run_q(ssh, db_host, db_pass,
        f"SELECT data->>'year', SUM(CASE WHEN data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int ELSE 0 END) FROM submissions WHERE campaign_id = '{cc}' AND data->>'year' IS NOT NULL GROUP BY 1 ORDER BY 1"))
                if r[0]]
    d["pie_kits_by_year"] = {"data": pie_year, "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#1E40AF", "#059669", "#7C3AED", "#EA580C"]}

    # ── BAR: Kits requested by country (from diagnostics) ──
    bar_kreq = [{"name": r[0].strip(), "value": int(r[1]) if r[1].lstrip('-').isdigit() else 0}
                for r in parse_rows(run_q(ssh, db_host, db_pass,
        f"SELECT data->>'country', SUM(COALESCE((data->>'kits_requested')::int,0)) FROM submissions WHERE campaign_id = '{cb}' AND data->>'kits_requested' IS NOT NULL GROUP BY 1 ORDER BY 2 DESC"))
                if r[0]]
    d["bar_kits_requested_kits"] = {"data": bar_kreq, "chartConfig": {"xKey": "name", "yKeys": ["value"], "colors": ["#7C3AED"], "layout": "vertical"}}

    # ── BAR: Kits by year ──
    bar_year = [{"name": r[0].strip(), "value": int(r[1]) if r[1].lstrip('-').isdigit() else 0}
                for r in parse_rows(run_q(ssh, db_host, db_pass,
        f"SELECT data->>'year', SUM(CASE WHEN data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int ELSE 0 END) FROM submissions WHERE campaign_id = '{cc}' AND data->>'year' IS NOT NULL GROUP BY 1 ORDER BY 1"))
                if r[0]]
    d["bar_kits_by_year"] = {"data": bar_year, "chartConfig": {"xKey": "name", "yKeys": ["value"], "colors": ["#059669"]}}

    # ── STACKED BAR: Demand vs Allocation by country ──
    requested_map = {}
    for r in parse_rows(run_q(ssh, db_host, db_pass,
            f"SELECT data->>'country', SUM(COALESCE((data->>'kits_requested')::int,0)) FROM submissions WHERE campaign_id = '{cb}' AND data->>'kits_requested' IS NOT NULL GROUP BY 1")):
        if r[0]:
            requested_map[r[0].strip()] = int(r[1]) if r[1].lstrip('-').isdigit() else 0
    shipped_map = {}
    for r in map_rows:
        if r[0]:
            shipped_map[r[0].strip()] = int(r[1]) if r[1].lstrip('-').isdigit() else 0
    all_countries = sorted(set(list(requested_map.keys()) + list(shipped_map.keys())))
    bar_compare = [{"name": c_name, "Demandes": requested_map.get(c_name, 0), "Allocation": shipped_map.get(c_name, 0)}
                   for c_name in all_countries if requested_map.get(c_name, 0) > 0 or shipped_map.get(c_name, 0) > 0]
    bar_compare.sort(key=lambda x: -(x["Demandes"] + x["Allocation"]))
    d["bar_demand_vs_alloc"] = {"data": bar_compare, "chartConfig": {"xKey": "name", "yKeys": ["Demandes", "Allocation"], "colors": ["#7C3AED", "#EA580C"], "layout": "vertical"}}

    # ── BAR: Samples by country ──
    samples_rows = parse_rows(run_q(ssh, db_host, db_pass,
        f"SELECT data->>'destination_country', SUM(CASE "
        f"WHEN data->>'num_samples' ~ '^[0-9]+$' THEN (data->>'num_samples')::int "
        f"WHEN data->>'kit_format' = 'F10' AND data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int * 880 "
        f"WHEN data->>'kit_format' = 'F20' AND data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int * 1760 "
        f"ELSE 0 END) FROM submissions WHERE campaign_id = '{cc}' GROUP BY 1 ORDER BY 2 DESC"))
    bar_samples = [{"name": r[0].strip(), "value": int(r[1]) if r[1].lstrip('-').isdigit() else 0} for r in samples_rows if r[0] and int(r[1]) > 0]
    d["bar_samples_by_country"] = {"data": bar_samples, "chartConfig": {"xKey": "name", "yKeys": ["value"], "colors": ["#059669"], "layout": "vertical"}}

    # ── PIE: Samples by year ──
    pie_samples_year = [{"name": r[0].strip(), "value": int(r[1]) if r[1].lstrip('-').isdigit() else 0}
                        for r in parse_rows(run_q(ssh, db_host, db_pass,
        f"SELECT data->>'year', SUM(CASE "
        f"WHEN data->>'num_samples' ~ '^[0-9]+$' THEN (data->>'num_samples')::int "
        f"WHEN data->>'kit_format' = 'F10' AND data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int * 880 "
        f"WHEN data->>'kit_format' = 'F20' AND data->>'quantity' ~ '^[0-9]+$' THEN (data->>'quantity')::int * 1760 "
        f"ELSE 0 END) FROM submissions WHERE campaign_id = '{cc}' AND data->>'year' IS NOT NULL GROUP BY 1 ORDER BY 1"))
                        if r[0]]
    d["pie_samples_by_year"] = {"data": pie_samples_year, "chartConfig": {"nameKey": "name", "valueKey": "value"}, "colors": ["#1E40AF", "#059669"]}

    return d


# Widget title_en -> data_key mapping
WIDGET_DATA_MAP = {
    "Kits Requested (Diagnostics)": "kpi_requested",
    "Total Kits Shipped": "kpi_total_kits",
    "Countries Receiving Kits": "kpi_countries_kits",
    "Total Shipments": "kpi_shipments",
    "Samples Covered": "kpi_samples",
    "Kit Formats": "kpi_formats",
    "Kit Recipients Map": "map_kits",
    "Kits by REC": "bar_kits_by_rec",
    "Kits Shipped by Country": "bar_kits_shipped",
    "Kit Format Distribution": "pie_kit_format",
    "Kits Distribution by Year": "pie_kits_by_year",
    "Kits Requested by Country": "bar_kits_requested_kits",
    "Kits by Year": "bar_kits_by_year",
    "Demand vs Allocation by Country": "bar_demand_vs_alloc",
    "Samples by Country": "bar_samples_by_country",
    "Samples by Year": "pie_samples_by_year",
}


def build_update_sql(data):
    """Build SQL to update widget configs with real data."""
    sql = []
    for title_en, data_key in WIDGET_DATA_MAP.items():
        if data_key not in data:
            print(f"  WARNING: no data for {data_key}")
            continue
        cfg = json.dumps(data[data_key], ensure_ascii=False).replace("'", "''")
        t_en = title_en.replace("'", "''")
        sql.append(f"UPDATE dashboard_builder.dashboard_widgets SET config = '{cfg}'::jsonb WHERE dashboard_id = '{DASH_KITS_ID}' AND title_en = '{t_en}';")
    return "\n".join(sql)


def run_sql_file(ssh, db_host, db_pass, sql_content):
    """Write SQL to temp file, SFTP it, execute via psql."""
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, newline="\n", encoding="utf-8")
    tmp.write(sql_content)
    tmp.close()

    sftp = ssh.open_sftp()
    sftp.put(tmp.name, "/tmp/ppr_kits_update.sql", confirm=False)
    sftp.close()
    os.unlink(tmp.name)

    chan = ssh.get_transport().open_session()
    chan.exec_command(
        f"PGPASSWORD='{db_pass}' psql -h {db_host} -p 5432 -U aris -d aris -f /tmp/ppr_kits_update.sql 2>&1"
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
    return out.decode(errors="replace").strip()


def deploy_server(env, host, db_host, db_pass, deploy_dir):
    print(f"\n{'='*60}")
    print(f"  {env} ({host})")
    print(f"{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        print(f"\n[1] Connecting to {host}...")
        ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=30)
        print("  Connected.")

        # Resolve campaign IDs for this environment
        cb, cc = CAMPAIGN_B, CAMPAIGN_C
        if env == "STG":
            r = run_q(ssh, db_host, db_pass, "SELECT id FROM collection_campaigns WHERE name::text LIKE '%Diagnostiques%HPPR%' LIMIT 1")
            if r.strip():
                cb = r.strip()
            r = run_q(ssh, db_host, db_pass, "SELECT id FROM collection_campaigns WHERE name::text LIKE '%Allocation Kits%' LIMIT 1")
            if r.strip():
                cc = r.strip()
            print(f"  STG campaigns: B={cb[:8]}.. C={cc[:8]}..")

        # Check dashboard exists
        r = run_q(ssh, db_host, db_pass,
            f"SELECT count(*) FROM dashboard_builder.dashboards WHERE id = '{DASH_KITS_ID}'")
        if r.strip() != "1":
            print(f"  ERROR: Dashboard {DASH_KITS_ID} not found (count={r})")
            return False

        # Check submissions exist
        r = run_q(ssh, db_host, db_pass,
            f"SELECT count(*) FROM submissions WHERE campaign_id = '{cc}'")
        print(f"  Submissions (Allocation Kits): {r}")

        r = run_q(ssh, db_host, db_pass,
            f"SELECT count(*) FROM submissions WHERE campaign_id = '{cb}'")
        print(f"  Submissions (Diagnostics): {r}")

        # Step 2: Compute data from real submissions
        print(f"\n[2] Computing data from submissions...")
        data = compute_data(ssh, db_host, db_pass, cb, cc)
        print(f"    Kits shipped: {data['kpi_total_kits']['value']}")
        print(f"    Kits requested: {data['kpi_requested']['value']}")
        print(f"    Countries: {data['kpi_countries_kits']['value']}")
        print(f"    Shipments: {data['kpi_shipments']['value']}")
        print(f"    Samples: {data['kpi_samples']['value']}")
        print(f"    Map countries: {len(data['map_kits']['data']['byCountry'])}")
        print(f"    Charts with data: {sum(1 for k, v in data.items() if k.startswith('bar_') or k.startswith('pie_'))}")

        # Step 3: Update widget configs in DB
        print(f"\n[3] Updating widget configs in DB...")
        sql = build_update_sql(data)
        result = run_sql_file(ssh, db_host, db_pass, sql)
        updates = result.count("UPDATE 1")
        total = len(WIDGET_DATA_MAP)
        print(f"    Updated: {updates}/{total} widgets")
        if updates < total:
            # Show which ones didn't match
            for line in result.split("\n"):
                if "UPDATE 0" in line:
                    print(f"    MISS: {line}")

        # Step 4: Flush Redis cache for this dashboard
        print(f"\n[4] Flushing Redis cache...")
        if env == "PROD":
            redis_host = "10.202.101.186"
        else:
            redis_host = "10.202.101.149"
        flush_cmd = f"redis-cli -h {redis_host} KEYS 'analytics:*{DASH_KITS_ID}*' | xargs -r redis-cli -h {redis_host} DEL"
        run_q(ssh, db_host, db_pass, "SELECT 1")  # keep connection alive
        stdin, stdout, stderr = ssh.exec_command(flush_cmd, timeout=10)
        flush_result = stdout.read().decode(errors="replace").strip()
        print(f"    Cache flushed: {flush_result or 'OK'}")

        # Also flush widget resolve cache
        flush_cmd2 = f"redis-cli -h {redis_host} KEYS 'analytics:widget-resolve:*' | xargs -r redis-cli -h {redis_host} DEL"
        stdin, stdout, stderr = ssh.exec_command(flush_cmd2, timeout=10)
        flush_result2 = stdout.read().decode(errors="replace").strip()
        print(f"    Widget cache flushed: {flush_result2 or 'OK'}")

        # Step 5: Git pull + rebuild analytics + web
        print(f"\n[5] Git pull...")
        cmd = f"{SUDO_CMD} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'"
        stdin, stdout, stderr = ssh.exec_command(cmd, timeout=120)
        out = stdout.read().decode(errors="replace")
        for line in out.strip().split("\n")[-3:]:
            print(f"    {line}")

        for svc in ["analytics", "web"]:
            print(f"\n[6] Rebuilding {svc}...")
            cmd = f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --build --force-recreate --no-deps {svc}'"
            stdin, stdout, stderr = ssh.exec_command(cmd, timeout=600)
            out = (stdout.read() + stderr.read()).decode(errors="replace")
            for line in out.strip().split("\n")[-5:]:
                print(f"    {line}")

        print(f"\n  {env} deploy completed successfully.")
        return True

    except Exception as e:
        print(f"  ERROR: {e}")
        import traceback
        traceback.print_exc()
        return False
    finally:
        ssh.close()


def main():
    print("=" * 60)
    print("  ARIS 4.0 -- PPR Kit Allocation Dashboard")
    print("  Populate with real data + rebuild analytics/web")
    print("=" * 60)

    results = {}

    for env, host, db_host, db_pass, deploy_dir in [
        ("PROD", "10.202.101.183", "10.202.101.185", "Ar1s_Pr0d_2024!xK9mZ", "/opt/aris-deploy/vm-app"),
        ("STG", "10.202.101.146", "10.202.101.148", "Ar1s_Stg_2024!xK9mZ", "/opt/aris-deploy/vm-app-stg"),
    ]:
        results[env] = deploy_server(env, host, db_host, db_pass, deploy_dir)

    print(f"\n{'='*60}")
    print("  DEPLOYMENT SUMMARY")
    print(f"{'='*60}")
    for name, success in results.items():
        print(f"  {name}: {'OK' if success else 'FAILED'}")
    print(f"{'='*60}")

    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
