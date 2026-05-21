#!/usr/bin/env python3
"""
Phase 1+2: Create 3 PPR survey form templates + 3 campaigns on PROD.
Phase 3: Import 83 existing responses from Excel/ODT files.
"""
import paramiko
import json
import uuid
import os
import sys
import tempfile

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VM_APP = "10.202.101.183"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
DB_HOST = "10.202.101.185"
DB_PASS = "Ar1s_Pr0d_2024!xK9mZ"

TENANT_AU_IBAR = "00000000-0000-4000-a000-000000000001"
USER_SUPER_ADMIN = "10000000-0000-4000-a000-000000000001"


def uid():
    return str(uuid.uuid4())


def ml(en, fr="", pt="", ar=""):
    return {"en": en, "fr": fr or en, "pt": pt or en, "ar": ar or en}


def opts(pairs):
    return [{"label": ml(en, fr, pt, ar), "value": val} for val, en, fr, pt, ar in pairs]


def yes_no():
    return opts([("yes", "Yes", "Oui", "Sim", "نعم"), ("no", "No", "Non", "Não", "لا")])


def field(code, en, fr, pt="", ar="", ftype="text", order=0, required=False, **props):
    return {
        "id": uid(), "type": ftype, "code": code,
        "label": ml(en, fr, pt, ar),
        "placeholder": ml(""), "helpText": ml(""),
        "column": 0, "columnSpan": props.pop("columnSpan", 1),
        "order": order, "required": required,
        "readOnly": False, "hidden": False,
        "validation": props.pop("validation", {}),
        "conditions": props.pop("conditions", []),
        "properties": props,
    }


def section(en, fr, pt, ar, order, columns=2, fields_list=None, color=None, desc_en="", desc_fr=""):
    return {
        "id": uid(), "name": ml(en, fr, pt, ar),
        "description": ml(desc_en, desc_fr) if desc_en else None,
        "columns": columns, "order": order,
        "isCollapsible": True, "isCollapsed": False,
        "isRepeatable": False, "icon": None, "color": color,
        "conditions": [], "fields": fields_list or [],
    }


def make_settings():
    return {
        "allowDraft": True, "allowAttachments": True, "maxAttachments": 5,
        "allowOffline": True, "requireGeoLocation": False, "autoSaveInterval": 60,
        "submissionWorkflow": "standard", "notifyOnSubmit": [],
        "duplicateDetection": {"enabled": False, "fields": []},
    }


# ═══════════════════════════════════════════════
# TEMPLATE A: Surveillance & Digital Tools
# ═══════════════════════════════════════════════
def build_template_a():
    sections = [
        section("General Information", "Informations Générales",
                "Informações Gerais", "معلومات عامة", 0, columns=2, color="#1E40AF",
                fields_list=[
                    field("country", "Country", "Pays", "País", "البلد",
                          ftype="text", order=0, required=True),
                    field("institution", "Institution Name", "Nom de l'institution",
                          "Nome da instituição", "اسم المؤسسة",
                          ftype="text", order=1, required=True),
                    field("respondent_name", "Respondent Name", "Nom du répondant",
                          "Nome do respondente", "اسم المستجيب",
                          ftype="text", order=2, required=True),
                    field("respondent_role", "Respondent Role", "Fonction du répondant",
                          "Função do respondente", "وظيفة المستجيب",
                          ftype="text", order=3),
                ]),
        section("Surveillance System", "Système de Surveillance",
                "Sistema de Vigilância", "نظام المراقبة", 1, columns=2, color="#059669",
                fields_list=[
                    field("has_surveillance", "National surveillance system?",
                          "Système national de surveillance?",
                          ftype="select", order=0, required=True, options=yes_no()),
                    field("surveillance_coverage", "System coverage",
                          "Couverture du système",
                          ftype="multi-select", order=1, columnSpan=2,
                          options=opts([
                              ("terrestrial", "Terrestrial animal diseases", "Maladies animales terrestres", "Doenças animais terrestres", "أمراض حيوانية أرضية"),
                              ("aquatic", "Aquatic diseases", "Maladies aquatiques", "Doenças aquáticas", "أمراض مائية"),
                              ("zoonoses", "Zoonoses", "Zoonoses", "Zoonoses", "أمراض مشتركة"),
                              ("other", "Other", "Autres", "Outros", "أخرى"),
                          ])),
                    field("surveillance_type", "System type",
                          "Type de système",
                          ftype="multi-select", order=2, columnSpan=2,
                          options=opts([
                              ("passive", "Passive surveillance", "Surveillance passive", "Vigilância passiva", "مراقبة سلبية"),
                              ("active", "Active surveillance", "Surveillance active", "Vigilância ativa", "مراقبة نشطة"),
                              ("sentinel", "Sentinel surveillance", "Surveillance sentinelle", "Vigilância sentinela", "مراقبة حارسة"),
                              ("syndromic", "Syndromic surveillance", "Surveillance syndromique", "Vigilância sindrômica", "مراقبة متلازمية"),
                              ("participatory", "Participatory surveillance", "Surveillance participative", "Vigilância participativa", "مراقبة تشاركية"),
                          ])),
                    field("has_formal_plan", "Formal surveillance plan?",
                          "Plan de surveillance formalisé?",
                          ftype="select", order=3, options=yes_no()),
                ]),
        section("Digital Tools", "Outils Numériques",
                "Ferramentas Digitais", "الأدوات الرقمية", 2, columns=2, color="#7C3AED",
                fields_list=[
                    field("uses_digital_tool", "Uses online system/web app?",
                          "Utilise un système en ligne?",
                          ftype="select", order=0, options=yes_no()),
                    field("tool_name", "System/application name",
                          "Nom du système/application",
                          ftype="text", order=1),
                    field("tool_url", "URL", "Adresse URL", ftype="text", order=2),
                    field("tool_developer", "Developer organization",
                          "Organisation développeur",
                          ftype="text", order=3),
                    field("tool_date", "Service date", "Date de mise en service",
                          ftype="text", order=4),
                    field("tool_coverage", "Coverage", "Couverture",
                          ftype="select", order=5,
                          options=opts([
                              ("national", "National", "Nationale", "Nacional", "وطنية"),
                              ("regional", "Regional", "Régionale", "Regional", "إقليمية"),
                              ("local", "Local", "Locale", "Local", "محلية"),
                          ])),
                    field("interoperability", "Connected to other platforms?",
                          "Connecté à d'autres plateformes?",
                          ftype="select", order=6, options=yes_no()),
                    field("interop_platforms", "Which platforms?",
                          "Lesquelles?",
                          ftype="textarea", order=7, columnSpan=2),
                    field("data_entry_method", "Data entry method",
                          "Méthode de saisie",
                          ftype="multi-select", order=8, columnSpan=2,
                          options=opts([
                              ("mobile", "Mobile (field)", "Mobile (terrain)", "Móvel (campo)", "جوال (ميدان)"),
                              ("desktop", "Desktop (office)", "Bureau (central)", "Desktop (escritório)", "مكتب"),
                              ("paper", "Paper then digitized", "Papier puis numérisé", "Papel depois digitalizado", "ورقي ثم رقمي"),
                          ])),
                    field("data_collected", "Data collected includes",
                          "Données collectées incluent",
                          ftype="textarea", order=9, columnSpan=2),
                    field("trained_staff", "Trained staff available?",
                          "Personnel formé disponible?",
                          ftype="select", order=10, options=yes_no()),
                    field("available_all_zones", "Available in all zones?",
                          "Disponible dans toutes les zones?",
                          ftype="select", order=11, options=yes_no()),
                    field("limitations", "Limitations", "Limitations",
                          ftype="textarea", order=12, columnSpan=2),
                ]),
        section("Challenges & Needs", "Défis et Besoins",
                "Desafios e Necessidades", "التحديات والاحتياجات", 3, columns=1, color="#DC2626",
                fields_list=[
                    field("main_challenges", "Main challenges",
                          "Principaux défis",
                          ftype="textarea", order=0, required=True, columnSpan=1),
                    field("support_needed", "Support/resources needed",
                          "Appuis/ressources nécessaires",
                          ftype="textarea", order=1, columnSpan=1),
                ]),
    ]
    return {
        "name": "Systèmes de Surveillance & Outils Numériques en Santé Animale",
        "domain": "animal-health",
        "formType": "CAMPAIGN",
        "dataClassification": "PARTNER",
        "description": "Questionnaire d'évaluation des systèmes nationaux de surveillance épidémiologique et des outils numériques en santé animale dans les pays membres de l'UA.",
        "schema": {"sections": sections, "settings": make_settings(), "validationRules": []},
        "uiSchema": {},
    }


# ═══════════════════════════════════════════════
# TEMPLATE B: Diagnostic Tests & HPPR-bELISA Kits
# ═══════════════════════════════════════════════
def build_template_b():
    sections = [
        section("General Information", "Informations Générales",
                "Informações Gerais", "معلومات عامة", 0, columns=2, color="#1E40AF",
                fields_list=[
                    field("country", "Country", "Pays", "País", "البلد",
                          ftype="text", order=0, required=True),
                    field("institution_contact", "Institution & Contact Person",
                          "Institution et personne de contact",
                          ftype="textarea", order=1, columnSpan=2),
                    field("contact_email_phone", "Email & Phone",
                          "Email et téléphone",
                          ftype="text", order=2, columnSpan=2),
                ]),
        section("PPR Country Status", "Statut PPR du Pays",
                "Estado PPR do País", "حالة طاعون المجترات الصغيرة", 1, columns=2, color="#059669",
                fields_list=[
                    field("ppr_status", "Current PPR status", "Statut PPR actuel",
                          ftype="select", order=0, required=True,
                          options=opts([
                              ("infected", "Infected", "Infecté", "Infectado", "مصاب"),
                              ("free", "Officially Free", "Officiellement indemne", "Oficialmente livre", "خالٍ رسميا"),
                              ("in_process", "In Process of Recognition", "En cours de reconnaissance", "Em processo", "قيد الاعتراف"),
                          ])),
                    field("last_outbreak", "Date/location of last confirmed outbreak",
                          "Date/lieu du dernier foyer confirmé",
                          ftype="textarea", order=1, columnSpan=2),
                    field("pmat_stage", "PMAT Stage reached", "Stade PMAT atteint",
                          ftype="select", order=2,
                          options=opts([("1","Stage 1","Stade 1","Estágio 1","المرحلة 1"),
                                        ("2","Stage 2","Stade 2","Estágio 2","المرحلة 2"),
                                        ("3","Stage 3","Stade 3","Estágio 3","المرحلة 3"),
                                        ("4","Stage 4","Stade 4","Estágio 4","المرحلة 4")])),
                    field("notification_system", "Notification system used",
                          "Système de notification utilisé",
                          ftype="select", order=3,
                          options=opts([
                              ("aris", "ARIS", "ARIS", "ARIS", "ARIS"),
                              ("wahis", "WAHIS", "WAHIS", "WAHIS", "WAHIS"),
                              ("empres_i", "EMPRES-i+", "EMPRES-i+", "EMPRES-i+", "EMPRES-i+"),
                              ("other", "Other", "Autre", "Outro", "أخرى"),
                          ])),
                ]),
        section("Diagnostic Capacity", "Capacité Diagnostique",
                "Capacidade Diagnóstica", "القدرة التشخيصية", 2, columns=2, color="#7C3AED",
                fields_list=[
                    field("diagnostic_tests", "Diagnostic tests currently used",
                          "Tests diagnostiques actuellement utilisés",
                          ftype="multi-select", order=0, columnSpan=2,
                          options=opts([
                              ("elisa", "ELISA", "ELISA", "ELISA", "إليزا"),
                              ("c_elisa", "c-ELISA", "c-ELISA", "c-ELISA", "c-ELISA"),
                              ("virus_neutral", "Virus Neutralization", "Neutralisation virale", "Neutralização viral", "تحييد الفيروس"),
                              ("pcr", "PCR", "PCR", "PCR", "PCR"),
                              ("rapid_test", "Rapid Test", "Test rapide", "Teste rápido", "اختبار سريع"),
                              ("other", "Other", "Autre", "Outro", "أخرى"),
                          ])),
                ]),
        section("Kit Request", "Demande de Kits",
                "Pedido de Kits", "طلب المجموعات", 3, columns=2, color="#D97706",
                fields_list=[
                    field("kits_requested", "HPPR-bELISA kits requested",
                          "Kits HPPR-bELISA demandés",
                          ftype="number", order=0, validation={"min": 0}),
                    field("request_reasons", "Reasons for request",
                          "Raisons de la demande",
                          ftype="textarea", order=1, columnSpan=2),
                    field("intended_use_date", "When do you intend to use the kits?",
                          "Date prévue d'utilisation",
                          ftype="text", order=2),
                    field("storage_conditions", "Storage conditions available",
                          "Conditions de stockage disponibles",
                          ftype="select", order=3,
                          options=opts([
                              ("minus20", "-20°C Freezer", "Congélateur -20°C", "Congelador -20°C", "مجمد -20"),
                              ("fridge", "Refrigerator (2-8°C)", "Réfrigérateur (2-8°C)", "Frigorífico (2-8°C)", "ثلاجة 2-8"),
                              ("room", "Room temperature", "Température ambiante", "Temp. ambiente", "درجة حرارة الغرفة"),
                          ])),
                ]),
        section("Delivery & Authorization", "Livraison et Autorisation",
                "Entrega e Autorização", "التسليم والتفويض", 4, columns=1, color="#0891B2",
                fields_list=[
                    field("delivery_address", "Full delivery address",
                          "Adresse de livraison complète",
                          ftype="textarea", order=0),
                    field("kit_receiver", "Kit receiver (name & contact)",
                          "Réceptionnaire des kits",
                          ftype="text", order=1),
                    field("official_representative", "Official representative",
                          "Représentant officiel",
                          ftype="textarea", order=2),
                    field("rep_email_phone", "Representative email & phone",
                          "Email et téléphone du représentant",
                          ftype="text", order=3),
                    field("endorsement", "Official endorsement?",
                          "Approbation officielle?",
                          ftype="select", order=4, options=yes_no()),
                    field("commitment", "Commitment to exclusive use & result sharing?",
                          "Engagement d'utilisation exclusive et partage des résultats?",
                          ftype="select", order=5, options=yes_no()),
                ]),
    ]
    return {
        "name": "Tests Diagnostiques & Demande Kits HPPR-bELISA (PPR)",
        "domain": "animal-health",
        "formType": "CAMPAIGN",
        "dataClassification": "PARTNER",
        "description": "Formulaire de collecte d'informations sur les tests diagnostiques sérologiques PPR et de demande de kits HPPR-bELISA auprès d'AU-PANVAC.",
        "schema": {"sections": sections, "settings": make_settings(), "validationRules": []},
        "uiSchema": {},
    }


# ═══════════════════════════════════════════════
# TEMPLATE C: Kit Allocation Tracking
# ═══════════════════════════════════════════════
def build_template_c():
    sections = [
        section("Kit Allocation Record", "Suivi d'Allocation de Kits PPR",
                "Registo de Alocação de Kits", "سجل توزيع المجموعات", 0,
                columns=1, color="#EA580C",
                desc_en="Track PPR kit shipments to AU Member States",
                desc_fr="Suivi des envois de kits PPR aux États membres de l'UA",
                fields_list=[
                    field("shipment_date", "Shipment Date", "Date d'envoi",
                          "Data de envio", "تاريخ الشحن",
                          ftype="date", order=0, required=True),
                    field("reagent_type", "Type of Reagents", "Type de réactifs",
                          "Tipo de reagentes", "نوع الكواشف",
                          ftype="select", order=1, required=True,
                          options=opts([
                              ("ppr_kit", "PPR Kit", "Kit PPR", "Kit PPR", "مجموعة PPR"),
                          ])),
                    field("kit_format", "Kit Format", "Format du kit",
                          "Formato do kit", "شكل المجموعة",
                          ftype="select", order=2, required=True,
                          options=opts([
                              ("F10", "F10 (880 samples)", "F10 (880 échantillons)", "F10 (880 amostras)", "F10 (880 عينة)"),
                              ("F20", "F20 (1760 samples)", "F20 (1760 échantillons)", "F20 (1760 amostras)", "F20 (1760 عينة)"),
                          ])),
                    field("quantity", "Quantity", "Quantité",
                          "Quantidade", "الكمية",
                          ftype="number", order=3, required=True, validation={"min": 1}),
                    field("num_samples", "Number of Samples", "Nombre d'échantillons",
                          "Número de amostras", "عدد العينات",
                          ftype="number", order=4),
                    field("destination_country", "Destination Country", "Pays destinataire",
                          "País de destino", "البلد المستلم",
                          ftype="text", order=5, required=True),
                    field("year", "Year", "Année", "Ano", "السنة",
                          ftype="select", order=6,
                          options=opts([("2025","2025","2025","2025","2025"),("2026","2026","2026","2026","2026"),("2027","2027","2027","2027","2027")])),
                ]),
    ]
    return {
        "name": "Suivi Allocation Kits PPR (HPPR-bELISA)",
        "domain": "animal-health",
        "formType": "CAMPAIGN",
        "dataClassification": "PARTNER",
        "description": "Suivi des envois de kits de diagnostic PPR (HPPR-bELISA) aux États membres de l'Union Africaine par AU-PANVAC.",
        "schema": {"sections": sections, "settings": make_settings(), "validationRules": []},
        "uiSchema": {},
    }


# ═══════════════════════════════════════════════
# DEPLOY
# ═══════════════════════════════════════════════

def get_ssh():
    c = paramiko.SSHClient()
    c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    c.connect(VM_APP, username=SSH_USER, password=SSH_PASS, timeout=15)
    return c


def api_login(c):
    sftp = c.open_sftp()
    with sftp.file("/tmp/login.json", "w") as f:
        f.write(json.dumps({"email": "admin@au-aris.org", "password": "Aris2026@@4!0"}))
    sftp.close()
    chan = c.get_transport().open_session()
    chan.exec_command('curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H "Content-Type: application/json" -d @/tmp/login.json')
    chan.settimeout(15)
    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch: break
            out += ch
    except: pass
    return json.loads(out.decode())["data"]["accessToken"]


def create_template(c, token, template_data):
    body = json.dumps(template_data, ensure_ascii=False)
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, newline="\n", encoding="utf-8")
    tmp.write(body)
    tmp.close()
    sftp = c.open_sftp()
    sftp.put(tmp.name, "/tmp/tpl_body.json")
    sftp.close()
    os.unlink(tmp.name)

    chan = c.get_transport().open_session()
    chan.exec_command(
        f'curl -s -X POST http://localhost:3010/api/v1/form-builder/templates '
        f'-H "Content-Type: application/json" '
        f'-H "Authorization: Bearer {token}" '
        f'-d @/tmp/tpl_body.json'
    )
    chan.settimeout(30)
    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch: break
            out += ch
    except: pass
    resp = json.loads(out.decode(errors="replace"))
    if "data" in resp:
        tpl = resp["data"]
        return tpl["id"], tpl.get("name", "?")
    else:
        print(f"    FAILED: {resp.get('message', '?')[:200]}")
        return None, None


def publish_template(c, tpl_id):
    chan = c.get_transport().open_session()
    chan.exec_command(
        f"echo '{SSH_PASS}' | sudo -S docker run --rm --network host "
        f"-e PGPASSWORD={DB_PASS} postgres:16 "
        f"psql -h {DB_HOST} -p 5432 -U aris -d aris -c "
        f"\"UPDATE form_builder.form_templates SET status='PUBLISHED', published_at=NOW() WHERE id='{tpl_id}'\""
    )
    chan.settimeout(15)
    chan.recv(4096)


def create_campaign(c, token, name, tpl_id, start, end, target_countries):
    import random
    suffix = ''.join(random.choices('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', k=4))
    code = f"PPR_{start[:4]}_{suffix}"
    body = json.dumps({
        "name": {"en": name, "fr": name, "pt": name, "ar": name},
        "domain": "animal-health",
        "formTemplateId": tpl_id,
        "startDate": start,
        "endDate": end,
        "targetCountries": target_countries,
        "frequency": "one_time",
        "scope": "continental",
        "code": code,
    }, ensure_ascii=False)

    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, newline="\n", encoding="utf-8")
    tmp.write(body)
    tmp.close()
    sftp = c.open_sftp()
    sftp.put(tmp.name, "/tmp/camp_body.json")
    sftp.close()
    os.unlink(tmp.name)

    chan = c.get_transport().open_session()
    chan.exec_command(
        f'curl -s -X POST http://localhost:3011/api/v1/workflow/campaigns '
        f'-H "Content-Type: application/json" '
        f'-H "Authorization: Bearer {token}" '
        f'-d @/tmp/camp_body.json'
    )
    chan.settimeout(30)
    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch: break
            out += ch
    except: pass
    try:
        resp = json.loads(out.decode(errors="replace"))
        if "data" in resp:
            camp = resp["data"]
            return camp["id"]
        else:
            print(f"    FAILED: {resp.get('message', '?')[:200]}")
            return None
    except:
        print(f"    ERROR: {out.decode(errors='replace')[:200]}")
        return None


def activate_campaign(c, token, camp_id):
    chan = c.get_transport().open_session()
    chan.exec_command(
        f'curl -s -X POST http://localhost:3011/api/v1/workflow/campaigns/{camp_id}/activate '
        f'-H "Content-Type: application/json" '
        f'-H "Authorization: Bearer {token}" '
        f'-d "{{}}"'
    )
    chan.settimeout(15)
    chan.recv(4096)


def main():
    print("=" * 60)
    print("  PPR SURVEYS — CREATE TEMPLATES + CAMPAIGNS")
    print("=" * 60)

    c = get_ssh()
    token = api_login(c)
    print("Login: OK\n")

    # ── Phase 1: Create 3 templates ──
    print("[PHASE 1] Creating form templates...")

    templates = [
        ("A", build_template_a()),
        ("B", build_template_b()),
        ("C", build_template_c()),
    ]

    template_ids = {}
    for label, tpl_data in templates:
        tpl_id, name = create_template(c, token, tpl_data)
        if tpl_id:
            publish_template(c, tpl_id)
            template_ids[label] = tpl_id
            secs = tpl_data["schema"]["sections"]
            fields = sum(len(s["fields"]) for s in secs)
            print(f"  [{label}] {name} — {len(secs)} sections, {fields} fields — PUBLISHED")
        else:
            print(f"  [{label}] FAILED")

    if len(template_ids) < 3:
        print("\nSome templates failed. Aborting.")
        c.close()
        return

    # ── Phase 2: Create 3 campaigns ──
    print(f"\n[PHASE 2] Creating campaigns...")

    campaigns_config = [
        ("A", "Enquête Surveillance & Outils Numériques en Santé Animale 2025",
         template_ids["A"], "2025-01-01", "2027-12-31"),
        ("B", "Enquête Tests Diagnostiques & Kits HPPR-bELISA (PPR) 2025",
         template_ids["B"], "2025-01-01", "2027-12-31"),
        ("C", "Suivi Allocation Kits PPR 2025-2027",
         template_ids["C"], "2025-04-01", "2027-12-31"),
    ]

    campaign_ids = {}
    for label, name, tpl_id, start, end in campaigns_config:
        camp_id = create_campaign(c, token, name, tpl_id, start, end, [])
        if camp_id:
            activate_campaign(c, token, camp_id)
            campaign_ids[label] = camp_id
            print(f"  [{label}] {name} — ACTIVE")
        else:
            print(f"  [{label}] FAILED")

    # Print summary
    print(f"\n{'=' * 60}")
    print("  SUMMARY")
    print(f"{'=' * 60}")
    print(f"\nTemplates:")
    for k, v in template_ids.items():
        print(f"  {k}: {v}")
    print(f"\nCampaigns:")
    for k, v in campaign_ids.items():
        print(f"  {k}: {v}")

    # Save IDs for import script
    ids = {"templates": template_ids, "campaigns": campaign_ids}
    with open(os.path.join(os.path.dirname(__file__), "_ppr_survey_ids.json"), "w") as f:
        json.dump(ids, f, indent=2)
    print(f"\nIDs saved to deploy/scripts/_ppr_survey_ids.json")

    c.close()
    print("\nDONE")


if __name__ == "__main__":
    main()
