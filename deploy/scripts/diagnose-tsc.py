#!/usr/bin/env python3
"""
Diagnose why tsc produces no output in Docker on VM-APP.
Builds ONLY shared-types in a minimal Docker image with verbose diagnostics.
"""
import paramiko
import sys
import os

os.environ["PYTHONIOENCODING"] = "utf-8"

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
HOST = "10.202.101.183"


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


def get_client():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(HOST, 22, SSH_USER, SSH_PASS, timeout=15,
              allow_agent=False, look_for_keys=False)
    return c


def run_sudo_stream(client, cmd, timeout=300):
    stdin, stdout, stderr = client.exec_command(f"sudo -S {cmd}", timeout=timeout)
    stdin.write(SSH_PASS + "\n")
    stdin.flush()
    stdin.channel.shutdown_write()

    output_lines = []
    for line in iter(stdout.readline, ""):
        line = line.rstrip()
        if line:
            safe_print(f"  {line}")
            output_lines.append(line)

    code = stdout.channel.recv_exit_status()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    err = "\n".join(l for l in err.splitlines() if "[sudo]" not in l and "password" not in l.lower())
    return code, "\n".join(output_lines), err


safe_print("=" * 60)
safe_print("  Diagnosing tsc in Docker on VM-APP")
safe_print("=" * 60)

# Create a diagnostic Dockerfile on the VM
c = get_client()

safe_print("\n=== Creating diagnostic Dockerfile ===")

diagnostic_dockerfile = r'''FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9 --activate
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/root/.local/share/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app

FROM base AS pruned
RUN pnpm add -g turbo
COPY . .
RUN turbo prune @aris/tenant-service --docker

FROM base AS diag

# Copy manifests and install
COPY --from=pruned /app/out/json/ .
RUN pnpm install --frozen-lockfile 2>&1 | tail -5

# Copy source
COPY --from=pruned /app/out/full/ .

# === DIAGNOSTICS ===
RUN echo "=== 1. What is in packages/shared-types/ ===" && \
    ls -la packages/shared-types/ && \
    echo "" && \
    echo "=== 2. What is in packages/shared-types/src/ ===" && \
    ls -la packages/shared-types/src/ 2>/dev/null || echo "  NO src/ directory!" && \
    echo "" && \
    echo "=== 3. Check tsconfig.json ===" && \
    cat packages/shared-types/tsconfig.json && \
    echo "" && \
    echo "=== 4. Check if tsc is available ===" && \
    which tsc 2>/dev/null || echo "  tsc not in PATH" && \
    ls -la node_modules/.bin/tsc 2>/dev/null || echo "  no node_modules/.bin/tsc" && \
    ls -la packages/shared-types/node_modules/.bin/tsc 2>/dev/null || echo "  no pkg node_modules/.bin/tsc" && \
    echo "" && \
    echo "=== 5. TypeScript version ===" && \
    npx tsc --version 2>&1 && \
    echo "" && \
    echo "=== 6. Run tsc -p with listEmittedFiles ===" && \
    cd /app/packages/shared-types && \
    npx tsc -p tsconfig.json --listEmittedFiles 2>&1 && \
    echo "" && \
    echo "=== 7. Check dist/ after compilation ===" && \
    ls -laR dist/ 2>/dev/null || echo "  NO dist/ directory created!" && \
    echo "" && \
    echo "=== 8. Try tsc WITHOUT -p (use default tsconfig) ===" && \
    npx tsc --outDir ./dist2 --listEmittedFiles 2>&1 && \
    ls -la dist2/ 2>/dev/null || echo "  NO dist2/ directory!" && \
    echo "" && \
    echo "=== 9. Try with pnpm exec instead of npx ===" && \
    cd /app/packages/shared-types && \
    pnpm exec tsc -p tsconfig.json --listEmittedFiles 2>&1 && \
    ls dist/ 2>/dev/null || echo "  still no dist/" && \
    echo "" && \
    echo "=== 10. Check node_modules/@aris/shared-types symlink ===" && \
    ls -la node_modules/@aris/ 2>/dev/null || echo "  no @aris in node_modules" && \
    echo "" && \
    echo "=== 11. Try direct path to tsc ===" && \
    cd /app/packages/shared-types && \
    /app/node_modules/.bin/tsc -p tsconfig.json --listEmittedFiles 2>&1 || echo "  direct tsc failed" && \
    ls -laR dist/ 2>/dev/null || echo "  still no dist/"
'''

# Write diagnostic Dockerfile to VM
code, out, err = run_sudo_stream(c, f"""bash -c 'cat > /opt/aris/Dockerfile.diag << "ENDOFFILE"
{diagnostic_dockerfile}
ENDOFFILE
echo "Dockerfile.diag written"
'""")
c.close()

# Build the diagnostic image
safe_print("\n=== Building diagnostic image ===")
c = get_client()
code, out, err = run_sudo_stream(c, """bash -c '
cd /opt/aris
export DOCKER_BUILDKIT=1
docker build --no-cache -f Dockerfile.diag -t aris-diag . 2>&1
'""", timeout=300)
c.close()

safe_print(f"\n  Diagnostic build exit code: {code}")

# Cleanup
c = get_client()
run_sudo_stream(c, "docker rmi aris-diag 2>/dev/null || true", timeout=10)
run_sudo_stream(c, "rm -f /opt/aris/Dockerfile.diag", timeout=5)
c.close()

safe_print("\n" + "=" * 60)
safe_print("  Diagnosis complete")
safe_print("=" * 60)
