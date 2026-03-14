#!/usr/bin/env python3
"""
ARIS 4.0 — Unified deployment script.

Deploys services to production VMs with targeted or full rebuild.

Usage:
  export ARIS_DEPLOY_PASS='...'

  python deploy.py                     # Deploy all services
  python deploy.py credential message  # Deploy specific services
  python deploy.py --all               # Deploy all services (explicit)
  python deploy.py --pull-only         # Only git pull, no rebuild
  python deploy.py --health            # Only run health checks
"""
import sys
import time
import argparse
from ssh_config import ssh, step, VM_APP, VM_KAFKA, VM_DB, VM_CACHE, SERVICES


def parse_args():
    parser = argparse.ArgumentParser(description="ARIS 4.0 — Deploy to production")
    parser.add_argument("services", nargs="*", default=[],
                        help="Services to deploy (e.g., credential message). Empty or --all for all.")
    parser.add_argument("--all", action="store_true",
                        help="Deploy all services")
    parser.add_argument("--pull-only", action="store_true",
                        help="Only git pull, no container rebuild")
    parser.add_argument("--health", action="store_true",
                        help="Only run health checks, no deploy")
    parser.add_argument("--vm", default="app",
                        choices=["app", "kafka", "db", "cache", "all"],
                        help="Target VM (default: app)")
    return parser.parse_args()


def git_pull():
    """Pull latest code on VM-APP."""
    step("Git pull on VM-APP")
    code, out, err = ssh(VM_APP, "cd /opt/aris && git pull origin main 2>&1", timeout=60)
    print(out)
    if code != 0:
        print(f"  ERROR: git pull failed (exit {code})")
        print(err)
        sys.exit(1)
    return code


def deploy_services(services):
    """Rebuild and restart specified services on VM-APP."""
    if not services:
        step("Rebuild ALL services on VM-APP")
        cmd = "cd /opt/aris-deploy/vm-app && docker compose up -d --build 2>&1"
    else:
        svc_list = " ".join(services)
        step(f"Rebuild services: {svc_list}")
        cmd = f"cd /opt/aris-deploy/vm-app && docker compose up -d --build --no-deps {svc_list} 2>&1"

    code, out, err = ssh(VM_APP, cmd, timeout=600)
    print(out)
    if code != 0:
        print(f"  ERROR: docker compose failed (exit {code})")
        print(err)
        sys.exit(1)

    # Prune old images
    ssh(VM_APP, "docker image prune -f 2>&1", timeout=60)


def health_checks(services=None):
    """Run health checks on services."""
    step("Health checks")
    time.sleep(10)

    check_list = []
    if services:
        # Only check requested services
        svc_map = {name: port for name, port in SERVICES}
        for svc in services:
            if svc in svc_map:
                check_list.append((svc, svc_map[svc]))
            else:
                print(f"  [?] Unknown service: {svc}")
    else:
        check_list = SERVICES

    failed = 0
    for name, port in check_list:
        code, out, _ = ssh(
            VM_APP,
            f"curl -s -o /dev/null -w '%{{http_code}}' --max-time 10 http://localhost:{port}/health 2>&1"
        )
        status = out.strip()
        if status in ("200", "204"):
            print(f"  [OK]   {name} (:{port}) => {status}")
        else:
            print(f"  [WARN] {name} (:{port}) => {status}")
            failed += 1

    print()
    if failed:
        print(f"  {failed} service(s) not responding!")
        return False
    else:
        print("  All services healthy!")
        return True


def main():
    args = parse_args()

    # Health-only mode
    if args.health:
        ok = health_checks(args.services if args.services else None)
        sys.exit(0 if ok else 1)

    # Determine services to deploy
    target_services = [] if (args.all or not args.services) else args.services

    # Validate service names
    valid_names = {name for name, _ in SERVICES}
    for svc in target_services:
        if svc not in valid_names:
            print(f"ERROR: Unknown service '{svc}'")
            print(f"Valid services: {', '.join(sorted(valid_names))}")
            sys.exit(1)

    # Step 1: Git pull
    git_pull()

    # Step 2: Deploy (unless pull-only)
    if not args.pull_only:
        deploy_services(target_services)

        # Step 3: Health checks
        ok = health_checks(target_services if target_services else None)

    # Done
    step("Deployment complete!" if not args.pull_only else "Git pull complete!")
    if target_services:
        print(f"  Services: {', '.join(target_services)}")
    else:
        print("  All services")


if __name__ == "__main__":
    main()
