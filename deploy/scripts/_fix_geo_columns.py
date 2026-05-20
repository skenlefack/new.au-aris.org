#!/usr/bin/env python3
"""Add missing name_pt and name_ar columns to geo_entities on STAGING."""
import paramiko
import tempfile
import os

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("10.202.101.146", username="arisadmin", password="@u-1baR.0rg$U24", timeout=15)

# Write SQL to temp file locally
sql = "ALTER TABLE public.geo_entities ADD COLUMN IF NOT EXISTS name_pt VARCHAR(255) DEFAULT '';\n"
sql += "ALTER TABLE public.geo_entities ADD COLUMN IF NOT EXISTS name_ar VARCHAR(255) DEFAULT '';\n"

tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".sql", delete=False, newline="\n")
tmp.write(sql)
tmp.close()

# Upload via SFTP (binary mode to avoid paramiko issues)
transport = c.get_transport()
sftp = paramiko.SFTPClient.from_transport(transport)
sftp.put(tmp.name, "/tmp/_fix_geo.sql")
sftp.close()
os.unlink(tmp.name)
print("SQL uploaded")

# Docker cp into collecte container, then use node to run prisma
chan = transport.open_session()
chan.exec_command(
    "echo '@u-1baR.0rg$U24' | sudo -S bash -c '"
    "docker cp /tmp/_fix_geo.sql aris-stg-collecte:/tmp/_fix_geo.sql && "
    "docker exec aris-stg-collecte node -e \""
    "const {PrismaClient}=require(\\\"@prisma/client\\\");"
    "const p=new PrismaClient();"
    "(async()=>{"
    "  await p.\\$executeRawUnsafe(\\\"ALTER TABLE public.geo_entities ADD COLUMN IF NOT EXISTS name_pt VARCHAR(255) DEFAULT \\'\\'\\\");"
    "  await p.\\$executeRawUnsafe(\\\"ALTER TABLE public.geo_entities ADD COLUMN IF NOT EXISTS name_ar VARCHAR(255) DEFAULT \\'\\'\\\");"
    "  const r=await p.\\$queryRawUnsafe(\\\"SELECT column_name FROM information_schema.columns WHERE table_name=\\'geo_entities\\' AND column_name LIKE \\'name_%\\'\\\");"
    "  console.log(JSON.stringify(r));"
    "  process.exit(0);"
    "})();"
    "\"'"
)
chan.settimeout(30)
out = b""
try:
    while True:
        chunk = chan.recv(4096)
        if not chunk:
            break
        out += chunk
except Exception:
    pass
print(f"Result: {out.decode(errors='replace').strip()}")
c.close()
