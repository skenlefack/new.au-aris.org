#!/usr/bin/env python3
"""Check master_data table counts and re-seed if empty."""
from ssh_config import ssh, step, VM_APP, VM_DB

# Step 1: Check table counts via psql on DB VM
step("Step 1: Checking master_data table row counts")

# Simpler approach: just count key tables individually
tables = [
    "Species", "Disease", "DiseaseSpecies", "Breed", "AgeGroup",
    "LivestockProduct", "ProductionSystem", "Unit", "ControlMeasure",
    "AdministrativeDivision", "Country"
]

for t in tables:
    code, out, _ = ssh(
        VM_APP,
        f'PGPASSWORD="Ar1s_Pr0d_2024!xK9mZ" psql -h {VM_DB} -U aris -d aris -t -A -c "SELECT count(*) FROM master_data.\\"{t}\\"" 2>&1'
    )
    count = out.strip().split('\n')[-1] if out.strip() else "ERROR"
    print(f"  {t}: {count}")

# Step 2: Check other schemas too
step("Step 2: Check other key schemas")
other_tables = [
    ("credential", "User"),
    ("tenant", "Tenant"),
    ("workflow", "WorkflowTemplate"),
]
for schema, table in other_tables:
    code, out, _ = ssh(
        VM_APP,
        f'PGPASSWORD="Ar1s_Pr0d_2024!xK9mZ" psql -h {VM_DB} -U aris -d aris -t -A -c "SELECT count(*) FROM {schema}.\\"{table}\\"" 2>&1'
    )
    count = out.strip().split('\n')[-1] if out.strip() else "ERROR"
    print(f"  {schema}.{table}: {count}")

# Step 3: If master_data is empty, re-seed
step("Step 3: Decision")
code, out, _ = ssh(
    VM_APP,
    f'PGPASSWORD="Ar1s_Pr0d_2024!xK9mZ" psql -h {VM_DB} -U aris -d aris -t -A -c "SELECT count(*) FROM master_data.\\"Species\\"" 2>&1'
)
species_count = int(out.strip().split('\n')[-1]) if out.strip() else 0

if species_count == 0:
    print("  Master data is EMPTY! Running full re-seed...")

    step("Step 3a: Running prisma generate")
    code, out, _ = ssh(
        VM_APP,
        "cd /opt/aris && npx prisma generate --schema=packages/db-schemas/prisma 2>&1",
        timeout=120
    )
    print(out[-500:] if len(out) > 500 else out)

    step("Step 3b: Running seed-master-data.ts")
    code, out, _ = ssh(
        VM_APP,
        "cd /opt/aris && npx tsx packages/db-schemas/prisma/seed-master-data.ts 2>&1",
        timeout=300
    )
    print(out)
    if code != 0:
        print(f"  ERROR: seed failed (exit {code})")
    else:
        print("  Seed completed successfully!")

    step("Step 3c: Running full seed (all domains)")
    code, out, _ = ssh(
        VM_APP,
        "cd /opt/aris && npx tsx scripts/seed-all-domains.ts 2>&1",
        timeout=300
    )
    print(out[-2000:] if len(out) > 2000 else out)

    step("Step 3d: Verify counts after re-seed")
    for t in tables:
        code, out, _ = ssh(
            VM_APP,
            f'PGPASSWORD="Ar1s_Pr0d_2024!xK9mZ" psql -h {VM_DB} -U aris -d aris -t -A -c "SELECT count(*) FROM master_data.\\"{t}\\"" 2>&1'
        )
        count = out.strip().split('\n')[-1] if out.strip() else "ERROR"
        print(f"  {t}: {count}")
else:
    print(f"  Species count = {species_count}, data exists. No re-seed needed.")
    print("  The issue might be in the API layer, not the database.")

print("\n" + "=" * 60)
print("  DONE")
print("=" * 60)
