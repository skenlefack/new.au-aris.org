#!/usr/bin/env python3
"""
ARIS 4.0 — Master Deployment Orchestrator
==========================================
Deploys the ARIS platform across 4 VMs in the AU-IBAR Nairobi DC.
Uses paramiko for SSH (works on Windows + Linux).

Deployment order (dependency-driven):
  Phase 1-3 (parallel): VM-DB, VM-KAFKA, VM-CACHE
  Phase 4 (sequential): VM-APP (depends on all above)

Usage:
  python deploy-all.py                     # Deploy all VMs
  python deploy-all.py --vm db             # Deploy only VM-DB
  python deploy-all.py --vm kafka          # Deploy only VM-KAFKA
  python deploy-all.py --vm cache          # Deploy only VM-CACHE
  python deploy-all.py --vm app            # Deploy only VM-APP
  python deploy-all.py --phase infra       # Deploy phases 1-3 only
  python deploy-all.py --verify            # Run verification checks only
  python deploy-all.py --dry-run           # Show what would be done
"""

import argparse
import os
import stat
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("ERROR: paramiko is required. Install with: pip install paramiko")
    sys.exit(1)


# ═══════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════
SSH_USER = "arisadmin"
SSH_PASSWORD = "@u-1baR.0rg$U24"
REMOTE_DEPLOY_DIR = "/opt/aris-deploy"
REMOTE_ARIS_DIR = "/opt/aris"

# Lock for thread-safe printing
print_lock = threading.Lock()


def tprint(*args, **kwargs):
    """Thread-safe print (Windows encoding safe)."""
    with print_lock:
        try:
            print(*args, **kwargs)
        except UnicodeEncodeError:
            text = " ".join(str(a) for a in args)
            print(text.encode("ascii", errors="replace").decode(), **kwargs)
        sys.stdout.flush()


@dataclass
class VM:
    name: str
    host: str
    hostname: str
    script: str
    description: str
    deploy_dir: str


VMS = {
    "db": VM(
        name="VM-DB",
        host="10.202.101.185",
        hostname="nbo-dbms03",
        script="scripts/setup-vm-db.sh",
        description="PostgreSQL + PgBouncer",
        deploy_dir="vm-db",
    ),
    "kafka": VM(
        name="VM-KAFKA",
        host="10.202.101.184",
        hostname="nbo-brk01",
        script="scripts/setup-vm-kafka.sh",
        description="Kafka KRaft cluster",
        deploy_dir="vm-kafka",
    ),
    "cache": VM(
        name="VM-CACHE",
        host="10.202.101.186",
        hostname="nbo-cch01",
        script="scripts/setup-vm-cache.sh",
        description="Redis + OpenSearch",
        deploy_dir="vm-cache",
    ),
    "app": VM(
        name="VM-APP",
        host="10.202.101.183",
        hostname="nbo-aris04",
        script="scripts/setup-vm-app.sh",
        description="Services + Frontend + Monitoring",
        deploy_dir="vm-app",
    ),
}


# ═══════════════════════════════════════════
# SSH / SFTP Helpers
# ═══════════════════════════════════════════
def get_ssh_client(vm: VM, timeout: int = 15) -> paramiko.SSHClient:
    """Create and return a connected SSH client."""
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=vm.host,
        port=22,
        username=SSH_USER,
        password=SSH_PASSWORD,
        timeout=timeout,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def ssh_exec(vm: VM, command: str, timeout: int = 600, sudo: bool = True) -> tuple[int, str, str]:
    """Execute a command on a remote VM. Returns (exit_code, stdout, stderr).
    Uses stdin to pass sudo password (avoids shell escaping issues with $ in password).
    """
    client = None
    try:
        client = get_ssh_client(vm)
        if sudo:
            full_cmd = f"sudo -S bash -c {_shell_quote(command)}"
        else:
            full_cmd = command
        stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
        if sudo:
            stdin.write(SSH_PASSWORD + "\n")
            stdin.flush()
            stdin.channel.shutdown_write()
        exit_code = stdout.channel.recv_exit_status()
        out = stdout.read().decode("utf-8", errors="replace")
        err = stderr.read().decode("utf-8", errors="replace")
        return exit_code, out, err
    except Exception as e:
        return -1, "", str(e)
    finally:
        if client:
            client.close()


def ssh_exec_stream(vm: VM, command: str, timeout: int = 600, sudo: bool = True) -> tuple[int, str]:
    """Execute a command and stream output in real-time. Returns (exit_code, full_output).
    Uses stdin to pass sudo password.
    """
    client = None
    try:
        client = get_ssh_client(vm, timeout=30)
        if sudo:
            full_cmd = f"sudo -S bash {command} 2>&1"
        else:
            full_cmd = command

        stdin, stdout, stderr = client.exec_command(full_cmd, timeout=timeout)
        if sudo:
            stdin.write(SSH_PASSWORD + "\n")
            stdin.flush()
            stdin.channel.shutdown_write()

        output_lines = []
        for line in iter(stdout.readline, ""):
            line = line.rstrip()
            tprint(f"  [{vm.name}] {line}")
            output_lines.append(line)

        exit_code = stdout.channel.recv_exit_status()
        err = stderr.read().decode("utf-8", errors="replace")
        if err.strip():
            err_clean = "\n".join(
                l for l in err.splitlines()
                if "[sudo]" not in l and "password" not in l.lower()
            )
            if err_clean.strip():
                output_lines.append(err_clean)

        return exit_code, "\n".join(output_lines)
    except Exception as e:
        return -1, str(e)
    finally:
        if client:
            client.close()


def _shell_quote(s: str) -> str:
    """Quote a string for safe shell use (handles single quotes)."""
    return "'" + s.replace("'", "'\"'\"'") + "'"


def upload_files(vm: VM, local_paths: list[str], remote_dir: str) -> bool:
    """Upload files/dirs by tar-ing locally, SFTP to /tmp, then sudo extract."""
    import tarfile
    import io
    import tempfile

    client = None
    try:
        # Create tar archive in memory
        tmp_tar = os.path.join(tempfile.gettempdir(), f"aris-deploy-{vm.name.lower()}.tar.gz")
        with tarfile.open(tmp_tar, "w:gz") as tar:
            for local_path in local_paths:
                p = Path(local_path)
                if p.is_file():
                    tar.add(str(p), arcname=p.name)
                elif p.is_dir():
                    for f in p.rglob("*"):
                        if f.is_file():
                            arcname = f"{p.name}/{f.relative_to(p).as_posix()}"
                            tar.add(str(f), arcname=arcname)

        tar_size = os.path.getsize(tmp_tar)
        tprint(f"  [{vm.name}] Archive: {tar_size // 1024} KB")

        # Upload tar to /tmp on remote
        client = get_ssh_client(vm, timeout=30)
        sftp = client.open_sftp()
        remote_tar = "/tmp/aris-deploy.tar.gz"
        sftp.put(tmp_tar, remote_tar)
        sftp.close()
        client.close()

        # Extract with sudo on remote
        extract_cmd = f"mkdir -p {remote_dir} && cd {remote_dir} && tar xzf {remote_tar} && rm -f {remote_tar}"
        exit_code, stdout, stderr = ssh_exec(vm, extract_cmd, timeout=60)

        # Cleanup local
        os.remove(tmp_tar)

        if exit_code != 0:
            tprint(f"  [{vm.name}] Extract failed: {stderr[:200]}")
            return False

        return True
    except Exception as e:
        tprint(f"  [{vm.name}] ERROR uploading: {e}")
        return False
    finally:
        if client:
            client.close()


def upload_codebase(vm: VM, repo_root: Path) -> bool:
    """Upload the ARIS codebase to /opt/aris on VM-APP (excluding node_modules, .git, etc.)."""
    import tarfile
    import tempfile

    tprint(f"  [{vm.name}] Creating codebase archive (excluding node_modules, .git)...")

    # Directories/files to exclude
    exclude_dirs = {
        "node_modules", ".git", ".next", "dist", ".turbo", ".cache",
        "__pycache__", ".pytest_cache", "coverage", ".nyc_output",
        "deploy",  # deploy files go to /opt/aris-deploy separately
    }
    exclude_extensions = {".pyc", ".pyo", ".log"}

    def should_exclude(tarinfo):
        parts = Path(tarinfo.name).parts
        for part in parts:
            if part in exclude_dirs:
                return None
        if any(tarinfo.name.endswith(ext) for ext in exclude_extensions):
            return None
        return tarinfo

    tmp_tar = os.path.join(tempfile.gettempdir(), "aris-codebase.tar.gz")
    try:
        with tarfile.open(tmp_tar, "w:gz", compresslevel=6) as tar:
            tar.add(str(repo_root), arcname=".", filter=should_exclude)

        tar_size = os.path.getsize(tmp_tar)
        tprint(f"  [{vm.name}] Codebase archive: {tar_size // (1024*1024)} MB")

        # Upload via SFTP
        client = get_ssh_client(vm, timeout=30)
        sftp = client.open_sftp()
        remote_tar = "/tmp/aris-codebase.tar.gz"
        tprint(f"  [{vm.name}] Uploading codebase to {vm.host}...")
        sftp.put(tmp_tar, remote_tar)
        sftp.close()
        client.close()
        tprint(f"  [{vm.name}] Upload complete")

        # Extract with sudo
        extract_cmd = f"mkdir -p {REMOTE_ARIS_DIR} && cd {REMOTE_ARIS_DIR} && tar xzf {remote_tar} && rm -f {remote_tar} && chown -R {SSH_USER}:{SSH_USER} {REMOTE_ARIS_DIR}"
        exit_code, stdout, stderr = ssh_exec(vm, extract_cmd, timeout=120)

        os.remove(tmp_tar)

        if exit_code != 0:
            tprint(f"  [{vm.name}] Codebase extract failed: {stderr[:200]}")
            return False

        tprint(f"  [{vm.name}] Codebase deployed to {REMOTE_ARIS_DIR}")
        return True
    except Exception as e:
        tprint(f"  [{vm.name}] ERROR uploading codebase: {e}")
        if os.path.exists(tmp_tar):
            os.remove(tmp_tar)
        return False


# ═══════════════════════════════════════════
# Deployment Logic
# ═══════════════════════════════════════════
def deploy_vm(vm: VM, deploy_dir: Path, dry_run: bool = False) -> tuple[str, bool, str]:
    """Deploy to a single VM. Returns (vm_name, success, output)."""
    tprint(f"\n{'='*60}")
    tprint(f"  Deploying {vm.name} ({vm.description})")
    tprint(f"  Host: {vm.host} ({vm.hostname})")
    tprint(f"{'='*60}")

    if dry_run:
        tprint(f"  [DRY RUN] Would upload deploy files to {vm.host}:{REMOTE_DEPLOY_DIR}")
        tprint(f"  [DRY RUN] Would run {vm.script} on {vm.host}")
        return (vm.name, True, "dry run")

    # 1. Check SSH connectivity
    tprint(f"  [{vm.name}] [1/4] Checking SSH connectivity to {vm.host}...")
    try:
        client = get_ssh_client(vm)
        client.close()
        tprint(f"  [{vm.name}] SSH OK")
    except Exception as e:
        tprint(f"  [{vm.name}] SSH FAILED: {e}")
        return (vm.name, False, f"SSH connection failed: {e}")

    # 2. Create remote deploy directory (with sudo, then chown)
    tprint(f"  [{vm.name}] [2/4] Preparing remote directory...")
    ssh_exec(vm, f"mkdir -p {REMOTE_DEPLOY_DIR} && chown -R {SSH_USER}:{SSH_USER} {REMOTE_DEPLOY_DIR}")

    # 3. Copy deployment files (tar + sftp + sudo extract)
    tprint(f"  [{vm.name}] [3/4] Uploading deployment files...")

    local_paths = [
        str(deploy_dir / "scripts"),
        str(deploy_dir / vm.deploy_dir),
        str(deploy_dir / ".env.production"),
    ]
    if not upload_files(vm, local_paths, REMOTE_DEPLOY_DIR):
        return (vm.name, False, "Failed to upload deployment files")
    tprint(f"  [{vm.name}] Deploy files uploaded")

    # 3b. For VM-APP: upload the full codebase to /opt/aris
    if vm.deploy_dir == "vm-app":
        tprint(f"  [{vm.name}] [3b/5] Uploading ARIS codebase...")
        repo_root = deploy_dir.parent  # deploy/ is inside the repo root
        if not upload_codebase(vm, repo_root):
            return (vm.name, False, "Failed to upload codebase")

    # 4. Execute setup script
    tprint(f"  [{vm.name}] [4/4] Running setup script (this may take several minutes)...")
    remote_script = f"{REMOTE_DEPLOY_DIR}/{vm.script}"
    ssh_exec(vm, f"chmod +x {remote_script}")
    ssh_exec(vm, f"chmod +x {REMOTE_DEPLOY_DIR}/scripts/*.sh")

    exit_code, output = ssh_exec_stream(
        vm,
        remote_script,
        timeout=1800,  # 30 minutes for image pulls
    )

    if exit_code != 0:
        tprint(f"\n  [{vm.name}] FAILED (exit code {exit_code})")
        return (vm.name, False, output[-500:] if output else "Unknown error")

    tprint(f"\n  [{vm.name}] SUCCESS!")
    return (vm.name, True, output[-500:] if output else "OK")


def verify_deployment() -> None:
    """Run post-deployment verification checks."""
    print("\n" + "=" * 60)
    print("  ARIS 4.0 — Deployment Verification")
    print("=" * 60)

    checks = [
        ("VM-DB: PostgreSQL via PgBouncer", VMS["db"],
         "docker exec aris-pgbouncer pg_isready -h 127.0.0.1 -p 6432 -U aris 2>&1"),
        ("VM-DB: Schema count", VMS["db"],
         """docker exec aris-postgres psql -U aris -d aris -t -c "SELECT count(*) FROM information_schema.schemata WHERE schema_name NOT IN ('pg_catalog','information_schema','pg_toast')" 2>&1"""),
        ("VM-KAFKA: Broker 1 ready", VMS["kafka"],
         "docker exec aris-kafka-1 kafka-broker-api-versions --bootstrap-server localhost:29092 >/dev/null 2>&1 && echo OK || echo FAIL"),
        ("VM-KAFKA: Topic count", VMS["kafka"],
         "docker exec aris-kafka-1 kafka-topics --list --bootstrap-server localhost:29092 2>/dev/null | wc -l"),
        ("VM-CACHE: Redis PING", VMS["cache"],
         "docker exec aris-redis redis-cli -a 'R3d1s_Pr0d_2024!vN7wQ' ping 2>&1 | grep -v Warning"),
        ("VM-CACHE: OpenSearch health", VMS["cache"],
         "curl -sf http://localhost:9200/_cluster/health 2>&1 | head -1"),
        ("VM-APP: Traefik", VMS["app"],
         "curl -sf http://localhost:80/ping 2>&1 && echo OK || echo FAIL"),
        ("VM-APP: Containers running", VMS["app"],
         "docker ps --format '{{.Names}}' 2>/dev/null | wc -l"),
    ]

    results = []
    for check_name, vm, cmd in checks:
        print(f"\n  [{check_name}]")
        try:
            exit_code, stdout, stderr = ssh_exec(vm, cmd, timeout=15)
            output = stdout.strip()
            success = exit_code == 0 and "FAIL" not in output
            status = "PASS" if success else "FAIL"
            print(f"    {status}: {output[:200]}")
            results.append((check_name, success))
        except Exception as e:
            print(f"    FAIL: {e}")
            results.append((check_name, False))

    # Summary
    passed = sum(1 for _, s in results if s)
    total = len(results)
    print(f"\n{'='*60}")
    print(f"  Results: {passed}/{total} checks passed")
    print(f"{'='*60}")


def main():
    parser = argparse.ArgumentParser(description="ARIS 4.0 — Production Deployment")
    parser.add_argument("--vm", choices=["db", "kafka", "cache", "app", "all"], default="all",
                        help="Which VM to deploy (default: all)")
    parser.add_argument("--phase", choices=["infra", "app", "all"], default="all",
                        help="Which phase to deploy")
    parser.add_argument("--verify", action="store_true",
                        help="Run verification checks only")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be done without executing")
    args = parser.parse_args()

    deploy_dir = Path(__file__).parent.resolve()

    print("=" * 60)
    print("  ARIS 4.0 — Production Deployment Orchestrator")
    print("  AU-IBAR Nairobi Data Centre — 4 VMs")
    print("=" * 60)
    print(f"  Deploy directory: {deploy_dir}")
    print(f"  SSH user: {SSH_USER}")
    print(f"  Target: {args.vm} (phase: {args.phase})")
    if args.dry_run:
        print("  MODE: DRY RUN")
    print()

    if args.verify:
        verify_deployment()
        return

    # Determine which VMs to deploy
    if args.vm != "all":
        target_vms = {args.vm: VMS[args.vm]}
    elif args.phase == "infra":
        target_vms = {k: v for k, v in VMS.items() if k != "app"}
    elif args.phase == "app":
        target_vms = {"app": VMS["app"]}
    else:
        target_vms = VMS.copy()

    # Phase 1-3: Infrastructure VMs (parallel)
    infra_vms = {k: v for k, v in target_vms.items() if k in ("db", "kafka", "cache")}
    app_vm = target_vms.get("app")

    results = {}

    if infra_vms:
        print("\n" + "=" * 60)
        print("  PHASE 1-3: Infrastructure (parallel)")
        print("=" * 60)

        with ThreadPoolExecutor(max_workers=3) as executor:
            futures = {
                executor.submit(deploy_vm, vm, deploy_dir, args.dry_run): name
                for name, vm in infra_vms.items()
            }
            for future in as_completed(futures):
                vm_name, success, output = future.result()
                results[vm_name] = success

    # Phase 4: Application VM (sequential, depends on infrastructure)
    if app_vm:
        if infra_vms and not all(results.values()):
            failed = [name for name, success in results.items() if not success]
            print(f"\n  WARNING: Infrastructure VMs failed: {failed}")
            print("  Skipping VM-APP deployment.")
            results["VM-APP"] = False
        else:
            print("\n" + "=" * 60)
            print("  PHASE 4: Application Server")
            print("=" * 60)
            vm_name, success, output = deploy_vm(app_vm, deploy_dir, args.dry_run)
            results[vm_name] = success

    # Summary
    print("\n" + "=" * 60)
    print("  DEPLOYMENT SUMMARY")
    print("=" * 60)
    for name, success in results.items():
        status = "SUCCESS" if success else "FAILED"
        print(f"  {name}: {status}")

    if all(results.values()):
        print("\n  All deployments successful!")
        print("\n  Run verification: python deploy-all.py --verify")
    else:
        print("\n  Some deployments failed. Check logs above.")
        sys.exit(1)


if __name__ == "__main__":
    main()
