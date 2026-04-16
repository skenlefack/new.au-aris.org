#!/usr/bin/env python3
"""Flush Redis cache on both staging and production."""
import paramiko
import sys
import time

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

ENVS = [
    {"label": "STAGING", "host": "10.202.101.149", "prefix": "aris-stg"},
    {"label": "PRODUCTION", "host": "10.202.101.186", "prefix": "aris"},
]


def connect(host):
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=15)
    return ssh


def sudo(ssh, cmd, timeout=30):
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
    return out.decode("utf-8", "replace").strip()


for env in ENVS:
    print(f"  Flushing Redis on {env['label']} ({env['host']})...")
    try:
        ssh = connect(env["host"])
        result = sudo(ssh, f"docker exec {env['prefix']}-redis redis-cli FLUSHALL")
        print(f"  -> {result}")
        ssh.close()
    except Exception as e:
        print(f"  -> Error: {e}")

print("Done.")
