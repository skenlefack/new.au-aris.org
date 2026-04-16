#!/usr/bin/env python3
"""Deploy form-builder + seed to STG and PROD."""
import paramiko
import sys
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = {
    "stg": {
        "label": "STAGING",
        "app_host": "10.202.101.146",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "compose_src": "deploy/vm-app-stg/docker-compose.yml",
        "prefix": "aris-stg",
    },
    "prod": {
        "label": "PRODUCTION",
        "app_host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "compose_src": "deploy/vm-app/docker-compose.yml",
        "prefix": "aris",
    },
}


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
                        "building", "done", "fail", "warn", "seed", "template"
                    ]):
                        safe_print(f"    {decoded}")
        else:
            time.sleep(0.5)
    if buf:
        decoded = buf.decode("utf-8", "replace").rstrip()
        if decoded:
            lines.append(decoded)
    return "\n".join(lines)


def deploy_env(env_key):
    env = ENVS[env_key]
    safe_print(f"\n{'='*60}")
    safe_print(f"  {env['label']} — {env['app_host']}")
    safe_print(f"{'='*60}")

    ssh = connect(env["app_host"])
    safe_print(f"  Connected")

    # 1. Git pull
    safe_print("\n  [1/4] Git pull...")
    sudo_stream(ssh, f"bash -c 'cd /opt/aris && git pull origin main 2>&1'", timeout=60)

    # 2. Copy docker-compose.yml
    safe_print("  [2/4] Copy docker-compose.yml...")
    sudo(ssh, f"cp /opt/aris/{env['compose_src']} {env['deploy_dir']}/docker-compose.yml")

    # 3. Rebuild form-builder
    safe_print("  [3/4] Rebuild form-builder...")
    sudo_stream(ssh,
        f"bash -c 'cd {env['deploy_dir']} && docker compose up -d --build --no-deps form-builder 2>&1'",
        timeout=300)
    s = sudo(ssh, f"docker ps --filter name={env['prefix']}-form-builder --format '{{{{.Status}}}}'")
    safe_print(f"  form-builder: {s}")

    # 4. Seed form templates
    safe_print("  [4/4] Seed form templates (28 templates)...")
    db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"
    container = f"{env['prefix']}-form-builder"

    out = sudo_stream(ssh,
        f"bash -c 'docker exec "
        f"-e DATABASE_URL=\"{db_url}\" "
        f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
        f"-w /app/services/form-builder "
        f"{container} node dist/seed.js 2>&1'",
        timeout=120)
    for line in (out or "").splitlines()[-15:]:
        if line.strip():
            safe_print(f"    {line}")

    ssh.close()
    safe_print(f"  {env['label']} DONE")


def main():
    for env_key in ["stg", "prod"]:
        deploy_env(env_key)

    safe_print(f"\n{'='*60}")
    safe_print("  Form-builder deployed + seeded on STG & PROD")
    safe_print(f"{'='*60}")


if __name__ == "__main__":
    main()
