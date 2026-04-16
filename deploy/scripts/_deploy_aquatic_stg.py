#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy Aquatic Health changes to STAGING.

Targeted deployment: git pull + rebuild only master-data, form-builder, animal-health
+ re-seed reference data and form templates.

Usage:
  set ARIS_DEPLOY_PASS=@u-1baR.0rg$U24
  python -u deploy/scripts/_deploy_aquatic_stg.py
"""
import sys
import os
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import step, ssh, ssh_stream, VM_PASS

STG_APP = "10.202.101.146"
STG_DB = "10.202.101.148"
DEPLOY_DIR = "/opt/aris-deploy/vm-app-stg"
GIT_DIR = "/opt/aris"
PREFIX = "aris-stg"
DB_URL = "postgresql://aris:Ar1s_Stg_2024!xK9mZ@10.202.101.148:5432/aris"

SERVICES_TO_REBUILD = ["master-data", "form-builder", "animal-health"]


def main():
    # ── 1. Git pull ──
    step("Step 1: Git pull on staging")
    code, out, err = ssh(STG_APP, f"cd {GIT_DIR} && git checkout -- . && git pull origin main 2>&1")
    for line in out.splitlines():
        if line.strip():
            print(f"  {line}")
    if code != 0:
        print(f"  ERROR: git pull failed: {err[:500]}")
        sys.exit(1)

    # ── 2. Copy docker-compose.yml ──
    step("Step 2: Copy docker-compose.yml")
    ssh(STG_APP, f"cp {GIT_DIR}/deploy/vm-app-stg/docker-compose.yml {DEPLOY_DIR}/docker-compose.yml")
    print("  docker-compose.yml copied")

    # ── 3. Rebuild 3 targeted services ──
    step(f"Step 3: Rebuild {', '.join(SERVICES_TO_REBUILD)}")
    svc_list = " ".join(SERVICES_TO_REBUILD)
    code, out, err = ssh_stream(
        STG_APP,
        f"cd {DEPLOY_DIR} && docker compose up -d --build --no-deps {svc_list} 2>&1",
        timeout=600,
    )
    print(f"  Build exit code: {code}")

    print("  Waiting 15s for containers to start...")
    time.sleep(15)

    # Check containers
    for svc in SERVICES_TO_REBUILD:
        code, out, err = ssh(STG_APP, f"docker ps --filter name={PREFIX}-{svc} --format '{{{{.Status}}}}'")
        status = out.strip() or "NOT FOUND"
        icon = "+" if "Up" in status else "X"
        print(f"  [{icon}] {svc}: {status}")

    # ── 4. Seed master-data (public Species/Disease tables) ──
    step("Step 4: Seed master-data (public schema)")
    code, out, err = ssh_stream(
        STG_APP,
        f'docker exec -e DATABASE_URL="{DB_URL}" {PREFIX}-master-data npx tsx src/seed/run-seed.ts 2>&1',
        timeout=120,
    )
    print(f"  master-data seed: {'OK' if code == 0 else f'FAILED ({code})'}")

    # ── 5. Seed RefSpecies/RefDisease (animal_health schema via seed-master-data.ts) ──
    step("Step 5: Seed RefSpecies/RefDisease (seed-master-data.ts)")
    code, out, err = ssh_stream(
        STG_APP,
        f'docker exec -e DATABASE_URL="{DB_URL}" {PREFIX}-credential sh -c '
        f'"cd /app/packages/db-schemas && npx tsx prisma/seed-master-data.ts 2>&1"',
        timeout=120,
    )
    print(f"  seed-master-data: {'OK' if code == 0 else f'FAILED ({code})'}")

    # ── 6. Seed form-builder (form templates) ──
    step("Step 6: Seed form-builder (22 templates)")
    code, out, err = ssh_stream(
        STG_APP,
        f'docker exec -e DATABASE_URL="{DB_URL}" {PREFIX}-form-builder npx tsx src/seed.ts 2>&1',
        timeout=120,
    )
    print(f"  form-builder seed: {'OK' if code == 0 else f'FAILED ({code})'}")

    # ── 7. Seed animal-health (aquatic events + lab results) ──
    step("Step 7: Seed animal-health (aquatic events)")
    code, out, err = ssh_stream(
        STG_APP,
        f'docker exec -e DATABASE_URL="{DB_URL}" {PREFIX}-animal-health npx tsx src/seed.ts 2>&1',
        timeout=120,
    )
    print(f"  animal-health seed: {'OK' if code == 0 else f'FAILED ({code})'}")

    # ── 8. Health checks ──
    step("Step 8: Health checks")
    ports = {"master-data": 3003, "form-builder": 3010, "animal-health": 3020}
    for svc, port in ports.items():
        code, out, err = ssh(STG_APP, f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 5 http://localhost:{port}/api/v1/{svc}/health")
        http = out.strip().replace("'", "")
        ok = http in ("200", "301", "302")
        icon = "+" if ok else "X"
        print(f"  [{icon}] {svc:20s} :{port} -> {http}")

    print(f"\n{'='*60}")
    print("  AQUATIC HEALTH DEPLOYMENT COMPLETE!")
    print("  URL: https://test.au-aris.org")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
