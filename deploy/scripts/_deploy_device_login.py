#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy: Multiple-connection control + device login notifications.

Steps per environment:
  1. Upload 8 changed source files  → /opt/aris/...
  2. Prisma db push                 → creates user_devices table
  3. Re-seed settings               → adds 2 new security.session.* configs
  4. Rebuild credential + message
  5. Health check

Usage:
  python _deploy_device_login.py          # stg + prod
  python _deploy_device_login.py stg
  python _deploy_device_login.py prod
"""
import os, sys, time, paramiko

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT  = os.path.dirname(os.path.dirname(SCRIPT_DIR))

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "stg": {
        "ip":          "10.202.101.146",
        "compose_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
        "prefix":      "aris-stg",
        "db_url":      "postgresql://aris:Ar1s_Stg_2024!xK9mZ@10.202.101.148:5432/aris",
    },
    "prod": {
        "ip":          "10.202.101.183",
        "compose_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
        "prefix":      "aris",
        "db_url":      "postgresql://aris:Ar1s_Pr0d_2024!xK9mZ@10.202.101.185:5432/aris",
    },
}

# local relative path → remote path under /opt/aris/
UPLOAD_FILES = [
    "packages/shared-types/src/kafka/topic-names.ts",
    "packages/db-schemas/prisma/credential.prisma",
    "packages/db-schemas/prisma/seed-settings.ts",
    "services/credential/src/services/auth.service.ts",
    "services/credential/src/routes/auth.routes.ts",
    "services/message/src/services/template-engine.ts",
    "services/message/src/templates/email/new-device-login.hbs",
    "services/message/src/consumers/notification.consumer.ts",
]

REBUILD = ["credential", "message"]


# ── Helpers ───────────────────────────────────────────────────────────────────

def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def connect(ip):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(ip, username=SSH_USER, password=SSH_PASS, timeout=15,
              allow_agent=False, look_for_keys=False)
    return c


def run_sudo(client, cmd, timeout=300):
    """
    Run: sudo -S bash -c '<cmd>'
    The single-quoted outer wrapper avoids inner-quote conflicts with docker exec.
    Returns (exit_code, stdout_lines_str, stderr_str).
    """
    # Escape any single quotes in cmd (should be none in our commands)
    full = f"echo '{SSH_PASS}' | sudo -S bash -c '{cmd}'"
    stdin, stdout, stderr = client.exec_command(full, timeout=timeout)
    stdin.channel.shutdown_write()

    lines = []
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"      {line}")
            lines.append(line)

    code = stdout.channel.recv_exit_status()
    err  = stderr.read().decode("utf-8", errors="replace")
    err  = "\n".join(l for l in err.splitlines()
                     if "[sudo]" not in l and "password" not in l.lower())
    if code != 0 and err.strip():
        for line in err.strip().splitlines()[:5]:
            safe_print(f"      [ERR] {line}")
    return code, "\n".join(lines), err


def docker_run(client, container, inner_cmd, db_url=None, workdir=None, timeout=180):
    """
    Run a command inside a Docker container.
    Uses: docker exec [-w workdir] [-e DATABASE_URL=...] <container> sh -c "<inner_cmd>"
    The inner_cmd must use only double-quoted strings internally.
    """
    parts = ["docker exec"]
    if workdir:
        parts.append(f"-w {workdir}")
    if db_url:
        parts.append(f'-e DATABASE_URL="{db_url}"')
    parts.append(container)
    # Use sh -c with double-quoting; inner_cmd must not contain single quotes
    parts.append(f'sh -c "{inner_cmd}"')
    cmd = " ".join(parts)
    return run_sudo(client, cmd, timeout=timeout)


# ── Deployment steps ──────────────────────────────────────────────────────────

def step_upload(client):
    safe_print(f"\n  [1/5] Uploading {len(UPLOAD_FILES)} source files...")
    sftp = client.open_sftp()
    ok = 0
    for rel in UPLOAD_FILES:
        local  = os.path.join(REPO_ROOT, rel.replace("/", os.sep))
        tmp    = f"/tmp/aris_deploy_{rel.replace('/', '__')}"
        remote = f"/opt/aris/{rel}"
        rdir   = "/".join(remote.split("/")[:-1])
        if not os.path.exists(local):
            safe_print(f"    WARNING local not found: {local}")
            continue
        sftp.put(local, tmp)
        code, _, _ = run_sudo(client, f"mkdir -p {rdir} && cp {tmp} {remote} && rm -f {tmp}",
                              timeout=30)
        icon = "OK" if code == 0 else "FAIL"
        safe_print(f"    [{icon}] {rel}")
        if code == 0:
            ok += 1
    sftp.close()
    safe_print(f"    Uploaded {ok}/{len(UPLOAD_FILES)} files")


def step_prisma_push(client, prefix, db_url):
    safe_print(f"\n  [2/5] Prisma db push (creates user_devices table)...")
    container = f"{prefix}-tenant"
    # Must cd to the db-schemas folder which has the prisma/ sub-folder
    inner = "cd /app/packages/db-schemas && npx prisma db push --schema=prisma --accept-data-loss 2>&1"
    code, out, err = docker_run(client, container, inner, db_url=db_url, timeout=120)
    status = "OK" if code == 0 else f"FAILED (code={code})"
    safe_print(f"    Prisma push: {status}")
    return code == 0


def step_seed_settings(client, prefix, db_url):
    safe_print(f"\n  [3/5] Seeding new security settings...")
    container = f"{prefix}-tenant"
    inner = "cd /app/packages/db-schemas && npx tsx prisma/seed-settings.ts 2>&1"
    code, out, err = docker_run(client, container, inner, db_url=db_url, timeout=180)
    status = "OK" if code == 0 else f"FAILED (code={code})"
    safe_print(f"    Settings seed: {status}")

    # Verify
    safe_print(f"    Verifying new configs in DB...")
    pg = f"{prefix}-postgres"
    vsql = "SELECT key FROM governance.system_configs WHERE key LIKE 'security.session.%' ORDER BY key"
    code2, out2, _ = run_sudo(client,
        f'docker exec {pg} psql -U aris -d aris -t -c "{vsql}" 2>/dev/null',
        timeout=15)
    if code2 == 0 and out2.strip():
        for row in out2.strip().splitlines():
            safe_print(f"      {row.strip()}")
    else:
        safe_print(f"      (could not verify — DB container: {pg})")


def step_rebuild(client, prefix, compose_dir, compose_src):
    safe_print(f"\n  [4/5] Copying docker-compose.yml...")
    run_sudo(client, f"cp /opt/aris/{compose_src} {compose_dir}/docker-compose.yml", timeout=15)

    safe_print(f"\n  [4/5] Rebuilding: {', '.join(REBUILD)}...")
    for svc in REBUILD:
        safe_print(f"\n    --- {svc} ---")
        run_sudo(client,
            f"docker compose -f {compose_dir}/docker-compose.yml up -d --build --no-deps {svc} 2>&1",
            timeout=600)


def step_health(client, prefix):
    safe_print(f"\n  [5/5] Health check (waiting 10s)...")
    time.sleep(10)
    for svc in REBUILD:
        name = f"{prefix}-{svc}"
        code, out, _ = run_sudo(client,
            f"docker ps --filter name=^/{name}$ --format {{{{.Status}}}}",
            timeout=15)
        status = out.strip() or "NOT FOUND"
        icon = "OK" if status.startswith("Up") else "!!"
        safe_print(f"    [{icon}] {name}: {status}")


# ── Main ──────────────────────────────────────────────────────────────────────

def deploy_env(env_key):
    cfg = ENVS[env_key]
    safe_print(f"\n{'='*62}")
    safe_print(f"  DEPLOYING TO {env_key.upper()} ({cfg['ip']})")
    safe_print(f"  device-login + multi-connection security feature")
    safe_print(f"{'='*62}")

    try:
        client = connect(cfg["ip"])
        safe_print(f"  Connected to {cfg['ip']}")
    except Exception as e:
        safe_print(f"  CANNOT CONNECT: {e}")
        return

    try:
        step_upload(client)
        step_prisma_push(client, cfg["prefix"], cfg["db_url"])
        step_seed_settings(client, cfg["prefix"], cfg["db_url"])
        step_rebuild(client, cfg["prefix"], cfg["compose_dir"], cfg["compose_src"])
        step_health(client, cfg["prefix"])
        safe_print(f"\n  {env_key.upper()} COMPLETE!")
    except Exception as e:
        safe_print(f"\n  ERROR: {e}")
        import traceback; traceback.print_exc()
    finally:
        client.close()


def main():
    targets = sys.argv[1:] if len(sys.argv) > 1 else ["stg", "prod"]
    for env in targets:
        if env not in ENVS:
            safe_print(f"Unknown env '{env}'. Use: stg, prod")
            continue
        deploy_env(env)
    safe_print(f"\n{'='*62}\n  ALL DONE\n{'='*62}")


if __name__ == "__main__":
    main()
