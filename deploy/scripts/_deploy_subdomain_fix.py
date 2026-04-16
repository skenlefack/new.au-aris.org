#!/usr/bin/env python3
"""
Deploy the Traefik subdomain catch-all labels (commit bd96273) to both
PROD and STAGING. Only the 'web' container needs to be recreated so
Traefik picks up the new labels.

STAGING compose is NOT in sync with git (it was restored from a backup),
so the labels are patched directly on the server file.
"""
import paramiko, sys

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S "

ENVIRONMENTS = [
    {
        "name": "PROD",
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "web_container": "aris-web",
        "sync_from_git": True,  # prod compose is tracked in git
    },
    {
        "name": "STAGING",
        "host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "web_container": "aris-stg-web",
        "sync_from_git": False,  # stg compose drifted; patch in place
    },
]

NEW_LABELS = """      # Catch-all for REC / country subdomains (e.g. igad.au-aris.org, ke.au-aris.org).
      # Lower priority so BI subdomain routers (superset/metabase/grafana) still win.
      # Next.js middleware (apps/web/src/middleware.ts) rewrites root requests
      # to /rec/{code} or /country/{code} based on the Host header.
      - "traefik.http.routers.web-subdomain.rule=HostRegexp(`^[a-z0-9-]+\\\\.au-aris\\\\.org$`)"
      - "traefik.http.routers.web-subdomain.entrypoints=websecure"
      - "traefik.http.routers.web-subdomain.middlewares=security-headers@file"
      - "traefik.http.routers.web-subdomain.priority=1"
      - "traefik.http.routers.web-subdomain.service=web"
"""


def run(ssh, cmd, timeout=600):
    print(f"  $ {cmd[:140]}")
    _, out, _ = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    result = out.read().decode(errors="replace").strip()
    print("    " + (result[-1000:].replace("\n", "\n    ") if result else "(ok)"))
    return result


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15,
                allow_agent=False, look_for_keys=False)
    return ssh


def patch_compose_in_place(ssh, compose_path):
    """Patch staging compose by injecting web-subdomain labels before the first
    empty line after 'traefik.http.services.web.loadbalancer.server.port'.
    Idempotent: no-op if already present."""
    py = (
        "import sys; "
        "f=sys.argv[1]; "
        "src=open(f).read(); "
        "marker='web-subdomain.rule=HostRegexp'; "
        "snip=open('/tmp/web-subdomain-labels.yml').read(); "
        "anchor='traefik.http.services.web.loadbalancer.server.port=3000\"'; "
        "print('already present') if marker in src else None; "
        "sys.exit(0) if marker in src else None; "
        "idx=src.find(anchor); "
        "assert idx>0, 'web anchor not found'; "
        "eol=src.find('\\n', idx)+1; "
        "out=src[:eol]+snip+src[eol:]; "
        "open(f,'w').write(out); "
        "print('patched', len(snip), 'bytes into', f)"
    )
    # Upload labels snippet
    sftp = ssh.open_sftp()
    with sftp.open("/tmp/web-subdomain-labels.yml", "w") as f:
        f.write(NEW_LABELS)
    with sftp.open("/tmp/patch_web_sub.py", "w") as f:
        f.write(py)
    sftp.close()
    run(ssh, f"{SUDO}python3 /tmp/patch_web_sub.py {compose_path}")


for env in ENVIRONMENTS:
    print(f"\n═══════════════════ {env['name']} ═══════════════════")
    ssh = connect(env["host"])

    if env["sync_from_git"]:
        print("\n[1/3] Git pull + sync compose...")
        run(ssh, f"cd /opt/aris && {SUDO}git fetch origin && {SUDO}git reset --hard origin/main")
        run(ssh, f"{SUDO}cp /opt/aris/deploy/vm-app/docker-compose.yml {env['deploy_dir']}/docker-compose.yml")
    else:
        print("\n[1/3] Patch compose in place (staging drift)...")
        patch_compose_in_place(ssh, f"{env['deploy_dir']}/docker-compose.yml")

    print("\n[2/3] Verify labels present...")
    run(ssh, f"{SUDO}grep -c 'web-subdomain' {env['deploy_dir']}/docker-compose.yml")

    print("\n[3/3] Recreate web container (picks up new labels)...")
    run(
        ssh,
        f"cd {env['deploy_dir']} && {SUDO}docker compose up -d --no-deps --force-recreate web 2>&1 | tail -10",
        timeout=600,
    )
    run(ssh, f"docker ps --filter name={env['web_container']} --format '{{{{.Names}}}} | {{{{.Status}}}}'")

    ssh.close()

print("\nDone. Test:")
print("  curl -I https://igad.au-aris.org/")
print("  curl -I https://ke.au-aris.org/")
print("  curl -I https://igad-test.au-aris.org/")
