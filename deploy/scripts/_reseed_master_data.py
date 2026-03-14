#!/usr/bin/env python3
"""Re-seed all master data on production."""
import time
from ssh_config import ssh, step, VM_APP

# Step 1: Quick check using a node one-liner via prisma
step("Step 1: Check current state via node")
code, out, _ = ssh(
    VM_APP,
    'cd /opt/aris && node -e "const{PrismaClient}=require(\\\"@prisma/client\\\");const p=new PrismaClient();p.species.count().then(c=>{console.log(\\\"Species:\\\",c);return p.disease.count()}).then(c=>{console.log(\\\"Disease:\\\",c);return p.breed.count()}).then(c=>{console.log(\\\"Breed:\\\",c);process.exit(0)}).catch(e=>{console.log(\\\"Error:\\\",e.message);process.exit(1)})" 2>&1',
    timeout=30
)
print(out)

# Step 2: Re-seed master data
step("Step 2: Running seed-master-data.ts")
code, out, _ = ssh(
    VM_APP,
    "cd /opt/aris && npx tsx packages/db-schemas/prisma/seed-master-data.ts 2>&1",
    timeout=300
)
print(out[-3000:] if len(out) > 3000 else out)
if code != 0:
    print(f"  EXIT CODE: {code}")

# Step 3: Run other seeds
step("Step 3: Running other seed scripts")

seeds = [
    ("seed-tenant.ts", "Tenant hierarchy"),
    ("seed-credential.ts", "Users/credentials"),
    ("seed-functions.ts", "Functions"),
    ("seed-workflow.ts", "Workflow templates"),
    ("seed-bi.ts", "BI config"),
]

for seed_file, desc in seeds:
    print(f"\n  --- {desc} ({seed_file}) ---")
    code, out, _ = ssh(
        VM_APP,
        f"cd /opt/aris && npx tsx packages/db-schemas/prisma/{seed_file} 2>&1",
        timeout=120
    )
    # Show last 500 chars
    print(out[-500:] if len(out) > 500 else out)
    if code != 0:
        print(f"  WARN: exit code {code}")

# Step 4: Verify
step("Step 4: Verify counts after re-seed")
code, out, _ = ssh(
    VM_APP,
    'cd /opt/aris && node -e "const{PrismaClient}=require(\\\"@prisma/client\\\");const p=new PrismaClient();Promise.all([p.species.count(),p.disease.count(),p.breed.count(),p.ageGroup.count(),p.livestockProduct.count(),p.unit.count(),p.controlMeasure.count(),p.country.count()]).then(([s,d,b,a,l,u,cm,co])=>{console.log(\\\"Species:\\\",s);console.log(\\\"Disease:\\\",d);console.log(\\\"Breed:\\\",b);console.log(\\\"AgeGroup:\\\",a);console.log(\\\"LivestockProduct:\\\",l);console.log(\\\"Unit:\\\",u);console.log(\\\"ControlMeasure:\\\",cm);console.log(\\\"Country:\\\",co);process.exit(0)}).catch(e=>{console.log(\\\"Error:\\\",e.message);process.exit(1)})" 2>&1',
    timeout=30
)
print(out)

# Step 5: Restart master-data service to clear any cache
step("Step 5: Restart master-data service")
code, out, _ = ssh(
    VM_APP,
    "docker restart aris-master-data 2>&1",
    timeout=60
)
print(out)
time.sleep(3)

print("\n" + "=" * 60)
print("  RE-SEED COMPLETE!")
print("=" * 60)
