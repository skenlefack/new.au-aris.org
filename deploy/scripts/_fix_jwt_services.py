"""
Fix JWT services on staging VM (10.202.101.146).
1. Restart form-builder, verify it works with JWT auth
2. If OK, restart all other application services that use JWT
"""
import sys, os, time, tempfile, json

VM_USER = "arisadmin"
VM_PASS = os.environ.get("ARIS_DEPLOY_PASS", "@u-1baR.0rg$U24")
STG_APP = "10.202.101.146"

import paramiko


def get_client(host):
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(host, port=22, username=VM_USER, password=VM_PASS,
              timeout=15, allow_agent=False, look_for_keys=False)
    return c


def run_sudo(host, cmd, timeout=30):
    c = get_client(host)
    stdin, stdout, stderr = c.exec_command(
        f"sudo -S bash -c '{cmd}'", timeout=timeout)
    if VM_PASS:
        stdin.write(VM_PASS + "\n")
        stdin.flush()
    stdin.channel.shutdown_write()
    stdout.channel.settimeout(timeout)
    out = stdout.read().decode("utf-8", errors="replace").strip()
    err = stderr.read().decode("utf-8", errors="replace").strip()
    code = stdout.channel.recv_exit_status()
    c.close()
    out = "\n".join(
        l for l in out.splitlines()
        if "[sudo]" not in l and "password" not in l.lower()
    )
    return code, out


def run_script(host, script, timeout=60):
    """Upload a bash script via SFTP and execute it."""
    c = get_client(host)
    sftp = c.open_sftp()
    local_tmp = tempfile.mktemp(suffix=".sh")
    with open(local_tmp, "w", newline="\n") as f:
        f.write(script)
    sftp.put(local_tmp, "/tmp/_run.sh")
    sftp.close()
    os.unlink(local_tmp)
    c.close()

    c = get_client(host)
    stdin, stdout, stderr = c.exec_command("bash /tmp/_run.sh", timeout=timeout)
    stdout.channel.settimeout(timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    c.close()
    return code, out, err


# Application services that use JWT auth middleware
APP_SERVICES = [
    "aris-stg-credential",
    "aris-stg-tenant",
    "aris-stg-master-data",
    "aris-stg-workflow",
    "aris-stg-animal-health",
    "aris-stg-message",
    "aris-stg-drive",
    "aris-stg-realtime",
    "aris-stg-data-quality",
    "aris-stg-data-contract",
    "aris-stg-interop-hub",
    "aris-stg-form-builder",
    "aris-stg-collecte",
    "aris-stg-livestock-prod",
    "aris-stg-fisheries",
    "aris-stg-wildlife",
    "aris-stg-apiculture",
    "aris-stg-trade-sps",
    "aris-stg-governance",
    "aris-stg-climate-env",
    "aris-stg-analytics",
    "aris-stg-geo-services",
    "aris-stg-knowledge-hub",
    "aris-stg-web",
]


def main():
    print("=" * 70)
    print("  FIX JWT SERVICES ON STAGING (10.202.101.146)")
    print("=" * 70)

    print("\n[1/6] Restarting aris-stg-form-builder...")
    code, out = run_sudo(STG_APP, "docker restart aris-stg-form-builder")
    if code != 0:
        print(f"  ERROR (exit {code}): {out}")
        sys.exit(1)
    print(f"  OK: {out}")

    print("\n[2/6] Waiting 10 seconds for form-builder to start...")
    time.sleep(10)
    print("  Done waiting.")

    print("\n[3/6] Checking form-builder logs (last 20 lines)...")
    code, out = run_sudo(STG_APP, "docker logs aris-stg-form-builder --tail 20", timeout=15)
    print(f"  Exit code: {code}")
    for line in out.splitlines():
        print(f"  | {line}")

    # Step 4: Login to get JWT token
    print("\n[4/6] Logging in to get JWT token...")
    login_script = '''#!/bin/bash

TOKEN_RESPONSE=$(curl -s -X POST http://localhost:3002/api/v1/credential/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"admin@au-aris.org","password":"Aris2024!"}')
echo "LOGIN_RESPONSE=$TOKEN_RESPONSE"
'''
    code, out, err = run_script(STG_APP, login_script, timeout=30)
    print(f"  Exit code: {code}")

    # Parse token from response
    token = None
    for line in out.splitlines():
        if line.startswith("LOGIN_RESPONSE="):
            raw = line[len("LOGIN_RESPONSE="):]
            try:
                data = json.loads(raw)
                if "data" in data and isinstance(data["data"], dict):
                    token = data["data"].get("accessToken") or data["data"].get("token")
                if not token:
                    token = data.get("accessToken") or data.get("token")
                if token:
                    print(f"  Got JWT token: {token[:40]}...")
                else:
                    print(f"  WARNING: No token found in response: {raw[:200]}")
            except json.JSONDecodeError:
                print(f"  ERROR: Could not parse JSON: {raw[:200]}")
            break
    else:
        print("  ERROR: No LOGIN_RESPONSE line found in output:")
        for line in out.splitlines():
            print(f"    | {line}")

    if not token:
        print("\n  FATAL: Cannot proceed without JWT token.")
        print("  Full output:")
        for line in out.splitlines():
            print(f"    | {line}")
        if err.strip():
            print("  Stderr:")
            for line in err.splitlines():
                print(f"    | {line}")
        sys.exit(1)

    # Step 5: Test form-builder API with token
    print("\n[5/6] Testing form-builder API with JWT token...")
    test_script = f'''#!/bin/bash

HTTP_CODE=$(curl -s -o /tmp/_api_body.txt -w "%{{http_code}}" \
  http://localhost:3010/api/v1/form-builder/templates \
  -H "Authorization: Bearer {token}")
BODY=$(cat /tmp/_api_body.txt)
echo "HTTP_CODE=$HTTP_CODE"
echo "API_BODY=$BODY"
'''
    code, out, err = run_script(STG_APP, test_script, timeout=30)
    print(f"  Exit code: {code}")

    form_builder_ok = False
    http_code = None
    body = None
    for line in out.splitlines():
        if line.startswith("HTTP_CODE="):
            http_code = line[len("HTTP_CODE="):].strip()
        if line.startswith("API_BODY="):
            body = line[len("API_BODY="):]
    if http_code:
        print(f"  HTTP Status: {http_code}")
        if body:
            print(f"  Response body (first 300 chars): {body[:300]}")
        if http_code.startswith("2"):
            form_builder_ok = True
            print("  FORM-BUILDER IS WORKING!")
        elif http_code == "401":
            print("  ERROR: 401 Unauthorized - JWT not accepted")
        else:
            print(f"  WARNING: Unexpected status {http_code}")
            if not http_code.startswith("5"):
                form_builder_ok = True
    else:
        print("  Could not parse API response. Full output:")
        for line in out.splitlines():
            print(f"    | {line}")

    if not form_builder_ok:
        print("\n  FATAL: form-builder is NOT working. Not restarting other services.")
        sys.exit(1)

    # Step 6: Restart ALL other application services
    print("\n[6/6] Restarting ALL application services that use JWT...")
    print(f"  Services to restart: {len(APP_SERVICES)}")

    code, out = run_sudo(STG_APP,
        'docker ps --format "{{.Names}}" | grep aris-stg | sort', timeout=15)
    running_containers = [l.strip() for l in out.splitlines() if l.strip()]
    print(f"\n  Running aris-stg containers ({len(running_containers)}):")
    for cn in running_containers:
        print(f"    - {cn}")

    services_to_restart = []
    for svc in APP_SERVICES:
        if svc == "aris-stg-form-builder":
            continue
        if svc in running_containers:
            services_to_restart.append(svc)
        else:
            print(f"  SKIP (not running): {svc}")

    print(f"\n  Will restart {len(services_to_restart)} services (form-builder already done)...")

    priority_order = ["aris-stg-credential", "aris-stg-tenant"]
    ordered = []
    for p in priority_order:
        if p in services_to_restart:
            ordered.append(p)
            services_to_restart.remove(p)
    ordered.extend(sorted(services_to_restart))

    restarted = ["aris-stg-form-builder"]
    failed = []

    for svc in ordered:
        print(f"\n  Restarting {svc}...")
        code, out = run_sudo(STG_APP, f"docker restart {svc}", timeout=30)
        if code == 0:
            print(f"    OK: {out}")
            restarted.append(svc)
        else:
            print(f"    FAILED (exit {code}): {out}")
            failed.append(svc)

    print("\n  Waiting 15 seconds for services to initialize...")
    time.sleep(15)

    print("\n" + "=" * 70)
    print("  RESTART SUMMARY")
    print("=" * 70)
    print(f"\n  Successfully restarted ({len(restarted)}):")
    for svc in restarted:
        print(f"    [OK] {svc}")

    if failed:
        print(f"\n  Failed to restart ({len(failed)}):")
        for svc in failed:
            print(f"    [FAIL] {svc}")

    print("\n  Quick health check after restart...")
    health_script = f'''#!/bin/bash
echo "=== Credential (3002) ==="
curl -s -o /dev/null -w "HTTP %{{http_code}}" http://localhost:3002/api/v1/credential/auth/login 2>&1 || echo "UNREACHABLE"
echo ""
echo "=== Tenant (3001) ==="
curl -s -o /dev/null -w "HTTP %{{http_code}}" http://localhost:3001/api/v1/tenant 2>&1 || echo "UNREACHABLE"
echo ""
echo "=== Form-Builder (3010) ==="
curl -s -o /dev/null -w "HTTP %{{http_code}}" http://localhost:3010/api/v1/form-builder/templates -H "Authorization: Bearer {token}" 2>&1 || echo "UNREACHABLE"
echo ""
echo "=== Master-Data (3003) ==="
curl -s -o /dev/null -w "HTTP %{{http_code}}" http://localhost:3003/api/v1/master-data/species -H "Authorization: Bearer {token}" 2>&1 || echo "UNREACHABLE"
echo ""
echo "=== Web (3000) ==="
curl -s -o /dev/null -w "HTTP %{{http_code}}" http://localhost:3000/ 2>&1 || echo "UNREACHABLE"
echo ""
'''
    code, out, err = run_script(STG_APP, health_script, timeout=30)
    for line in out.splitlines():
        if line.strip():
            print(f"    {line}")

    print("\n" + "=" * 70)
    print("  DONE")
    print("=" * 70)


if __name__ == "__main__":
    main()

