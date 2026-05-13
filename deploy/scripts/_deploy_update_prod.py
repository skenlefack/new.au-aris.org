#!/usr/bin/env python3
"""
ARIS 4.0 - Deploy current changes to PRODUCTION
================================================
Uploads modified + new files via SFTP, rebuilds web + ai-orchestrator.

Usage:
  python deploy/scripts/_deploy_update_prod.py
"""
import paramiko
import sys
import time
import os

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
APP_HOST = "10.202.101.183"
GIT_DIR = "/opt/aris"
DEPLOY_DIR = "/opt/aris-deploy/vm-app"

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# All modified + new files to upload
FILES = [
    # Form builder
    "apps/web/src/components/form-builder/FormBuilder.tsx",
    "apps/web/src/components/form-builder/FormBuilderToolbar.tsx",
    "apps/web/src/components/form-builder/panels/PropertiesPanel.tsx",
    "apps/web/src/components/form-builder/renderer/AdminLocationField.tsx",
    "apps/web/src/components/form-builder/renderer/ConditionEvaluator.ts",
    "apps/web/src/components/form-builder/renderer/FieldRenderer.tsx",
    "apps/web/src/components/form-builder/renderer/FormRenderer.tsx",
    "apps/web/src/components/form-builder/renderer/MasterDataSelectField.tsx",
    "apps/web/src/components/form-builder/utils/form-schema.ts",
    "apps/web/src/components/form-builder/modals/ValidationRulesModal.tsx",
    # Footer
    "apps/web/src/components/landing/Footer.tsx",
    # i18n
    "apps/web/src/messages/ar.json",
    "apps/web/src/messages/en.json",
    "apps/web/src/messages/es.json",
    "apps/web/src/messages/fr.json",
    "apps/web/src/messages/pt.json",
    # Collecte
    "packages/db-schemas/prisma/collecte.prisma",
    "services/collecte/src/services/submission.service.ts",
    # AI orchestrator
    "services/ai-orchestrator/src/routes/generation.routes.ts",
]

SERVICES_TO_REBUILD = ["web"]


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
                        "already up", "applied"
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


def main():
    total = 4
    safe_print(f"\n{'#'*60}")
    safe_print(f"  DEPLOYING TO PRODUCTION")
    safe_print(f"  Host: {APP_HOST}")
    safe_print(f"  Services: {', '.join(SERVICES_TO_REBUILD)}")
    safe_print(f"  Files: {len(FILES)}")
    safe_print(f"{'#'*60}")

    ssh = connect(APP_HOST)
    safe_print(f"  Connected to {APP_HOST}")

    # 1. Upload files
    step(1, total, f"Upload {len(FILES)} files via SFTP")
    sftp = ssh.open_sftp()
    for rel_path in FILES:
        local = os.path.join(REPO, rel_path.replace("/", os.sep))
        if not os.path.exists(local):
            safe_print(f"  SKIP (not found): {rel_path}")
            continue
        remote = f"{GIT_DIR}/{rel_path}"
        size_mb = os.path.getsize(local) / (1024 * 1024)
        safe_print(f"  {rel_path} ({size_mb:.1f} MB)")
        remote_dir = "/".join(remote.split("/")[:-1])
        sudo(ssh, f"mkdir -p {remote_dir}")
        tmp_path = f"/tmp/_upload_{os.path.basename(rel_path)}"
        sftp.put(local, tmp_path)
        sudo(ssh, f"cp {tmp_path} {remote}")
        sudo(ssh, f"rm -f {tmp_path}")
    sftp.close()
    safe_print("  All files uploaded")

    # 2. Rebuild services
    for i, svc in enumerate(SERVICES_TO_REBUILD):
        step(2 + i, total, f"Rebuild {svc}")
        safe_print(f"  Building {svc}...")
        sudo_stream(ssh,
            f"bash -c 'cd {DEPLOY_DIR} && docker compose up -d --build --no-deps {svc} 2>&1'",
            timeout=600)
        container = f"aris-{svc}"
        s = sudo(ssh, f"docker ps --filter name={container} --format '{{{{.Status}}}}'")
        safe_print(f"  {svc} status: {s}")

    # 4. Verify
    step(total, total, "Verify")
    time.sleep(3)
    out = sudo(ssh, "curl -s -o /dev/null -w '%{http_code}' https://au-aris.org", timeout=15)
    safe_print(f"  Web HTTP: {out}")
    out = sudo(ssh, "curl -s -o /dev/null -w '%{http_code}' https://au-aris.org/aris-mobile.apk", timeout=15)
    safe_print(f"  APK HTTP: {out}")

    ssh.close()
    safe_print(f"\n{'='*60}")
    safe_print(f"  PRODUCTION DEPLOY COMPLETE")
    safe_print(f"  https://au-aris.org")
    safe_print(f"{'='*60}")


if __name__ == "__main__":
    main()
