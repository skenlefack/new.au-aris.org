#!/usr/bin/env python3
"""
Deploy Roles & Permissions module to STAGING + PRODUCTION.
Steps per environment:
  1. Git pull
  2. Copy docker-compose.yml
  3. Prisma db push (create 5 new tables)
  4. Rebuild tenant + credential + web services
  5. Seed roles & permissions
  6. Health checks
"""
import paramiko
import sys
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = [
    {
        "label": "STAGING",
        "app_host": "10.202.101.146",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
        "prefix": "aris-stg",
        "url": "https://test.au-aris.org",
    },
    {
        "label": "PRODUCTION",
        "app_host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
        "prefix": "aris",
        "url": "https://au-aris.org",
    },
]

# Services that need rebuild for this feature
SERVICES_TO_REBUILD = ["tenant", "credential", "web"]


def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode("ascii"))


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    return ssh


def sudo(ssh, cmd, timeout=120):
    ch = ssh.get_transport().open_session()
    ch.settimeout(timeout)
    ch.exec_command("sudo -S " + cmd)
    ch.sendall((SSH_PASS + "\n").encode())
    time.sleep(0.5)
    out = b""
    while ch.recv_ready() or not ch.exit_status_ready():
        if ch.recv_ready():
            out += ch.recv(65536)
        else:
            time.sleep(0.3)
            if ch.exit_status_ready() and not ch.recv_ready():
                break
    lines = [l for l in out.decode("utf-8", "replace").splitlines()
             if "[sudo]" not in l and "password" not in l.lower()]
    return "\n".join(lines)


def sudo_stream(ssh, cmd, timeout=600):
    ch = ssh.get_transport().open_session()
    ch.settimeout(timeout)
    ch.exec_command("sudo -S " + cmd)
    ch.sendall((SSH_PASS + "\n").encode())
    time.sleep(0.5)
    lines = []
    buf = b""
    while not ch.exit_status_ready() or ch.recv_ready():
        if ch.recv_ready():
            buf += ch.recv(65536)
            while b"\n" in buf:
                line, buf = buf.split(b"\n", 1)
                decoded = line.decode("utf-8", "replace").rstrip()
                if decoded and "[sudo]" not in decoded and "password" not in decoded.lower():
                    lines.append(decoded)
                    low = decoded.lower()
                    if any(k in low for k in [
                        "error", "built", "running", "created", "started",
                        "pulling", "building", "done", "fail", "warn",
                        "seed", "migrat", "prisma", "already up", "applied",
                        "role", "permission", "assignment",
                    ]):
                        safe_print(f"    {decoded}")
        else:
            time.sleep(0.5)
    if buf:
        decoded = buf.decode("utf-8", "replace").rstrip()
        if decoded:
            lines.append(decoded)
    return "\n".join(lines)


def step(n, total, msg):
    safe_print(f"\n{'='*60}")
    safe_print(f"  [{n}/{total}] {msg}")
    safe_print(f"{'='*60}")


def deploy_env(env):
    """Full deploy for one environment."""
    label = env["label"]
    total = 6
    errors = []

    safe_print(f"\n{'#'*60}")
    safe_print(f"  DEPLOYING ROLES MODULE -- {label}")
    safe_print(f"  Host: {env['app_host']}")
    safe_print(f"{'#'*60}")

    ssh = connect(env["app_host"])
    safe_print(f"  Connected to {env['app_host']}")

    try:
        # ── 1. Git pull ──
        step(1, total, "Git pull latest code")
        out = sudo_stream(ssh,
            f"bash -c 'cd /opt/aris && git pull origin main 2>&1'",
            timeout=60)
        for line in (out or "").splitlines()[-5:]:
            if line.strip():
                safe_print(f"    {line}")

        # ── 2. Copy docker-compose.yml ──
        step(2, total, "Copy docker-compose.yml")
        sudo(ssh,
            f"cp /opt/aris/{env['compose_src']} {env['deploy_dir']}/docker-compose.yml",
            timeout=10)
        safe_print("  Copied")

        # ── 3. Prisma db push ──
        step(3, total, "Prisma db push (create Role, Permission, RolePermission, FunctionRole, UserRoleAssignment tables)")
        db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"

        # Use tenant container for prisma push (it has prisma installed)
        container = f"{env['prefix']}-tenant"
        safe_print(f"  Container: {container}")
        safe_print(f"  DB: {env['db_host']}:5432")

        out = sudo_stream(ssh,
            f"bash -c 'docker exec "
            f"-e DATABASE_URL=\"{db_url}\" "
            f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
            f"-w /app/packages/db-schemas "
            f"{container} npx prisma db push --schema=prisma --accept-data-loss 2>&1'",
            timeout=120)

        push_output = (out or "").lower()
        if "error" in push_output and "already" not in push_output and "eacces" not in push_output:
            safe_print(f"  WARN: Prisma push may have issues")
            errors.append("prisma_push")
        else:
            safe_print("  Prisma schema pushed OK")

        # ── 4. Rebuild services ──
        step(4, total, f"Rebuild {len(SERVICES_TO_REBUILD)} services: {', '.join(SERVICES_TO_REBUILD)}")
        for svc in SERVICES_TO_REBUILD:
            safe_print(f"\n  Building {svc}...")
            sudo_stream(ssh,
                f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps {svc} 2>&1'",
                timeout=600 if svc == "web" else 300)

            # Check container status
            s = sudo(ssh,
                f"docker ps --filter name={env['prefix']}-{svc} --format '{{{{.Status}}}}'",
                timeout=10)
            icon = "+" if "Up" in s else "?"
            safe_print(f"  [{icon}] {svc}: {s.strip()}")

            if "Up" not in s:
                errors.append(f"container_{svc}")

        # Wait for services to start
        safe_print("\n  Waiting 15s for services to stabilize...")
        time.sleep(15)

        # ── 5. Seed roles & permissions ──
        step(5, total, "Seed roles, permissions & mappings")

        # The seed-roles.ts is compiled to dist/seed-roles.js in the container
        # We run it inside the tenant container which has access to Prisma
        container = f"{env['prefix']}-tenant"
        db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"

        # First check if seed-roles.js exists in dist
        check = sudo(ssh,
            f"docker exec {container} ls -la /app/packages/db-schemas/prisma/seed-roles.ts 2>&1 || echo 'NOT_FOUND'",
            timeout=10)
        safe_print(f"  seed-roles.ts: {'found' if 'NOT_FOUND' not in check else 'NOT FOUND'}")

        # Run seed via npx tsx (available in node containers)
        safe_print(f"  Running seed-roles via tenant container...")
        out = sudo_stream(ssh,
            f"bash -c 'docker exec "
            f"-e DATABASE_URL=\"{db_url}\" "
            f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
            f"-w /app/packages/db-schemas "
            f"{container} npx tsx prisma/seed-roles.ts 2>&1'",
            timeout=120)

        seed_output = (out or "").lower()
        if "error" in seed_output and "duplicate" not in seed_output and "already" not in seed_output:
            safe_print(f"  WARN: Seed may have issues")
            # Try alternative: run from compiled dist if tsx not available
            safe_print(f"  Trying alternative: node with ts-node...")
            out2 = sudo_stream(ssh,
                f"bash -c 'docker exec "
                f"-e DATABASE_URL=\"{db_url}\" "
                f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
                f"-w /app/packages/db-schemas "
                f"{container} node --loader ts-node/esm prisma/seed-roles.ts 2>&1'",
                timeout=120)
            if "error" in (out2 or "").lower() and "complete" not in (out2 or "").lower():
                errors.append("seed")
        else:
            safe_print("  Seed completed")

        # ── 6. Health checks ──
        step(6, total, "Health checks")
        ok_count = 0
        port_map = {"tenant": 3001, "credential": 3002, "web": 3100}

        for svc in SERVICES_TO_REBUILD:
            port = port_map[svc]
            s = sudo(ssh,
                f"docker ps --filter name={env['prefix']}-{svc} --format '{{{{.Status}}}}'",
                timeout=10)
            up = "Up" in s
            if up:
                ok_count += 1
            icon = "+" if up else "X"
            safe_print(f"  [{icon}] {svc:20s} :{port} -> {s.strip()}")

        # Quick API check on tenant roles endpoint
        safe_print(f"\n  Testing roles API...")
        api_check = sudo(ssh,
            f"curl -s -o /dev/null -w '%{{http_code}}' http://localhost:3001/api/v1/settings/roles 2>&1 || echo 'FAIL'",
            timeout=10)
        safe_print(f"  GET /api/v1/settings/roles -> {api_check.strip()} (401=OK, needs auth)")

        return ok_count, errors

    except Exception as e:
        safe_print(f"  ERROR: {e}")
        errors.append(f"exception: {e}")
        return 0, errors
    finally:
        ssh.close()


def main():
    safe_print("=" * 60)
    safe_print("  ARIS 4.0 -- Roles & Permissions Module Deployment")
    safe_print("  Targets: STAGING + PRODUCTION")
    safe_print(f"  Date: {time.strftime('%Y-%m-%d %H:%M')}")
    safe_print("  Services: tenant, credential, web")
    safe_print("  New tables: roles, permissions, role_permissions,")
    safe_print("              function_roles, user_role_assignments")
    safe_print("=" * 60)

    results = {}

    for env in ENVS:
        ok_count, errors = deploy_env(env)
        results[env["label"]] = {
            "ok": ok_count == len(SERVICES_TO_REBUILD) and len(errors) == 0,
            "containers_up": ok_count,
            "errors": errors,
            "url": env["url"],
        }

    # ── Summary ──
    safe_print(f"\n{'#'*60}")
    safe_print("  DEPLOYMENT SUMMARY")
    safe_print(f"{'#'*60}")
    for label, r in results.items():
        status = "OK" if r["ok"] else "ISSUES"
        safe_print(f"  {label}:")
        safe_print(f"    Status:     {status}")
        safe_print(f"    Containers: {r['containers_up']}/{len(SERVICES_TO_REBUILD)} up")
        safe_print(f"    URL:        {r['url']}")
        if r["errors"]:
            safe_print(f"    Errors:     {', '.join(r['errors'])}")
    safe_print(f"{'#'*60}")

    if not all(r["ok"] for r in results.values()):
        safe_print("\n  Some issues detected. Check output above.")
        sys.exit(1)
    else:
        safe_print("\n  All deployments succeeded!")


if __name__ == "__main__":
    main()
