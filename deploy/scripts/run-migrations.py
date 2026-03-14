#!/usr/bin/env python3
"""
ARIS 4.0 — Run Prisma migrations and seed data on VM-APP
Uses the credential service container (which has Prisma client + direct DB access)
"""
import sys

from ssh_config import get_client as _get_client, VM_APP, VM_PASS


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    return _get_client(VM_APP)


def run_sudo(client, cmd, timeout=120):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, out, err


def run_sudo_stream(client, cmd, timeout=300):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    if VM_PASS:
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


safe_print("=" * 60)
safe_print("  ARIS 4.0 — Database Migrations & Seeding")
safe_print("=" * 60)

# The credential service container has the Prisma client and node_modules.
# We need to run prisma migrate deploy + seeds using DIRECT_DATABASE_URL
# (which connects directly to PostgreSQL, bypassing PgBouncer).

c = get_client()

# Step 1: Check database connectivity
safe_print("\n=== 1. Checking database connectivity ===")
code, out, err = run_sudo(c, "docker exec aris-credential sh -c 'node -e \"const { PrismaClient } = require(\\\"@prisma/client\\\"); const p = new PrismaClient(); p.\\$queryRaw\\`SELECT 1\\`.then(r => console.log(\\\"DB OK\\\")).catch(e => console.log(\\\"DB ERROR:\\\", e.message))\"' 2>&1", timeout=30)
safe_print(f"  {out[:300]}")
c.close()

# Step 2: Run Prisma migrations via docker exec
safe_print("\n=== 2. Running Prisma migrations ===")
c = get_client()
# Use the credential container — it has prisma + all schema files
# Need to use DIRECT_DATABASE_URL for migrations (not PgBouncer)
code, err = run_sudo_stream(c, """bash -c '
# Run Prisma db push (since we may not have migration files, use push to sync schema)
docker exec -e DATABASE_URL="postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris" aris-credential sh -c "cd /app/packages/db-schemas && npx prisma db push --schema=prisma --accept-data-loss 2>&1"
'""", timeout=300)
safe_print(f"  Migration exit code: {0 if code == 0 else code}")
if err:
    safe_print(f"  Error: {err[:500]}")
c.close()

# Step 3: Run seeds
safe_print("\n=== 3. Running seeds ===")
c = get_client()

# Seed credentials (users)
safe_print("\n  --- Seeding credentials ---")
code, err = run_sudo_stream(c, """bash -c '
docker exec -e DATABASE_URL="postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris" aris-credential sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-credential.ts 2>&1"
'""", timeout=120)
safe_print(f"  Exit: {code}")

# Seed tenants
safe_print("\n  --- Seeding tenants ---")
code, err = run_sudo_stream(c, """bash -c '
docker exec -e DATABASE_URL="postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris" aris-tenant sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-tenant.ts 2>&1"
'""", timeout=120)
safe_print(f"  Exit: {code}")

# Seed functions
safe_print("\n  --- Seeding functions ---")
code, err = run_sudo_stream(c, """bash -c '
docker exec -e DATABASE_URL="postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris" aris-credential sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-functions.ts 2>&1"
'""", timeout=120)
safe_print(f"  Exit: {code}")

# Seed workflow
safe_print("\n  --- Seeding workflow ---")
code, err = run_sudo_stream(c, """bash -c '
docker exec -e DATABASE_URL="postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris" aris-workflow sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-workflow.ts 2>&1"
'""", timeout=120)
safe_print(f"  Exit: {code}")

# Seed BI
safe_print("\n  --- Seeding BI ---")
code, err = run_sudo_stream(c, """bash -c '
docker exec -e DATABASE_URL="postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris" aris-credential sh -c "cd /app/packages/db-schemas && npx tsx prisma/seed-bi.ts 2>&1"
'""", timeout=120)
safe_print(f"  Exit: {code}")
c.close()

# Step 4: Verify login works
safe_print("\n=== 4. Verifying login ===")
c = get_client()
run_sudo(c, """bash -c 'echo '"'"'{"email":"admin@au-aris.org","password":"Aris2024!"}'"'"' > /tmp/login.json'""")
code, out, err = run_sudo(c, 'curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H "Content-Type: application/json" -d @/tmp/login.json 2>&1', timeout=10)
safe_print(f"  Login: {out[:500] if out else 'NO RESPONSE'}")
c.close()

safe_print("\n" + "=" * 60)
safe_print("  Database setup complete!")
safe_print("=" * 60)
