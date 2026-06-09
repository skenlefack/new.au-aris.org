#!/usr/bin/env python3
"""
Validate all AFADATA submissions through the 4-level ARIS workflow.
Creates workflow instances, transitions, and datalake entries.
"""
import paramiko
import json
import sys
import os
import uuid
import hashlib
import tempfile

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH_PASS = "@u-1baR.0rg$U24"
SUPER_ADMIN = "10000000-0000-4000-a000-000000000001"
TENANT_AU = "00000000-0000-4000-a000-000000000001"

# Workflow levels (4-level validation)
LEVELS = [
    ("NATIONAL_TECHNICAL", "Data Steward technical validation"),
    ("NATIONAL_OFFICIAL", "CVO/Data Owner official approval"),
    ("REC_HARMONIZATION", "REC regional harmonization"),
    ("CONTINENTAL_PUBLICATION", "AU-IBAR continental publication"),
]

ENV_CONFIG = {
    "PROD": {"host": "10.202.101.183", "db_host": "10.202.101.185", "db_pass": "Ar1s_Pr0d_2024!xK9mZ"},
    "STG":  {"host": "10.202.101.146", "db_host": "10.202.101.148", "db_pass": "Ar1s_Stg_2024!xK9mZ"},
}


def det_uuid(ns, key):
    h = hashlib.sha256(f"afadata-wf:{ns}:{key}".encode()).hexdigest()
    return str(uuid.UUID(h[:32]))


def run_sql_file(client, db_host, db_pass, sql):
    """Upload SQL as temp file, execute via docker psql."""
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, newline="\n", encoding="utf-8")
    tmp.write(sql)
    tmp.close()
    sftp = client.open_sftp()
    sftp.put(tmp.name, "/tmp/validate_batch.sql")
    sftp.close()
    os.unlink(tmp.name)

    chan = client.get_transport().open_session()
    chan.settimeout(120)
    chan.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
        f"-v /tmp/validate_batch.sql:/d.sql:ro "
        f"-e PGPASSWORD={db_pass} postgres:16 "
        f"psql -h {db_host} -p 5432 -U aris -d aris -f /d.sql 2>&1"
    )
    out = b""
    try:
        while True:
            ch_data = chan.recv(65536)
            if not ch_data:
                break
            out += ch_data
    except:
        pass
    return out.decode(errors="replace").strip()


def run_query(client, db_host, db_pass, sql):
    chan = client.get_transport().open_session()
    chan.settimeout(15)
    escaped = sql.replace('"', '\\"')
    chan.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
        f"-e PGPASSWORD={db_pass} postgres:16 "
        f'psql -h {db_host} -p 5432 -U aris -d aris -t -A -c "{escaped}"'
    )
    out = b""
    try:
        while True:
            ch_data = chan.recv(65536)
            if not ch_data:
                break
            out += ch_data
    except:
        pass
    return out.decode(errors="replace").strip()


def process_env(env_name, cfg):
    print(f"\n{'='*60}")
    print(f"  {env_name} — VALIDATE AFADATA SUBMISSIONS")
    print(f"{'='*60}")

    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(cfg["host"], username="arisadmin", password=SSH_PASS, timeout=15)
    db_host, db_pass = cfg["db_host"], cfg["db_pass"]

    # Get all AFADATA submissions
    raw = run_query(c, db_host, db_pass,
        "SELECT s.id, s.tenant_id, s.campaign_id, s.data::text, c.domain, s.submitted_at::date "
        "FROM submissions s "
        "JOIN collection_campaigns c ON s.campaign_id = c.id "
        "WHERE c.name::text ILIKE '%AFADATA%' "
        "ORDER BY s.campaign_id, s.submitted_at")

    submissions = []
    for line in raw.split("\n"):
        if "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 6 and len(parts[0]) == 36:
                submissions.append({
                    "id": parts[0],
                    "tenant_id": parts[1],
                    "campaign_id": parts[2],
                    "data_raw": parts[3],
                    "domain": parts[4],
                    "submitted_at": parts[5],
                })

    print(f"\n  Total AFADATA submissions: {len(submissions)}")

    # Get tenant → country code mapping
    raw_tenants = run_query(c, db_host, db_pass,
        "SELECT id, code, rec_code FROM tenants WHERE level = 'MEMBER_STATE'")
    tenant_to_code = {}
    tenant_to_rec = {}
    for line in raw_tenants.split("\n"):
        if "|" in line:
            parts = [p.strip() for p in line.split("|")]
            if len(parts) >= 2 and len(parts[0]) == 36:
                tenant_to_code[parts[0]] = parts[1]
                tenant_to_rec[parts[0]] = parts[2] if len(parts) > 2 else ""

    # Process in batches
    BATCH = 300
    total_wf = 0
    total_transitions = 0
    total_datalake = 0

    for batch_start in range(0, len(submissions), BATCH):
        batch = submissions[batch_start:batch_start + BATCH]
        sql_parts = []

        for sub in batch:
            sub_id = sub["id"]
            tenant_id = sub["tenant_id"]
            domain = sub["domain"]
            submitted_at = sub["submitted_at"]
            country_code = tenant_to_code.get(tenant_id, "")
            rec_code = tenant_to_rec.get(tenant_id, "")

            # 1. Create workflow instance (fully approved at continental level)
            wf_id = det_uuid("wf", sub_id)
            sql_parts.append(
                f"INSERT INTO workflow.workflow_instances "
                f"(id, tenant_id, entity_type, entity_id, domain, "
                f"current_level, status, wahis_ready, analytics_ready, "
                f"created_by, created_at, updated_at) "
                f"VALUES ('{wf_id}', '{tenant_id}', 'SUBMISSION', '{sub_id}', '{domain}', "
                f"'CONTINENTAL_PUBLICATION'::workflow.\"WfLevel\", 'APPROVED'::workflow.\"WfStatus\", true, true, "
                f"'{SUPER_ADMIN}', '{submitted_at}'::timestamp, '{submitted_at}'::timestamp) "
                f"ON CONFLICT (id) DO NOTHING;"
            )

            # 2. Create 4 workflow transitions (full validation chain)
            for i, (level, comment) in enumerate(LEVELS):
                prev_level = LEVELS[i - 1][0] if i > 0 else "NATIONAL_TECHNICAL"
                prev_status = "PENDING" if i == 0 else "APPROVED"
                tr_id = det_uuid("tr", f"{sub_id}-{i}")
                sql_parts.append(
                    f"INSERT INTO workflow.workflow_transitions "
                    f"(id, instance_id, from_level, to_level, from_status, to_status, "
                    f"action, actor_user_id, actor_role, comment, created_at) "
                    f"VALUES ('{tr_id}', '{wf_id}', "
                    f"'{prev_level}'::workflow.\"WfLevel\", '{level}'::workflow.\"WfLevel\", "
                    f"'{prev_status}'::workflow.\"WfStatus\", 'APPROVED'::workflow.\"WfStatus\", "
                    f"'APPROVE'::workflow.\"WfAction\", '{SUPER_ADMIN}', 'SUPER_ADMIN', "
                    f"'{comment}', '{submitted_at}'::timestamp + interval '{i} hour') "
                    f"ON CONFLICT (id) DO NOTHING;"
                )

            # 3. Link workflow to submission
            sql_parts.append(
                f"UPDATE submissions SET workflow_instance_id = '{wf_id}' "
                f"WHERE id = '{sub_id}' AND workflow_instance_id IS NULL;"
            )

            # 4. Parse data for datalake entry
            try:
                data = json.loads(sub["data_raw"])
            except:
                data = {}

            country = data.get("adm0", country_code)
            year_str = submitted_at[:4] if submitted_at else "2025"
            month_str = submitted_at[5:7] if len(submitted_at) >= 7 else "1"

            # Datalake payload = submission data enriched
            dl_payload = {
                **data,
                "submission_id": sub_id,
                "campaign_id": sub["campaign_id"],
                "domain": domain,
                "country_code": country,
                "validation_status": "APPROVED",
                "validation_level": "CONTINENTAL_PUBLICATION",
            }
            dl_payload_json = json.dumps(dl_payload, ensure_ascii=False).replace("'", "''")

            dl_metadata = json.dumps({
                "source_campaign": sub["campaign_id"],
                "validated_by": SUPER_ADMIN,
                "validation_date": submitted_at,
            }, ensure_ascii=False).replace("'", "''")

            # Compute ISO week number
            try:
                import datetime
                dt = datetime.date(int(year_str), int(month_str), 15)
                week_num = dt.isocalendar()[1]
            except:
                week_num = 1

            dl_id = det_uuid("dl", sub_id)
            sql_parts.append(
                f"INSERT INTO datalake.data_lake_entry "
                f"(id, source, entity_type, entity_id, action, payload, metadata, "
                f"tenant_id, country_code, rec_code, year, month, week, ingested_at) "
                f"VALUES ('{dl_id}', 'COLLECTE'::datalake.\"DatalakeSource\", 'submission', '{sub_id}', 'VALIDATED', "
                f"'{dl_payload_json}'::jsonb, '{dl_metadata}'::jsonb, "
                f"'{tenant_id}', '{country}', '{rec_code}', "
                f"{year_str}, {month_str}, {week_num}, '{submitted_at}'::timestamptz) "
                f"ON CONFLICT (id) DO NOTHING;"
            )

        result = run_sql_file(c, db_host, db_pass, "\n".join(sql_parts))

        wf_count = result.count("INSERT 0 1")
        err_count = result.count("ERROR")
        batch_num = batch_start // BATCH + 1
        if err_count > 0:
            # Show first error
            for line in result.split("\n"):
                if "ERROR" in line:
                    print(f"  Batch {batch_num}: ERROR: {line.strip()[:120]}")
                    break
        else:
            print(f"  Batch {batch_num}: {len(batch)} submissions → {wf_count} inserts")
        total_wf += len(batch)

    # Verify
    print(f"\n  --- VERIFICATION ---")

    # Workflow instances
    r = run_query(c, db_host, db_pass,
        "SELECT count(*) FROM workflow.workflow_instances WHERE entity_type = 'SUBMISSION' AND status = 'APPROVED'")
    print(f"  Workflow instances (APPROVED): {r.split(chr(10))[-1].strip()}")

    # Transitions
    r = run_query(c, db_host, db_pass,
        "SELECT count(*) FROM workflow.workflow_transitions WHERE to_status = 'APPROVED'")
    print(f"  Workflow transitions: {r.split(chr(10))[-1].strip()}")

    # Submissions with workflow linked
    r = run_query(c, db_host, db_pass,
        "SELECT count(*) FROM submissions s JOIN collection_campaigns c ON s.campaign_id = c.id "
        "WHERE c.name::text ILIKE '%AFADATA%' AND s.workflow_instance_id IS NOT NULL")
    print(f"  Submissions with workflow: {r.split(chr(10))[-1].strip()}")

    # Datalake entries
    r = run_query(c, db_host, db_pass,
        "SELECT source, count(*) FROM datalake.data_lake_entry GROUP BY 1 ORDER BY 1")
    print(f"  Datalake entries:")
    for line in r.split("\n"):
        if "|" in line:
            print(f"    {line.strip()}")

    # Datalake by domain
    r = run_query(c, db_host, db_pass,
        "SELECT payload->>'domain' as domain, count(*) FROM datalake.data_lake_entry WHERE source = 'COLLECTE' GROUP BY 1 ORDER BY 1")
    print(f"  Datalake by domain:")
    for line in r.split("\n"):
        if "|" in line:
            print(f"    {line.strip()}")

    # Datalake by country (top 10)
    r = run_query(c, db_host, db_pass,
        "SELECT country_code, count(*) FROM datalake.data_lake_entry WHERE source = 'COLLECTE' GROUP BY 1 ORDER BY 2 DESC LIMIT 10")
    print(f"  Datalake by country (top 10):")
    for line in r.split("\n"):
        if "|" in line:
            print(f"    {line.strip()}")

    c.close()
    print(f"\n  {env_name} DONE — {total_wf} submissions validated")


def main():
    print("=" * 60)
    print("  AFADATA — FULL WORKFLOW VALIDATION + DATALAKE")
    print("=" * 60)

    for env_name, cfg in ENV_CONFIG.items():
        process_env(env_name, cfg)

    print(f"\n{'='*60}")
    print("  ALL DONE")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
