#!/usr/bin/env python3
"""
Remote Docker build launcher for VM-APP.
Launches docker compose build + up in background via nohup.
"""
import time
import sys

from ssh_config import get_client, ssh_exec, VM_APP, VM_PASS

def main():
    mode = sys.argv[1] if len(sys.argv) > 1 else "start"

    client = get_client(VM_APP)

    if mode == "start":
        print(f"[VM-APP] Launching Docker build on {VM_APP}...")

        # Write a build script to the server
        build_script = """#!/bin/bash
set -o pipefail
cd /opt/aris-deploy/vm-app
export COMPOSE_PARALLEL_LIMIT=3
export DOCKER_BUILDKIT=1

echo "=== Build started at $(date) ==="
echo "=== Working directory: $(pwd) ==="

docker compose build 2>&1
BUILD_EXIT=$?

echo ""
echo "=== Build finished at $(date) with exit code $BUILD_EXIT ==="

if [ $BUILD_EXIT -eq 0 ]; then
    echo "Starting containers..."
    docker compose up -d 2>&1
    UP_EXIT=$?
    echo "=== Containers started at $(date) with exit code $UP_EXIT ==="
    echo ""
    echo "Running containers:"
    docker ps --format "table {{.Names}}\\t{{.Status}}" 2>/dev/null
else
    echo "Build FAILED, not starting containers"
fi

echo ""
echo "=== ALL DONE ==="
"""
        # Upload build script
        sftp = client.open_sftp()
        with sftp.file("/tmp/aris-docker-build.sh", "w") as f:
            f.write(build_script)
        sftp.close()

        # Make executable and launch with nohup
        ssh_exec(client, "chmod +x /tmp/aris-docker-build.sh")

        # Launch in background - use sudo -S to pipe password
        # Write a launcher that feeds the password to sudo
        launcher = f"""#!/bin/bash
echo '{VM_PASS}' | sudo -S bash /tmp/aris-docker-build.sh > /tmp/aris-build.log 2>&1
"""
        sftp2 = client.open_sftp()
        with sftp2.file("/tmp/aris-launcher.sh", "w") as f:
            f.write(launcher)
        sftp2.close()
        ssh_exec(client, "chmod +x /tmp/aris-launcher.sh")

        # Launch nohup in background - don't wait for output
        channel = client.get_transport().open_session()
        channel.exec_command("nohup bash /tmp/aris-launcher.sh > /dev/null 2>&1 &")
        channel.close()

        time.sleep(5)

        # Verify it's running
        out, _ = ssh_exec(client, "ps aux | grep aris-docker-build | grep -v grep | wc -l")
        if out.strip() != "0":
            print("[VM-APP] Build process is running in background!")
        else:
            # Check if build maybe already finished
            out, _ = ssh_exec(client, "tail -3 /tmp/aris-build.log 2>/dev/null")
            print(f"[VM-APP] Process check - log tail:\n{out}")

        out, _ = ssh_exec(client, "head -5 /tmp/aris-build.log 2>/dev/null")
        print(f"[VM-APP] Log start:\n{out}")

        print("\n[VM-APP] Use 'python remote-build.py check' to monitor progress")

    elif mode == "check":
        print(f"[VM-APP] Checking build progress on {VM_APP}...")

        # Check if still running
        out, _ = ssh_exec(client, "ps aux | grep aris-docker-build | grep -v grep | wc -l")
        running = out.strip() != "0"

        if running:
            print("[VM-APP] Build is STILL RUNNING")
        else:
            print("[VM-APP] Build process has FINISHED")

        # Show last 30 lines of log
        out, _ = ssh_exec(client, "tail -30 /tmp/aris-build.log 2>/dev/null")
        print(f"\n--- Last 30 lines of build log ---\n{out}")

        # Show docker images count
        out, _ = ssh_exec(client, f"echo '{VM_PASS}' | sudo -S docker images 2>/dev/null | grep -c aris || echo 0")
        print(f"ARIS Docker images built: {out.strip()}")

        # Show running containers
        out, _ = ssh_exec(client, f"echo '{VM_PASS}' | sudo -S docker ps --format 'table {{{{.Names}}}}\\t{{{{.Status}}}}' 2>/dev/null | head -40")
        if out.strip():
            print(f"\nRunning containers:\n{out}")
        else:
            print("\nNo containers running yet")

    elif mode == "log":
        # Show full log (last 200 lines)
        out, _ = ssh_exec(client, "tail -200 /tmp/aris-build.log 2>/dev/null")
        print(out)

    client.close()

if __name__ == "__main__":
    main()
