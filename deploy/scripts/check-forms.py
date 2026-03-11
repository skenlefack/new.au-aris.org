#!/usr/bin/env python3
"""Check form-builder data in the database."""
import paramiko
import sys
import os

os.environ["PYTHONIOENCODING"] = "utf-8"

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
HOST = "10.202.101.183"
DB_URL = "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, SSH_USER, SSH_PASS, timeout=15,
              allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=15):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


c = get_client()

safe_print("=== Form Builder Database Check ===\n")

# 1. List tables in form_builder schema
safe_print("--- 1. Tables in form_builder schema ---")
code, out = run_sudo(c, f"""docker exec aris-postgres psql -U aris -d aris -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema='form_builder' ORDER BY table_name" 2>&1""")
safe_print(f"{out}\n")

# 2. Count form templates
safe_print("--- 2. Form templates count ---")
code, out = run_sudo(c, f"""docker exec aris-postgres psql -U aris -d aris -t -c "SELECT count(*) FROM form_builder.form_templates" 2>&1""")
safe_print(f"  form_templates: {out.strip()}")

# 3. List form templates if any
safe_print("\n--- 3. Form templates list ---")
code, out = run_sudo(c, f"""docker exec aris-postgres psql -U aris -d aris -c "SELECT id, title, status, domain, created_at FROM form_builder.form_templates ORDER BY created_at" 2>&1""")
safe_print(f"{out}")

# 4. Check collecte schema tables
safe_print("\n--- 4. Tables in collecte schema ---")
code, out = run_sudo(c, f"""docker exec aris-postgres psql -U aris -d aris -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema='collecte' ORDER BY table_name" 2>&1""")
safe_print(f"{out}")

# 5. Count campaigns
safe_print("--- 5. Campaigns count ---")
code, out = run_sudo(c, f"""docker exec aris-postgres psql -U aris -d aris -t -c "SELECT count(*) FROM collecte.campaigns" 2>&1""")
safe_print(f"  campaigns: {out.strip()}")

# 6. Check form-builder service health and API
safe_print("\n--- 6. Form-builder service check ---")
code, out = run_sudo(c, "curl -s http://localhost:3010/health 2>&1")
safe_print(f"  Health: {out[:200]}")

# 7. Check form-builder API endpoint
safe_print("\n--- 7. Form-builder API (list templates) ---")
code, out = run_sudo(c, """curl -s http://localhost:3010/api/v1/form-builder/templates 2>&1 | head -c 500""")
safe_print(f"  Response: {out[:500]}")

c.close()
safe_print("\n=== Done ===")
