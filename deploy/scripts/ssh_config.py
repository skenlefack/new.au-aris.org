#!/usr/bin/env python3
"""
ARIS 4.0 — Centralized SSH/VM configuration for deploy scripts.

Reads credentials from environment variables instead of hardcoding.
Set these before running any deploy script:

  export ARIS_DEPLOY_USER=arisadmin
  export ARIS_DEPLOY_PASS='your-ssh-password'

Or use SSH key-based auth (preferred):
  export ARIS_DEPLOY_USER=arisadmin
  export ARIS_DEPLOY_KEY=/path/to/id_rsa
"""
import os
import sys
import io
import paramiko

# ── VM addresses ──────────────────────────────────────────────
VM_APP   = os.environ.get("ARIS_VM_APP",   "10.202.101.183")
VM_KAFKA = os.environ.get("ARIS_VM_KAFKA", "10.202.101.184")
VM_DB    = os.environ.get("ARIS_VM_DB",    "10.202.101.185")
VM_CACHE = os.environ.get("ARIS_VM_CACHE", "10.202.101.186")

# ── Credentials ───────────────────────────────────────────────
VM_USER = os.environ.get("ARIS_DEPLOY_USER", "arisadmin")
VM_PASS = os.environ.get("ARIS_DEPLOY_PASS")
VM_KEY  = os.environ.get("ARIS_DEPLOY_KEY")   # path to SSH private key

# Ensure UTF-8 stdout/stderr
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")


def _check_credentials():
    """Abort early if no credentials are configured."""
    if not VM_PASS and not VM_KEY:
        print("ERROR: No SSH credentials configured.", file=sys.stderr)
        print("Set ARIS_DEPLOY_PASS (password) or ARIS_DEPLOY_KEY (key path).", file=sys.stderr)
        sys.exit(1)


def ssh(host, cmd, timeout=600):
    """Execute a command on a remote VM via SSH.

    Args:
        host: VM IP address (use VM_APP, VM_DB, VM_KAFKA, VM_CACHE constants)
        cmd: Shell command to execute (wrapped in sudo bash -c)
        timeout: Command timeout in seconds (default 600)

    Returns:
        Tuple of (exit_code, stdout, stderr)
    """
    _check_credentials()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs = dict(
        hostname=host,
        port=22,
        username=VM_USER,
        timeout=15,
        allow_agent=False,
        look_for_keys=False,
    )

    if VM_KEY:
        connect_kwargs["key_filename"] = VM_KEY
    else:
        connect_kwargs["password"] = VM_PASS

    c.connect(**connect_kwargs)

    stdin, stdout, stderr = c.exec_command(
        f"sudo -S bash -c '{cmd}'", timeout=timeout
    )
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()

    code = stdout.channel.recv_exit_status()
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    c.close()
    return code, out, err


def get_client(host):
    """Create and return a connected SSH client (caller must close it).

    Useful for scripts that need SFTP or multiple commands on the same connection.
    """
    _check_credentials()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs = dict(
        hostname=host,
        port=22,
        username=VM_USER,
        timeout=15,
        allow_agent=False,
        look_for_keys=False,
    )
    if VM_KEY:
        connect_kwargs["key_filename"] = VM_KEY
    else:
        connect_kwargs["password"] = VM_PASS

    c.connect(**connect_kwargs)
    return c


def ssh_exec(client, cmd, timeout=120):
    """Execute a command on an existing SSH client (no sudo wrapper).

    Args:
        client: Connected paramiko.SSHClient
        cmd: Shell command to execute
        timeout: Command timeout in seconds

    Returns:
        Tuple of (stdout, stderr) as strings
    """
    stdin, stdout, stderr = client.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    return out, err


def ssh_stream(host, cmd, timeout=300):
    """Execute a command and stream output line by line.

    Args:
        host: VM IP address
        cmd: Shell command to execute (wrapped in sudo bash -c)
        timeout: Command timeout in seconds

    Returns:
        Tuple of (exit_code, full_stdout, full_stderr)
    """
    _check_credentials()
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    connect_kwargs = dict(
        hostname=host,
        port=22,
        username=VM_USER,
        timeout=15,
        allow_agent=False,
        look_for_keys=False,
    )
    if VM_KEY:
        connect_kwargs["key_filename"] = VM_KEY
    else:
        connect_kwargs["password"] = VM_PASS

    c.connect(**connect_kwargs)

    stdin, stdout, stderr = c.exec_command(
        f"sudo -S bash -c '{cmd}'", timeout=timeout
    )
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()

    lines = []
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        print(f"  | {line}")
        lines.append(line)

    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace")
    c.close()
    return code, "\n".join(lines), err


def step(msg):
    """Print a formatted step banner."""
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


# ── Service registry ──────────────────────────────────────────
SERVICES = [
    ("tenant",         3001),
    ("credential",     3002),
    ("master-data",    3003),
    ("data-quality",   3004),
    ("data-contract",  3005),
    ("message",        3006),
    ("drive",          3007),
    ("realtime",       3008),
    ("form-builder",   3010),
    ("collecte",       3011),
    ("workflow",       3012),
    ("animal-health",  3020),
    ("livestock-prod", 3021),
    ("fisheries",      3022),
    ("wildlife",       3023),
    ("apiculture",     3024),
    ("trade-sps",      3025),
    ("governance",     3026),
    ("climate-env",    3027),
    ("analytics",      3030),
    ("geo-services",   3031),
    ("interop-hub",    3032),
    ("knowledge-hub",  3033),
]
