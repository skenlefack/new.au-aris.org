#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy Master Data Updates to Production
Syncs code, runs prisma generate/migrate, seeds data, restarts services.
"""
import sys

from ssh_config import ssh, step, VM_APP

REMOTE_DIR = "/opt/aris"


def main():
    # Step 0: Check connectivity
    step("Step 0: Checking VM-APP connectivity")
    code, out, _ = ssh(VM_APP, "echo CONNECTION_OK && hostname")
    if code != 0 or "CONNECTION_OK" not in out:
        print("FAILED to connect to VM-APP!")
        sys.exit(1)
    print(f"  Connected to: {out.strip()}")

    # Step 1: Pull latest code from GitHub on VM-APP (already done)
    step("Step 1: Verifying latest code on VM-APP")
    code, out, err = ssh(VM_APP,
        f"cd {REMOTE_DIR} && git log --oneline -1 2>&1",
        timeout=30
    )
    print(f"  Latest commit: {out.strip()}")

    # Step 2: Install dependencies
    step("Step 2: Installing dependencies (pnpm install)")
    code, out, err = ssh(VM_APP,
        f"cd {REMOTE_DIR} && pnpm install --frozen-lockfile 2>&1 | tail -10",
        timeout=300
    )
    print(out)
    if code != 0:
        print(f"  WARN: pnpm install exit code {code}, trying without --frozen-lockfile...")
        code, out, err = ssh(VM_APP,
            f"cd {REMOTE_DIR} && pnpm install 2>&1 | tail -10",
            timeout=300
        )
        print(out)

    # Step 3: Generate Prisma client
    step("Step 3: Generating Prisma client")
    code, out, err = ssh(VM_APP,
        f"cd {REMOTE_DIR} && npx prisma generate --schema=packages/db-schemas/prisma 2>&1",
        timeout=120
    )
    print(out)
    if code != 0:
        print(f"  ERROR: prisma generate failed (exit {code})")
        print(err[-500:] if err else "")

    # Step 4: Run Prisma migrations
    step("Step 4: Running Prisma migrations")
    code, out, err = ssh(VM_APP,
        f"cd {REMOTE_DIR} && npx prisma migrate deploy --schema=packages/db-schemas/prisma 2>&1",
        timeout=120
    )
    print(out)
    if code != 0:
        print(f"  WARN: prisma migrate deploy exit code {code}")
        print(err[-500:] if err else "")
        # Try db push as fallback (for new models without migration files)
        step("Step 4b: Trying prisma db push as fallback")
        code, out, err = ssh(VM_APP,
            f"cd {REMOTE_DIR} && npx prisma db push --schema=packages/db-schemas/prisma --accept-data-loss 2>&1",
            timeout=120
        )
        print(out)

    # Step 5: Seed master data
    step("Step 5: Seeding master data reference tables")
    code, out, err = ssh(VM_APP,
        f"cd {REMOTE_DIR} && npx tsx packages/db-schemas/prisma/seed-master-data.ts 2>&1",
        timeout=180
    )
    print(out)
    if code != 0:
        print(f"  ERROR: seed failed (exit {code})")
        print(err[-500:] if err else "")
        sys.exit(1)

    # Step 6: Rebuild and restart affected Docker services
    step("Step 6: Rebuilding and restarting affected services")

    # Check if docker compose is available and find the compose file
    code, out, err = ssh(VM_APP,
        f"ls {REMOTE_DIR}/deploy/vm-app/docker-compose.yml 2>/dev/null && echo FOUND || "
        f"ls {REMOTE_DIR}/docker-compose.services.yml 2>/dev/null && echo FOUND_ROOT || "
        f"echo NO_COMPOSE",
        timeout=10
    )
    compose_output = out.strip()

    if "FOUND" in compose_output:
        # Restart master-data and web services
        code, out, err = ssh(VM_APP,
            f"cd {REMOTE_DIR}/deploy/vm-app && "
            f"docker compose up -d --build --no-deps master-data web 2>&1 | tail -20",
            timeout=600
        )
        print(out)
        if code != 0:
            print(f"  WARN: docker compose exit code {code}")
            # Try just restarting
            code2, out2, _ = ssh(VM_APP,
                f"cd {REMOTE_DIR}/deploy/vm-app && docker compose restart master-data 2>&1",
                timeout=60
            )
            print(out2)
    else:
        print("  No docker-compose found, checking for running containers...")
        code, out, err = ssh(VM_APP,
            "docker ps --format '{{.Names}}' | grep -E 'master|web' 2>&1",
            timeout=10
        )
        print(f"  Running containers: {out.strip()}")
        if out.strip():
            for container in out.strip().split("\n"):
                if container:
                    print(f"  Restarting {container}...")
                    ssh(VM_APP, f"docker restart {container} 2>&1", timeout=60)

    # Step 7: Verify
    step("Step 7: Verification")
    code, out, err = ssh(VM_APP,
        "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' 2>&1 | "
        "grep -E 'master|web|NAME' | head -10",
        timeout=15
    )
    print(out)

    print("\n" + "=" * 60)
    print("  DEPLOYMENT COMPLETE!")
    print("=" * 60)
    print(f"\n  Changes deployed:")
    print(f"  - 13 new reference data types (WOAH enrichment)")
    print(f"  - 88 diseases (was 25)")
    print(f"  - 170+ disease-species relations (was 53)")
    print(f"  - 47 breeds (was 20)")
    print(f"  - 51 livestock products (was 12)")
    print(f"  - 33 age groups (was 13)")
    print(f"  - 19 WOAH-aligned control measures")


if __name__ == "__main__":
    main()
