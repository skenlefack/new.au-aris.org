#!/usr/bin/env python3
"""
ARIS 4.0 — Deploy VM-AI (nbo-ai01)
====================================
Deploys Docker Compose stack (Python ML, NiFi, Prometheus, Grafana)
to the AI VM at 10.202.101.142.

Usage:
  python deploy/scripts/_deploy_vm_ai.py
  python deploy/scripts/_deploy_vm_ai.py --build-only   # Build without starting
  python deploy/scripts/_deploy_vm_ai.py --check         # Health check only
"""
import argparse
import sys
import time

import paramiko

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# ── Connection ─────────────────────────────────────────────────
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
AI_HOST = "10.202.101.142"

GIT_DIR = "/opt/aris"
DEPLOY_DIR = "/opt/aris-deploy/vm-ai"
COMPOSE_SRC = "deploy/vm-ai/docker-compose.yml"


def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode("ascii"))


def connect():
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(AI_HOST, username=SSH_USER, password=SSH_PASS, timeout=15)
    safe_print(f"[OK] Connected to {AI_HOST}")
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
             if not l.startswith("[sudo]")]
    return "\n".join(lines), ch.recv_exit_status()


def run(ssh, cmd, timeout=120):
    _, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", "replace").strip()
    err = stderr.read().decode("utf-8", "replace").strip()
    rc = stdout.channel.recv_exit_status()
    return out, err, rc


# ── Steps ──────────────────────────────────────────────────────

def step_git_pull(ssh):
    safe_print("\n=== Step 1: Git pull ===")
    out, rc = sudo(ssh, f"bash -c 'cd {GIT_DIR} && git fetch origin && git reset --hard origin/main'")
    safe_print(out[-500:] if len(out) > 500 else out)
    if rc != 0:
        safe_print(f"[WARN] git pull exit code: {rc}")
    else:
        safe_print("[OK] Git pull done")


def step_setup_deploy_dir(ssh):
    safe_print("\n=== Step 2: Setup deploy directory ===")
    cmds = [
        f"mkdir -p {DEPLOY_DIR}/prometheus",
        f"cp {GIT_DIR}/{COMPOSE_SRC} {DEPLOY_DIR}/docker-compose.yml",
        f"cp {GIT_DIR}/deploy/vm-ai/prometheus/prometheus.yml {DEPLOY_DIR}/prometheus/prometheus.yml",
    ]
    for cmd in cmds:
        out, rc = sudo(ssh, f"bash -c '{cmd}'")
        if rc != 0:
            safe_print(f"[WARN] Failed: {cmd}")
            safe_print(out)
        else:
            safe_print(f"  [OK] {cmd.split('/')[-1] if '/' in cmd else cmd[:60]}")
    safe_print("[OK] Deploy dir ready")


def step_docker_compose_up(ssh, build_only=False):
    safe_print("\n=== Step 3: Docker Compose ===")
    action = "build" if build_only else "up -d --build"
    cmd = f"bash -c 'cd {DEPLOY_DIR} && docker compose {action}'"
    out, rc = sudo(ssh, cmd, timeout=600)
    safe_print(out[-1000:] if len(out) > 1000 else out)
    if rc != 0:
        safe_print(f"[ERROR] docker compose {action} failed (exit {rc})")
        return False
    safe_print(f"[OK] docker compose {action} done")
    return True


def step_check_health(ssh):
    safe_print("\n=== Step 4: Health checks ===")
    time.sleep(10)  # Wait for containers to start

    checks = [
        ("python-ml", "curl -sf http://localhost:8000/health"),
        ("prometheus", "curl -sf http://localhost:9090/-/healthy"),
        ("grafana", "curl -sf http://localhost:3000/api/health"),
        ("ollama", "curl -sf http://localhost:11434/api/tags"),
    ]
    all_ok = True
    for name, cmd in checks:
        out, err, rc = run(ssh, cmd)
        status = "OK" if rc == 0 else "FAIL"
        if rc != 0:
            all_ok = False
        safe_print(f"  [{status}] {name}: {out[:100] if out else err[:100]}")

    # Container status
    out, err, rc = run(ssh, f"cd {DEPLOY_DIR} && docker compose ps --format 'table {{{{.Name}}}}\\t{{{{.Status}}}}'")
    safe_print(f"\n{out}")

    return all_ok


def step_check_ollama_models(ssh):
    safe_print("\n=== Step 5: Ollama models ===")
    out, err, rc = run(ssh, "curl -sf http://localhost:11434/api/tags")
    safe_print(f"  Models: {out[:300] if out else 'Ollama not reachable'}")


# ── Main ───────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Deploy ARIS VM-AI stack")
    parser.add_argument("--build-only", action="store_true", help="Build images only")
    parser.add_argument("--check", action="store_true", help="Health check only")
    args = parser.parse_args()

    safe_print("=" * 60)
    safe_print("ARIS 4.0 — VM-AI Deploy (nbo-ai01)")
    safe_print("=" * 60)

    ssh = connect()

    try:
        if args.check:
            step_check_health(ssh)
            step_check_ollama_models(ssh)
        else:
            step_git_pull(ssh)
            step_setup_deploy_dir(ssh)
            step_docker_compose_up(ssh, build_only=args.build_only)
            if not args.build_only:
                ok = step_check_health(ssh)
                step_check_ollama_models(ssh)
                if not ok:
                    safe_print("\n[WARN] Some health checks failed — check logs")
                else:
                    safe_print("\n[OK] All services healthy!")
    finally:
        ssh.close()
        safe_print("\n[OK] SSH closed")


if __name__ == "__main__":
    main()
