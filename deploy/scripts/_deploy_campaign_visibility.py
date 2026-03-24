#!/usr/bin/env python3
"""
Deploy campaign visibility & editability fix.

Deploys:
  1. collecte service (backend visibility/edit rules)
  2. web frontend (permission-aware UI)

To both staging and production VMs.

Usage:
  # Staging only (default)
  python _deploy_campaign_visibility.py

  # Production only
  python _deploy_campaign_visibility.py --prod

  # Both staging + production
  python _deploy_campaign_visibility.py --both
"""
import sys
import time
from ssh_config import ssh, step

# VM IPs
VM_APP_STG  = "10.202.101.146"
VM_APP_PROD = "10.202.101.183"

# (env_name, vm_ip, deploy_dir, git_compose_source)
TARGETS = []
if "--prod" in sys.argv:
    TARGETS.append(("PRODUCTION", VM_APP_PROD, "/opt/aris-deploy/vm-app",     "/opt/aris/deploy/vm-app"))
elif "--both" in sys.argv:
    TARGETS.append(("STAGING",    VM_APP_STG,  "/opt/aris-deploy/vm-app-stg", "/opt/aris/deploy/vm-app-stg"))
    TARGETS.append(("PRODUCTION", VM_APP_PROD, "/opt/aris-deploy/vm-app",     "/opt/aris/deploy/vm-app"))
else:
    TARGETS.append(("STAGING", VM_APP_STG, "/opt/aris-deploy/vm-app-stg", "/opt/aris/deploy/vm-app-stg"))

for env_name, vm_ip, deploy_dir, compose_src in TARGETS:
    print("\n" + "=" * 60)
    print(f"  DEPLOYING TO {env_name} ({vm_ip})")
    print("=" * 60)

    # Step 1: Pull latest code
    step(f"[{env_name}] Step 1: Pull latest code")
    code, out, _ = ssh(vm_ip, "cd /opt/aris && git pull origin main 2>&1", timeout=60)
    print(out)

    # Step 2: Copy docker-compose.yml from correct source to deploy dir
    step(f"[{env_name}] Step 2: Sync docker-compose.yml")
    code, out, _ = ssh(
        vm_ip,
        f"cp {compose_src}/docker-compose.yml {deploy_dir}/docker-compose.yml 2>&1",
        timeout=30,
    )
    print(out or "(synced)")

    # Step 3: Rebuild collecte service
    step(f"[{env_name}] Step 3: Rebuild collecte service")
    code, out, _ = ssh(
        vm_ip,
        f"cd {deploy_dir} && docker compose --env-file .env up -d --build --no-deps collecte 2>&1",
        timeout=300,
    )
    print(out)
    print(f"  Exit: {code}")

    # Step 4: Rebuild web frontend
    step(f"[{env_name}] Step 4: Rebuild web frontend")
    code, out, _ = ssh(
        vm_ip,
        f"cd {deploy_dir} && docker compose --env-file .env up -d --build --no-deps web 2>&1",
        timeout=300,
    )
    print(out)
    print(f"  Exit: {code}")

    # Step 5: Wait and verify health
    step(f"[{env_name}] Step 5: Health checks")
    time.sleep(10)

    for svc, port in [("collecte", 3011), ("web", 3000)]:
        code, out, _ = ssh(
            vm_ip,
            f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:{port}/health 2>&1",
        )
        status = out.strip()
        icon = "OK" if status in ("200", "204") else "WARN"
        print(f"  {svc} (:{port}) => {status} [{icon}]")

    # Step 6: Docker cleanup
    step(f"[{env_name}] Step 6: Docker cleanup")
    code, out, _ = ssh(
        vm_ip,
        "docker image prune -f && docker builder prune -f --keep-storage=2GB 2>&1",
        timeout=120,
    )
    reclaimed = [l for l in out.splitlines() if "reclaimed" in l.lower()]
    for line in reclaimed:
        print(f"  {line.strip()}")
    code, out, _ = ssh(vm_ip, "df -h / | tail -1")
    print(f"  Disk: {out.strip()}")

    print(f"\n  {env_name} DONE!")

print("\n" + "=" * 60)
print("  CAMPAIGN VISIBILITY DEPLOY COMPLETE!")
print("  Services: collecte, web")
print("=" * 60)
