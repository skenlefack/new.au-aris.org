"""Smoke test the data-sharing module on staging + production."""
import paramiko

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S bash -c"

TARGETS = [
    ("STAGING", "10.202.101.146", "aris-stg-data-sharing", "test.au-aris.org"),
    ("PRODUCTION", "10.202.101.183", "aris-data-sharing", "au-aris.org"),
]


def run(ssh, cmd, timeout=60):
    print(f"  $ {cmd[:140]}{'...' if len(cmd) > 140 else ''}")
    _, out_h, err_h = ssh.exec_command(cmd, timeout=timeout)
    out = out_h.read().decode("utf-8", errors="replace")
    err = err_h.read().decode("utf-8", errors="replace")
    text = (out + err).strip()
    if text:
        for line in text.splitlines()[-12:]:
            print(f"    {line}")
    return text


for label, host, container, hostname in TARGETS:
    print(f"\n{'='*60}\n{label} ({host})\n{'='*60}")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=30)

        # 1. Container status
        print("\n[1] Container status")
        run(ssh, f"{SUDO} 'docker ps --filter name={container} --format \"{{{{.Status}}}} | {{{{.Names}}}}\"'")

        # 2. Health endpoint
        print("\n[2] Internal health")
        run(ssh, "curl -sf http://localhost:3034/health || echo HEALTH_FAIL")

        # 3. Verify schema tables exist (introspect via psql)
        print("\n[3] DB schema check (data_sharing.data_share_agreements)")
        if label == "STAGING":
            db_pass = "Ar1s_Stg_2024!xK9mZ"
            db_host = "10.202.101.148"
            db_name = "aris"
        else:
            db_pass = "ArisDB2024!@SecurePass"
            db_host = "10.202.101.185"
            db_name = "aris"
        run(ssh,
            f"PGPASSWORD='{db_pass}' psql -h {db_host} -U arisuser -d {db_name} "
            f"-c \"\\dt data_sharing.*\" 2>&1 | tail -10")

        # 4. Through Traefik
        print("\n[4] Public health via Traefik /api/v1/data-sharing")
        run(ssh, f"curl -sk -o /dev/null -w '%{{http_code}}\\n' https://{hostname}/api/v1/data-sharing/agreements")

        # 5. Recent logs
        print("\n[5] Recent service logs (last 15 lines)")
        run(ssh, f"{SUDO} 'docker logs --tail 15 {container} 2>&1'")
    finally:
        ssh.close()
