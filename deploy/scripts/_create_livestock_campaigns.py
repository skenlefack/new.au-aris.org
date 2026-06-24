"""Create 7 Livestock & Production campaigns on production."""
import paramiko, sys, json

sys.stdout.reconfigure(encoding="utf-8", errors="replace")
SSH_PASS = "@u-1baR.0rg$U24"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect("10.202.101.183", username="arisadmin", password=SSH_PASS, timeout=15, allow_agent=False, look_for_keys=False)

_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    "-d '{\"email\":\"admin@au-aris.org\",\"password\":\"Aris2026@@4!0\"}' 2>/dev/null",
    timeout=15,
)
token = json.loads(stdout.read().decode())["data"]["accessToken"]

ALL_55 = ["DZ","AO","BJ","BW","BF","BI","CV","CM","CF","TD","KM","CG","CD","CI","DJ","EG","GQ","ER","SZ","ET","GA","GM","GH","GN","GW","KE","LS","LR","LY","MG","MW","ML","MR","MU","MA","MZ","NA","NE","NG","RW","ST","SN","SC","SL","SO","ZA","SS","SD","TZ","TG","TN","UG","ZM","ZW"]
PILOT = ["KE","ET","NG","SN","ZA","TZ","CM","GH","EG","MA"]

campaigns = [
    {
        "code": "LP_POPULATION_CENSUS_2026",
        "name": {"en": "Annual Animal Population Census 2026", "fr": "Recensement annuel de la population animale 2026", "pt": "Recenseamento anual da populacao animal 2026"},
        "description": {"en": "Comprehensive annual livestock census covering population counts, mortality rates, sex ratios, and production systems across all AU Member States", "fr": "Recensement annuel complet du cheptel couvrant les effectifs, les taux de mortalite, les sex-ratios et les systemes de production dans tous les Etats membres", "pt": "Recenseamento anual completo do gado abrangendo contagens populacionais, taxas de mortalidade, proporcoes de sexo e sistemas de producao"},
        "domain": "livestock-prod",
        "formTemplateId": "b3d0d91a-bb21-4ae4-a0c7-951efa828947",
        "startDate": "2026-01-01", "endDate": "2026-12-31",
        "targetCountries": ALL_55, "targetSubmissions": 660, "targetPerAgent": 12,
        "frequency": "annual", "scope": "continental",
        "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"
    },
    {
        "code": "LP_GENETIC_DIVERSITY_2026",
        "name": {"en": "Animal Genetic Diversity Survey 2026", "fr": "Enquete sur la diversite genetique animale 2026", "pt": "Pesquisa de diversidade genetica animal 2026"},
        "description": {"en": "Annual survey of breed characteristics, genetic diversity indicators, and population numbers for indigenous and exotic breeds", "fr": "Enquete annuelle sur les caracteristiques des races, les indicateurs de diversite genetique et les effectifs des races locales et exotiques", "pt": "Pesquisa anual sobre caracteristicas raciais, indicadores de diversidade genetica e numeros populacionais"},
        "domain": "livestock-prod",
        "formTemplateId": "c9da108c-ea16-4788-a9f6-a526a7c1800c",
        "startDate": "2026-01-01", "endDate": "2026-12-31",
        "targetCountries": ALL_55, "targetSubmissions": 330, "targetPerAgent": 6,
        "frequency": "annual", "scope": "continental",
        "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"
    },
    {
        "code": "LP_BREEDING_PROGRAMS_H1_2026",
        "name": {"en": "Breeding & Genomics Programs H1 2026", "fr": "Programmes de reproduction et genomique S1 2026", "pt": "Programas de reproducao e genomica S1 2026"},
        "description": {"en": "Biannual reporting on breeding improvement programs, assisted reproductive technologies, and genomic selection initiatives", "fr": "Rapportage semestriel sur les programmes d amelioration genetique, les technologies de reproduction assistee et les initiatives de selection genomique", "pt": "Relatorio semestral sobre programas de melhoramento genetico, tecnologias de reproducao assistida e iniciativas de selecao genomica"},
        "domain": "livestock-prod",
        "formTemplateId": "6afb5283-8332-4c7d-8685-a17d0f820af7",
        "startDate": "2026-01-01", "endDate": "2026-06-30",
        "targetCountries": PILOT, "targetSubmissions": 200, "targetPerAgent": 10,
        "frequency": "biannual", "scope": "continental",
        "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"
    },
    {
        "code": "LP_BREEDER_ASSOCIATIONS_2026",
        "name": {"en": "Breeder Associations Registry 2026", "fr": "Registre des associations d eleveurs 2026", "pt": "Registo de associacoes de criadores 2026"},
        "description": {"en": "Annual registry of breeder associations including membership, breeding stock sales, and genetic material trade data", "fr": "Registre annuel des associations d eleveurs incluant les membres, les ventes de reproducteurs et les donnees du commerce de materiel genetique", "pt": "Registo anual das associacoes de criadores incluindo membros, vendas de reproductores e dados de comercio de material genetico"},
        "domain": "livestock-prod",
        "formTemplateId": "e7d99533-5f41-49a6-863f-71c76587d0ad",
        "startDate": "2026-01-01", "endDate": "2026-12-31",
        "targetCountries": PILOT, "targetSubmissions": 160, "targetPerAgent": 8,
        "frequency": "annual", "scope": "continental",
        "sendReminders": True, "reminderDaysBefore": 5, "status": "ACTIVE"
    },
    {
        "code": "LP_DISASTER_REPORT_2026",
        "name": {"en": "Disaster & Risk Management Report 2026", "fr": "Rapport gestion des catastrophes et risques 2026", "pt": "Relatorio de gestao de desastres e riscos 2026"},
        "description": {"en": "Continuous reporting on natural disasters affecting livestock, early warning systems, preparedness agencies, and animal/human losses", "fr": "Rapportage continu sur les catastrophes naturelles affectant le cheptel, les systemes d alerte precoce, les agences de preparedness et les pertes", "pt": "Relatorio continuo sobre desastres naturais que afetam o gado, sistemas de alerta precoce, agencias de preparacao e perdas"},
        "domain": "livestock-prod",
        "formTemplateId": "0ea6f458-9f2c-4aaa-a2c7-6901af00fa68",
        "startDate": "2026-01-01", "endDate": "2026-12-31",
        "targetCountries": ALL_55, "targetSubmissions": 100,
        "frequency": "one_time", "scope": "continental",
        "sendReminders": True, "reminderDaysBefore": 1, "status": "ACTIVE"
    },
    {
        "code": "LP_LEGISLATION_REVIEW_2026",
        "name": {"en": "Animal Production Legislation Review 2026", "fr": "Revue legislative de la production animale 2026", "pt": "Revisao legislativa da producao animal 2026"},
        "description": {"en": "Annual review of existing legislation on animal production governance, enforcement mechanisms, and implementation status", "fr": "Revue annuelle de la legislation existante sur la gouvernance de la production animale, les mecanismes d application et l etat de mise en oeuvre", "pt": "Revisao anual da legislacao existente sobre governanca da producao animal, mecanismos de aplicacao e estado de implementacao"},
        "domain": "livestock-prod",
        "formTemplateId": "5d15e421-118d-446a-91bd-2fa7fbe09826",
        "startDate": "2026-01-01", "endDate": "2026-12-31",
        "targetCountries": ALL_55, "targetSubmissions": 55, "targetPerAgent": 1,
        "frequency": "annual", "scope": "continental",
        "sendReminders": True, "reminderDaysBefore": 14, "status": "ACTIVE"
    },
    {
        "code": "LP_GENETIC_CENTRES_2026",
        "name": {"en": "National Genetic Resources Centres Report 2026", "fr": "Rapport des centres nationaux de ressources genetiques 2026", "pt": "Relatorio dos centros nacionais de recursos geneticos 2026"},
        "description": {"en": "Annual reporting on genetic material storage, import/export volumes, transfer agreements, and standard operating procedures", "fr": "Rapportage annuel sur le stockage de materiel genetique, les volumes d import/export, les accords de transfert et les procedures operationnelles standard", "pt": "Relatorio anual sobre armazenamento de material genetico, volumes de importacao/exportacao, acordos de transferencia e procedimentos operacionais padrao"},
        "domain": "livestock-prod",
        "formTemplateId": "69f84593-683a-4467-b69e-8b00be7f3bc3",
        "startDate": "2026-01-01", "endDate": "2026-12-31",
        "targetCountries": PILOT, "targetSubmissions": 80, "targetPerAgent": 4,
        "frequency": "annual", "scope": "continental",
        "sendReminders": True, "reminderDaysBefore": 7, "status": "ACTIVE"
    },
]

print(f"Creating {len(campaigns)} campaigns...\n")

sftp = ssh.open_sftp()
for i, camp in enumerate(campaigns, 1):
    fname = f"/tmp/lp_camp_{i}.json"
    with sftp.open(fname, "w") as f:
        f.write(json.dumps(camp))

    _, stdout, _ = ssh.exec_command(
        f'curl -sk -X POST "https://localhost/api/v1/workflow/campaigns" '
        f'-H "Authorization: Bearer {token}" -H "Content-Type: application/json" '
        f'-d @{fname} 2>/dev/null',
        timeout=15,
    )
    out = stdout.read().decode()
    try:
        result = json.loads(out)
        if result.get("data", {}).get("id"):
            print(f'{i}. OK  {camp["name"]["en"]}')
            print(f'   ID: {result["data"]["id"]}')
        else:
            print(f'{i}. ERR {camp["name"]["en"]}: {result.get("message", out[:200])}')
    except:
        print(f'{i}. RAW {out[:200]}')

    ssh.exec_command(f"rm -f {fname}")

sftp.close()
ssh.close()
print("\nDONE")
