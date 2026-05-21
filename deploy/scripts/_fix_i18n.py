#!/usr/bin/env python3
"""Fix missing i18n translations across all 5 languages."""
import json
import os

BASE = os.path.join(os.path.dirname(__file__), "..", "..", "apps", "web", "src", "messages")

# Load all
langs = {}
for lang in ["en", "fr", "pt", "ar", "es"]:
    path = os.path.join(BASE, f"{lang}.json")
    with open(path, "r", encoding="utf-8") as f:
        langs[lang] = json.load(f)

# ── 1. Add missing collecte keys to PT ──
PT_COLLECTE = {
    "comments": "Comentários", "compileSynthesis": "Compilar Síntese", "fbClickToRename": "Clique para renomear",
    "formReview": "Revisão do Formulário", "noCommentsYet": "Sem comentários ainda",
    "noUsersFound": "Nenhum utilizador encontrado", "noZonesFound": "Nenhuma zona encontrada",
    "read": "Lido", "reply": "Responder", "reviewMessage": "Mensagem de revisão",
    "reviewMessagePlaceholder": "Escreva a sua mensagem de revisão...", "reviewSent": "Revisão enviada",
    "reviewers": "Revisores", "reviewersSelected": "Revisores selecionados", "saveSynthesis": "Guardar Síntese",
    "searchAdminZones": "Pesquisar zonas administrativas", "searchUsers": "Pesquisar utilizadores",
    "selectReviewers": "Selecionar revisores", "sendComment": "Enviar comentário",
    "sendForReview": "Enviar para revisão", "sendReview": "Enviar revisão", "sentBy": "Enviado por",
    "synthesis": "Síntese", "synthesisDesc": "Compilar uma síntese dos dados",
    "synthesisPlaceholder": "Escreva a sua síntese aqui...", "synthesisSaved": "Síntese guardada",
    "targetZones": "Zonas alvo", "targetZonesDesc": "Selecionar zonas administrativas alvo",
    "unread": "Não lido", "writeComment": "Escrever comentário", "writeReply": "Escrever resposta",
}
for key, val in PT_COLLECTE.items():
    if key not in langs["pt"].get("collecte", {}):
        langs["pt"]["collecte"][key] = val

# ── 2. Add missing collecte keys to AR ──
AR_COLLECTE = {
    "comments": "التعليقات", "compileSynthesis": "تجميع التقرير", "fbClickToRename": "انقر لإعادة التسمية",
    "formReview": "مراجعة النموذج", "noCommentsYet": "لا توجد تعليقات بعد",
    "noUsersFound": "لم يتم العثور على مستخدمين", "noZonesFound": "لم يتم العثور على مناطق",
    "read": "مقروء", "reply": "رد", "reviewMessage": "رسالة المراجعة",
    "reviewMessagePlaceholder": "اكتب رسالة المراجعة...", "reviewSent": "تم إرسال المراجعة",
    "reviewers": "المراجعون", "reviewersSelected": "المراجعون المحددون", "saveSynthesis": "حفظ التقرير",
    "searchAdminZones": "البحث عن المناطق الإدارية", "searchUsers": "البحث عن المستخدمين",
    "selectReviewers": "اختيار المراجعين", "sendComment": "إرسال تعليق",
    "sendForReview": "إرسال للمراجعة", "sendReview": "إرسال المراجعة", "sentBy": "أرسل بواسطة",
    "synthesis": "تقرير تجميعي", "synthesisDesc": "تجميع تقرير من البيانات",
    "synthesisPlaceholder": "اكتب التقرير هنا...", "synthesisSaved": "تم حفظ التقرير",
    "targetZones": "المناطق المستهدفة", "targetZonesDesc": "اختيار المناطق الإدارية المستهدفة",
    "unread": "غير مقروء", "writeComment": "كتابة تعليق", "writeReply": "كتابة رد",
}
for key, val in AR_COLLECTE.items():
    if key not in langs["ar"].get("collecte", {}):
        langs["ar"]["collecte"][key] = val

# ── 3. Add missing ES keys from EN (fallback) ──
def deep_merge(target, source):
    added = 0
    for k, v in source.items():
        if k not in target:
            target[k] = v
            added += 1
        elif isinstance(v, dict) and isinstance(target.get(k), dict):
            added += deep_merge(target[k], v)
    return added

es_added = deep_merge(langs["es"], langs["en"])
print(f"ES: added {es_added} missing keys from EN")

# ── 4. Add hardcoded UI strings to all languages ──
UI_KEYS = {
    "requiredFieldsError": {
        "en": "required field(s) must be filled before submitting.",
        "fr": "champ(s) obligatoire(s) doivent être remplis avant la soumission.",
        "pt": "campo(s) obrigatório(s) devem ser preenchidos antes do envio.",
        "ar": "يجب ملء الحقول المطلوبة قبل الإرسال.",
        "es": "campo(s) obligatorio(s) deben completarse antes del envío.",
    },
    "previewModeMessage": {
        "en": "Preview mode — you can fill in fields to test the form, but data will not be submitted.",
        "fr": "Mode aperçu — vous pouvez remplir les champs pour tester le formulaire, mais les données ne seront pas soumises.",
        "pt": "Modo de pré-visualização — pode preencher os campos para testar, mas os dados não serão enviados.",
        "ar": "وضع المعاينة — يمكنك ملء الحقول لاختبار النموذج، لكن البيانات لن تُرسل.",
        "es": "Modo vista previa — puede completar los campos para probar, pero los datos no se enviarán.",
    },
    "submitting": {"en": "Submitting...", "fr": "Envoi en cours...", "pt": "A enviar...", "ar": "جاري الإرسال...", "es": "Enviando..."},
    "submitForm": {"en": "Submit", "fr": "Soumettre", "pt": "Enviar", "ar": "إرسال", "es": "Enviar"},
    "submissionDetail": {"en": "Submission Detail", "fr": "Détail de la soumission", "pt": "Detalhe da submissão", "ar": "تفاصيل التقديم", "es": "Detalle del envío"},
    "submittedData": {"en": "Submitted Data", "fr": "Données soumises", "pt": "Dados enviados", "ar": "البيانات المقدمة", "es": "Datos enviados"},
    "noSubmissionsYet": {"en": "No submissions yet.", "fr": "Aucune soumission pour le moment.", "pt": "Nenhuma submissão ainda.", "ar": "لا توجد بيانات مقدمة بعد.", "es": "Sin envíos aún."},
    "submissions": {"en": "submission(s)", "fr": "soumission(s)", "pt": "submissão(ões)", "ar": "تقديم(ات)", "es": "envío(s)"},
    "view": {"en": "View", "fr": "Voir", "pt": "Ver", "ar": "عرض", "es": "Ver"},
    "date": {"en": "Date", "fr": "Date", "pt": "Data", "ar": "التاريخ", "es": "Fecha"},
    "noData": {"en": "No data", "fr": "Aucune donnée", "pt": "Sem dados", "ar": "لا توجد بيانات", "es": "Sin datos"},
    "previous": {"en": "Previous", "fr": "Précédent", "pt": "Anterior", "ar": "السابق", "es": "Anterior"},
    "next": {"en": "Next", "fr": "Suivant", "pt": "Seguinte", "ar": "التالي", "es": "Siguiente"},
    "rows": {"en": "Rows", "fr": "Lignes", "pt": "Linhas", "ar": "الصفوف", "es": "Filas"},
    "backToSubmissions": {"en": "Back to Campaigns", "fr": "Retour aux campagnes", "pt": "Voltar às campanhas", "ar": "العودة إلى الحملات", "es": "Volver a campañas"},
    "submissionNotFound": {"en": "Submission not found", "fr": "Soumission introuvable", "pt": "Submissão não encontrada", "ar": "التقديم غير موجود", "es": "Envío no encontrado"},
    "close": {"en": "Close", "fr": "Fermer", "pt": "Fechar", "ar": "إغلاق", "es": "Cerrar"},
    "confirm": {"en": "Confirm", "fr": "Confirmer", "pt": "Confirmar", "ar": "تأكيد", "es": "Confirmar"},
    "edit": {"en": "Edit", "fr": "Modifier", "pt": "Editar", "ar": "تعديل", "es": "Editar"},
    "deleteSubDomain": {"en": "Delete sub-domain", "fr": "Supprimer le sous-domaine", "pt": "Eliminar subdomínio", "ar": "حذف النطاق الفرعي", "es": "Eliminar subdominio"},
    "deleteDashboard": {"en": "Delete dashboard", "fr": "Supprimer le tableau de bord", "pt": "Eliminar painel", "ar": "حذف لوحة المتابعة", "es": "Eliminar panel"},
    "addSample": {"en": "+ Add Sample", "fr": "+ Ajouter Prélèvement", "pt": "+ Adicionar Amostra", "ar": "+ إضافة عينة", "es": "+ Añadir Muestra"},
    "showing": {"en": "Showing", "fr": "Affichage de", "pt": "A mostrar", "ar": "عرض", "es": "Mostrando"},
    "of": {"en": "of", "fr": "sur", "pt": "de", "ar": "من", "es": "de"},
}

for key, translations in UI_KEYS.items():
    for lang_code, text in translations.items():
        if lang_code in langs:
            langs[lang_code]["collecte"][key] = text

# ── 5. Save all files ──
for lang in ["en", "fr", "pt", "ar", "es"]:
    path = os.path.join(BASE, f"{lang}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(langs[lang], f, ensure_ascii=False, indent=2)
        f.write("\n")

# ── 6. Verify ──
def count_keys(obj):
    c = 0
    for v in obj.values():
        if isinstance(v, dict):
            c += count_keys(v)
        else:
            c += 1
    return c

for lang in ["en", "fr", "pt", "ar", "es"]:
    path = os.path.join(BASE, f"{lang}.json")
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"{lang.upper()}: {count_keys(data)} keys")
