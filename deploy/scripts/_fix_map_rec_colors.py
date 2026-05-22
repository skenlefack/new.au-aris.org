#!/usr/bin/env python3
"""Fix PPR dashboard: map height, add REC chart, vivid pie colors."""
import paramiko, json, sys, uuid, tempfile, os

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DASHBOARD_ID = "a68e2cdf-4d5e-5a0d-9571-6d8f6b99e1d6"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

# Kits by REC (pre-computed)
REC_DATA = [
    {"rec": "SADC", "kits": 14},
    {"rec": "ECOWAS", "kits": 8},
    {"rec": "EAC", "kits": 2},
    {"rec": "UMA", "kits": 2},
    {"rec": "ECCAS", "kits": 1},
]

# Vivid colors for pies
COLOR_UPDATES = {
    "Has National Surveillance System": ["#10B981", "#F43F5E"],
    "Uses Digital Tools": ["#8B5CF6", "#CBD5E1"],
    "PPR Status by Country": ["#F43F5E", "#10B981", "#F59E0B"],
    "Kit Format Distribution": ["#F59E0B", "#06B6D4"],
}


def main():
    rec_config = json.dumps({
        "data": REC_DATA,
        "chartConfig": {"xKey": "rec", "yKeys": ["kits"], "colors": ["#8B5CF6"]},
    }, ensure_ascii=False).replace("'", "''")

    for env, host, db_host, db_pass in [
        ("PROD", "10.202.101.183", "10.202.101.185", "Ar1s_Pr0d_2024!xK9mZ"),
        ("STG", "10.202.101.146", "10.202.101.148", "Ar1s_Stg_2024!xK9mZ"),
    ]:
        print("--- {} ---".format(env))
        c = paramiko.SSHClient()
        c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        c.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)

        # Get section 3 ID
        chan = c.get_transport().open_session()
        chan.exec_command(
            "echo '{}' | sudo -S docker run --rm --network host "
            "-e PGPASSWORD={} postgres:16 "
            "psql -h {} -p 5432 -U aris -d aris -t -A -c "
            "\"SELECT id FROM dashboard_builder.dashboard_sections "
            "WHERE dashboard_id='{}' AND sort_order=3\"".format(
                SSH_PASS, db_pass, db_host, DASHBOARD_ID)
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
        section_id = out.decode().strip()

        # Read current pie configs and update colors
        color_sql = []
        for title, colors in COLOR_UPDATES.items():
            chan2 = c.get_transport().open_session()
            t_esc = title.replace("'", "''")
            chan2.exec_command(
                "echo '{}' | sudo -S docker run --rm --network host "
                "-e PGPASSWORD={} postgres:16 "
                "psql -h {} -p 5432 -U aris -d aris -t -A -c "
                "\"SELECT config FROM dashboard_builder.dashboard_widgets "
                "WHERE dashboard_id='{}' AND title_en='{}'\"".format(
                    SSH_PASS, db_pass, db_host, DASHBOARD_ID, t_esc)
            )
            chan2.settimeout(15)
            out = b""
            try:
                while True:
                    ch = chan2.recv(4096)
                    if not ch:
                        break
                    out += ch
            except Exception:
                pass
            raw = out.decode(errors="replace").strip()
            if raw:
                try:
                    cfg = json.loads(raw)
                    cfg["colors"] = colors
                    cfg_json = json.dumps(cfg, ensure_ascii=False).replace("'", "''")
                    color_sql.append(
                        "UPDATE dashboard_builder.dashboard_widgets "
                        "SET config = '{}' WHERE dashboard_id = '{}' "
                        "AND title_en = '{}';".format(cfg_json, DASHBOARD_ID, t_esc)
                    )
                except Exception:
                    pass

        # Build full SQL
        wid = str(uuid.uuid4())
        sql_lines = [
            # Map widget: increase height
            "UPDATE dashboard_builder.dashboard_widgets "
            "SET column_index = 0, sort_order = 2, grid_h = 6 "
            "WHERE dashboard_id = '{}' AND type = 'MAP_AFRICA';".format(DASHBOARD_ID),

            # Add REC bar chart next to map
            "DELETE FROM dashboard_builder.dashboard_widgets "
            "WHERE dashboard_id = '{}' AND title_en = 'Kits by REC';".format(DASHBOARD_ID),

            "INSERT INTO dashboard_builder.dashboard_widgets "
            "(id, section_id, dashboard_id, type, data_source, "
            "title_en, title_fr, title_ar, title_pt, "
            "grid_x, grid_y, grid_w, grid_h, column_index, sort_order, "
            "config, created_at, updated_at) VALUES "
            "('{wid}', '{sid}', '{did}', 'BAR_CHART', 'MANUAL_VALUE', "
            "'Kits by REC', 'Kits par CER', 'Kits by REC', 'Kits por CER', "
            "6, 3, 6, 6, 1, 2, "
            "'{cfg}'::jsonb, NOW(), NOW());".format(
                wid=wid, sid=section_id, did=DASHBOARD_ID, cfg=rec_config),
        ]
        sql_lines.extend(color_sql)

        # Verify
        sql_lines.append(
            "SELECT type, title_en, column_index, sort_order, grid_h "
            "FROM dashboard_builder.dashboard_widgets "
            "WHERE dashboard_id = '{}' ORDER BY sort_order, column_index;".format(DASHBOARD_ID)
        )

        sql = "\n".join(sql_lines)
        tmp = tempfile.NamedTemporaryFile(
            mode="w", suffix=".sql", delete=False, newline="\n", encoding="utf-8"
        )
        tmp.write(sql)
        tmp.close()
        sftp = c.open_sftp()
        sftp.put(tmp.name, "/tmp/fix_all.sql")
        sftp.close()
        os.unlink(tmp.name)

        chan3 = c.get_transport().open_session()
        chan3.exec_command(
            "echo '{}' | sudo -S docker run --rm --network host "
            "-v /tmp/fix_all.sql:/f.sql:ro "
            "-e PGPASSWORD={} postgres:16 "
            "psql -h {} -p 5432 -U aris -d aris -f /f.sql 2>&1 | tail -20".format(
                SSH_PASS, db_pass, db_host)
        )
        chan3.settimeout(30)
        out = b""
        try:
            while True:
                ch = chan3.recv(4096)
                if not ch:
                    break
                out += ch
        except Exception:
            pass
        print(out.decode(errors="replace").strip())
        print()
        c.close()

    print("DONE")


if __name__ == "__main__":
    main()
