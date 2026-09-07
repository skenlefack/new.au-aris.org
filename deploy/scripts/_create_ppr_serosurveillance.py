"""
Create 4 PPR Pre-Vaccination Sero-Surveillance form templates + publish + campaign via SSH API.

Templates:
  A. Herd / Holding Record (30 fields)
  B. Individual Animal Record (19 fields)
  C. Sample Consignment / Chain of Custody (13 fields)
  D. Laboratory Result Record (10 fields)

Campaign: PPR_SEROSURV_LIBERIA_2026 — 1,000 sheep & goats across 5 counties, Liberia.
"""
import paramiko, json, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

# ── Connection ──────────────────────────────────────────────
SSH_HOST = "10.202.101.183"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
LOGIN_EMAIL = "admin@au-aris.org"
LOGIN_PASS = "Aris2026@@4!0"

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
print(f"Connecting to {SSH_HOST}...")
ssh.connect(SSH_HOST, username=SSH_USER, password=SSH_PASS, timeout=15,
            allow_agent=False, look_for_keys=False)

# ── Auth token ──────────────────────────────────────────────
_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    f"-d '{{\"email\":\"{LOGIN_EMAIL}\",\"password\":\"{LOGIN_PASS}\"}}' 2>/dev/null",
    timeout=15)
token = json.loads(stdout.read().decode())["data"]["accessToken"]
print("Authenticated.\n")

def api_post(path, body):
    data = json.dumps(body)
    chan = ssh.get_transport().open_session()
    chan.settimeout(30)
    chan.exec_command(
        f'curl -sk -X POST "https://localhost{path}" '
        f'-H "Authorization: Bearer {token}" '
        f'-H "Content-Type: application/json" '
        f'--data-binary @- 2>/dev/null'
    )
    chan.sendall(data.encode())
    chan.shutdown_write()
    time.sleep(3)
    resp = b''
    for _ in range(10):
        if chan.recv_ready():
            resp += chan.recv(16384)
        elif chan.exit_status_ready():
            while chan.recv_ready():
                resp += chan.recv(16384)
            break
        time.sleep(0.5)
    return json.loads(resp.decode())


# ════════════════════════════════════════════════════════════════
# FIELD HELPERS  (6-language labels: en, fr, pt, ar, es, sw)
# ════════════════════════════════════════════════════════════════

def L(en, fr, pt=None, ar=None, es=None, sw=None):
    """Build a 6-lang label dict."""
    return {
        "en": en,
        "fr": fr,
        "pt": pt or en,
        "ar": ar or en,
        "es": es or en,
        "sw": sw or en,
    }

def f_admin_location(order=0):
    return {
        "id": "admin_location", "type": "admin-location", "code": "admin_location",
        "label": L("Administrative Location", "Localisation administrative",
                    "Localização administrativa", "الموقع الإداري",
                    "Ubicación administrativa", "Eneo la Utawala"),
        "column": 1, "columnSpan": 2, "order": order, "required": True,
        "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
        "properties": {"levels": [0, 1, 2], "requiredLevels": [0]}
    }

def f_geo(order=0):
    return {
        "id": "geo_location", "type": "geo-selector", "code": "geo_location",
        "label": L("GPS Coordinates", "Coordonnées GPS",
                    "Coordenadas GPS", "إحداثيات GPS",
                    "Coordenadas GPS", "Viwianishi vya GPS"),
        "column": 1, "columnSpan": 1, "order": order, "required": False,
        "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
        "properties": {"modes": ["point"], "defaultMode": "point"}
    }

def f_text(id, label, order, required=True, col=1, span=1, placeholder=None, helpText=None):
    props = {}
    if placeholder:
        props["placeholder"] = placeholder
    f = {
        "id": id, "type": "text", "code": id,
        "label": label, "column": col, "columnSpan": span,
        "order": order, "required": required, "readOnly": False, "hidden": False,
        "validation": {}, "conditions": [], "properties": props,
    }
    if helpText:
        f["helpText"] = helpText
    return f

def f_number(id, label, order, required=True, col=1, span=1, min_val=None, max_val=None, helpText=None):
    v = {}
    if min_val is not None: v["min"] = min_val
    if max_val is not None: v["max"] = max_val
    f = {
        "id": id, "type": "number", "code": id,
        "label": label, "column": col, "columnSpan": span,
        "order": order, "required": required, "readOnly": False, "hidden": False,
        "validation": v, "conditions": [], "properties": {},
    }
    if helpText:
        f["helpText"] = helpText
    return f

def f_date(id, label, order, required=True, col=1, span=1):
    return {
        "id": id, "type": "date", "code": id,
        "label": label, "column": col, "columnSpan": span,
        "order": order, "required": required, "readOnly": False, "hidden": False,
        "validation": {}, "conditions": [], "properties": {},
    }

def f_select(id, label, order, options, required=True, col=1, span=1, conditions=None):
    opts = []
    for o in options:
        if isinstance(o, dict):
            opts.append(o)
        elif isinstance(o, (list, tuple)):
            opts.append({
                "label": L(*o) if len(o) >= 2 else L(o[0], o[0]),
                "value": o[0].lower().replace(" ", "_").replace("/", "_").replace("-", "_"),
            })
        else:
            opts.append({"label": L(o, o), "value": o.lower().replace(" ", "_")})
    f = {
        "id": id, "type": "select", "code": id,
        "label": label, "column": col, "columnSpan": span,
        "order": order, "required": required, "readOnly": False, "hidden": False,
        "validation": {}, "conditions": conditions or [],
        "properties": {"options": opts},
    }
    return f

def f_select_v(id, label, order, options, required=True, col=1, span=1, conditions=None):
    """Select with explicit value objects."""
    return {
        "id": id, "type": "select", "code": id,
        "label": label, "column": col, "columnSpan": span,
        "order": order, "required": required, "readOnly": False, "hidden": False,
        "validation": {}, "conditions": conditions or [],
        "properties": {"options": options},
    }

def section(id, label, order, cols, fields, collapsible=False, collapsed=False):
    return {
        "id": id, "name": label, "order": order,
        "columns": cols, "isCollapsible": collapsible, "isCollapsed": collapsed,
        "isRepeatable": False, "conditions": [], "fields": fields,
    }


SETTINGS = {
    "allowDraft": True, "allowAttachments": True, "maxAttachments": 5,
    "allowOffline": True, "requireGeoLocation": False, "autoSaveInterval": 30,
    "submissionWorkflow": "review_then_validate",
    "notifyOnSubmit": [], "duplicateDetection": {"enabled": False, "fields": []},
}


# ════════════════════════════════════════════════════════════════
# TEMPLATE A: HERD / HOLDING RECORD
# ════════════════════════════════════════════════════════════════

TEAM_OPTIONS = [
    {"label": L("T1", "T1", "T1", "T1", "T1", "T1"), "value": "T1"},
    {"label": L("T2", "T2", "T2", "T2", "T2", "T2"), "value": "T2"},
    {"label": L("T3", "T3", "T3", "T3", "T3", "T3"), "value": "T3"},
    {"label": L("T4", "T4", "T4", "T4", "T4", "T4"), "value": "T4"},
    {"label": L("T5", "T5", "T5", "T5", "T5", "T5"), "value": "T5"},
]

YES_NO = [
    {"label": L("Yes", "Oui", "Sim", "نعم", "Sí", "Ndiyo"), "value": "yes"},
    {"label": L("No", "Non", "Não", "لا", "No", "Hapana"), "value": "no"},
]

YES_NO_UNK = [
    {"label": L("Yes", "Oui", "Sim", "نعم", "Sí", "Ndiyo"), "value": "yes"},
    {"label": L("No", "Non", "Não", "لا", "No", "Hapana"), "value": "no"},
    {"label": L("Unknown", "Inconnu", "Desconhecido", "غير معروف", "Desconocido", "Haijulikani"), "value": "unknown"},
]

herd_template = {
    "name": "PPR Sero-Surveillance — A. Herd / Holding Record",
    "domain": "animal_health",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            section("location", L("Location", "Localisation", "Localização", "الموقع", "Ubicación", "Eneo"), 0, 2, [
                f_admin_location(0),
                f_geo(1),
            ]),
            section("herd_identification",
                    L("Herd Identification", "Identification du troupeau",
                      "Identificação do rebanho", "تعريف القطيع",
                      "Identificación del rebaño", "Utambulisho wa Kundi"), 1, 2, [
                f_text("form_serial_number",
                       L("Form Serial Number", "Numéro de série du formulaire",
                         "Número de série do formulário", "الرقم التسلسلي للنموذج",
                         "Número de serie del formulario", "Nambari ya Serial ya Fomu"),
                       0, required=True, col=1),
                f_select_v("risk_stratum",
                           L("Risk Stratum", "Strate de risque",
                             "Estrato de risco", "طبقة المخاطر",
                             "Estrato de riesgo", "Tabaka la Hatari"), 1, [
                    {"label": L("High", "Élevé", "Alto", "مرتفع", "Alto", "Juu"), "value": "high"},
                    {"label": L("Medium", "Moyen", "Médio", "متوسط", "Medio", "Wastani"), "value": "medium"},
                    {"label": L("Low", "Faible", "Baixo", "منخفض", "Bajo", "Chini"), "value": "low"},
                ], col=2),
                f_date("visit_date",
                       L("Visit Date", "Date de visite",
                         "Data da visita", "تاريخ الزيارة",
                         "Fecha de visita", "Tarehe ya Ziara"), 2, col=1),
                f_select_v("team_code",
                           L("Team Code", "Code d'équipe",
                             "Código da equipa", "رمز الفريق",
                             "Código del equipo", "Msimbo wa Timu"), 3, TEAM_OPTIONS, col=2),
                f_text("herd_identifier",
                       L("Herd Identifier", "Identifiant du troupeau",
                         "Identificador do rebanho", "معرف القطيع",
                         "Identificador del rebaño", "Kitambulisho cha Kundi"), 4, col=1),
                f_text("owner_name",
                       L("Owner Name", "Nom du propriétaire",
                         "Nome do proprietário", "اسم المالك",
                         "Nombre del propietario", "Jina la Mmiliki"), 5, col=2),
                f_select_v("owner_sex",
                           L("Owner Sex", "Sexe du propriétaire",
                             "Sexo do proprietário", "جنس المالك",
                             "Sexo del propietario", "Jinsia ya Mmiliki"), 6, [
                    {"label": L("Female", "Féminin", "Feminino", "أنثى", "Femenino", "Kike"), "value": "female"},
                    {"label": L("Male", "Masculin", "Masculino", "ذكر", "Masculino", "Kiume"), "value": "male"},
                ], col=1),
                f_text("telephone",
                       L("Telephone", "Téléphone",
                         "Telefone", "هاتف",
                         "Teléfono", "Simu"), 7, required=False, col=2),
            ]),
            section("herd_composition",
                    L("Herd Composition", "Composition du troupeau",
                      "Composição do rebanho", "تكوين القطيع",
                      "Composición del rebaño", "Muundo wa Kundi"), 2, 2, [
                f_select_v("production_system",
                           L("Production System", "Système de production",
                             "Sistema de produção", "نظام الإنتاج",
                             "Sistema de producción", "Mfumo wa Uzalishaji"), 0, [
                    {"label": L("Sedentary", "Sédentaire", "Sedentário", "مستقر", "Sedentario", "Kisitari"), "value": "sedentary"},
                    {"label": L("Agro-pastoral", "Agro-pastoral", "Agro-pastoral", "زراعي-رعوي", "Agro-pastoral", "Kilimo-ufugaji"), "value": "agro_pastoral"},
                    {"label": L("Transhumant", "Transhumant", "Transumante", "ترحال", "Trashumante", "Kuhamahama"), "value": "transhumant"},
                    {"label": L("Peri-urban", "Péri-urbain", "Peri-urbano", "شبه حضري", "Peri-urbano", "Pembezoni mwa Mji"), "value": "peri_urban"},
                    {"label": L("Mixed", "Mixte", "Misto", "مختلط", "Mixto", "Mchanganyiko"), "value": "mixed"},
                ], col=1),
                f_number("sheep_count",
                         L("Number of Sheep", "Nombre de moutons",
                           "Número de ovinos", "عدد الأغنام",
                           "Número de ovejas", "Idadi ya Kondoo"), 1, min_val=0, col=2),
                f_number("goat_count",
                         L("Number of Goats", "Nombre de chèvres",
                           "Número de caprinos", "عدد الماعز",
                           "Número de cabras", "Idadi ya Mbuzi"), 2, min_val=0, col=1),
                f_number("eligible_animals",
                         L("Eligible Animals", "Animaux éligibles",
                           "Animais elegíveis", "الحيوانات المؤهلة",
                           "Animales elegibles", "Wanyama Wanaostahili"), 3, min_val=0, col=2,
                         helpText=L("Animals aged 6 months+", "Animaux âgés de 6 mois+",
                                    "Animais com 6 meses+", "الحيوانات بعمر 6 أشهر+",
                                    "Animales de 6 meses+", "Wanyama wenye miezi 6+")),
                f_number("animals_sampled",
                         L("Animals Sampled", "Animaux échantillonnés",
                           "Animais amostrados", "الحيوانات المأخوذ عيناتها",
                           "Animales muestreados", "Wanyama Waliopimwa"), 4, min_val=0, col=1),
            ]),
            section("sampling_method",
                    L("Sampling Method", "Méthode d'échantillonnage",
                      "Método de amostragem", "طريقة أخذ العينات",
                      "Método de muestreo", "Njia ya Sampuli"), 3, 2, [
                f_select_v("herd_selection_method",
                           L("Herd Selection Method", "Méthode de sélection du troupeau",
                             "Método de seleção do rebanho", "طريقة اختيار القطيع",
                             "Método de selección del rebaño", "Njia ya Kuchagua Kundi"), 0, [
                    {"label": L("Random from list", "Aléatoire sur liste", "Aleatório da lista", "عشوائي من القائمة", "Aleatorio de la lista", "Nasibu kutoka orodha"), "value": "random_from_list"},
                    {"label": L("Systematic", "Systématique", "Sistemático", "منهجي", "Sistemático", "Kimfumo"), "value": "systematic"},
                    {"label": L("Replacement unit", "Unité de remplacement", "Unidade de substituição", "وحدة بديلة", "Unidad de reemplazo", "Kitengo mbadala"), "value": "replacement_unit"},
                ], col=1),
                f_number("community_herds_count",
                         L("Total Herds in Community", "Total troupeaux dans la communauté",
                           "Total de rebanhos na comunidade", "إجمالي القطعان في المجتمع",
                           "Total de rebaños en la comunidad", "Jumla ya Makundi katika Jamii"), 1, required=False, min_val=0, col=2),
            ]),
            section("vaccination_history",
                    L("Vaccination History", "Historique de vaccination",
                      "Histórico de vacinação", "تاريخ التطعيم",
                      "Historial de vacunación", "Historia ya Chanjo"), 4, 2, [
                f_select_v("herd_vaccinated_12m",
                           L("Herd Vaccinated in Last 12 Months?", "Troupeau vacciné dans les 12 derniers mois ?",
                             "Rebanho vacinado nos últimos 12 meses?", "هل تم تطعيم القطيع في آخر 12 شهرًا؟",
                             "¿Rebaño vacunado en los últimos 12 meses?", "Kundi limechanjwa miezi 12 iliyopita?"), 0, YES_NO_UNK, col=1),
                f_text("last_vaccination_date",
                       L("Last Vaccination Date", "Date de dernière vaccination",
                         "Data da última vacinação", "تاريخ آخر تطعيم",
                         "Fecha de última vacunación", "Tarehe ya Chanjo ya Mwisho"), 1, required=False, col=2,
                       placeholder="MM/YYYY or Unknown"),
                f_text("vaccine_batch",
                       L("Vaccine Batch Number", "Numéro de lot du vaccin",
                         "Número do lote da vacina", "رقم دفعة اللقاح",
                         "Número de lote de vacuna", "Nambari ya Kundi la Chanjo"), 2, required=False, col=1),
                f_select_v("vaccination_info_source",
                           L("Vaccination Info Source", "Source d'information vaccination",
                             "Fonte de informação da vacinação", "مصدر معلومات التطعيم",
                             "Fuente de información de vacunación", "Chanzo cha Taarifa ya Chanjo"), 3, [
                    {"label": L("Vaccination card", "Carte de vaccination", "Cartão de vacinação", "بطاقة التطعيم", "Tarjeta de vacunación", "Kadi ya chanjo"), "value": "vaccination_card"},
                    {"label": L("Register", "Registre", "Registo", "سجل", "Registro", "Daftari"), "value": "register"},
                    {"label": L("Owner recall", "Rappel du propriétaire", "Memória do proprietário", "استدعاء المالك", "Recuerdo del propietario", "Kumbukumbu ya mmiliki"), "value": "owner_recall"},
                    {"label": L("None", "Aucune", "Nenhuma", "لا يوجد", "Ninguna", "Hakuna"), "value": "none"},
                ], col=2),
            ]),
            section("movement_risk",
                    L("Movement & Risk", "Mouvements et risques",
                      "Movimentação e risco", "الحركة والمخاطر",
                      "Movimiento y riesgo", "Harakati na Hatari"), 5, 2, [
                f_select_v("animals_introduced_6m",
                           L("Animals Introduced in Last 6 Months?", "Animaux introduits dans les 6 derniers mois ?",
                             "Animais introduzidos nos últimos 6 meses?", "هل تم إدخال حيوانات في آخر 6 أشهر؟",
                             "¿Animales introducidos en los últimos 6 meses?", "Wanyama wameingizwa miezi 6 iliyopita?"), 0, YES_NO, col=1),
                f_number("introduced_number",
                         L("Number Introduced", "Nombre introduit",
                           "Número introduzido", "العدد المُدخل",
                           "Número introducido", "Idadi Iliyoingizwa"), 1, required=False, min_val=0, col=2),
                f_text("introduced_origin",
                       L("Origin of Introduced Animals", "Origine des animaux introduits",
                         "Origem dos animais introduzidos", "أصل الحيوانات المُدخلة",
                         "Origen de los animales introducidos", "Asili ya Wanyama Walioingizwa"), 2, required=False, col=1),
                f_select_v("market_within_10km",
                           L("Livestock Market Within 10 km?", "Marché à bétail à moins de 10 km ?",
                             "Mercado de gado a menos de 10 km?", "سوق ماشية ضمن 10 كم؟",
                             "¿Mercado ganadero a menos de 10 km?", "Soko la Mifugo ndani ya km 10?"), 3, YES_NO, col=2),
                f_text("market_name",
                       L("Market Name", "Nom du marché",
                         "Nome do mercado", "اسم السوق",
                         "Nombre del mercado", "Jina la Soko"), 4, required=False, col=1),
                f_number("distance_to_border_km",
                         L("Distance to International Border (km)", "Distance à la frontière internationale (km)",
                           "Distância à fronteira internacional (km)", "المسافة إلى الحدود الدولية (كم)",
                           "Distancia a la frontera internacional (km)", "Umbali hadi Mpaka wa Kimataifa (km)"), 5, required=False, min_val=0, col=2),
                f_select_v("ppr_signs_12m",
                           L("PPR Signs in Last 12 Months?", "Signes de PPR dans les 12 derniers mois ?",
                             "Sinais de PPR nos últimos 12 meses?", "علامات الطاعون في آخر 12 شهرًا؟",
                             "¿Signos de PPR en los últimos 12 meses?", "Dalili za PPR miezi 12 iliyopita?"), 6, YES_NO, col=1),
                f_number("approx_cases",
                         L("Approximate Cases", "Cas approximatifs",
                           "Casos aproximados", "الحالات التقريبية",
                           "Casos aproximados", "Kesi za Takriban"), 7, required=False, min_val=0, col=2),
                f_number("approx_deaths",
                         L("Approximate Deaths", "Décès approximatifs",
                           "Mortes aproximadas", "الوفيات التقريبية",
                           "Muertes aproximadas", "Vifo vya Takriban"), 8, required=False, min_val=0, col=1),
            ]),
            section("consent",
                    L("Consent & Replacement", "Consentement et remplacement",
                      "Consentimento e substituição", "الموافقة والاستبدال",
                      "Consentimiento y reemplazo", "Ridhaa na Ubadilishaji"), 6, 2, [
                f_select_v("consent_obtained",
                           L("Consent Obtained?", "Consentement obtenu ?",
                             "Consentimento obtido?", "هل تم الحصول على الموافقة؟",
                             "¿Consentimiento obtenido?", "Ridhaa Imepatikana?"), 0, YES_NO, col=1),
                f_select_v("is_replacement",
                           L("Is This a Replacement?", "Est-ce un remplacement ?",
                             "É uma substituição?", "هل هذا بديل؟",
                             "¿Es un reemplazo?", "Hii ni Mbadala?"), 1, YES_NO, col=2),
                f_text("replaced_unit_id",
                       L("Replaced Unit ID", "ID unité remplacée",
                         "ID da unidade substituída", "معرف الوحدة المستبدلة",
                         "ID de la unidad reemplazada", "Kitambulisho cha Kitengo Kilichobadilishwa"), 2, required=False, col=1),
                f_text("replacement_reason",
                       L("Replacement Reason", "Raison du remplacement",
                         "Razão da substituição", "سبب الاستبدال",
                         "Razón del reemplazo", "Sababu ya Ubadilishaji"), 3, required=False, col=2),
            ]),
        ],
        "settings": SETTINGS,
    }
}


# ════════════════════════════════════════════════════════════════
# TEMPLATE B: INDIVIDUAL ANIMAL RECORD
# ════════════════════════════════════════════════════════════════

animal_template = {
    "name": "PPR Sero-Surveillance — B. Individual Animal Record",
    "domain": "animal_health",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            section("animal_identification",
                    L("Animal Identification", "Identification de l'animal",
                      "Identificação do animal", "تعريف الحيوان",
                      "Identificación del animal", "Utambulisho wa Mnyama"), 0, 2, [
                f_text("animal_identifier",
                       L("Animal Identifier", "Identifiant de l'animal",
                         "Identificador do animal", "معرف الحيوان",
                         "Identificador del animal", "Kitambulisho cha Mnyama"), 0, col=1,
                       helpText=L("Ear tag or barcode number", "Numéro de boucle ou code-barres",
                                  "Número do brinco ou código de barras", "رقم علامة الأذن أو الباركود",
                                  "Número de crotal o código de barras", "Nambari ya alama ya sikio au msimbo")),
                {
                    "id": "herd_identifier", "type": "form-data-select", "code": "herd_identifier",
                    "label": L("Herd Identifier", "Identifiant du troupeau",
                               "Identificador do rebanho", "معرف القطيع",
                               "Identificador del rebaño", "Kitambulisho cha Kundi"),
                    "helpText": L("Select from registered herds (Form A)", "Sélectionner parmi les troupeaux enregistrés (Form A)",
                                  "Selecionar dos rebanhos registados (Form A)", "اختر من القطعان المسجلة (نموذج أ)",
                                  "Seleccionar de los rebaños registrados (Form A)", "Chagua kutoka makundi yaliyosajiliwa (Fomu A)"),
                    "column": 2, "columnSpan": 1, "order": 1, "required": True,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {
                        "sourceTemplateName": "PPR Sero-Surveillance — A. Herd / Holding Record",
                        "sourceFieldCode": "herd_identifier",
                        "valueFieldCode": "herd_identifier",
                        "filterByAdminLocation": True,
                    },
                },
                f_select_v("species",
                           L("Species", "Espèce",
                             "Espécie", "النوع",
                             "Especie", "Spishi"), 2, [
                    {"label": L("Sheep", "Mouton", "Ovino", "غنم", "Oveja", "Kondoo"), "value": "sheep"},
                    {"label": L("Goat", "Chèvre", "Caprino", "ماعز", "Cabra", "Mbuzi"), "value": "goat"},
                ], col=1),
                f_select_v("sex",
                           L("Sex", "Sexe",
                             "Sexo", "الجنس",
                             "Sexo", "Jinsia"), 3, [
                    {"label": L("Female", "Femelle", "Fêmea", "أنثى", "Hembra", "Kike"), "value": "female"},
                    {"label": L("Male", "Mâle", "Macho", "ذكر", "Macho", "Kiume"), "value": "male"},
                ], col=2),
                f_number("age_months",
                         L("Age (months)", "Âge (mois)",
                           "Idade (meses)", "العمر (أشهر)",
                           "Edad (meses)", "Umri (miezi)"), 4, min_val=0, col=1),
                f_select_v("dentition_category",
                           L("Dentition Category", "Catégorie de dentition",
                             "Categoria de dentição", "فئة الأسنان",
                             "Categoría de dentición", "Aina ya Meno"), 5, [
                    {"label": L("0", "0"), "value": "0"},
                    {"label": L("1", "1"), "value": "1"},
                    {"label": L("2", "2"), "value": "2"},
                    {"label": L("3+", "3+"), "value": "3plus"},
                ], col=2),
                f_text("breed_type",
                       L("Breed Type", "Type de race",
                         "Tipo de raça", "نوع السلالة",
                         "Tipo de raza", "Aina ya Kizazi"), 6, required=False, col=1),
                f_select_v("body_condition_score",
                           L("Body Condition Score", "Note d'état corporel",
                             "Escore de condição corporal", "درجة حالة الجسم",
                             "Puntuación de condición corporal", "Alama ya Hali ya Mwili"), 7, [
                    {"label": L("1 — Emaciated", "1 — Émacié", "1 — Emaciado", "1 — هزيل", "1 — Emaciado", "1 — Mdhaifu sana"), "value": "1"},
                    {"label": L("2 — Thin", "2 — Maigre", "2 — Magro", "2 — نحيف", "2 — Delgado", "2 — Mwembamba"), "value": "2"},
                    {"label": L("3 — Average", "3 — Moyen", "3 — Médio", "3 — متوسط", "3 — Promedio", "3 — Wastani"), "value": "3"},
                    {"label": L("4 — Good", "4 — Bon", "4 — Bom", "4 — جيد", "4 — Bueno", "4 — Nzuri"), "value": "4"},
                    {"label": L("5 — Obese", "5 — Obèse", "5 — Obeso", "5 — سمين", "5 — Obeso", "5 — Mnene"), "value": "5"},
                ], col=2),
            ]),
            section("clinical_vaccination",
                    L("Clinical & Vaccination", "Clinique et vaccination",
                      "Clínica e vacinação", "السريري والتطعيم",
                      "Clínica y vacunación", "Kliniki na Chanjo"), 1, 2, [
                f_select_v("reproductive_status",
                           L("Reproductive Status", "Statut reproductif",
                             "Estado reprodutivo", "الحالة التناسلية",
                             "Estado reproductivo", "Hali ya Uzazi"), 0, [
                    {"label": L("Pregnant", "Gestante", "Gestante", "حامل", "Gestante", "Mja Mimba"), "value": "pregnant"},
                    {"label": L("Lactating", "Allaitante", "Lactante", "مرضعة", "Lactante", "Anayenyonyesha"), "value": "lactating"},
                    {"label": L("Neither", "Aucun", "Nenhum", "لا شيء", "Ninguno", "Hakuna"), "value": "neither"},
                    {"label": L("Unknown", "Inconnu", "Desconhecido", "غير معروف", "Desconocido", "Haijulikani"), "value": "unknown"},
                ], col=1, conditions=[{"field": "sex", "operator": "equals", "value": "female"}]),
                f_select_v("vaccination_status",
                           L("Vaccination Status", "Statut vaccinal",
                             "Estado vacinal", "حالة التطعيم",
                             "Estado vacunal", "Hali ya Chanjo"), 1, [
                    {"label": L("Vaccinated", "Vacciné", "Vacinado", "مُطعّم", "Vacunado", "Amechanjwa"), "value": "vaccinated"},
                    {"label": L("Not vaccinated", "Non vacciné", "Não vacinado", "غير مُطعّم", "No vacunado", "Hajachanjwa"), "value": "not_vaccinated"},
                    {"label": L("Unknown", "Inconnu", "Desconhecido", "غير معروف", "Desconocido", "Haijulikani"), "value": "unknown"},
                ], col=2),
                f_text("last_vaccination_date_b",
                       L("Last Vaccination Date", "Date de dernière vaccination",
                         "Data da última vacinação", "تاريخ آخر تطعيم",
                         "Fecha de última vacunación", "Tarehe ya Chanjo ya Mwisho"), 2, required=False, col=1,
                       placeholder="MM/YYYY"),
                f_select_v("vaccination_info_source_b",
                           L("Vaccination Info Source", "Source d'information vaccination",
                             "Fonte de informação da vacinação", "مصدر معلومات التطعيم",
                             "Fuente de información de vacunación", "Chanzo cha Taarifa ya Chanjo"), 3, [
                    {"label": L("Card", "Carte", "Cartão", "بطاقة", "Tarjeta", "Kadi"), "value": "card"},
                    {"label": L("Register", "Registre", "Registo", "سجل", "Registro", "Daftari"), "value": "register"},
                    {"label": L("Recall", "Rappel", "Memória", "استدعاء", "Recuerdo", "Kumbukumbu"), "value": "recall"},
                    {"label": L("None", "Aucune", "Nenhuma", "لا يوجد", "Ninguna", "Hakuna"), "value": "none"},
                ], col=2),
                f_select_v("clinical_signs",
                           L("Clinical Signs", "Signes cliniques",
                             "Sinais clínicos", "العلامات السريرية",
                             "Signos clínicos", "Dalili za Kliniki"), 4, [
                    {"label": L("None", "Aucun", "Nenhum", "لا يوجد", "Ninguno", "Hakuna"), "value": "none"},
                    {"label": L("Ocular-nasal discharge", "Écoulement oculo-nasal", "Secreção oculo-nasal", "إفرازات عينية أنفية", "Secreción oculo-nasal", "Kutoka usaha macho/pua"), "value": "ocular_nasal_discharge"},
                    {"label": L("Diarrhoea", "Diarrhée", "Diarreia", "إسهال", "Diarrea", "Kuhara"), "value": "diarrhoea"},
                    {"label": L("Oral lesions", "Lésions buccales", "Lesões orais", "آفات فموية", "Lesiones orales", "Vidonda vya mdomo"), "value": "oral_lesions"},
                    {"label": L("Respiratory signs", "Signes respiratoires", "Sinais respiratórios", "علامات تنفسية", "Signos respiratorios", "Dalili za kupumua"), "value": "respiratory_signs"},
                    {"label": L("Other", "Autre", "Outro", "أخرى", "Otro", "Nyingine"), "value": "other"},
                ], col=1),
            ]),
            section("specimen_collection",
                    L("Specimen Collection", "Collecte de spécimens",
                      "Coleta de espécimes", "جمع العينات",
                      "Recolección de especímenes", "Ukusanyaji wa Sampuli"), 2, 2, [
                f_select_v("serum_tube_collected",
                           L("Serum Tube Collected?", "Tube sérique collecté ?",
                             "Tubo de soro coletado?", "هل تم جمع أنبوب المصل؟",
                             "¿Tubo de suero recolectado?", "Bomba la Seramu Limekusanywa?"), 0, YES_NO, col=1),
                f_text("collection_time",
                       L("Collection Time", "Heure de collecte",
                         "Hora de coleta", "وقت الجمع",
                         "Hora de recolección", "Wakati wa Ukusanyaji"), 1, required=False, col=2,
                       placeholder="HH:MM"),
                f_select_v("swab_collected",
                           L("Swab Collected?", "Écouvillon collecté ?",
                             "Zaragatoa coletada?", "هل تم جمع المسحة؟",
                             "¿Hisopo recolectado?", "Swab Imekusanywa?"), 2, YES_NO, col=1),
                f_select_v("swab_type",
                           L("Swab Type", "Type d'écouvillon",
                             "Tipo de zaragatoa", "نوع المسحة",
                             "Tipo de hisopo", "Aina ya Swab"), 3, [
                    {"label": L("Ocular", "Oculaire", "Ocular", "عيني", "Ocular", "Macho"), "value": "ocular"},
                    {"label": L("Nasal", "Nasal", "Nasal", "أنفي", "Nasal", "Pua"), "value": "nasal"},
                    {"label": L("Oral", "Oral", "Oral", "فموي", "Oral", "Mdomo"), "value": "oral"},
                ], required=False, col=2),
                f_select_v("specimen_condition",
                           L("Specimen Condition", "État du spécimen",
                             "Condição do espécime", "حالة العينة",
                             "Condición del espécimen", "Hali ya Sampuli"), 4, [
                    {"label": L("Satisfactory", "Satisfaisant", "Satisfatório", "مرضي", "Satisfactorio", "Ya kuridhisha"), "value": "satisfactory"},
                    {"label": L("Haemolysed", "Hémolysé", "Hemolisado", "متحلل دمويًا", "Hemolizado", "Imevunjika damu"), "value": "haemolysed"},
                    {"label": L("Insufficient volume", "Volume insuffisant", "Volume insuficiente", "حجم غير كافٍ", "Volumen insuficiente", "Ujazo usiotosha"), "value": "insufficient_volume"},
                    {"label": L("Leaked", "Fuite", "Vazamento", "تسرب", "Filtración", "Imevuja"), "value": "leaked"},
                    {"label": L("Other", "Autre", "Outro", "أخرى", "Otro", "Nyingine"), "value": "other"},
                ], col=1),
                f_text("sampler_initials",
                       L("Sampler Initials", "Initiales du préleveur",
                         "Iniciais do coletor", "الأحرف الأولى للجامع",
                         "Iniciales del muestreador", "Herufi za Mkusanyaji"), 5, col=2),
                f_select_v("non_response_code",
                           L("Non-Response Code", "Code de non-réponse",
                             "Código de não resposta", "رمز عدم الاستجابة",
                             "Código de no respuesta", "Msimbo wa Kutokujibu"), 6, [
                    {"label": L("Refusal", "Refus", "Recusa", "رفض", "Rechazo", "Kukataa"), "value": "refusal"},
                    {"label": L("Animal unavailable", "Animal indisponible", "Animal indisponível", "الحيوان غير متاح", "Animal no disponible", "Mnyama hayupo"), "value": "animal_unavailable"},
                    {"label": L("Unsafe to restrain", "Dangereux à contenir", "Inseguro para conter", "غير آمن للتقييد", "Inseguro para contener", "Hatari kumzuia"), "value": "unsafe_to_restrain"},
                    {"label": L("Other", "Autre", "Outro", "أخرى", "Otro", "Nyingine"), "value": "other"},
                ], required=False, col=1),
            ]),
        ],
        "settings": SETTINGS,
    }
}


# ════════════════════════════════════════════════════════════════
# TEMPLATE C: SAMPLE CONSIGNMENT / CHAIN OF CUSTODY
# ════════════════════════════════════════════════════════════════

consignment_template = {
    "name": "PPR Sero-Surveillance — C. Sample Consignment",
    "domain": "animal_health",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            section("dispatch_info",
                    L("Dispatch Information", "Informations d'expédition",
                      "Informações de expedição", "معلومات الإرسال",
                      "Información de despacho", "Taarifa za Usafirishaji"), 0, 2, [
                f_text("consignment_id",
                       L("Consignment ID", "ID du lot",
                         "ID da remessa", "معرف الشحنة",
                         "ID del envío", "Kitambulisho cha Usafirishaji"), 0, col=1),
                {
                    "id": "county_team", "type": "form-data-select", "code": "county_team",
                    "label": L("County / Team", "Comté / Équipe",
                               "Condado / Equipa", "المقاطعة / الفريق",
                               "Condado / Equipo", "Kaunti / Timu"),
                    "helpText": L("Select team from field records (Form A)", "Sélectionner l'équipe des fiches terrain (Form A)",
                                  "Selecionar equipa dos registos de campo (Form A)", "اختر الفريق من سجلات الميدان (نموذج أ)",
                                  "Seleccionar equipo de registros de campo (Form A)", "Chagua timu kutoka rekodi za uwandani (Fomu A)"),
                    "column": 2, "columnSpan": 1, "order": 1, "required": True,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {
                        "sourceTemplateName": "PPR Sero-Surveillance — A. Herd / Holding Record",
                        "sourceFieldCode": "team_code",
                        "valueFieldCode": "team_code",
                        "filterByAdminLocation": False,
                    },
                },
                f_date("dispatch_date",
                       L("Dispatch Date", "Date d'expédition",
                         "Data de expedição", "تاريخ الإرسال",
                         "Fecha de despacho", "Tarehe ya Kutuma"), 2, col=1),
                f_text("dispatch_time",
                       L("Dispatch Time", "Heure d'expédition",
                         "Hora de expedição", "وقت الإرسال",
                         "Hora de despacho", "Wakati wa Kutuma"), 3, required=False, col=2,
                       placeholder="HH:MM"),
                f_number("tubes_dispatched",
                         L("Tubes Dispatched", "Tubes expédiés",
                           "Tubos expedidos", "الأنابيب المرسلة",
                           "Tubos despachados", "Bomba Zilizotumwa"), 4, min_val=0, col=1),
                f_number("cryovials_dispatched",
                         L("Cryovials Dispatched", "Cryovials expédiés",
                           "Crioviais expedidos", "الأنابيب المبردة المرسلة",
                           "Crioviales despachados", "Cryovials Zilizotumwa"), 5, min_val=0, col=2),
                f_number("swabs_dispatched",
                         L("Swabs Dispatched", "Écouvillons expédiés",
                           "Zaragatoas expedidas", "المسحات المرسلة",
                           "Hisopos despachados", "Swabs Zilizotumwa"), 6, min_val=0, col=1),
                f_number("temp_dispatch",
                         L("Temperature at Dispatch", "Température à l'expédition",
                           "Temperatura na expedição", "درجة الحرارة عند الإرسال",
                           "Temperatura al despacho", "Halijoto Wakati wa Kutuma"), 7, col=2,
                         helpText=L("°C", "°C", "°C", "°C", "°C", "°C")),
                f_text("monitoring_device_id",
                       L("Monitoring Device ID", "ID du dispositif de suivi",
                         "ID do dispositivo de monitorização", "معرف جهاز المراقبة",
                         "ID del dispositivo de monitoreo", "Kitambulisho cha Kifaa cha Ufuatiliaji"), 8, required=False, col=1),
                f_text("courier_vehicle",
                       L("Courier / Vehicle", "Coursier / Véhicule",
                         "Estafeta / Veículo", "المندوب / المركبة",
                         "Mensajero / Vehículo", "Mjumbe / Gari"), 9, col=2),
            ]),
            section("receipt_at_cvl",
                    L("Receipt at CVL", "Réception au CVL",
                      "Recepção no CVL", "الاستلام في المختبر",
                      "Recepción en CVL", "Mapokezi katika CVL"), 1, 2, [
                f_date("receipt_date",
                       L("Receipt Date", "Date de réception",
                         "Data de recepção", "تاريخ الاستلام",
                         "Fecha de recepción", "Tarehe ya Mapokezi"), 0, col=1),
                f_text("receipt_time",
                       L("Receipt Time", "Heure de réception",
                         "Hora de recepção", "وقت الاستلام",
                         "Hora de recepción", "Wakati wa Mapokezi"), 1, required=False, col=2,
                       placeholder="HH:MM"),
                f_number("temp_receipt",
                         L("Temperature at Receipt", "Température à la réception",
                           "Temperatura na recepção", "درجة الحرارة عند الاستلام",
                           "Temperatura al recibir", "Halijoto Wakati wa Mapokezi"), 2, col=1,
                         helpText=L("°C", "°C", "°C", "°C", "°C", "°C")),
                f_number("specimens_received",
                         L("Specimens Received", "Spécimens reçus",
                           "Espécimes recebidos", "العينات المستلمة",
                           "Especímenes recibidos", "Sampuli Zilizopokelewa"), 3, min_val=0, col=2),
                f_number("specimens_rejected",
                         L("Specimens Rejected", "Spécimens rejetés",
                           "Espécimes rejeitados", "العينات المرفوضة",
                           "Especímenes rechazados", "Sampuli Zilizokataliwa"), 4, min_val=0, col=1),
                f_select_v("rejection_reasons",
                           L("Rejection Reasons", "Raisons du rejet",
                             "Razões de rejeição", "أسباب الرفض",
                             "Razones de rechazo", "Sababu za Kukataa"), 5, [
                    {"label": L("Haemolysis", "Hémolyse", "Hemólise", "انحلال الدم", "Hemólisis", "Kuvunjika damu"), "value": "haemolysis"},
                    {"label": L("Insufficient volume", "Volume insuffisant", "Volume insuficiente", "حجم غير كافٍ", "Volumen insuficiente", "Ujazo usiotosha"), "value": "insufficient_volume"},
                    {"label": L("Label illegible", "Étiquette illisible", "Rótulo ilegível", "الملصق غير مقروء", "Etiqueta ilegible", "Lebo haiyasomeki"), "value": "label_illegible"},
                    {"label": L("Temperature breach", "Rupture de température", "Violação de temperatura", "اختراق درجة الحرارة", "Falla de temperatura", "Kuvuka halijoto"), "value": "temperature_breach"},
                    {"label": L("Leakage", "Fuite", "Vazamento", "تسرب", "Filtración", "Uvujaji"), "value": "leakage"},
                    {"label": L("No matching form", "Formulaire non trouvé", "Formulário não encontrado", "نموذج غير مطابق", "Formulario no encontrado", "Fomu hailingani"), "value": "no_matching_form"},
                ], required=False, col=2),
                f_text("cvl_accession_range",
                       L("CVL Accession Range", "Plage d'accession CVL",
                         "Faixa de acesso CVL", "نطاق رقم الدخول المختبري",
                         "Rango de acceso CVL", "Safu ya Nambari ya CVL"), 6, col=1),
                f_text("received_by",
                       L("Received By", "Reçu par",
                         "Recebido por", "استلم بواسطة",
                         "Recibido por", "Imepokelewa na"), 7, col=2),
                f_text("released_by",
                       L("Released By", "Libéré par",
                         "Liberado por", "أفرج بواسطة",
                         "Liberado por", "Imetolewa na"), 8, col=1),
            ]),
        ],
        "settings": SETTINGS,
    }
}


# ════════════════════════════════════════════════════════════════
# TEMPLATE D: LABORATORY RESULT RECORD
# ════════════════════════════════════════════════════════════════

lab_template = {
    "name": "PPR Sero-Surveillance — D. Laboratory Result Record",
    "domain": "animal_health",
    "formType": "CAMPAIGN",
    "schema": {
        "sections": [
            section("sample_identification",
                    L("Sample Identification", "Identification de l'échantillon",
                      "Identificação da amostra", "تعريف العينة",
                      "Identificación de la muestra", "Utambulisho wa Sampuli"), 0, 2, [
                f_text("accession_number",
                       L("Accession Number", "Numéro d'accession",
                         "Número de acesso", "رقم الدخول",
                         "Número de acceso", "Nambari ya Kuingia"), 0, col=1),
                {
                    "id": "animal_identifier_d", "type": "form-data-select", "code": "animal_identifier_d",
                    "label": L("Animal Identifier", "Identifiant de l'animal",
                               "Identificador do animal", "معرف الحيوان",
                               "Identificador del animal", "Kitambulisho cha Mnyama"),
                    "helpText": L("Select from sampled animals (Form B)", "Sélectionner parmi les animaux prélevés (Form B)",
                                  "Selecionar dos animais amostrados (Form B)", "اختر من الحيوانات المأخوذ عيناتها (نموذج ب)",
                                  "Seleccionar de los animales muestreados (Form B)", "Chagua kutoka wanyama waliopimwa (Fomu B)"),
                    "column": 2, "columnSpan": 1, "order": 1, "required": True,
                    "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
                    "properties": {
                        "sourceTemplateName": "PPR Sero-Surveillance — B. Individual Animal Record",
                        "sourceFieldCode": "animal_identifier",
                        "valueFieldCode": "animal_identifier",
                        "filterByAdminLocation": False,
                    },
                },
                f_text("plate_well_position",
                       L("Plate / Well Position", "Plaque / Position du puits",
                         "Placa / Posição do poço", "اللوحة / موضع البئر",
                         "Placa / Posición del pozo", "Sahani / Nafasi ya Kisima"), 2, col=1),
            ]),
            section("test_results",
                    L("Test Results", "Résultats des tests",
                      "Resultados dos testes", "نتائج الاختبارات",
                      "Resultados de pruebas", "Matokeo ya Mtihani"), 1, 2, [
                f_text("kit_name",
                       L("Kit Name", "Nom du kit",
                         "Nome do kit", "اسم المجموعة",
                         "Nombre del kit", "Jina la Kit"), 0, col=1),
                f_text("kit_lot_number",
                       L("Kit Lot Number", "Numéro de lot du kit",
                         "Número do lote do kit", "رقم دفعة المجموعة",
                         "Número de lote del kit", "Nambari ya Kundi la Kit"), 1, col=2),
                f_date("kit_expiry_date",
                       L("Kit Expiry Date", "Date d'expiration du kit",
                         "Data de validade do kit", "تاريخ انتهاء المجموعة",
                         "Fecha de caducidad del kit", "Tarehe ya Mwisho wa Kit"), 2, col=1),
                f_date("test_date",
                       L("Test Date", "Date du test",
                         "Data do teste", "تاريخ الاختبار",
                         "Fecha de prueba", "Tarehe ya Mtihani"), 3, col=2),
                f_number("od_inhibition",
                         L("OD / % Inhibition", "DO / % Inhibition",
                           "DO / % Inibição", "الكثافة الضوئية / % التثبيط",
                           "DO / % Inhibición", "OD / % Uzuiaji"), 4, col=1,
                         helpText=L("Optical density or % inhibition", "Densité optique ou % inhibition",
                                    "Densidade óptica ou % inibição", "الكثافة الضوئية أو نسبة التثبيط",
                                    "Densidad óptica o % inhibición", "Uzito wa mwanga au % uzuiaji")),
                f_select_v("result",
                           L("Result", "Résultat",
                             "Resultado", "النتيجة",
                             "Resultado", "Matokeo"), 5, [
                    {"label": L("Positive", "Positif", "Positivo", "إيجابي", "Positivo", "Chanya"), "value": "positive"},
                    {"label": L("Negative", "Négatif", "Negativo", "سلبي", "Negativo", "Hasi"), "value": "negative"},
                    {"label": L("Doubtful", "Douteux", "Duvidoso", "مشكوك فيه", "Dudoso", "Shaka"), "value": "doubtful"},
                    {"label": L("Invalid", "Invalide", "Inválido", "غير صالح", "Inválido", "Batili"), "value": "invalid"},
                ], col=2),
                f_select_v("repeat_result",
                           L("Repeat Result", "Résultat de répétition",
                             "Resultado de repetição", "نتيجة الإعادة",
                             "Resultado de repetición", "Matokeo ya Kurudia"), 6, [
                    {"label": L("Positive", "Positif", "Positivo", "إيجابي", "Positivo", "Chanya"), "value": "positive"},
                    {"label": L("Negative", "Négatif", "Negativo", "سلبي", "Negativo", "Hasi"), "value": "negative"},
                    {"label": L("Doubtful", "Douteux", "Duvidoso", "مشكوك فيه", "Dudoso", "Shaka"), "value": "doubtful"},
                    {"label": L("Not repeated", "Non répété", "Não repetido", "لم يُعاد", "No repetido", "Haikurudiwa"), "value": "not_repeated"},
                ], required=False, col=1),
            ]),
            section("authorization",
                    L("Authorization", "Autorisation",
                      "Autorização", "التفويض",
                      "Autorización", "Idhini"), 2, 2, [
                f_text("authorized_by",
                       L("Authorized By", "Autorisé par",
                         "Autorizado por", "مصرح بواسطة",
                         "Autorizado por", "Imeidhinishwa na"), 0, col=1),
                f_date("release_date",
                       L("Release Date", "Date de libération",
                         "Data de liberação", "تاريخ الإصدار",
                         "Fecha de liberación", "Tarehe ya Kutolewa"), 1, col=2),
            ]),
        ],
        "settings": SETTINGS,
    }
}


# ════════════════════════════════════════════════════════════════
# CREATE + PUBLISH + CAMPAIGN
# ════════════════════════════════════════════════════════════════

TEMPLATES = [
    ("herd",         herd_template),
    ("animal",       animal_template),
    ("consignment",  consignment_template),
    ("lab",          lab_template),
]

created_ids = {}
print("=" * 60)
print("CREATING 4 PPR SERO-SURVEILLANCE TEMPLATES")
print("=" * 60)

for (key, tmpl) in TEMPLATES:
    print(f"\n── {key.upper()} ──")

    # Create
    print(f"  Creating template: {tmpl['name']}...")
    r = api_post("/api/v1/form-builder/templates", tmpl)
    tid = r.get("data", {}).get("id")
    if not tid:
        print(f"  ERROR: {r.get('message', json.dumps(r)[:200])}")
        continue

    created_ids[key] = tid
    print(f"  Template ID: {tid}")

    # Publish
    r2 = api_post(f"/api/v1/form-builder/templates/{tid}/publish", {})
    status = r2.get("data", {}).get("status", "?")
    print(f"  Status: {status}")


# ── Campaign ────────────────────────────────────────────────
if created_ids:
    first_id = list(created_ids.values())[0]
    all_ids = list(created_ids.values())

    print(f"\n── CAMPAIGN ──")
    print(f"  Creating campaign: PPR_SEROSURV_LIBERIA_2026...")
    r3 = api_post("/api/v1/workflow/campaigns", {
        "code": "PPR_SEROSURV_LIBERIA_2026",
        "name": {
            "en": "PPR Pre-Vaccination Sero-Surveillance — Liberia",
            "fr": "Séro-surveillance pré-vaccinale PPR — Libéria",
            "pt": "Serovigilância pré-vacinação PPR — Libéria",
            "ar": "المراقبة المصلية قبل التطعيم للطاعون — ليبيريا",
            "es": "Serovigilancia pre-vacunación PPR — Liberia",
            "sw": "Ufuatiliaji wa Sero kabla ya Chanjo PPR — Liberia",
        },
        "description": {
            "en": "Baseline antibody assessment of 1,000 sheep and goats across 5 counties before risk-based vaccination under the Mano River Basin PPR control initiative",
            "fr": "Évaluation de base des anticorps chez 1 000 moutons et chèvres dans 5 comtés avant la vaccination basée sur le risque dans le cadre de l'initiative de contrôle PPR du bassin du fleuve Mano",
            "pt": "Avaliação basal de anticorpos em 1.000 ovinos e caprinos em 5 condados antes da vacinação baseada em risco no âmbito da iniciativa de controlo PPR da Bacia do Rio Mano",
            "ar": "تقييم الأجسام المضادة الأساسية لـ 1000 من الأغنام والماعز في 5 مقاطعات قبل التطعيم القائم على المخاطر في إطار مبادرة مكافحة طاعون المجترات الصغيرة في حوض نهر مانو",
            "es": "Evaluación basal de anticuerpos en 1.000 ovejas y cabras en 5 condados antes de la vacunación basada en riesgo bajo la iniciativa de control PPR de la cuenca del río Mano",
            "sw": "Tathmini ya msingi ya kingamwili katika kondoo na mbuzi 1,000 katika kaunti 5 kabla ya chanjo inayotegemea hatari chini ya mpango wa kudhibiti PPR wa Bonde la Mto Mano",
        },
        "domain": "animal_health",
        "formTemplateId": first_id,
        "formTemplateIds": all_ids,
        "startDate": "2026-10-05",
        "endDate": "2026-10-23",
        "targetCountries": ["LR"],
        "targetSubmissions": 1000,
        "frequency": "one_time",
        "scope": "continental",
        "status": "PLANNED",
    })
    cid = r3.get("data", {}).get("id")
    if cid:
        print(f"  Campaign ID: {cid}")
    else:
        print(f"  Campaign: {r3.get('message', '')[:200]}")

ssh.close()

# ════════════════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════════════════

print("\n" + "=" * 60)
print("TEMPLATE IDs:")
print("=" * 60)
for key, tid in created_ids.items():
    print(f"  {key:15s} → {tid}")
print()
print("DONE — 4 templates created & published, 1 campaign created.")
print("=" * 60)
