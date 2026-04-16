#!/usr/bin/env python3
"""
Deploy message + web services to STG and PROD.
Adds WhatsApp/Telegram channels + test-email endpoint.
Steps:
  1. git stash + git pull
  2. Copy docker-compose.yml to deploy dir
  3. Prisma db push (adds whatsapp/telegram columns to notification_preferences)
  4. Rebuild + restart message service
  5. Rebuild + restart web service
  6. Verify containers
"""
import paramiko
import time
import sys
import traceback

SSH_PASSWORD = "@u-1baR.0rg$U24"

SERVERS = [
    {
        "name": "STG",
        "host": "10.202.101.146",
        "user": "arisadmin",
        "password": SSH_PASSWORD,
        "git_dir": "/opt/aris",
        "compose_src": "/opt/aris/deploy/vm-app-stg/docker-compose.yml",
        "compose_dst": "/opt/aris-deploy/vm-app-stg/docker-compose.yml",
        "compose_dir": "/opt/aris-deploy/vm-app-stg",
        "msg_ctr": "aris-stg-message",
        "web_ctr": "aris-stg-web",
        "db_user": "aris_message",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "db_name": "aris_message",
        "db_port": "5432",
        "prod": False,
    },
    {
        "name": "PROD",
        "host": "10.202.101.183",
        "user": "arisadmin",
        "password": SSH_PASSWORD,
        "git_dir": "/opt/aris",
        "compose_src": "/opt/aris/deploy/vm-app/docker-compose.yml",
        "compose_dst": "/opt/aris-deploy/vm-app/docker-compose.yml",
        "compose_dir": "/opt/aris-deploy/vm-app",
        "msg_ctr": "aris-message",
        "web_ctr": "aris-web",
        "db_user": None,
        "db_pass": None,
        "db_name": "aris_message",
        "db_port": "5432",
        "prod": True,
    },
]


def banner(m):
    sep = "=" * 70
    print("\n" + sep + "\n  " + m + "\n" + sep)
    sys.stdout.flush()


def section(m):
    print("\n--- " + m + " ---")
    sys.stdout.flush()


def run(ssh, cmd, timeout=300):
    print("  CMD: " + cmd[:220])
    sys.stdout.flush()
    _, so, _ = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    out = so.read().decode("utf-8", errors="replace")
    rc = so.channel.recv_exit_status()
    if out.strip():
        print("  OUT:\n" + out.strip()[:4000])
    print("  EXIT: " + str(rc))
    sys.stdout.flush()
    return rc, out


def sudo_run(ssh, cmd, timeout=300):
    full = "echo '" + SSH_PASSWORD + "' | sudo -S bash -c '" + cmd.replace("'", "'\\''") + "'"
    return run(ssh, full, timeout)


def connect(s):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    print("  Connecting to " + s["host"] + " ...")
    c.connect(s["host"], username=s["user"], password=s["password"],
              timeout=30, allow_agent=False, look_for_keys=False)
    print("  Connected.")
    sys.stdout.flush()
    return c


def s1_git_pull(ssh, s):
    section("STEP 1: git stash + git pull")
    rc, _ = run(ssh, "cd " + s["git_dir"] + " && git stash && git pull origin main")
    if rc:
        print("  WARNING: git pull returned non-zero, continuing anyway")
    return rc


def s2_copy_compose(ssh, s):
    section("STEP 2: Copy docker-compose.yml to deploy dir")
    rc, _ = sudo_run(ssh, "cp " + s["compose_src"] + " " + s["compose_dst"])
    if rc:
        print("  WARNING: compose copy non-zero")
    return rc


def s3_prisma(ssh, s):
    section("STEP 3: Prisma db push for message schema")
    ctr = s["msg_ctr"]

    if s["prod"]:
        print("  Extracting DB URL from container env...")
        rc, out = run(ssh, "docker exec " + ctr + " env")
        url = None
        for ln in out.splitlines():
            if ln.startswith("DIRECT_DATABASE_URL="):
                url = ln.split("=", 1)[1].strip()
                break
        if not url:
            for ln in out.splitlines():
                if ln.startswith("DATABASE_URL=") and "postgresql" in ln:
                    raw = ln.split("=", 1)[1].strip()
                    url = raw.replace(":6432/", ":5432/")
                    url = url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
                    break
        if not url:
            print("  ERROR: no DB URL found, skipping prisma push")
            return 1
    else:
        url = ("postgresql://" + s["db_user"] + ":" + s["db_pass"]
               + "@localhost:" + s["db_port"] + "/" + s["db_name"])

    print("  DB URL (truncated): " + url[:100])

    # Check npx availability
    rc, _ = run(ssh, "docker exec " + ctr + " which npx")
    if rc:
        print("  npx not in container. Skipping prisma push.")
        return 0

    push_cmd = ("docker exec -w /app/packages/db-schemas"
                + " -e DATABASE_URL=" + url
                + " " + ctr
                + " npx prisma db push --schema=prisma --accept-data-loss")
    rc, _ = run(ssh, push_cmd, timeout=120)
    if rc:
        print("  WARNING: prisma push non-zero, may already be up to date")
    return rc


def s4_rebuild(ssh, s, svc, step):
    section("STEP " + str(step) + ": Rebuild + restart " + svc)
    cmd = "cd " + s["compose_dir"] + " && docker compose up -d --build --no-deps " + svc
    rc, _ = sudo_run(ssh, cmd, timeout=600)
    if rc:
        print("  WARNING: rebuild " + svc + " non-zero")
    return rc


def s6_verify(ssh, s):
    section("STEP 6: Verify containers running")
    cmd = "docker ps --format '{{.Names}}\\t{{.Status}}' | grep -E '" + s["msg_ctr"] + "|" + s["web_ctr"] + "'"
    rc, _ = run(ssh, cmd)
    if rc:
        print("  WARNING: containers may still be building")
    return rc


def deploy(s):
    banner("DEPLOYING TO " + s["name"] + " (" + s["host"] + ")")
    res = {}
    try:
        ssh = connect(s)
    except Exception as e:
        print("  FATAL connect: " + str(e))
        return {"connect": 1}
    try:
        res["1_git_pull"]        = s1_git_pull(ssh, s)
        res["2_copy_compose"]    = s2_copy_compose(ssh, s)
        res["3_prisma_push"]     = s3_prisma(ssh, s)
        res["4_rebuild_message"] = s4_rebuild(ssh, s, "message", 4)
        print("  Waiting 15s for message to stabilize...")
        time.sleep(15)
        res["5_rebuild_web"]     = s4_rebuild(ssh, s, "web", 5)
        print("  Waiting 30s for web build to start (build takes ~2-3min)...")
        time.sleep(30)
        res["6_verify"]          = s6_verify(ssh, s)
    except Exception as e:
        print("  FATAL: " + str(e))
        traceback.print_exc()
    finally:
        ssh.close()
    return res


def main():
    all_res = {}
    for s in SERVERS:
        all_res[s["name"]] = deploy(s)

    banner("DEPLOYMENT SUMMARY")
    for sname, res in all_res.items():
        print("\n  " + sname + ":")
        for step, rc in res.items():
            status = "OK" if rc == 0 else "NON-ZERO rc=" + str(rc)
            print("    " + step.ljust(25) + ": " + status)

    print("\nDeploy script finished.\n")


if __name__ == "__main__":
    main()
