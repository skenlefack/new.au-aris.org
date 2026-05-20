#!/usr/bin/env python3
"""Fix PPR template: change sampling section from matrix to repeater."""
import paramiko, json, uuid, sys, tempfile, os

VM_APP = "10.202.101.183"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
TPL_ID = "9e7db4f5-7806-438a-8a87-22d521d4a70e"

def ml(en, fr="", pt="", ar=""):
    return {"en": en, "fr": fr or en, "pt": pt or en, "ar": ar or en}

def opts(pairs):
    return [{"label": ml(en, fr, pt, ar), "value": val} for val, en, fr, pt, ar in pairs]

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect(VM_APP, username=SSH_USER, password=SSH_PASS, timeout=15)

# Login
login_body = json.dumps({"email": "admin@au-aris.org", "password": "Aris2026@@4!0"})
tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, newline="\n")
tmp.write(login_body)
tmp.close()
sftp = c.open_sftp()
sftp.put(tmp.name, "/tmp/login.json")
sftp.close()
os.unlink(tmp.name)

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
token = json.loads(out.decode())["data"]["accessToken"]
print("Login OK")

# Fetch template
chan = c.get_transport().open_session()
chan.exec_command(f'curl -s -H "Authorization: Bearer {token}" "http://localhost:3010/api/v1/form-builder/templates/{TPL_ID}"')
chan.settimeout(15)
out = b""
try:
    while True:
        ch = chan.recv(4096)
        if not ch: break
        out += ch
except: pass
schema = json.loads(out.decode(errors="replace"))["data"]["schema"]
print(f"Fetched schema: {len(schema['sections'])} sections")

# Replace section 7
for s in schema["sections"]:
    if s["order"] == 7:
        old_id = s["fields"][0]["id"] if s["fields"] else str(uuid.uuid4())
        s["fields"] = [{
            "id": old_id, "type": "repeater", "code": "samples",
            "label": ml("Samples", "Prélèvements", "Amostras", "العينات"),
            "placeholder": ml(""), "column": 0, "columnSpan": 1, "order": 0,
            "required": False, "readOnly": False, "hidden": False,
            "validation": {}, "conditions": [],
            "helpText": ml("Add up to 15 non-vaccinated animals", "Ajoutez jusqu'à 15 animaux non vaccinés",
                          "Adicione até 15 animais não vacinados", "أضف حتى 15 حيوان غير مطعم"),
            "properties": {
                "minRows": 1, "maxRows": 15,
                "addLabel": ml("+ Add Sample", "+ Ajouter Prélèvement", "+ Adicionar Amostra", "+ إضافة عينة"),
                "fields": [
                    {"code": "species", "label": ml("Species","Espèce","Espécie","النوع"), "type": "select", "required": True,
                     "options": opts([("goat","Goat","Chèvre","Caprino","ماعز"),("sheep","Sheep","Mouton","Ovino","غنم")])},
                    {"code": "sex", "label": ml("Sex","Sexe","Sexo","الجنس"), "type": "select", "required": True,
                     "options": opts([("M","Male","Mâle","Macho","ذكر"),("F","Female","Femelle","Fêmea","أنثى")])},
                    {"code": "age", "label": ml("Age","Âge","Idade","العمر"), "type": "select", "required": True,
                     "options": opts([("4_12m","4-12 months","4-12 mois","4-12 meses","4-12 شهر"),("over_12m",">12 months",">12 mois",">12 meses",">12 شهر")])},
                    {"code": "sample_code", "label": ml("Sample Code","Code Prélèvement","Código Amostra","رمز العينة"), "type": "text",
                     "placeholder": ml("e.g. AD/Djerem/001","ex. AD/Djerem/001","ex. AD/Djerem/001","مثال: AD/Djerem/001")},
                    {"code": "sample_type", "label": ml("Sample Type","Type Échantillon","Tipo Amostra","نوع العينة"), "type": "select", "required": True,
                     "options": opts([
                         ("SE","SE - Serum","SE - Sérum (tube sec)","SE - Soro","SE - مصل"),
                         ("ECN","ECN - Conjunctival Swab","ECN - Écouvillon CN (VTM bleu)","ECN - Zaragatoa CN","ECN - مسحة ملتحمية"),
                         ("EON","EON - Oro-nasal Swab","EON - Écouvillon ON (VTM bleu)","EON - Zaragatoa ON","EON - مسحة فموية"),
                     ])},
                    {"code": "lab_result", "label": ml("Lab Result","Résultat Labo","Resultado Lab","نتيجة المختبر"), "type": "select",
                     "options": opts([("positive","Positive","Positif","Positivo","إيجابي"),("negative","Negative","Négatif","Negativo","سلبي"),
                         ("doubtful","Doubtful","Douteux","Duvidoso","مشكوك فيه")])},
                ],
            },
        }]
        print("Section 7 replaced: matrix -> repeater (6 sub-fields, 1-15 rows)")
        break

# Upload
body = json.dumps({"schema": schema}, ensure_ascii=False)
tmp2 = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, newline="\n", encoding="utf-8")
tmp2.write(body)
tmp2.close()
sftp = c.open_sftp()
sftp.put(tmp2.name, "/tmp/ppr_fix.json")
sftp.close()
os.unlink(tmp2.name)
print(f"Uploaded ({len(body)} bytes)")

# PATCH
chan = c.get_transport().open_session()
chan.exec_command(
    f'curl -s -X PATCH http://localhost:3010/api/v1/form-builder/templates/{TPL_ID} '
    f'-H "Content-Type: application/json" '
    f'-H "Authorization: Bearer {token}" '
    f'-d @/tmp/ppr_fix.json'
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
        for s in resp["data"]["schema"]["sections"]:
            if s["order"] == 7:
                f = s["fields"][0]
                sub = f.get("properties", {}).get("fields", [])
                print(f"Verified: type={f['type']}, sub-fields={len(sub)}, max={f['properties'].get('maxRows')}")
        print("SUCCESS!")
    else:
        print(f"FAILED: {resp.get('message','?')}")
except Exception as e:
    print(f"Error: {e}")

c.close()
