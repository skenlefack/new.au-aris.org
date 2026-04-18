#!/usr/bin/env python3
"""
ARIS 4.0 — BI Tools Deployment & Verification
==============================================
Rebuilds the web container (fixes 404 on /bi-tools/*) and verifies
that all 3 BI containers (Superset, Metabase, Grafana) are healthy.

Phases:
  1. Git pull latest code on VM-APP
  2. Rebuild & restart the web container (fixes 404)
  3. Verify all BI containers are running and healthy
  4. Verify Traefik routing for BI subdomains
  5. Verify Superset datasource bootstrap
  6. Re-seed BI tool configs & access rules in DB
  7. Print summary

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python deploy/scripts/_deploy_bi_tools.py

  # Staging:
  python deploy/scripts/_deploy_bi_tools.py --env=staging

  # Skip web rebuild (only verify BI containers):
  python deploy/scripts/_deploy_bi_tools.py --verify-only

  # Also rebuild BI containers:
  python deploy/scripts/_deploy_bi_tools.py --rebuild-bi
"""
import sys
import os
import argparse
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from ssh_config import ssh, ssh_stream, step, VM_APP, VM_DB

# ═══════════════════════════════════════════════════════════════
#  CONFIGURATION
# ═══════════════════════════════════════════════════════════════

ENVS = {
    "prod": {
        "vm_app": VM_APP,                     # 10.202.101.183
        "vm_db": VM_DB,                       # 10.202.101.185
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "container_prefix": "aris",
        "domain": "au-aris.org",
        "db_password": "Ar1s_Pr0d_2024!xK9mZ",
    },
    "staging": {
        "vm_app": "10.202.101.146",           # nbo-aris05
        "vm_db": "10.202.101.148",            # nbo-dbms04
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "container_prefix": "aris-stg",
        "domain": "test.au-aris.org",
        "db_password": "Ar1s_Stg_2024!xK9mZ",
    },
}

BI_CONTAINERS = ["superset", "metabase", "grafana"]
BI_SUBDOMAINS = {
    "prod": {
        "superset": "superset.au-aris.org",
        "metabase": "metabase.au-aris.org",
        "grafana": "grafana.au-aris.org",
    },
    "staging": {
        "superset": "superset-test.au-aris.org",
        "metabase": "metabase-test.au-aris.org",
        "grafana": "grafana-test.au-aris.org",
    },
}


# ═══════════════════════════════════════════════════════════════
#  HELPERS
# ═══════════════════════════════════════════════════════════════

def banner(msg):
    print(f"\n{'#' * 70}")
    print(f"#  {msg}")
    print(f"{'#' * 70}\n")


def run(host, cmd, timeout=300, label=None):
    if label:
        print(f"  [{label}] {cmd[:100]}...")
    code, out, err = ssh(host, cmd, timeout=timeout)
    if out.strip():
        for line in out.strip().splitlines()[:20]:
            print(f"    {line}")
    if code != 0 and err.strip():
        for line in err.strip().splitlines()[:10]:
            print(f"    ERR: {line}")
    return code, out


def run_check(host, cmd, timeout=300, label=None):
    code, out = run(host, cmd, timeout=timeout, label=label)
    if code != 0:
        print(f"\n  FATAL: Command failed (exit {code})")
        sys.exit(1)
    return out


# ═══════════════════════════════════════════════════════════════
#  PHASE 1: GIT PULL
# ═══════════════════════════════════════════════════════════════

def phase_git_pull(env):
    step("Phase 1: Git pull latest code")
    cfg = ENVS[env]
    run_check(cfg["vm_app"],
              "cd /opt/aris && git fetch origin && git reset --hard origin/main",
              timeout=120, label="git-pull")
    print("  OK: Code updated to latest main")


# ═══════════════════════════════════════════════════════════════
#  PHASE 2: REBUILD WEB CONTAINER
# ═══════════════════════════════════════════════════════════════

def phase_rebuild_web(env):
    step("Phase 2: Rebuild & restart web container (fixes 404 on /bi-tools/*)")
    cfg = ENVS[env]
    deploy = cfg["deploy_dir"]
    prefix = cfg["container_prefix"]

    print("  Building web container (this takes 2-4 minutes)...")
    run_check(cfg["vm_app"],
              f"cd {deploy} && docker compose up -d --build --force-recreate --no-deps web",
              timeout=600, label="build-web")

    # Wait for container to be healthy
    print("  Waiting for web container to start...")
    time.sleep(10)

    code, out = run(cfg["vm_app"],
                    f"docker ps --filter name={prefix}-web --format '{{{{.Status}}}}'",
                    label="health-check")
    if "Up" in out:
        print(f"  OK: {prefix}-web is running")
    else:
        print(f"  WARNING: {prefix}-web may not be healthy: {out.strip()}")


# ═══════════════════════════════════════════════════════════════
#  PHASE 3: VERIFY BI CONTAINERS
# ═══════════════════════════════════════════════════════════════

def phase_verify_bi_containers(env):
    step("Phase 3: Verify BI containers are running")
    cfg = ENVS[env]
    prefix = cfg["container_prefix"]
    results = {}

    for tool in BI_CONTAINERS:
        container = f"{prefix}-{tool}"
        code, out = run(cfg["vm_app"],
                        f"docker ps --filter name={container} --format '{{{{.Names}}}}\\t{{{{.Status}}}}\\t{{{{.Ports}}}}'",
                        label=tool)
        if container in out and "Up" in out:
            results[tool] = "OK"
            print(f"  OK: {container} is running")
        else:
            results[tool] = "DOWN"
            print(f"  FAIL: {container} is NOT running")

    # Check internal health endpoints
    for tool in BI_CONTAINERS:
        if results.get(tool) != "OK":
            continue
        container = f"{prefix}-{tool}"
        if tool == "superset":
            code, out = run(cfg["vm_app"],
                            f"docker exec {container} curl -sf -o /dev/null -w '%{{http_code}}' http://localhost:8088/health 2>/dev/null || echo FAIL",
                            label="superset-health")
            if "200" in out:
                print("  OK: Superset /health returns 200")
            else:
                print(f"  WARNING: Superset health check: {out.strip()}")
        elif tool == "metabase":
            code, out = run(cfg["vm_app"],
                            f"docker exec {container} curl -sf -o /dev/null -w '%{{http_code}}' http://localhost:3000/api/health 2>/dev/null || echo FAIL",
                            label="metabase-health")
            if "200" in out:
                print("  OK: Metabase /api/health returns 200")
            else:
                print(f"  WARNING: Metabase health check: {out.strip()}")
        elif tool == "grafana":
            code, out = run(cfg["vm_app"],
                            f"docker exec {container} curl -sf -o /dev/null -w '%{{http_code}}' http://localhost:3000/api/health 2>/dev/null || echo FAIL",
                            label="grafana-health")
            if "200" in out:
                print("  OK: Grafana /api/health returns 200")
            else:
                print(f"  WARNING: Grafana health check: {out.strip()}")

    return results


# ═══════════════════════════════════════════════════════════════
#  PHASE 4: VERIFY TRAEFIK ROUTING
# ═══════════════════════════════════════════════════════════════

def phase_verify_routing(env):
    step("Phase 4: Verify Traefik routing for BI subdomains")
    cfg = ENVS[env]
    subdomains = BI_SUBDOMAINS[env]

    for tool, domain in subdomains.items():
        code, out = run(cfg["vm_app"],
                        f"curl -sf -o /dev/null -w '%{{http_code}}' -H 'Host: {domain}' https://127.0.0.1 --insecure 2>/dev/null || echo FAIL",
                        label=f"route-{tool}")
        status = out.strip()
        if status in ("200", "302", "301"):
            print(f"  OK: {domain} -> {status}")
        else:
            print(f"  FAIL: {domain} -> {status}")


# ═══════════════════════════════════════════════════════════════
#  PHASE 5: VERIFY SUPERSET DATASOURCE
# ═══════════════════════════════════════════════════════════════

def phase_verify_superset_datasource(env):
    step("Phase 5: Verify Superset has ARIS datasource")
    cfg = ENVS[env]
    prefix = cfg["container_prefix"]
    container = f"{prefix}-superset"

    # Check if ARIS database is registered in Superset
    code, out = run(cfg["vm_app"],
                    f"docker exec {container} superset list-db 2>/dev/null || echo 'list-db not available'",
                    label="superset-datasource")

    # Fallback: check via API
    code, out = run(cfg["vm_app"],
                    f"docker exec {container} curl -sf http://localhost:8088/api/v1/database/ -H 'Content-Type: application/json' 2>/dev/null | python3 -c \"import sys,json; data=json.load(sys.stdin); [print(f'  DB: {{d[\\\"database_name\\\"]}} (id={{d[\\\"id\\\"]}})') for d in data.get('result',[])]\" 2>/dev/null || echo 'Could not list databases'",
                    label="superset-db-api")

    if "ARIS" in out or "aris" in out.lower():
        print("  OK: ARIS datasource found in Superset")
    else:
        print("  WARNING: ARIS datasource may not be registered")
        print("  TIP: Run bootstrap_datasource.py or add manually via Superset UI")


# ═══════════════════════════════════════════════════════════════
#  PHASE 6: RE-SEED BI CONFIGS IN DB
# ═══════════════════════════════════════════════════════════════

def phase_reseed_bi(env):
    step("Phase 6: Re-seed BI tool configs & access rules")
    cfg = ENVS[env]
    prefix = cfg["container_prefix"]
    db_pass = cfg["db_password"]

    # Use the tenant container to run the seed (it has Prisma + node)
    container = f"{prefix}-tenant"
    db_url = f"postgresql://aris:{db_pass}@{cfg['vm_db']}:6432/aris?pgbouncer=true"

    code, out = run(cfg["vm_app"],
                    f"docker exec -w /app/packages/db-schemas -e DATABASE_URL='{db_url}' {container} node dist/seed-bi.js 2>&1",
                    timeout=60, label="seed-bi")

    if code == 0:
        print("  OK: BI seed completed successfully")
    else:
        print("  WARNING: BI seed may have failed — check output above")
        print("  TIP: The seed-bi.ts may need to be compiled first")


# ═══════════════════════════════════════════════════════════════
#  PHASE 7: REBUILD BI CONTAINERS (optional)
# ═══════════════════════════════════════════════════════════════

def phase_rebuild_bi(env):
    step("Phase 7: Rebuild BI containers")
    cfg = ENVS[env]
    deploy = cfg["deploy_dir"]

    for tool in BI_CONTAINERS:
        print(f"  Rebuilding {tool}...")
        run(cfg["vm_app"],
            f"cd {deploy} && docker compose up -d --build --force-recreate --no-deps {tool}",
            timeout=600, label=f"rebuild-{tool}")
        time.sleep(5)


# ═══════════════════════════════════════════════════════════════
#  PHASE 8: SUMMARY
# ═══════════════════════════════════════════════════════════════

def phase_summary(env, results):
    step("SUMMARY")
    cfg = ENVS[env]
    domain = cfg["domain"]
    subdomains = BI_SUBDOMAINS[env]

    print(f"  Environment: {env.upper()}")
    print(f"  Domain:      {domain}")
    print()
    print("  BI Tool Status:")
    for tool in BI_CONTAINERS:
        status = results.get(tool, "UNKNOWN")
        icon = "OK" if status == "OK" else "FAIL"
        subdomain = subdomains[tool]
        print(f"    {icon}: {tool:12s} -> {subdomain}")

    print()
    print("  Next.js Pages:")
    print(f"    https://{domain}/bi-tools           <- BI Tools hub")
    print(f"    https://{domain}/bi-tools/superset  <- Superset embed")
    print(f"    https://{domain}/bi-tools/metabase  <- Metabase embed")
    print(f"    https://{domain}/bi-tools/grafana   <- Grafana embed")
    print()
    print("  If /bi-tools/* still returns 404, clear browser cache or hard-refresh.")
    print()


# ═══════════════════════════════════════════════════════════════
#  MAIN
# ═══════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(description="ARIS BI Tools Deploy & Verify")
    parser.add_argument("--env", choices=["prod", "staging"], default="prod",
                        help="Target environment (default: prod)")
    parser.add_argument("--verify-only", action="store_true",
                        help="Skip web rebuild, only verify BI containers")
    parser.add_argument("--rebuild-bi", action="store_true",
                        help="Also rebuild Superset/Metabase/Grafana containers")
    parser.add_argument("--skip-seed", action="store_true",
                        help="Skip BI seed step")
    args = parser.parse_args()

    env = args.env
    banner(f"ARIS 4.0 — BI Tools Deployment ({env.upper()})")

    if not args.verify_only:
        phase_git_pull(env)
        phase_rebuild_web(env)

    results = phase_verify_bi_containers(env)
    phase_verify_routing(env)
    phase_verify_superset_datasource(env)

    if not args.skip_seed:
        phase_reseed_bi(env)

    if args.rebuild_bi:
        phase_rebuild_bi(env)
        results = phase_verify_bi_containers(env)

    phase_summary(env, results)


if __name__ == "__main__":
    main()
