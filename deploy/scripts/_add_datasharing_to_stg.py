#!/usr/bin/env python3
"""
Add the data-sharing service definition to the staging docker-compose.yml.
Reads prod compose locally, extracts + transforms the block, sends it to
staging via SFTP, inserts before the interop-hub service, then
force-recreates aris-stg-data-sharing so it is under compose management.
"""
import paramiko, sys, re, os, base64

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PROD_COMPOSE_LOCAL = os.path.join(REPO_ROOT, "deploy", "vm-app", "docker-compose.yml")

# 1. Extract the data-sharing block from the local prod compose
with open(PROD_COMPOSE_LOCAL, encoding="utf-8") as f:
    text = f.read()

m = re.search(
    r"^  data-sharing:\n(?:^(?:    .*|  \#.*|\s*)\n)+",
    text,
    flags=re.MULTILINE,
)
if not m:
    # Fallback: take from "^  data-sharing:" to the next "^  <name>:"
    idx = text.find("\n  data-sharing:\n")
    assert idx >= 0, "data-sharing block not found"
    start = idx + 1
    rest = text[start + len("  data-sharing:\n"):]
    end_rel = re.search(r"\n  [a-z][a-z0-9-]+:\n", rest)
    assert end_rel, "end of block not found"
    block = text[start:start + len("  data-sharing:\n") + end_rel.start() + 1]
else:
    block = m.group(0)

block_stg = block.replace("aris-data-sharing", "aris-stg-data-sharing")
print("Extracted + transformed data-sharing block:")
print("---")
print(block_stg)
print("---")

# 2. SSH + SFTP to send the snippet to /tmp on staging
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.146", username="arisadmin",
            password="@u-1baR.0rg$U24", timeout=15,
            allow_agent=False, look_for_keys=False)

SUDO = "echo '@u-1baR.0rg$U24' | sudo -S "
STG = "/opt/aris-deploy/vm-app-stg/docker-compose.yml"


def run(cmd, timeout=120, pty=True):
    print(f"\n$ {cmd[:140]}")
    _, out, _ = ssh.exec_command(cmd, timeout=timeout, get_pty=pty)
    result = out.read().decode(errors="replace").strip()
    print(result[-1200:] if result else "(ok)")
    return result


# Guard
current = run(f"{SUDO}grep -c '^  data-sharing:' {STG} || echo 0")
if current.strip().endswith("1"):
    print("\ndata-sharing already present — exiting.")
    ssh.close()
    sys.exit(0)

# Backup
run(f"{SUDO}cp {STG} {STG}.bak.pre-datasharing")

# Write snippet via SFTP to /tmp (no sudo needed there)
sftp = ssh.open_sftp()
with sftp.open("/tmp/datasharing-stg.yml", "w") as f:
    f.write(block_stg)
sftp.close()
print("\nSnippet uploaded to /tmp/datasharing-stg.yml")

# Insert before '  interop-hub:' using Python on the remote host
insert_py = (
    "import sys; "
    "f=sys.argv[1]; "
    "src=open(f).read(); "
    "snip=open('/tmp/datasharing-stg.yml').read(); "
    "snip=snip.rstrip()+'\\n\\n'; "
    "marker='\\n  interop-hub:\\n'; "
    "idx=src.find(marker); "
    "assert idx>0, 'interop-hub marker not found'; "
    "out=src[:idx+1]+snip+src[idx+1:]; "
    "open(f,'w').write(out); "
    "print('inserted', len(snip), 'bytes before interop-hub')"
)
# Write the insertion python to /tmp and run via sudo
sftp = ssh.open_sftp()
with sftp.open("/tmp/insert_ds.py", "w") as f:
    f.write(insert_py)
sftp.close()

run(f"{SUDO}python3 /tmp/insert_ds.py {STG}")

# Verify
run(f"{SUDO}grep -c 'aris-stg-data-sharing' {STG}")
run(f"cd /opt/aris-deploy/vm-app-stg && {SUDO}docker compose config --services | sort | tail -10")

# Reattach running container under compose
print("\n--- Bring data-sharing under staging compose (force-recreate) ---")
run(
    f"cd /opt/aris-deploy/vm-app-stg && {SUDO}docker compose up -d --no-deps --force-recreate data-sharing 2>&1 | tail -10",
    timeout=900,
)
run("docker ps --filter name=aris-stg-data-sharing --format '{{.Names}} | {{.Status}}'")

ssh.close()
print("\nDone.")
