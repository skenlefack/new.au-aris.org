"""
Update domain name/description translations in DB (staging + production)
via docker cp + docker exec psql -f inside the postgres container.
"""

import paramiko
import json
import sys
import tempfile
import os

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S"

ENVS = [
    {
        "name": "STAGING",
        "db_host": "10.202.101.148",
        "db_pass": "Ar1s_Stg_2024!xK9mZ",
        "pg_container": "aris-stg-postgres",
    },
    {
        "name": "PRODUCTION",
        "db_host": "10.202.101.185",
        "db_pass": "@u-1baR.0rg$U24",
        "pg_container": "aris-postgres",
    },
]

DOMAINS = [
    {
        "code": "governance",
        "name": {"en": "Governance & Capacities", "fr": "Gouvernance et capacit\u00e9s", "pt": "Governan\u00e7a e Capacidades"},
        "description": {
            "en": "Legal frameworks, veterinary services evaluation, PVS metrics, and institutional capacity building.",
            "fr": "Cadres juridiques, \u00e9valuation des services v\u00e9t\u00e9rinaires, indicateurs PVS et renforcement des capacit\u00e9s institutionnelles.",
            "pt": "Quadros legais, avalia\u00e7\u00e3o de servi\u00e7os veterin\u00e1rios, m\u00e9tricas PVS e capacita\u00e7\u00e3o institucional.",
        },
    },
    {
        "code": "animal-health",
        "name": {"en": "Animal Health & One Health", "fr": "Sant\u00e9 animale et One Health", "pt": "Sa\u00fade Animal e One Health"},
        "description": {
            "en": "Disease surveillance, outbreak management, laboratory results, vaccination campaigns, and antimicrobial resistance monitoring.",
            "fr": "Surveillance des maladies, gestion des foyers, r\u00e9sultats de laboratoire, campagnes de vaccination et surveillance de la r\u00e9sistance aux antimicrobiens.",
            "pt": "Vigil\u00e2ncia de doen\u00e7as, gest\u00e3o de surtos, resultados laboratoriais, campanhas de vacina\u00e7\u00e3o e monitoriza\u00e7\u00e3o da resist\u00eancia antimicrobiana.",
        },
    },
    {
        "code": "livestock-prod",
        "name": {"en": "Production & Pastoralism", "fr": "Production et pastoralisme", "pt": "Produ\u00e7\u00e3o e Pastoralismo"},
        "description": {
            "en": "Livestock census, production systems, slaughterhouse data, and transhumance corridor management.",
            "fr": "Recensement du b\u00e9tail, syst\u00e8mes de production, donn\u00e9es d\u2019abattage et gestion des corridors de transhumance.",
            "pt": "Recenseamento pecu\u00e1rio, sistemas de produ\u00e7\u00e3o, dados de abate e gest\u00e3o de corredores de transum\u00e2ncia.",
        },
    },
    {
        "code": "trade-sps",
        "name": {"en": "Trade, Markets & SPS", "fr": "Commerce, march\u00e9s et SPS", "pt": "Com\u00e9rcio, Mercados e SPS"},
        "description": {
            "en": "Trade flows, SPS certification, market price intelligence, and AfCFTA integration support.",
            "fr": "Flux commerciaux, certification SPS, intelligence des prix de march\u00e9 et soutien \u00e0 l\u2019int\u00e9gration ZLECAf.",
            "pt": "Fluxos comerciais, certifica\u00e7\u00e3o SPS, intelig\u00eancia de pre\u00e7os de mercado e suporte \u00e0 integra\u00e7\u00e3o ZLECAf.",
        },
    },
    {
        "code": "fisheries",
        "name": {"en": "Fisheries & Aquaculture", "fr": "P\u00eaches et aquaculture", "pt": "Pescas e Aquicultura"},
        "description": {
            "en": "Capture fisheries, fishing fleet management, aquaculture farms, and aquatic animal health.",
            "fr": "P\u00eache de capture, gestion de la flotte de p\u00eache, fermes aquacoles et sant\u00e9 des animaux aquatiques.",
            "pt": "Pesca de captura, gest\u00e3o de frotas pesqueiras, fazendas de aquicultura e sa\u00fade de animais aqu\u00e1ticos.",
        },
    },
    {
        "code": "wildlife",
        "name": {"en": "Wildlife & Biodiversity", "fr": "Faune sauvage et biodiversit\u00e9", "pt": "Vida Selvagem e Biodiversidade"},
        "description": {
            "en": "Wildlife inventories, protected area management, CITES permits, and human-wildlife conflict resolution.",
            "fr": "Inventaires de la faune, gestion des aires prot\u00e9g\u00e9es, permis CITES et r\u00e9solution des conflits homme-faune.",
            "pt": "Invent\u00e1rios de vida selvagem, gest\u00e3o de \u00e1reas protegidas, licen\u00e7as CITES e resolu\u00e7\u00e3o de conflitos homem-fauna.",
        },
    },
    {
        "code": "apiculture",
        "name": {"en": "Apiculture & Pollination", "fr": "Apiculture et pollinisation", "pt": "Apicultura e Poliniza\u00e7\u00e3o"},
        "description": {
            "en": "Apiary management, honey and hive product production, colony health monitoring, and beekeeper training.",
            "fr": "Gestion des ruchers, production de miel et produits de la ruche, suivi de la sant\u00e9 des colonies et formation des apiculteurs.",
            "pt": "Gest\u00e3o de api\u00e1rios, produ\u00e7\u00e3o de mel e produtos da colmeia, monitoriza\u00e7\u00e3o da sa\u00fade das col\u00f3nias e forma\u00e7\u00e3o de apicultores.",
        },
    },
    {
        "code": "climate-env",
        "name": {"en": "Climate & Environment", "fr": "Climat et environnement", "pt": "Clima e Ambiente"},
        "description": {
            "en": "Water stress monitoring, rangeland condition assessment, GHG tracking, and vulnerability hotspot mapping.",
            "fr": "Suivi du stress hydrique, \u00e9valuation de l\u2019\u00e9tat des parcours, suivi des GES et cartographie des zones vuln\u00e9rables.",
            "pt": "Monitoriza\u00e7\u00e3o do estresse h\u00eddrico, avalia\u00e7\u00e3o da condi\u00e7\u00e3o das pastagens, rastreamento de GEE e mapeamento de pontos de vulnerabilidade.",
        },
    },
    {
        "code": "knowledge-hub",
        "name": {"en": "Knowledge Management", "fr": "Gestion des connaissances", "pt": "Gest\u00e3o do Conhecimento"},
        "description": {
            "en": "Knowledge base, e-repository, e-learning platform, policy briefs, and monitoring/evaluation/learning.",
            "fr": "Base de connaissances, e-r\u00e9f\u00e9rentiel, plateforme e-learning, notes de politique et suivi/\u00e9valuation/apprentissage.",
            "pt": "Base de conhecimento, e-reposit\u00f3rio, plataforma de e-learning, notas de pol\u00edtica e monitoriza\u00e7\u00e3o/avalia\u00e7\u00e3o/aprendizagem.",
        },
    },
]


def build_sql():
    """Build a single SQL script with all UPDATE statements."""
    lines = ["-- ARIS 4.0 Domain translation updates"]
    for d in DOMAINS:
        code = d["code"]
        name_json = json.dumps(d["name"], ensure_ascii=False).replace("'", "''")
        desc_json = json.dumps(d["description"], ensure_ascii=False).replace("'", "''")
        lines.append(
            f'UPDATE governance.domains '
            f"SET \"name\" = '{name_json}'::jsonb, "
            f"\"description\" = '{desc_json}'::jsonb "
            f"WHERE \"code\" = '{code}';"
        )
    return "\n".join(lines)


def run_ssh(ssh, cmd, timeout=120):
    print(f"  > {cmd[:140]}{'...' if len(cmd) > 140 else ''}")
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")
    code = stdout.channel.recv_exit_status()
    combined = (out + err).strip()
    if combined:
        for line in combined.split("\n")[-15:]:
            print(f"    {line}")
    return code, out, err


def update_db(env):
    name = env["name"]
    db_host = env["db_host"]
    container = env["pg_container"]

    print(f"\n{'='*60}")
    print(f"  UPDATING DB -- {name} ({db_host})")
    print(f"{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    try:
        ssh.connect(db_host, username=SSH_USER, password=SSH_PASS, timeout=30)
        print("  Connected.")

        # 1. Build SQL script
        sql_content = build_sql()

        # 2. Write SQL file on the remote host via heredoc
        print("  Writing SQL file on remote host...")
        write_cmd = f"cat > /tmp/domain_translations.sql << 'SQLEOF'\n{sql_content}\nSQLEOF"
        exit_code, out, err = run_ssh(ssh, write_cmd)
        if exit_code != 0:
            print(f"  ERROR writing SQL file: {err}")
            return False

        # 3. Copy SQL file into the Docker container
        print("  Copying SQL file into container...")
        cp_cmd = f"{SUDO} docker cp /tmp/domain_translations.sql {container}:/tmp/domain_translations.sql"
        exit_code, out, err = run_ssh(ssh, cp_cmd)
        if exit_code != 0:
            print(f"  ERROR copying to container: {err}")
            return False

        # 4. Execute SQL file inside the container
        print("  Executing SQL inside container...")
        exec_cmd = f"{SUDO} docker exec {container} psql -U aris -d aris -f /tmp/domain_translations.sql"
        exit_code, out, err = run_ssh(ssh, exec_cmd)

        # Count UPDATE results
        ok_count = out.count("UPDATE 1")
        print(f"\n  {name}: {ok_count}/9 domains updated (exit code: {exit_code}).")

        # 5. Cleanup
        run_ssh(ssh, f"rm -f /tmp/domain_translations.sql")
        run_ssh(ssh, f"{SUDO} docker exec {container} rm -f /tmp/domain_translations.sql")

        return ok_count == 9

    except Exception as e:
        print(f"  ERROR: {e}")
        return False
    finally:
        ssh.close()


def main():
    print("=" * 60)
    print("  ARIS 4.0 -- Domain Translation DB Update")
    print("=" * 60)

    results = {}
    for env in ENVS:
        results[env["name"]] = update_db(env)

    print(f"\n{'='*60}")
    print("  SUMMARY")
    print(f"{'='*60}")
    for name, ok in results.items():
        print(f"  {name}: {'OK' if ok else 'FAILED'}")
    print(f"{'='*60}")

    return 0 if all(results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
