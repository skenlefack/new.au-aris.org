#!/usr/bin/env python3
"""Seed form-builder templates (28) on STG and PROD with correct path."""
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
        "prefix": "aris-stg",
    },
    "prod": {
        "label": "PRODUCTION",
        "app_host": "10.202.101.183",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "prefix": "aris",
    },
}


def safe_print(msg):
    try:
        print(msg, flush=True)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode("ascii"), flush=True)


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
                    safe_print(f"    {decoded}")
        else:
            time.sleep(0.5)
    if buf:
        decoded = buf.decode("utf-8", "replace").rstrip()
        if decoded:
            lines.append(decoded)
            safe_print(f"    {decoded}")
    return "\n".join(lines)


def seed_env(env_key):
    env = ENVS[env_key]
    safe_print(f"\n{'='*60}")
    safe_print(f"  {env['label']} — {env['app_host']}")
    safe_print(f"{'='*60}")

    ssh = connect(env["app_host"])
    container = f"{env['prefix']}-form-builder"
    db_url = f"postgresql://aris:{env['db_pass']}@{env['db_host']}:5432/aris"

    # Check container running
    out = sudo(ssh, f"docker ps --filter name={container} --format '{{{{.Status}}}}'")
    safe_print(f"  Container: {out.strip()}")
    if "Up" not in out:
        safe_print("  ERROR: Container not running!")
        ssh.close()
        return False

    # Verify seed.js exists
    safe_print("  Checking seed.js exists...")
    out = sudo(ssh, f"docker exec {container} ls -la /app/services/form-builder/dist/seed.js 2>&1")
    safe_print(f"  {out.strip()}")

    # Run seed with correct working directory
    safe_print(f"\n  Running seed (node dist/seed.js from /app/services/form-builder)...")
    out = sudo_stream(ssh,
        f"bash -c 'docker exec "
        f"-e DATABASE_URL=\"{db_url}\" "
        f"-e DIRECT_DATABASE_URL=\"{db_url}\" "
        f"-w /app/services/form-builder "
        f"{container} node dist/seed.js 2>&1'",
        timeout=120)

    success = out and ("template" in out.lower() or "seed" in out.lower() or "upsert" in out.lower()) and "error" not in out.lower()

    if success:
        safe_print(f"\n  {env['label']} seed: OK")
    else:
        safe_print(f"\n  {env['label']} seed: POSSIBLE ISSUE (check output above)")

    ssh.close()
    return success


def main():
    results = {}
    for env_key in ["stg", "prod"]:
        results[env_key] = seed_env(env_key)

    safe_print(f"\n{'='*60}")
    safe_print("  SUMMARY")
    safe_print(f"{'='*60}")
    for env_key, ok in results.items():
        safe_print(f"  {ENVS[env_key]['label']}: {'OK' if ok else 'CHECK OUTPUT'}")


if __name__ == "__main__":
    main()
