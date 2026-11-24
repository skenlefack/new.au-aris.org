#!/usr/bin/env python3
"""
Import the new Burundi administrative divisions into ARIS geo_entities.

Source: div_admin/nouvelle decoupage administrative.xlsx (columns: Provine, Commune, Zone2, colline)
Hierarchy: Province (5) > Commune (42) > Zone (450) > Colline (3,034)

- Source cleanup: Cyrillic look-alike letters replaced by Latin ones (SHOMBО, MAТANA), whitespace
  trimmed, duplicate rows dropped; province and commune names converted from UPPER CASE to Title Case.
- Every pre-existing BI division (ADMIN1..ADMIN5) is kept with its UUID but recoded BI-OLD-... and
  set is_active = false, so existing references stay valid while they disappear from pickers.
- New codes: BI-01..BI-05 (file order), BI-01-01 (communes), BI-01-01-01 (zones), BI-01-01-01-001 (collines).
- Idempotent: the backup snapshot is taken once, upsert on code; aborts the transaction if counts don't match.
- Upserts governance.admin_levels for BI and flushes the Redis geo cache.

Usage: python -u deploy/scripts/_import_bi_divisions.py --env staging|prod|both [--sql-only]
"""
import argparse
import json
import os
import sys

import openpyxl
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SSH_USER = "arisadmin"
SSH_PASS = os.environ.get("ARIS_DEPLOY_PASS", "")
JUMP = "10.202.101.183"
TARGETS = {
    "staging": {"db_host": "10.202.101.148", "pg": "aris-stg-postgres", "cache_host": "10.202.101.149"},
    "prod": {"db_host": "10.202.101.185", "pg": "aris-postgres", "cache_host": "10.202.101.186"},
}
ROOT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
XLSX = os.path.join(ROOT, "div_admin", "nouvelle decoupage administrative.xlsx")
BACKUP = "backup.geo_entities_bi_20261124"

ADMIN_LEVELS = [
    (1, "province", {"en": "Province", "fr": "Province", "pt": "Província", "ar": "محافظة", "es": "Provincia", "sw": "Jimbo"}),
    (2, "commune", {"en": "Commune", "fr": "Commune", "pt": "Comuna", "ar": "بلدية", "es": "Comuna", "sw": "Kata"}),
    (3, "zone", {"en": "Zone", "fr": "Zone", "pt": "Zona", "ar": "منطقة", "es": "Zona", "sw": "Eneo"}),
    (4, "colline", {"en": "Colline", "fr": "Colline", "pt": "Colina", "ar": "تلة", "es": "Colina", "sw": "Kilima"}),
]
COLS = ("id, code, name, name_en, name_fr, name_pt, name_ar, name_es, name_sw, level, parent_id, "
        "country_code, is_active, version, created_at, updated_at")
# Cyrillic letters that look like Latin ones (found in SHOMBО and MAТANA)
CYRILLIC = str.maketrans("АВСЕНІКМОРТХаеорсух", "ABCEHIKMOPTXaeopcyx")


def esc(s):
    return s.replace("'", "''")


def clean(v):
    return " ".join(str(v).translate(CYRILLIC).split())


def title(s):
    return "-".join(w.capitalize() for w in s.split("-")) if s.isupper() else s


def parse_xlsx():
    """Return {province: {commune: {zone: [collines]}}} in file order, without duplicates."""
    ws = openpyxl.load_workbook(XLSX, read_only=True, data_only=True).worksheets[0]
    tree = {}
    for row in list(ws.iter_rows(values_only=True))[1:]:
        if not any(row[:4]):
            continue
        if not all(row[:4]):
            raise SystemExit(f"Incomplete row: {row}")
        p, c, z, col = (clean(v) for v in row[:4])
        lst = tree.setdefault(title(p), {}).setdefault(title(c), {}).setdefault(z, [])
        if col.lower() not in (x.lower() for x in lst):
            lst.append(col)
    return tree


def build(tree):
    out = {1: [], 2: [], 3: [], 4: []}
    for pi, (p, comms) in enumerate(tree.items(), 1):
        pc = f"BI-{pi:02d}"
        out[1].append((pc, p, "BI"))
        for ci, (c, zones) in enumerate(comms.items(), 1):
            cc = f"{pc}-{ci:02d}"
            out[2].append((cc, c, pc))
            for zi, (z, cols) in enumerate(zones.items(), 1):
                zc = f"{cc}-{zi:02d}"
                out[3].append((zc, z, cc))
                for li, col in enumerate(cols, 1):
                    out[4].append((f"{zc}-{li:03d}", col, zc))
    return out


def generate_sql(ents):
    L = [
        "SET client_encoding = 'UTF8';", "\\set ON_ERROR_STOP on", "BEGIN;",
        "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.geo_entities WHERE code='BI' AND level='COUNTRY') "
        "THEN RAISE EXCEPTION 'BI country not found'; END IF; END $$;",
        "CREATE SCHEMA IF NOT EXISTS backup;",
        f"CREATE TABLE IF NOT EXISTS {BACKUP} AS SELECT * FROM public.geo_entities WHERE country_code='BI';",
        "-- Former divisions: keep the rows (same UUIDs), recode and deactivate",
        "UPDATE public.geo_entities SET code = 'BI-OLD-' || substring(code from 4), is_active = FALSE, "
        "version = version + 1, updated_at = NOW() "
        "WHERE country_code='BI' AND level <> 'COUNTRY' AND code NOT LIKE 'BI-OLD-%' "
        f"AND id IN (SELECT id FROM {BACKUP} WHERE level <> 'COUNTRY');",
        "",
    ]
    for lvl, code, name in ADMIN_LEVELS:
        js = esc(json.dumps(name, ensure_ascii=False))
        L.append(
            "INSERT INTO governance.admin_levels (id, country_id, level, code, name, is_active, created_at, updated_at) "
            f"SELECT gen_random_uuid(), c.id, {lvl}, '{code}', '{js}'::jsonb, TRUE, NOW(), NOW() "
            "FROM governance.countries c WHERE c.code='BI' "
            "ON CONFLICT (country_id, level) DO UPDATE SET code=EXCLUDED.code, name=EXCLUDED.name, "
            "is_active=TRUE, updated_at=NOW();")
    L.append("UPDATE governance.admin_levels SET is_active=FALSE, updated_at=NOW() "
             "WHERE level > 4 AND country_id = (SELECT id FROM governance.countries WHERE code='BI');")
    for lvl in (1, 2, 3, 4):
        vals = ",\n".join(f"('{esc(c)}','{esc(n)}','{esc(p)}')" for c, n, p in ents[lvl])
        L.append(
            f"-- ADMIN{lvl}: {len(ents[lvl])}\nINSERT INTO public.geo_entities ({COLS})\n"
            "SELECT gen_random_uuid(), v.code, v.name, v.name, v.name, v.name, v.name, v.name, v.name, "
            f"'ADMIN{lvl}', p.id, 'BI', TRUE, 1, NOW(), NOW()\n"
            f"FROM (VALUES\n{vals}\n) AS v(code, name, parent_code)\n"
            "JOIN public.geo_entities p ON p.code = v.parent_code\n"
            "ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name, name_en=EXCLUDED.name_en, "
            "name_fr=EXCLUDED.name_fr, name_pt=EXCLUDED.name_pt, name_ar=EXCLUDED.name_ar, "
            "name_es=EXCLUDED.name_es, name_sw=EXCLUDED.name_sw, level=EXCLUDED.level, "
            "parent_id=EXCLUDED.parent_id, is_active=TRUE, updated_at=NOW();")
    L.append("DO $$ DECLARE n INT; BEGIN")
    for lvl in (1, 2, 3, 4):
        L.append(f"  SELECT count(*) INTO n FROM public.geo_entities "
                 f"WHERE country_code='BI' AND level='ADMIN{lvl}' AND is_active;")
        L.append(f"  IF n <> {len(ents[lvl])} THEN RAISE EXCEPTION "
                 f"'ADMIN{lvl}: got %, expected {len(ents[lvl])}', n; END IF;")
    L += [
        "END $$;", "COMMIT;",
        "SELECT level, is_active, count(*) FROM public.geo_entities WHERE country_code='BI' GROUP BY 1,2 ORDER BY 1,2;",
        "SELECT al.level, al.code, al.name->>'fr' AS fr, al.is_active FROM governance.admin_levels al "
        "JOIN governance.countries c ON c.id=al.country_id WHERE c.code='BI' ORDER BY al.level;",
    ]
    return "\n".join(L)


FLUSH_SH = r"""#!/bin/sh
R=$(docker ps --format '{{.Names}}' | grep -i redis | head -1)
[ -z "$R" ] && echo 'NO_REDIS' && exit 1
PW=$(docker inspect --format '{{range .Args}}{{.}} {{end}}' $R | sed -n 's/.*--requirepass \([^ ]*\).*/\1/p')
A=''; [ -n "$PW" ] && A="-a $PW --no-auth-warning"
N=$(docker exec $R redis-cli $A --scan --pattern '*master-data:geo*' | wc -l)
docker exec $R sh -c "redis-cli $A --scan --pattern '*master-data:geo*' | xargs -r redis-cli $A DEL >/dev/null"
echo "$R: deleted $N geo keys"
"""


def client(host, jump):
    ch = jump.get_transport().open_channel("direct-tcpip", (host, 22), ("127.0.0.1", 0))
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, username=SSH_USER, password=SSH_PASS, sock=ch, timeout=20,
              allow_agent=False, look_for_keys=False)
    return c


def run(c, cmd, timeout=600):
    stdin, o, _ = c.exec_command(f"sudo -S -p '' bash -c \"{cmd}\" 2>&1", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.channel.shutdown_write()
    out = o.read().decode("utf-8", errors="replace")
    return o.channel.recv_exit_status(), out


def import_env(env, sql, jump):
    t = TARGETS[env]
    print(f"\n===== Burundi divisions -> {env.upper()}")
    c = client(t["db_host"], jump)
    sftp = c.open_sftp()
    with sftp.file("/tmp/_bi_divisions.sql", "wb") as f:
        f.write(sql.encode("utf-8"))
    sftp.close()
    code, out = run(c, f"docker cp /tmp/_bi_divisions.sql {t['pg']}:/tmp/_bi_divisions.sql && "
                       f"docker exec {t['pg']} psql -U aris -d aris -q -f /tmp/_bi_divisions.sql")
    c.close()
    print(out[-3000:])
    if code != 0 or "ERROR" in out:
        print("  FAILED - transaction rolled back")
        return False
    c = client(t["cache_host"], jump)
    sftp = c.open_sftp()
    with sftp.file("/tmp/_flush_geo.sh", "wb") as f:
        f.write(FLUSH_SH.encode())
    sftp.close()
    _, out = run(c, "sh /tmp/_flush_geo.sh; rm -f /tmp/_flush_geo.sh")
    print("  Redis:", out.strip())
    c.close()
    return True


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", choices=["staging", "prod", "both"], default="staging")
    ap.add_argument("--sql-only", action="store_true")
    a = ap.parse_args()
    tree = parse_xlsx()
    ents = build(tree)
    print(f"Parsed: provinces={len(ents[1])}, communes={len(ents[2])}, zones={len(ents[3])}, "
          f"collines={len(ents[4])}")
    sql = generate_sql(ents)
    local = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_bi_divisions_aris.sql")
    with open(local, "w", encoding="utf-8") as f:
        f.write(sql)
    print("SQL written:", local)
    if a.sql_only:
        for p, comms in tree.items():
            print(f"{p}: " + "; ".join(f"{c} ({len(z)})" for c, z in comms.items()))
        return
    jump = paramiko.SSHClient()
    jump.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    jump.connect(JUMP, username=SSH_USER, password=SSH_PASS, timeout=20)
    envs = ["staging", "prod"] if a.env == "both" else [a.env]
    res = {e: import_env(e, sql, jump) for e in envs}
    jump.close()
    print("\nSUMMARY:", ", ".join(f"{e}={'OK' if ok else 'FAILED'}" for e, ok in res.items()))
    sys.exit(0 if all(res.values()) else 1)


if __name__ == "__main__":
    main()
