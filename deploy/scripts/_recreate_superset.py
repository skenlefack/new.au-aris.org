#!/usr/bin/env python3
"""Force-recreate Superset on Prod and Staging."""

import paramiko, time, json, sys, io, codecs

# Fix Windows cp1252 encoding issues with docker compose Unicode output
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if hasattr(sys.stderr, 'buffer'):
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

SERVERS = [
    dict(name="PRODUCTION", host="10.202.101.183", user="arisadmin",
         password='@u-1baR.0rg$U24',
         compose_dir="/opt/aris-deploy/vm-app", domain="au-aris.org",
         traefik_container="aris-traefik"),
    dict(name="STAGING", host="10.202.101.146", user="arisadmin",
         password='@u-1baR.0rg$U24',
         compose_dir="/opt/aris-deploy/vm-app-stg", domain="test.au-aris.org",
         traefik_container="aris-stg-traefik"),
]


def run_ssh(ssh, cmd, timeout=120):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    rc = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    return rc, clean_output(out), clean_output(err)


import re
ANSI_RE = re.compile(r'(\[[0-9;?]*[a-zA-Z]|\].*?|[--])')

def clean_output(text):
    return ANSI_RE.sub('', text)


def run_sudo(ssh, cmd, pw, timeout=120):
    full = "sudo -S " + cmd
    stdin, stdout, stderr = ssh.exec_command(full, timeout=timeout, get_pty=True)
    time.sleep(0.5)
    stdin.write(pw + "\n")
    stdin.flush()
    rc = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace").strip()
    lines = [l for l in out.split("\n") if "[sudo]" not in l and "password for" not in l.lower()]
    return rc, "\n".join(lines).strip(), ""


def go(srv):
    nm = srv["name"]
    host = srv["host"]
    cdir = srv["compose_dir"]
    dom = srv["domain"]
    tc = srv["traefik_container"]
    pw = srv["password"]
    eq70 = "=" * 70
    print(f"\n{eq70}")
    print(f"  {nm} -- {host}")
    print(eq70)
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        print(f"\n[1] Connecting to {host}...")
        ssh.connect(host, username=srv["user"], password=pw, timeout=15)
        print("    Connected.")

        print("\n[2] Current Superset container status...")
        rc, out, _ = run_sudo(ssh, "docker ps --filter name=superset --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'", pw)
        if out:
            for line in out.split("\n"):
                if line.strip(): print(f"    {line}")
        else:
            print("    No superset container running.")

        print("\n[3] Force-recreating Superset...")
        cmd = f"bash -c 'cd {cdir} && docker compose up -d --force-recreate --no-deps superset'"
        print(f"    CMD: cd {cdir} && docker compose up -d --force-recreate --no-deps superset")
        rc, out, _ = run_sudo(ssh, cmd, pw, timeout=180)
        for line in (out or "").split("\n"):
            if line.strip(): print(f"    {line}")
        print(f"    Exit code: {rc}")

        print("\n[4] Waiting 20s for container...")
        time.sleep(20)
        rc, out, _ = run_sudo(ssh, "docker ps --filter name=superset --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}'", pw)
        for line in (out or "").split("\n"):
            if line.strip(): print(f"    {line}")

        print("\n[5] Verifying /static path through Traefik...")
        rc, out, _ = run_ssh(ssh, "curl -sk -o /dev/null -w '%{http_code}' https://localhost/static/appbuilder/css/adminlte.min.css")
        print(f"    curl https://localhost/static/... => HTTP {out}")

        rc, out, _ = run_ssh(ssh, f"curl -sk -o /dev/null -w '%{{http_code}}' https://{dom}/static/appbuilder/css/adminlte.min.css --resolve '{dom}:443:127.0.0.1'")
        print(f"    curl https://{dom}/static/... => HTTP {out}")

        rc, out, _ = run_ssh(ssh, f"curl -sk -o /dev/null -w '%{{http_code}}' https://{dom}/superset/ --resolve '{dom}:443:127.0.0.1'")
        print(f"    curl https://{dom}/superset/ => HTTP {out}")

        print("\n    Response headers for /static path:")
        rc, out, _ = run_ssh(ssh, f"curl -sk -I https://{dom}/static/appbuilder/css/adminlte.min.css --resolve '{dom}:443:127.0.0.1' 2>/dev/null | head -15")
        for line in (out or "").split("\n"): print(f"      {line}")

        print("\n[6] Checking Traefik routers for superset...")
        rc, out, _ = run_ssh(ssh, 'curl -s http://localhost:8080/api/http/routers 2>/dev/null')
        found_api = False
        if out and out.startswith("["):
            try:
                routers = json.loads(out)
                sr = [r for r in routers if "superset" in r.get("name", "").lower() or "superset" in str(r.get("rule", "")).lower() or "static" in r.get("name", "").lower()]
                if sr:
                    found_api = True
                    print("    Superset-related Traefik routers:")
                    for r in sr:
                        print(f"      Name: {r.get('name','?')}, Rule: {r.get('rule','?')}")
                        print(f"      Service: {r.get('service','?')}, Status: {r.get('status','?')}")
                        print(f"      Priority: {r.get('priority','default')}, EntryPoints: {r.get('entryPoints','?')}")
                        print()
                else:
                    found_api = True
                    print(f"    No superset routers found among {len(routers)} total routers.")
            except Exception as e:
                print(f"    JSON parse error: {e}")
        if not found_api:
            print("    Traefik API not reachable on :8080. Trying docker exec...")
            rc, out, _ = run_sudo(ssh, f'docker exec {tc} wget -qO- http://localhost:8080/api/http/routers', pw)
            if out:
                idx = out.find("[")
                if idx >= 0:
                    try:
                        routers = json.loads(out[idx:])
                        sr = [r for r in routers if "superset" in r.get("name", "").lower() or "static" in r.get("name", "").lower()]
                        if sr:
                            print("    Superset routers (via exec):")
                            for r in sr:
                                print(f"      {r.get('name')} | {r.get('rule')} | {r.get('service')} | {r.get('status')}")
                        else:
                            print(f"    No superset routers. Total: {len(routers)}")
                    except Exception as e:
                        print(f"    Parse error: {e}")
            else:
                print("    Checking container labels instead...")
                rc, out, _ = run_sudo(ssh, "docker inspect $(docker ps -q --filter name=superset) 2>/dev/null", pw)
                if out:
                    idx = out.find("[")
                    if idx >= 0:
                        try:
                            c = json.loads(out[idx:])
                            labels = {k: v for k, v in c[0]["Config"]["Labels"].items() if "traefik" in k}
                            for k, v in sorted(labels.items()):
                                print(f"      {k} = {v}")
                        except Exception as e:
                            print(f"    Parse error: {e}")

        print("\n[7] Last 15 lines of Superset logs...")
        rc, out, _ = run_sudo(ssh, "docker logs --tail 15 $(docker ps -q --filter name=superset) 2>&1", pw)
        for line in (out or "").split("\n"):
            if line.strip(): print(f"    {line}")

        print(f"\n    {nm} done.")
    except Exception as e:
        print(f"    ERROR: {e}")
        import traceback
        traceback.print_exc()
    finally:
        ssh.close()


if __name__ == "__main__":
    print("=" * 70)
    print("  SUPERSET FORCE-RECREATE -- Prod & Staging")
    print("  Purpose: Traefik picks up new labels (superset-static router)")
    print("=" * 70)
    for s in SERVERS:
        go(s)
    print("\n" + "=" * 70)
    print("  ALL DONE")
    print("=" * 70)
