#!/usr/bin/env python3
"""Check if the uploaded seed-settings.ts has the new data-quality entries."""
import sys

from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# Check on host filesystem
code, out, err = ssh(VM_APP, "grep -c \"category: 'data-quality'\" /opt/aris/packages/db-schemas/prisma/seed-settings.ts", timeout=10)
safe_print(f"Host file count: {out}")

# Check inside the container
code, out, err = ssh(VM_APP, "docker exec aris-tenant grep -c \"category: 'data-quality'\" /app/packages/db-schemas/prisma/seed-settings.ts", timeout=10)
safe_print(f"Container file count: {out}")

# Show the seed uses the container's file, not host
code, out, err = ssh(VM_APP, "docker exec aris-tenant wc -l /app/packages/db-schemas/prisma/seed-settings.ts", timeout=10)
safe_print(f"Container file lines: {out}")

code, out, err = ssh(VM_APP, "wc -l /opt/aris/packages/db-schemas/prisma/seed-settings.ts", timeout=10)
safe_print(f"Host file lines: {out}")
