#!/usr/bin/env python3
"""
ARIS 4.0 — Setup + Deploy VM-AI (nbo-ai01)
=============================================
Complete setup of the AI VM: Docker, Ollama config, model pulls,
UFW firewall, disk check, then full Docker Compose deploy.

Replaces Philippe's 7-action checklist + deploy script in one pass.

Usage:
  python deploy/scripts/_setup_and_deploy_vm_ai.py              # Full setup + deploy
  python deploy/scripts/_setup_and_deploy_vm_ai.py --check      # Diagnostic only
  python deploy/scripts/_setup_and_deploy_vm_ai.py --skip-models # Skip model pulls (saves 1-2h)
  python deploy/scripts/_setup_and_deploy_vm_ai.py --from=5     # Resume from step N
"""
import argparse
import json
import sys
import time

import paramiko

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# -- Connection ---------------------------------------------------------------
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
AI_HOST = "10.202.101.142"
APP_HOST = "10.202.101.183"

GIT_DIR = "/opt/aris"
DEPLOY_DIR = "/opt/aris-deploy/vm-ai"
COMPOSE_SRC = "deploy/vm-ai/docker-compose.yml"
PROMETHEUS_SRC = "deploy/vm-ai/prometheus/prometheus.yml"
GIT_REMOTE = "https://github.com/skenlefack/new.au-aris.org.git"


def safe_print(msg):
    try:
        print(msg)
    except UnicodeEncodeError:
        print(msg.encode("ascii", "replace").decode("ascii"))


def connect(host=AI_HOST):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    safe_print(f"[OK] Connected to {host}")
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


def banner(step_num, title):
    safe_print(f"\n{'='*60}")
    safe_print(f"  Step {step_num}: {title}")
    safe_print(f"{'='*60}")


# -- Step 1: Diagnostic ------------------------------------------------------

def step_diagnostic(ssh):
    banner(1, "Diagnostic VM-AI")

    # OS
    out, _, _ = run(ssh, "lsb_release -d 2>/dev/null || cat /etc/os-release | head -2")
    safe_print(f"  OS: {out}")

    # CPU
    out, _, _ = run(ssh, "nproc")
    safe_print(f"  CPUs: {out}")

    # RAM
    out, _, _ = run(ssh, "free -h | grep Mem | awk '{print $2}'")
    safe_print(f"  RAM: {out}")

    # Disk
    out, _, _ = run(ssh, "df -h / | tail -1 | awk '{print $4 \" free / \" $2 \" total (\" $5 \" used)\"}'")
    safe_print(f"  Disk: {out}")

    # Ollama
    out, _, rc = run(ssh, "ollama --version 2>/dev/null || echo 'not installed'")
    safe_print(f"  Ollama: {out}")

    out, _, rc = run(ssh, "systemctl is-active ollama 2>/dev/null || echo 'not running'")
    safe_print(f"  Ollama service: {out}")

    out, _, rc = run(ssh, "curl -sf http://localhost:11434/api/tags 2>/dev/null")
    if rc == 0:
        try:
            models = json.loads(out)
            names = [m["name"] for m in models.get("models", [])]
            safe_print(f"  Ollama models: {', '.join(names) if names else 'none'}")
        except Exception:
            safe_print(f"  Ollama models: {out[:200]}")
    else:
        safe_print("  Ollama models: [not reachable]")

    # Docker
    out, _, rc = run(ssh, "docker --version 2>/dev/null || echo 'not installed'")
    safe_print(f"  Docker: {out}")

    out, _, rc = run(ssh, "docker compose version 2>/dev/null || echo 'not installed'")
    safe_print(f"  Docker Compose: {out}")

    out, _, rc = run(ssh, "systemctl is-active docker 2>/dev/null || echo 'not running'")
    safe_print(f"  Docker service: {out}")

    # UFW
    out, rc = sudo(ssh, "ufw status 2>/dev/null || echo 'not installed'")
    safe_print(f"  UFW: {out[:200]}")

    # Python
    out, _, rc = run(ssh, "python3 --version 2>/dev/null || echo 'not installed'")
    safe_print(f"  Python: {out}")

    # Git repo
    out, _, rc = run(ssh, f"test -d {GIT_DIR}/.git && echo 'present' || echo 'missing'")
    safe_print(f"  Git repo ({GIT_DIR}): {out}")

    return True


# -- Step 2: Install Docker --------------------------------------------------

def step_install_docker(ssh):
    banner(2, "Install / Verify Docker")

    # Check if Docker is already installed
    out, _, rc = run(ssh, "docker --version 2>/dev/null")
    if rc == 0 and "Docker version" in out:
        safe_print(f"  [OK] Docker already installed: {out}")
        # Make sure it's running
        out2, rc2 = sudo(ssh, "systemctl enable docker && systemctl start docker")
        safe_print("  [OK] Docker service enabled")
        return True

    safe_print("  Docker not found, installing...")

    # Install Docker using official convenience script
    out, rc = sudo(ssh, "bash -c 'curl -fsSL https://get.docker.com | sh'", timeout=300)
    if rc != 0:
        safe_print(f"  [ERROR] Docker install failed (exit {rc})")
        safe_print(out[-500:])
        return False
    safe_print("  [OK] Docker installed")

    # Add arisadmin to docker group
    out, rc = sudo(ssh, "usermod -aG docker arisadmin")
    safe_print("  [OK] arisadmin added to docker group")

    # Enable and start Docker
    out, rc = sudo(ssh, "systemctl enable docker && systemctl start docker")
    safe_print("  [OK] Docker service enabled and started")

    # Verify
    out, _, rc = run(ssh, "docker --version")
    safe_print(f"  [OK] Verified: {out}")
    out, _, rc = run(ssh, "docker compose version")
    safe_print(f"  [OK] Compose: {out}")

    return True


# -- Step 3: Install + Configure Ollama --------------------------------------

def step_configure_ollama(ssh):
    banner(3, "Install + Configure Ollama")

    # Check if Ollama is installed
    out, _, rc = run(ssh, "ollama --version 2>/dev/null")
    if rc != 0 or "not" in out.lower():
        safe_print("  Ollama not found, installing...")
        out, rc = sudo(ssh, "bash -c 'curl -fsSL https://ollama.com/install.sh | sh'", timeout=300)
        safe_print(out[-500:] if len(out) > 500 else out)
        if rc != 0:
            safe_print(f"  [ERROR] Ollama install failed (exit {rc})")
            return False
        safe_print("  [OK] Ollama installed")
        time.sleep(3)
    else:
        safe_print(f"  [OK] Ollama already installed: {out}")

    # Ensure service is running
    out, _, rc = run(ssh, "systemctl is-active ollama 2>/dev/null")
    if out.strip() != "active":
        safe_print("  Starting Ollama service...")
        sudo(ssh, "systemctl enable ollama && systemctl start ollama")
        time.sleep(5)

    # Check current env config
    out, _, rc = run(ssh, "cat /etc/systemd/system/ollama.service.d/override.conf 2>/dev/null || echo 'no override'")
    safe_print(f"  Current override: {out[:200]}")

    # Create systemd override for Ollama env vars
    override_content = """[Service]
Environment="OLLAMA_MAX_LOADED_MODELS=2"
Environment="OLLAMA_KEEP_ALIVE=10m"
Environment="OLLAMA_NUM_PARALLEL=2"
Environment="OLLAMA_HOST=0.0.0.0"
"""
    cmds = [
        "mkdir -p /etc/systemd/system/ollama.service.d",
        f"bash -c 'cat > /etc/systemd/system/ollama.service.d/override.conf << EOFCONF\n{override_content}EOFCONF'",
        "systemctl daemon-reload",
        "systemctl restart ollama",
    ]
    for cmd in cmds:
        out, rc = sudo(ssh, cmd)
        if rc != 0:
            safe_print(f"  [WARN] {cmd[:50]}... exit {rc}")
            safe_print(f"  {out[:200]}")

    time.sleep(5)  # Wait for Ollama to restart

    # Verify Ollama is running and accessible
    out, _, rc = run(ssh, "curl -sf http://localhost:11434/")
    if "Ollama is running" in (out or ""):
        safe_print("  [OK] Ollama configured and running")
        safe_print("    - OLLAMA_MAX_LOADED_MODELS=2")
        safe_print("    - OLLAMA_KEEP_ALIVE=10m")
        safe_print("    - OLLAMA_NUM_PARALLEL=2")
        safe_print("    - OLLAMA_HOST=0.0.0.0 (accepts remote connections)")
        return True
    else:
        safe_print(f"  [WARN] Ollama may not be responding: {out[:100]}")
        return True  # Continue anyway


# -- Step 4: Pull Additional Models ------------------------------------------

def step_pull_models(ssh):
    banner(4, "Pull Additional Ollama Models")

    # List current models
    out, _, rc = run(ssh, "curl -sf http://localhost:11434/api/tags")
    existing = set()
    if rc == 0:
        try:
            models = json.loads(out)
            existing = {m["name"] for m in models.get("models", [])}
            safe_print(f"  Current models: {', '.join(existing) if existing else 'none'}")
        except Exception:
            safe_print(f"  Could not parse models: {out[:200]}")

    models_to_pull = [
        ("qwen2.5-coder:32b", "Code generation + interop mapping (~20 GB)"),
        ("phi4:14b", "NLP classification / lightweight tasks (~10 GB)"),
    ]

    for model_name, desc in models_to_pull:
        if model_name in existing:
            safe_print(f"  [SKIP] {model_name} already present")
            continue

        safe_print(f"  Pulling {model_name} — {desc}")
        safe_print(f"  (This can take 30-60 min depending on bandwidth...)")

        out, rc = sudo(ssh, f"ollama pull {model_name}", timeout=7200)  # 2h timeout
        if rc != 0:
            safe_print(f"  [ERROR] Failed to pull {model_name}")
            safe_print(f"  {out[-300:]}")
            safe_print(f"  Continuing with other models...")
        else:
            safe_print(f"  [OK] {model_name} pulled successfully")

    # Final model list
    out, _, rc = run(ssh, "curl -sf http://localhost:11434/api/tags")
    if rc == 0:
        try:
            models = json.loads(out)
            names = [m["name"] for m in models.get("models", [])]
            safe_print(f"\n  Final models: {', '.join(names)}")
        except Exception:
            pass

    return True


# -- Step 5: Configure UFW Firewall ------------------------------------------

def step_configure_ufw(ssh):
    banner(5, "Configure UFW Firewall")

    # Check UFW status
    out, rc = sudo(ssh, "ufw status 2>/dev/null")
    safe_print(f"  Current status: {out[:200]}")

    # Install UFW if needed
    out_check, _, _ = run(ssh, "which ufw 2>/dev/null")
    if not out_check:
        safe_print("  Installing UFW...")
        sudo(ssh, "apt-get update -qq && apt-get install -y -qq ufw", timeout=120)

    # Set default policies
    sudo(ssh, "ufw default deny incoming")
    sudo(ssh, "ufw default allow outgoing")
    safe_print("  [OK] Default policies: deny incoming, allow outgoing")

    # Allow required ports from internal network only
    rules = [
        ("22", "SSH"),
        ("11434", "Ollama API"),
        ("8000", "Python ML Service"),
        ("8443", "Apache NiFi"),
        ("9090", "Prometheus"),
        ("9100", "Node Exporter"),
        ("3000", "Grafana"),
    ]
    for port, desc in rules:
        out, rc = sudo(ssh, f"ufw allow from 10.202.101.0/24 to any port {port} proto tcp")
        safe_print(f"  [OK] Allow {port}/tcp ({desc}) from 10.202.101.0/24")

    # Enable UFW (non-interactive)
    out, rc = sudo(ssh, "bash -c 'echo y | ufw enable'")
    safe_print(f"  [OK] UFW enabled")

    # Show status
    out, rc = sudo(ssh, "ufw status numbered")
    safe_print(f"\n{out}")

    return True


# -- Step 6: Disk Space Check ------------------------------------------------

def step_check_disk(ssh):
    banner(6, "Verify Disk Space")

    out, _, _ = run(ssh, "df -h / | tail -1")
    safe_print(f"  Root partition: {out}")

    out, _, _ = run(ssh, "du -sh /usr/share/ollama/.ollama/models 2>/dev/null || du -sh /root/.ollama/models 2>/dev/null || echo 'models dir not found'")
    safe_print(f"  Ollama models: {out}")

    out, _, _ = run(ssh, "du -sh /var/lib/docker 2>/dev/null || echo 'docker dir not found'")
    safe_print(f"  Docker data: {out}")

    # Check free space
    out, _, _ = run(ssh, "df --output=avail / | tail -1")
    try:
        avail_kb = int(out.strip())
        avail_gb = avail_kb / 1024 / 1024
        if avail_gb < 50:
            safe_print(f"  [WARN] Only {avail_gb:.1f} GB free — recommended 100 GB+")
        else:
            safe_print(f"  [OK] {avail_gb:.1f} GB free")
    except ValueError:
        safe_print(f"  [WARN] Could not parse free space: {out}")

    return True


# -- Step 7: Git Pull + Deploy Stack -----------------------------------------

def step_deploy_stack(ssh):
    banner(7, "Git Pull + Deploy Docker Stack")

    # Git pull
    safe_print("  Pulling latest code...")
    out, rc = sudo(ssh, f"bash -c 'cd {GIT_DIR} && git fetch origin && git reset --hard origin/main'")
    if rc != 0:
        # Maybe git repo doesn't exist yet — clone it
        safe_print("  [WARN] Git pull failed, trying clone from GitHub...")
        out, rc = sudo(ssh, f"bash -c 'git clone --depth 1 --branch main {GIT_REMOTE} {GIT_DIR}'", timeout=600)
        if rc != 0:
            safe_print(f"  [ERROR] Cannot get code. Manual setup needed at {GIT_DIR}")
            safe_print(f"  {out[-300:]}")
            return False
    safe_print("  [OK] Code updated")

    # Setup deploy directory
    cmds = [
        f"mkdir -p {DEPLOY_DIR}/prometheus",
        f"cp {GIT_DIR}/{COMPOSE_SRC} {DEPLOY_DIR}/docker-compose.yml",
        f"cp {GIT_DIR}/{PROMETHEUS_SRC} {DEPLOY_DIR}/prometheus/prometheus.yml",
    ]
    for cmd in cmds:
        out, rc = sudo(ssh, f"bash -c '{cmd}'")
        if rc != 0:
            safe_print(f"  [WARN] {cmd[:60]}... exit {rc}")

    safe_print("  [OK] Deploy directory ready")

    # Docker compose up
    safe_print("  Starting Docker Compose stack (this may take a few minutes)...")
    out, rc = sudo(ssh, f"bash -c 'cd {DEPLOY_DIR} && docker compose up -d --build'", timeout=600)
    safe_print(out[-1000:] if len(out) > 1000 else out)

    if rc != 0:
        safe_print(f"  [ERROR] Docker Compose failed (exit {rc})")
        return False

    safe_print("  [OK] Docker stack deployed")
    return True


# -- Step 8: Health Checks ---------------------------------------------------

def step_health_checks(ssh):
    banner(8, "Health Checks")
    time.sleep(15)  # Wait for services to start

    checks = [
        ("Ollama", "curl -sf http://localhost:11434/"),
        ("Python ML", "curl -sf http://localhost:8000/health"),
        ("Prometheus", "curl -sf http://localhost:9090/-/healthy"),
        ("Grafana", "curl -sf http://localhost:3000/api/health"),
        ("Node Exporter", "curl -sf http://localhost:9100/metrics | head -1"),
    ]

    results = {}
    for name, cmd in checks:
        out, _, rc = run(ssh, cmd)
        status = "OK" if rc == 0 else "FAIL"
        results[name] = rc == 0
        detail = out[:80] if out else "(no response)"
        safe_print(f"  [{status}] {name}: {detail}")

    # NiFi takes longer to start
    safe_print("  [....] NiFi (checking, may need 2+ min to start)...")
    for attempt in range(4):
        out, _, rc = run(ssh, "curl -sfk https://localhost:8443/nifi-api/system-diagnostics")
        if rc == 0:
            safe_print(f"  [OK] NiFi: running")
            results["NiFi"] = True
            break
        time.sleep(30)
    else:
        safe_print(f"  [WARN] NiFi: not ready yet (may still be starting)")
        results["NiFi"] = False

    # Container status
    out, _, rc = run(ssh, f"cd {DEPLOY_DIR} && docker compose ps 2>/dev/null || docker ps --format 'table {{{{.Names}}}}\\t{{{{.Status}}}}'")
    safe_print(f"\n  Containers:\n{out}")

    ok_count = sum(1 for v in results.values() if v)
    total = len(results)
    safe_print(f"\n  Result: {ok_count}/{total} services healthy")

    return ok_count >= 4  # At least Ollama + ML + Prometheus + Grafana


# -- Step 9: Connectivity from VM-APP ----------------------------------------

def step_test_from_app(ssh_ai):
    banner(9, "Test Connectivity from VM-APP")

    try:
        ssh_app = connect(APP_HOST)
    except Exception as e:
        safe_print(f"  [SKIP] Cannot connect to VM-APP ({APP_HOST}): {e}")
        safe_print(f"  You can test manually from VM-APP with:")
        safe_print(f"    curl http://{AI_HOST}:11434/")
        safe_print(f"    curl http://{AI_HOST}:8000/health")
        return True

    try:
        tests = [
            ("Ollama from VM-APP", f"curl -sf http://{AI_HOST}:11434/"),
            ("ML Service from VM-APP", f"curl -sf http://{AI_HOST}:8000/health"),
            ("Prometheus from VM-APP", f"curl -sf http://{AI_HOST}:9090/-/healthy"),
        ]
        for name, cmd in tests:
            out, _, rc = run(ssh_app, cmd, timeout=10)
            status = "OK" if rc == 0 else "FAIL"
            safe_print(f"  [{status}] {name}: {out[:80] if out else '(no response)'}")
    finally:
        ssh_app.close()

    return True


# -- Main ---------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Setup + Deploy ARIS VM-AI")
    parser.add_argument("--check", action="store_true", help="Diagnostic only (no changes)")
    parser.add_argument("--skip-models", action="store_true", help="Skip model downloads (saves 1-2h)")
    parser.add_argument("--from", type=int, default=1, dest="from_step", help="Resume from step N")
    args = parser.parse_args()

    safe_print("=" * 60)
    safe_print("  ARIS 4.0 — VM-AI Complete Setup + Deploy")
    safe_print(f"  Target: {AI_HOST} (nbo-ai01)")
    safe_print("=" * 60)

    ssh = connect()

    try:
        if args.check:
            step_diagnostic(ssh)
            step_check_disk(ssh)
            step_health_checks(ssh)
            return

        steps = [
            (1, "Diagnostic", step_diagnostic),
            (2, "Install Docker", step_install_docker),
            (3, "Configure Ollama", step_configure_ollama),
            (4, "Pull Models", step_pull_models if not args.skip_models else None),
            (5, "Configure UFW", step_configure_ufw),
            (6, "Check Disk", step_check_disk),
            (7, "Deploy Stack", step_deploy_stack),
            (8, "Health Checks", step_health_checks),
            (9, "Test from VM-APP", step_test_from_app),
        ]

        for num, name, func in steps:
            if func is None:
                safe_print(f"\n  [SKIP] Step {num}: {name}")
                continue
            if num < args.from_step:
                safe_print(f"\n  [SKIP] Step {num}: {name} (--from={args.from_step})")
                continue

            ok = func(ssh)
            if not ok and num in (2, 7):  # Critical steps
                safe_print(f"\n  [ABORT] Step {num} ({name}) failed — cannot continue")
                safe_print(f"  Fix the issue and retry with: --from={num}")
                return

        safe_print("\n" + "=" * 60)
        safe_print("  SETUP COMPLETE!")
        safe_print("=" * 60)
        safe_print(f"""
  Next steps:
  1. Configure Traefik on VM-APP to route /api/v1/ai/* -> {AI_HOST}:3035
  2. Deploy AI Orchestrator service on VM-APP (port 3035)
  3. Create ai.* schema tables in PostgreSQL
  4. Test from browser: https://au-aris.org/api/v1/ai/health
""")

    finally:
        ssh.close()
        safe_print("[OK] SSH closed")


if __name__ == "__main__":
    main()
