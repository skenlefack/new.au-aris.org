"""
PAID v2 Cleanup — Drop old tables, delete PAID submissions/templates/campaigns.
Run on staging first, then production.

Usage: python deploy/scripts/_paid_v2_cleanup.py [--target stg|prod]
"""

import paramiko
import sys
import time
import os

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

TARGETS = {
    "stg": {"host": "10.202.101.148", "db_pass": "Ar1s_Stg_2024!xK9mZ", "db_user": "aris"},
    "prod": {"host": "10.202.101.185", "db_pass": "Ar1s_Pr0d_2024!xK9mZ", "db_user": "aris"},
}

CLEANUP_SQL = """
-- 1. Delete PAID form submissions (via template domain)
DELETE FROM form_builder.form_submissions
WHERE template_id IN (
  SELECT id FROM form_builder.form_templates WHERE domain = 'paid'
);

-- 2. Delete PAID campaigns
DELETE FROM public.collection_campaigns WHERE domain = 'paid';

-- 3. Delete PAID form templates
DELETE FROM form_builder.form_templates WHERE domain = 'paid';

-- 4. Drop old PAID reference tables
DROP TABLE IF EXISTS animal_health.paid_partners_national CASCADE;
DROP TABLE IF EXISTS animal_health.paid_partners_intl CASCADE;
DROP TABLE IF EXISTS animal_health.paid_projects CASCADE;
DROP TABLE IF EXISTS animal_health.paid_diseases CASCADE;
DROP TABLE IF EXISTS animal_health.paid_production_systems CASCADE;
DROP TABLE IF EXISTS animal_health.paid_species CASCADE;
DROP TABLE IF EXISTS animal_health.paid_activities CASCADE;
DROP TABLE IF EXISTS animal_health.paid_sectors CASCADE;

-- 5. Drop new tables if re-running (idempotent)
DROP TABLE IF EXISTS animal_health.paid_breakdown_fields CASCADE;
DROP TABLE IF EXISTS animal_health.paid_paid_activities CASCADE;
DROP TABLE IF EXISTS animal_health.paid_subactivities CASCADE;
DROP TABLE IF EXISTS animal_health.paid_lf_activities CASCADE;
DROP TABLE IF EXISTS animal_health.paid_logframes CASCADE;
DROP TABLE IF EXISTS animal_health.paid_impl_partners_national CASCADE;
DROP TABLE IF EXISTS animal_health.paid_impl_partners_intl CASCADE;
DROP TABLE IF EXISTS animal_health.paid_executive_partners CASCADE;
DROP TABLE IF EXISTS animal_health.paid_projects CASCADE;
"""


def run_sql(target_key: str):
    t = TARGETS[target_key]
    print(f"\n{'='*60}")
    print(f"  PAID v2 CLEANUP — {target_key.upper()} ({t['host']})")
    print(f"{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(t["host"], username=SSH_USER, password=SSH_PASS, timeout=15)

    db_url = f"postgresql://{t['db_user']}:{t['db_pass']}@localhost:5432/aris"
    cmd = f'psql "{db_url}" -c "{CLEANUP_SQL.replace(chr(10), " ")}"'

    print("[*] Running cleanup SQL...")
    _, stdout, stderr = ssh.exec_command(cmd, timeout=60)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")

    if out.strip():
        print(out.strip())
    if err.strip() and "NOTICE" not in err and "password" not in err.lower():
        print(f"STDERR: {err.strip()}")

    print(f"[OK] Cleanup complete on {target_key.upper()}")
    ssh.close()


def main():
    target = sys.argv[1].replace("--target=", "").replace("--target", "").strip() if len(sys.argv) > 1 else "stg"
    if target not in TARGETS:
        print(f"Usage: python {sys.argv[0]} [--target stg|prod]")
        sys.exit(1)

    run_sql(target)


if __name__ == "__main__":
    main()
