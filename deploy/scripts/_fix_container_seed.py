#!/usr/bin/env python3
"""Copy seed-settings.ts into the aris-tenant container and re-run seed."""
import os
import sys
from ssh_config import get_client, VM_APP, VM_PASS

DB_URL = "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def run_sudo(client, cmd, timeout=30):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(VM_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, out, err


def run_sudo_stream(client, cmd, timeout=300):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(VM_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"  {line}")
    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, err


# Step 1: Upload file to /tmp
safe_print("=== 1. Upload via SFTP ===")
deploy_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
repo_root = os.path.dirname(deploy_dir)
local_file = os.path.join(repo_root, "packages", "db-schemas", "prisma", "seed-settings.ts")
safe_print(f"  Local file: {local_file} ({os.path.getsize(local_file)} bytes)")

c = get_client(VM_APP)
sftp = c.open_sftp()
sftp.put(local_file, "/tmp/aris-seed-settings-dq.ts", confirm=False)
sftp.close()
c.close()
safe_print("  SFTP upload done")

# Step 2: docker cp into container
safe_print("\n=== 2. docker cp into aris-tenant ===")
c = get_client(VM_APP)
code, out, err = run_sudo(c, "docker cp /tmp/aris-seed-settings-dq.ts aris-tenant:/app/packages/db-schemas/prisma/seed-settings.ts", timeout=15)
safe_print(f"  docker cp: exit {code}")
if err:
    safe_print(f"  ERR: {err}")
c.close()

# Step 3: Verify file inside container
safe_print("\n=== 3. Verify container file ===")
c = get_client(VM_APP)
code, out, err = run_sudo(c, "docker exec aris-tenant wc -l /app/packages/db-schemas/prisma/seed-settings.ts", timeout=10)
safe_print(f"  Lines: {out}")
c.close()

c = get_client(VM_APP)
code, out, err = run_sudo(c, "docker exec aris-tenant grep -c \"data-quality\" /app/packages/db-schemas/prisma/seed-settings.ts", timeout=10)
safe_print(f"  data-quality occurrences: {out}")
c.close()

# Step 4: Run seed
safe_print("\n=== 4. Running seed ===")
c = get_client(VM_APP)
cmd = f"""bash -c 'docker exec -e DATABASE_URL="{DB_URL}" aris-tenant sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-settings.ts 2>&1"'"""
code, errs = run_sudo_stream(c, cmd, timeout=180)
status = "OK" if code == 0 else f"FAILED ({code})"
safe_print(f"  Seed: {status}")
c.close()

# Step 5: Verify DB
safe_print("\n=== 5. Verify DB ===")
js_code = """
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRawUnsafe(
    "SELECT key FROM governance.system_configs WHERE category = 'data-quality' ORDER BY key"
  );
  console.log("Count: " + rows.length);
  rows.forEach(r => console.log("  " + r.key));
  await p.$disconnect();
})();
"""

c = get_client(VM_APP)
sftp = c.open_sftp()
with sftp.open("/tmp/verify_dq.js", "w") as f:
    f.write(js_code)
sftp.close()
c.close()

c = get_client(VM_APP)
code, out, err = run_sudo(c,
    f'bash -c \'docker cp /tmp/verify_dq.js aris-tenant:/app/verify_dq.js && docker exec -w /app -e DATABASE_URL="{DB_URL}" aris-tenant node verify_dq.js && docker exec aris-tenant rm -f /app/verify_dq.js\'',
    timeout=30
)
safe_print(out)
if err:
    safe_print(f"  ERR: {err}")
c.close()

safe_print("\nDone!")
