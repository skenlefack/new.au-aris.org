"""Patch 3 PPR sero-surveillance templates to use form-data-select for cross-form links."""
import paramiko, json, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
LOGIN_EMAIL = "admin@au-aris.org"
LOGIN_PASS = "Aris2026@@4!0"

ENVS = [
    {
        "name": "PRODUCTION", "host": "10.202.101.183",
        "animal": "ade2dd34-ea9c-4773-aee3-7140aa020c6a",
        "consignment": "a13d35d3-eb9d-43f1-a5b2-f70f1de33c1e",
        "lab": "31cf2138-5733-4b51-9789-0f06ab64f0fb",
    },
    {
        "name": "STAGING", "host": "10.202.101.146",
        "animal": "6b24c99c-d735-47d2-b057-2af8a4d5f2f4",
        "consignment": "5ddeae70-d3ac-4ac6-8bfb-b8af743d6d65",
        "lab": "3cd8f027-2721-43d0-9e7d-a622f86b7d8f",
    },
]

def L(en, fr, pt=None, ar=None, es=None, sw=None):
    return {"en": en, "fr": fr, "pt": pt or en, "ar": ar or en, "es": es or en, "sw": sw or en}

PATCHES = {
    "animal": {
        "field_id": "herd_identifier",
        "new_field": {
            "id": "herd_identifier", "type": "form-data-select", "code": "herd_identifier",
            "label": L("Herd Identifier", "Identifiant du troupeau",
                       "Identificador do rebanho", "\u0645\u0639\u0631\u0641 \u0627\u0644\u0642\u0637\u064a\u0639",
                       "Identificador del reba\u00f1o", "Kitambulisho cha Kundi"),
            "helpText": L("Select from registered herds (Form A)", "S\u00e9lectionner parmi les troupeaux enregistr\u00e9s (Form A)",
                          "Selecionar dos rebanhos registados (Form A)", "\u0627\u062e\u062a\u0631 \u0645\u0646 \u0627\u0644\u0642\u0637\u0639\u0627\u0646 \u0627\u0644\u0645\u0633\u062c\u0644\u0629",
                          "Seleccionar de los reba\u00f1os registrados (Form A)", "Chagua kutoka makundi yaliyosajiliwa (Fomu A)"),
            "column": 2, "columnSpan": 1, "order": 1, "required": True,
            "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
            "properties": {
                "sourceTemplateName": "PPR Sero-Surveillance \u2014 A. Herd / Holding Record",
                "sourceFieldCode": "herd_identifier",
                "valueFieldCode": "herd_identifier",
                "filterByAdminLocation": True,
            },
        },
        "section_id": "animal_identification",
    },
    "consignment": {
        "field_id": "county_team",
        "new_field": {
            "id": "county_team", "type": "form-data-select", "code": "county_team",
            "label": L("County / Team", "Comt\u00e9 / \u00c9quipe",
                       "Condado / Equipa", "\u0627\u0644\u0645\u0642\u0627\u0637\u0639\u0629 / \u0627\u0644\u0641\u0631\u064a\u0642",
                       "Condado / Equipo", "Kaunti / Timu"),
            "helpText": L("Select team from field records (Form A)", "S\u00e9lectionner l'\u00e9quipe des fiches terrain (Form A)",
                          "Selecionar equipa dos registos de campo (Form A)", "\u0627\u062e\u062a\u0631 \u0627\u0644\u0641\u0631\u064a\u0642 \u0645\u0646 \u0633\u062c\u0644\u0627\u062a \u0627\u0644\u0645\u064a\u062f\u0627\u0646",
                          "Seleccionar equipo de registros de campo (Form A)", "Chagua timu kutoka rekodi za uwandani (Fomu A)"),
            "column": 2, "columnSpan": 1, "order": 1, "required": True,
            "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
            "properties": {
                "sourceTemplateName": "PPR Sero-Surveillance \u2014 A. Herd / Holding Record",
                "sourceFieldCode": "team_code",
                "valueFieldCode": "team_code",
                "filterByAdminLocation": False,
            },
        },
        "section_id": "dispatch_info",
    },
    "lab": {
        "field_id": "animal_identifier_d",
        "new_field": {
            "id": "animal_identifier_d", "type": "form-data-select", "code": "animal_identifier_d",
            "label": L("Animal Identifier", "Identifiant de l'animal",
                       "Identificador do animal", "\u0645\u0639\u0631\u0641 \u0627\u0644\u062d\u064a\u0648\u0627\u0646",
                       "Identificador del animal", "Kitambulisho cha Mnyama"),
            "helpText": L("Select from sampled animals (Form B)", "S\u00e9lectionner parmi les animaux pr\u00e9lev\u00e9s (Form B)",
                          "Selecionar dos animais amostrados (Form B)", "\u0627\u062e\u062a\u0631 \u0645\u0646 \u0627\u0644\u062d\u064a\u0648\u0627\u0646\u0627\u062a \u0627\u0644\u0645\u0623\u062e\u0648\u0630 \u0639\u064a\u0646\u0627\u062a\u0647\u0627",
                          "Seleccionar de los animales muestreados (Form B)", "Chagua kutoka wanyama waliopimwa (Fomu B)"),
            "column": 2, "columnSpan": 1, "order": 1, "required": True,
            "readOnly": False, "hidden": False, "validation": {}, "conditions": [],
            "properties": {
                "sourceTemplateName": "PPR Sero-Surveillance \u2014 B. Individual Animal Record",
                "sourceFieldCode": "animal_identifier",
                "valueFieldCode": "animal_identifier",
                "filterByAdminLocation": False,
            },
        },
        "section_id": "sample_identification",
    },
}

for env in ENVS:
    print(f"\n{'='*60}")
    print(f"  PATCHING -- {env['name']} ({env['host']})")
    print(f"{'='*60}")

    ssh = paramiko.SSHClient()
    ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        ssh.connect(env["host"], username=SSH_USER, password=SSH_PASS, timeout=15,
                    allow_agent=False, look_for_keys=False)
        print("  Connected.")

        _, stdout, _ = ssh.exec_command(
            'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
            '-H "Content-Type: application/json" '
            f"-d '{{\"email\":\"{LOGIN_EMAIL}\",\"password\":\"{LOGIN_PASS}\"}}' 2>/dev/null",
            timeout=15)
        token = json.loads(stdout.read().decode())["data"]["accessToken"]
        print("  Authenticated.")

        def api_get(path):
            _, so, _ = ssh.exec_command(
                f'curl -sk "https://localhost{path}" '
                f'-H "Authorization: Bearer {token}" 2>/dev/null', timeout=15)
            return json.loads(so.read().decode())

        def api_patch(path, body):
            data = json.dumps(body)
            chan = ssh.get_transport().open_session()
            chan.settimeout(30)
            chan.exec_command(
                f'curl -sk -X PATCH "https://localhost{path}" '
                f'-H "Authorization: Bearer {token}" '
                f'-H "Content-Type: application/json" '
                f'--data-binary @- 2>/dev/null'
            )
            chan.sendall(data.encode())
            chan.shutdown_write()
            time.sleep(2)
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

        for key, patch_info in PATCHES.items():
            tid = env[key]
            print(f"\n  [{key.upper()}] Template {tid[:12]}...")

            r = api_get(f"/api/v1/form-builder/templates/{tid}")
            tmpl = r.get("data", {})
            schema = tmpl.get("schema", {})
            sections = schema.get("sections", [])

            patched = False
            for sec in sections:
                if sec["id"] == patch_info["section_id"]:
                    fields = sec.get("fields", [])
                    for i, f in enumerate(fields):
                        if f["id"] == patch_info["field_id"]:
                            old_type = f.get("type", "?")
                            fields[i] = patch_info["new_field"]
                            patched = True
                            print(f"    Replaced {patch_info['field_id']}: {old_type} -> form-data-select")
                            break
                    break

            if not patched:
                print(f"    WARNING: field {patch_info['field_id']} not found!")
                continue

            r2 = api_patch(f"/api/v1/form-builder/templates/{tid}", {"schema": schema})
            ok = bool(r2.get("data", {}).get("id"))
            msg = r2.get("message", "")
            print(f"    PATCH: {'OK' if ok else msg[:100]}")

    except Exception as e:
        print(f"  ERROR: {e}")
    finally:
        ssh.close()

print("\nDone -- cross-form links patched on both environments.")
