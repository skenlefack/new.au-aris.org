#!/usr/bin/env python3
"""Check form-builder data — query VM-DB directly."""
import paramiko
import sys
import os

os.environ["PYTHONIOENCODING"] = "utf-8"

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
HOST_DB = "10.202.101.185"
HOST_APP = "10.202.101.183"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, 22, SSH_USER, SSH_PASS, timeout=15,
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


safe_print("=== Form Builder Database Check ===\n")

# Query VM-DB
c = get_client(HOST_DB)

# 1. Tables in form_builder schema
safe_print("--- 1. Tables in form_builder schema ---")
code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema='form_builder' ORDER BY table_name" 2>&1""")
safe_print(f"{out}\n")

# 2. Count form templates
safe_print("--- 2. Form templates ---")
code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -c "SELECT id, title, status, domain, version, created_at FROM form_builder.form_templates ORDER BY created_at" 2>&1""")
safe_print(f"{out}\n")

# 3. Count form versions
safe_print("--- 3. Form versions ---")
code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -c "SELECT count(*) as total FROM form_builder.form_versions" 2>&1""")
safe_print(f"{out}\n")

# 4. Tables in collecte schema
safe_print("--- 4. Collecte tables ---")
code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -t -c "SELECT table_name FROM information_schema.tables WHERE table_schema='collecte' ORDER BY table_name" 2>&1""")
safe_print(f"{out}\n")

# 5. Campaigns
safe_print("--- 5. Campaigns ---")
code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -c "SELECT id, title, status, created_at FROM collecte.campaigns ORDER BY created_at" 2>&1""")
safe_print(f"{out}\n")

c.close()

# Check form-builder seed
safe_print("--- 6. Running form-builder seed ---")
c = get_client(HOST_APP)
DB_URL = "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris"

# Check if seed exists
code, out = run_sudo(c, """docker exec aris-form-builder ls /app/packages/db-schemas/prisma/seed*.ts 2>&1""")
safe_print(f"  Seed files in container: {out}")

# Check if form-builder has its own seed
code, out = run_sudo(c, """docker exec aris-form-builder ls /app/services/form-builder/src/seed.ts 2>&1""")
safe_print(f"  Form-builder seed: {out}")

c.close()
safe_print("\n=== Done ===")
