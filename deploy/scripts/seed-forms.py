#!/usr/bin/env python3
"""Check form_templates columns and run form-builder seed."""
import paramiko
import sys
import os

os.environ["PYTHONIOENCODING"] = "utf-8"

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
HOST_DB = "10.202.101.185"
HOST_APP = "10.202.101.183"
DB_URL = "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris"


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


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    return code, out


def run_sudo_stream(client, cmd, timeout=120):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"  {line}")
    code = stdout.channel.recv_exit_status()
    return code


safe_print("=== Form Builder: Check & Seed ===\n")

# 1. Check actual columns in form_templates
safe_print("--- 1. form_templates columns ---")
c = get_client(HOST_DB)
code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='form_builder' AND table_name='form_templates' ORDER BY ordinal_position" 2>&1""")
safe_print(f"{out}\n")
c.close()

# 2. Check current data in form_templates
safe_print("--- 2. Current form_templates data ---")
c = get_client(HOST_DB)
code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -c "SELECT * FROM form_builder.form_templates LIMIT 5" 2>&1""")
safe_print(f"{out}\n")
c.close()

# 3. Check collecte schema tables
safe_print("--- 3. All tables in collecte schema ---")
c = get_client(HOST_DB)
code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -c "SELECT table_name FROM information_schema.tables WHERE table_schema='collecte'" 2>&1""")
safe_print(f"{out}\n")
c.close()

# 4. Run the form-builder seed
safe_print("--- 4. Running form-builder seed ---")
c = get_client(HOST_APP)
code = run_sudo_stream(c, f"""bash -c 'docker exec -e DATABASE_URL="{DB_URL}" aris-form-builder sh -c "cd /app/services/form-builder && npx tsx src/seed.ts 2>&1"'""", timeout=120)
safe_print(f"\n  Seed exit: {code}\n")
c.close()

# 5. Re-check form_templates after seed
safe_print("--- 5. form_templates after seed ---")
c = get_client(HOST_DB)
code, out = run_sudo(c, """docker exec aris-postgres psql -U aris -d aris -c "SELECT id, name, status, domain, created_at FROM form_builder.form_templates ORDER BY created_at" 2>&1""")
safe_print(f"{out}")
c.close()

safe_print("\n=== Done ===")
