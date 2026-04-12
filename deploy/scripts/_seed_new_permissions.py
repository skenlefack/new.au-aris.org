"""Seed new permissions for features implemented in WS-2 to WS-9."""
import paramiko, json, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.183", username="arisadmin",
            password="@u-1baR.0rg$U24", timeout=15,
            allow_agent=False, look_for_keys=False)

_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    """-d '{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}' 2>/dev/null""",
    timeout=15)
token = json.loads(stdout.read().decode())["data"]["accessToken"]
print("Authenticated\n")

# New permissions to add (module, feature, actions, description_en, description_fr)
NEW_PERMISSIONS = [
    # Fisheries — missing features
    ("fisheries", "efforts", ["view","create","edit","delete","export"], "Fishing effort reports", "Rapports d'effort de peche"),
    ("fisheries", "trade", ["view","create","edit","delete","export"], "Fish trade data", "Donnees commerciales poisson"),
    ("fisheries", "export", ["view","export"], "Fisheries data export (FishStatJ)", "Export donnees peche (FishStatJ)"),
    ("fisheries", "import", ["view","create"], "Fisheries bulk import", "Import en masse peche"),

    # Interop — new connectors
    ("interop", "fishstatj", ["view","create","export","configure"], "FishStatJ FAO connector", "Connecteur FishStatJ FAO"),
    ("interop", "cites", ["view","create","export","configure"], "CITES/WDPA connector", "Connecteur CITES/WDPA"),

    # Knowledge — e-learning
    ("knowledge", "elearning", ["view","create","edit","delete","configure"], "E-learning courses", "Cours e-learning"),

    # Trade — additional form-based features
    ("trade", "cost-production", ["view","create","edit","delete","export"], "Cost of production surveys", "Enquetes cout de production"),
    ("trade", "transport", ["view","create","edit","delete","export"], "Transport volume data", "Donnees volume de transport"),
    ("trade", "quality-standards", ["view","create","edit","delete","validate"], "Quality standards assessments", "Evaluations normes qualite"),

    # Data Sharing — new module
    ("data-sharing", "agreements", ["view","create","edit","delete","validate","configure"], "Sharing agreements management", "Gestion des accords de partage"),
    ("data-sharing", "preview", ["view"], "Preview shared data", "Apercu donnees partagees"),
    ("data-sharing", "export", ["view","export"], "Export shared data", "Export donnees partagees"),

    # Analytics — new features
    ("analytics", "kpis", ["view","configure"], "Continental KPI dashboards", "Tableaux de bord KPI continentaux"),
    ("analytics", "dashboards", ["view","configure"], "Embedded Superset dashboards", "Dashboards Superset embarques"),

    # PAID — new module
    ("paid", "dashboard", ["view"], "PAID dashboard", "Tableau de bord PAID"),
    ("paid", "collecte", ["view","create","edit","delete","export"], "PAID data collection", "Collecte de donnees PAID"),
    ("paid", "campaigns", ["view","create","edit","configure"], "PAID campaigns management", "Gestion des campagnes PAID"),
]

# Build SQL INSERT statements
values = []
for module, feature, actions, desc_en, desc_fr in NEW_PERMISSIONS:
    for action in actions:
        desc_json = json.dumps({"en": desc_en, "fr": desc_fr}).replace("'", "''")
        values.append(
            f"(gen_random_uuid(), '{module}', '{feature}', '{action}', "
            f"'{desc_json}'::jsonb, true, now(), now())"
        )

sql = (
    "INSERT INTO governance.permissions (id, module, feature, action, description, is_active, created_at, updated_at) VALUES\n"
    + ",\n".join(values)
    + "\nON CONFLICT (module, feature, action) DO NOTHING;\n"
)

print(f"Inserting {len(values)} permissions ({len(NEW_PERMISSIONS)} features)...\n")

# Write SQL to server and execute
sftp = ssh.open_sftp()
with sftp.file("/tmp/seed_perms.sql", "w") as f:
    f.write(sql)
sftp.close()

SUDO = "echo '@u-1baR.0rg$U24' | sudo -S"
_, stdout, _ = ssh.exec_command(
    f"{SUDO} bash -c 'docker cp /tmp/seed_perms.sql aris-postgres:/tmp/ && "
    f"docker exec aris-postgres psql -U aris -d aris -f /tmp/seed_perms.sql'",
    timeout=30)
time.sleep(3)
out = stdout.read().decode(errors="replace").strip()
print(f"Result: {out}")

# Verify
_, stdout, _ = ssh.exec_command(
    f'curl -sk "https://localhost/api/v1/settings/permissions?limit=500" '
    f'-H "Authorization: Bearer {token}" 2>/dev/null', timeout=15)
perms = json.loads(stdout.read().decode()).get("data", [])

from collections import defaultdict
by_mod = defaultdict(set)
for p in perms:
    by_mod[p.get("module", "?")].add(p.get("feature", "?"))

print(f"\nTotal permissions: {len(perms)} | Modules: {len(by_mod)}")
for mod in sorted(by_mod.keys()):
    print(f"  {mod}: {sorted(by_mod[mod])}")

ssh.close()

# Also do same on staging DB
print("\n--- Seeding staging DB ---")
ssh2 = paramiko.SSHClient()
ssh2.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh2.connect("10.202.101.148", username="arisadmin",
             password="@u-1baR.0rg$U24", timeout=15,
             allow_agent=False, look_for_keys=False)
sftp2 = ssh2.open_sftp()
with sftp2.file("/tmp/seed_perms.sql", "w") as f:
    f.write(sql)
sftp2.close()
_, stdout, _ = ssh2.exec_command(
    f"{SUDO} bash -c 'docker cp /tmp/seed_perms.sql aris-stg-postgres:/tmp/ && "
    f"docker exec aris-stg-postgres psql -U aris -d aris -f /tmp/seed_perms.sql'",
    timeout=30)
time.sleep(3)
print(f"Staging: {stdout.read().decode(errors='replace').strip()}")
ssh2.close()
print("DONE")
