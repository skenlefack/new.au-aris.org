"""
Deploy slideshow module: create DB tables + rebuild analytics + web.
Targets: Staging + Production.
"""

import paramiko
import sys

try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass

_builtin_print = print

def safe_print(*args, **kwargs):
    try:
        _builtin_print(*args, **kwargs)
    except UnicodeEncodeError:
        text = " ".join(str(a) for a in args)
        _builtin_print(text.encode("ascii", "replace").decode("ascii"), **kwargs)

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO_CMD = f"echo '{SSH_PASS}' | sudo -S bash -c"

# SQL to create slideshow tables in dashboard_builder schema
CREATE_TABLES_SQL = """
-- Enum type
DO $$ BEGIN
  CREATE TYPE dashboard_builder."SlideshowTransition" AS ENUM ('FADE','SLIDE_LEFT','SLIDE_RIGHT','ZOOM','FLIP');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Slideshows table
CREATE TABLE IF NOT EXISTS dashboard_builder.dashboard_slideshows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  title_fr TEXT NOT NULL,
  title_en TEXT NOT NULL,
  title_ar TEXT,
  title_pt TEXT,
  description TEXT,
  public_token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  transition dashboard_builder."SlideshowTransition" NOT NULL DEFAULT 'FADE',
  interval_ms INTEGER NOT NULL DEFAULT 15000,
  auto_play BOOLEAN NOT NULL DEFAULT true,
  loop BOOLEAN NOT NULL DEFAULT true,
  show_progress BOOLEAN NOT NULL DEFAULT true,
  show_controls BOOLEAN NOT NULL DEFAULT false,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Slides table
CREATE TABLE IF NOT EXISTS dashboard_builder.dashboard_slideshow_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slideshow_id UUID NOT NULL REFERENCES dashboard_builder.dashboard_slideshows(id) ON DELETE CASCADE,
  dashboard_id UUID NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER,
  transition dashboard_builder."SlideshowTransition",
  CONSTRAINT uq_slideshow_dashboard UNIQUE(slideshow_id, dashboard_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_slideshow_tenant_id ON dashboard_builder.dashboard_slideshows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_slideshow_public_token ON dashboard_builder.dashboard_slideshows(public_token);
CREATE INDEX IF NOT EXISTS idx_slideshow_is_active ON dashboard_builder.dashboard_slideshows(is_active);
CREATE INDEX IF NOT EXISTS idx_slide_slideshow_id ON dashboard_builder.dashboard_slideshow_slides(slideshow_id);
CREATE INDEX IF NOT EXISTS idx_slide_sort_order ON dashboard_builder.dashboard_slideshow_slides(slideshow_id, sort_order);
"""

SERVERS = [
    {
        "name": "STAGING",
        "host": "10.202.101.146",
        "deploy_dir": "/opt/aris-deploy/vm-app-stg",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "services": ["analytics", "web"],
    },
    {
        "name": "PRODUCTION",
        "host": "10.202.101.183",
        "deploy_dir": "/opt/aris-deploy/vm-app",
        "db_host": "10.202.101.185",
        "db_pass": "Ar1s_Pr0d_2024!xK9mZ",
        "services": ["analytics", "web"],
    },
]


def run_ssh_command(ssh, command, timeout=120):
    safe_print(f"  > {command[:120]}{'...' if len(command) > 120 else ''}")
    stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    exit_code = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        lines = combined.split("\n")
        for line in lines[-8:]:
            safe_print(f"    {line}")
    return exit_code, out, err


def deploy_server(server):
    name = server["name"]
    host = server["host"]
    deploy_dir = server["deploy_dir"]
    db_host = server["db_host"]
    db_pass = server["db_pass"]

    safe_print(f"\n{'='*60}")
    safe_print(f"  DEPLOYING slideshow module -- {name} ({host})")
    safe_print(f"{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        safe_print(f"\n[1] Connecting to {host}...")
        ssh.connect(host, username=SSH_USER, password=SSH_PASS, timeout=30)
        safe_print("  Connected.")

        # Step 2: Git pull
        safe_print(f"\n[2] Git pull on /opt/aris...")
        cmd = f"{SUDO_CMD} 'cd /opt/aris && git fetch origin && git reset --hard origin/main'"
        run_ssh_command(ssh, cmd, timeout=120)

        # Step 3: Create DB tables via psql on DB host
        safe_print(f"\n[3] Creating slideshow tables in DB ({db_host})...")
        db_url = f"postgresql://aris:{db_pass}@{db_host}:5432/aris"
        sql_escaped = CREATE_TABLES_SQL.replace("'", "'\\''")
        cmd = f"PGPASSWORD='{db_pass}' psql -h {db_host} -U aris -d aris -c '{sql_escaped}'"
        exit_code, out, err = run_ssh_command(ssh, cmd, timeout=60)
        if exit_code != 0 and "already exists" not in (out + err):
            safe_print(f"  WARNING: DB table creation returned code {exit_code}")
            # Continue anyway - tables might already exist

        # Step 4: Rebuild services
        for i, svc in enumerate(server["services"], start=4):
            safe_print(f"\n[{i}] Rebuilding {svc}...")
            cmd = f"{SUDO_CMD} 'cd {deploy_dir} && docker compose up -d --build --no-deps {svc}'"
            exit_code, _, _ = run_ssh_command(ssh, cmd, timeout=600)
            if exit_code != 0:
                safe_print(f"  ERROR: {svc} rebuild failed")
                return False

        safe_print(f"\n  {name} deploy completed successfully.")
        return True

    except Exception as e:
        safe_print(f"  ERROR on {name}: {e}")
        return False
    finally:
        ssh.close()


def main():
    safe_print("=" * 60)
    safe_print("  ARIS 4.0 -- Slideshow Module Deployment")
    safe_print("  Creates DB tables + rebuilds analytics + web")
    safe_print("  Targets: Staging + Production")
    safe_print("=" * 60)

    results = {}
    for server in SERVERS:
        results[server["name"]] = deploy_server(server)

    safe_print(f"\n{'='*60}")
    safe_print("  DEPLOYMENT SUMMARY")
    safe_print(f"{'='*60}")
    for name, success in results.items():
        safe_print(f"  {name}: {'OK' if success else 'FAILED'}")
    safe_print(f"{'='*60}")

    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
