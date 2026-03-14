#!/usr/bin/env python3
"""Verify data-quality settings exist in production DB."""
import sys

from ssh_config import get_client, ssh, VM_APP

DB_URL = "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# Step 1: Write a JS verification script to /tmp on the remote server
js_script = """
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRawUnsafe(
    "SELECT key, value FROM governance.system_configs WHERE category = 'data-quality' ORDER BY key"
  );
  console.log("Count: " + rows.length);
  rows.forEach(r => console.log("  " + r.key + " = " + JSON.stringify(r.value)));
  await p.$disconnect();
})();
"""

c = get_client(VM_APP)
sftp = c.open_sftp()
with sftp.open("/tmp/verify_dq.js", "w") as f:
    f.write(js_script)
sftp.close()
c.close()

# Step 2: Copy into container and run
code, out, err = ssh(VM_APP,
    f'docker cp /tmp/verify_dq.js aris-tenant:/app/verify_dq.js && docker exec -w /app -e DATABASE_URL="{DB_URL}" aris-tenant node verify_dq.js && docker exec aris-tenant rm -f /app/verify_dq.js',
    timeout=30
)

safe_print("=== Data-Quality Settings in Production ===")
safe_print(out)
if err:
    safe_print(f"ERR: {err}")
