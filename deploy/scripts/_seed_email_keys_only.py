#!/usr/bin/env python3
"""Upsert 3 SMTP config keys into governance.system_configs on both envs."""
import paramiko, sys

if sys.platform == "win32": sys.stdout.reconfigure(encoding="utf-8", errors="replace")

UPSERT_SQL = """
INSERT INTO governance.system_configs (id, category, key, value, label, description, type, is_editable, scope, created_at, updated_at)
VALUES
  (gen_random_uuid(), 'email', 'email.smtp.secure', 'false'::jsonb,
    '{"en":"SMTP Use TLS","fr":"SMTP Utiliser TLS","pt":"SMTP Usar TLS"}'::jsonb,
    '{"en":"Enable for implicit TLS (port 465). Leave disabled for STARTTLS or plain relays.","fr":"Activer pour TLS implicite (port 465).","pt":"Ative para TLS implicito (porta 465)."}'::jsonb,
    'boolean', true, 'global', now(), now()),
  (gen_random_uuid(), 'email', 'email.smtp.user', '""'::jsonb,
    '{"en":"SMTP Username","fr":"Utilisateur SMTP","pt":"Usuario SMTP"}'::jsonb,
    '{"en":"Username for SMTP authentication. Leave empty for unauthenticated relays.","fr":"Nom d''utilisateur SMTP. Laisser vide pour relais sans authentification.","pt":"Usuario SMTP. Deixe vazio para relays sem autenticacao."}'::jsonb,
    'string', true, 'global', now(), now()),
  (gen_random_uuid(), 'email', 'email.smtp.pass', '""'::jsonb,
    '{"en":"SMTP Password","fr":"Mot de passe SMTP","pt":"Senha SMTP"}'::jsonb,
    '{"en":"Password for SMTP authentication. Stored as a secret.","fr":"Mot de passe SMTP. Stocke comme secret.","pt":"Senha SMTP. Armazenada como segredo."}'::jsonb,
    'secret', true, 'global', now(), now())
ON CONFLICT (category, key) DO NOTHING;
"""

ENVS = [
    {"name": "STG",  "db_host": "10.202.101.148", "pg_container": "aris-stg-postgres", "pg_pass": "Ar1s_Stg_2024!xK9mZ", "sudo": False},
    {"name": "PROD", "db_host": "10.202.101.185", "pg_container": "aris-postgres",     "pg_pass": "Ar1s_Pr0d_2024!xK9mZ", "sudo": True},
]

def run(ssh, cmd, use_sudo=False, timeout=60):
    if use_sudo:
        esc = cmd.replace("'", "'\\''")
        cmd = f"echo '@u-1baR.0rg$U24' | sudo -S bash -c '{esc}'"
    print(f"  $ {cmd[:150]}")
    _, out, _ = ssh.exec_command(cmd, timeout=timeout, get_pty=True)
    print("    " + out.read().decode(errors="replace")[-800:].replace("\n", "\n    "))

for env in ENVS:
    print(f"\n═══ {env['name']} ═══")
    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    ssh.connect(env["db_host"], username="arisadmin", password="@u-1baR.0rg$U24", timeout=15, allow_agent=False, look_for_keys=False)
    sftp = ssh.open_sftp()
    with sftp.open("/tmp/seed-email-keys.sql", "w") as f:
        f.write(UPSERT_SQL)
    sftp.close()
    run(ssh, f"docker cp /tmp/seed-email-keys.sql {env['pg_container']}:/tmp/seed-email-keys.sql", use_sudo=env["sudo"])
    run(
        ssh,
        f'docker exec -e PGPASSWORD="{env["pg_pass"]}" {env["pg_container"]} '
        f"psql -U aris -d aris -f /tmp/seed-email-keys.sql",
        use_sudo=env["sudo"],
    )
    run(
        ssh,
        f'docker exec -e PGPASSWORD="{env["pg_pass"]}" {env["pg_container"]} '
        f"psql -U aris -d aris -c \"SELECT key FROM governance.system_configs WHERE category='email' ORDER BY key\"",
        use_sudo=env["sudo"],
    )
    ssh.close()
