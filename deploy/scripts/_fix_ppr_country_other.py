#!/usr/bin/env python3
"""
Fix PPR survey templates:
1. Change 'country' field from text to master-data-select (countries) with tenant scoping
2. Add "Other, please specify" conditional text fields for all selects with "other" option
"""
import paramiko
import json
import uuid
import os
import sys
import tempfile
import copy

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VM_APP = "10.202.101.183"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
DB_HOST = "10.202.101.185"
DB_PASS = "Ar1s_Pr0d_2024!xK9mZ"

BASE = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(BASE, "_ppr_survey_ids.json")) as f:
    IDS = json.load(f)


def uid():
    return str(uuid.uuid4())


def ml(en, fr="", pt="", ar=""):
    return {"en": en, "fr": fr or en, "pt": pt or en, "ar": ar or en}


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


def fetch_template(c, token, tpl_id):
    chan = c.get_transport().open_session()
    chan.exec_command(f'curl -s -H "Authorization: Bearer {token}" "http://localhost:3010/api/v1/form-builder/templates/{tpl_id}"')
    chan.settimeout(15)
    out = b""
    try:
        while True:
            ch = chan.recv(4096)
            if not ch: break
            out += ch
    except: pass
    return json.loads(out.decode(errors="replace"))["data"]


def update_template(c, token, tpl_id, schema):
    body = json.dumps({"schema": schema}, ensure_ascii=False)
    tmp = tempfile.NamedTemporaryFile(mode="w", suffix=".json", delete=False, newline="\n", encoding="utf-8")
    tmp.write(body)
    tmp.close()
    sftp = c.open_sftp()
    sftp.put(tmp.name, "/tmp/tpl_update.json")
    sftp.close()
    os.unlink(tmp.name)

    chan = c.get_transport().open_session()
    chan.exec_command(
        f'curl -s -X PATCH http://localhost:3010/api/v1/form-builder/templates/{tpl_id} '
        f'-H "Content-Type: application/json" '
        f'-H "Authorization: Bearer {token}" '
        f'-d @/tmp/tpl_update.json'
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
    return "data" in resp


def fix_schema(schema):
    """
    1. Replace country text field with master-data-select (geo-entities countries)
    2. Add conditional "specify" fields after every field with "other" option
    """
    changes = 0

    for section in schema["sections"]:
        new_fields = []
        for field in section["fields"]:
            code = field["code"]
            ftype = field["type"]

            # Fix 1: Country field → admin-location with level 0 only (tenant-scoped)
            if code == "country" and ftype in ("text", "master-data-select"):
                field["type"] = "admin-location"
                field["properties"] = {
                    "levels": [0],
                    "requiredLevels": [0],
                }
                field["label"] = ml("Country", "Pays", "País", "البلد")
                changes += 1
                print(f"    country: {ftype} → admin-location (level 0, tenant-scoped)")

            # Fix 1b: destination_country in template C → also admin-location
            if code == "destination_country" and ftype in ("text", "master-data-select"):
                field["type"] = "admin-location"
                field["properties"] = {
                    "levels": [0],
                    "requiredLevels": [0],
                }
                field["label"] = ml("Destination Country", "Pays destinataire", "País de destino", "البلد المستلم")
                changes += 1
                print(f"    destination_country: {ftype} → admin-location (level 0, tenant-scoped)")

            new_fields.append(field)

            # Fix 2: Add "Other, specify" field after any select/multi-select with "other" option
            options = field.get("properties", {}).get("options", [])
            has_other = any(
                o.get("value") in ("other", "Other", "other_specify")
                for o in options
            )

            if has_other and ftype in ("select", "multi-select"):
                specify_code = f"{code}_other_specify"
                # Check if it already exists
                existing = any(f2["code"] == specify_code for f2 in section["fields"])
                if not existing:
                    specify_field = {
                        "id": uid(),
                        "type": "text",
                        "code": specify_code,
                        "label": ml(
                            "If other, please specify",
                            "Si autre, précisez",
                            "Se outro, especifique",
                            "إذا كان أخرى، يرجى التحديد"
                        ),
                        "placeholder": ml("Specify...", "Précisez...", "Especifique...", "حدد..."),
                        "helpText": ml(""),
                        "column": 0,
                        "columnSpan": field.get("columnSpan", 1),
                        "order": field["order"] + 0.5,  # Insert right after
                        "required": False,
                        "readOnly": False,
                        "hidden": False,
                        "validation": {},
                        "properties": {},
                        "conditions": [{
                            "id": uid(),
                            "type": "visibility",
                            "action": "show",
                            "logic": "any",
                            "rules": [{
                                "field": code,
                                "operator": "equals" if ftype == "select" else "contains",
                                "value": "other",
                            }],
                        }],
                    }
                    new_fields.append(specify_field)
                    changes += 1
                    print(f"    + {specify_code} (conditional on {code}=other)")

        section["fields"] = new_fields

        # Re-order fields to fix fractional orders
        section["fields"].sort(key=lambda f: f["order"])
        for i, f in enumerate(section["fields"]):
            f["order"] = i

    return changes


def main():
    print("=" * 60)
    print("  FIX PPR TEMPLATES: country select + other specify")
    print("=" * 60)

    c = get_ssh()
    token = api_login(c)
    print("Login: OK\n")

    for label, tpl_id in IDS["templates"].items():
        print(f"[{label}] Template {tpl_id[:12]}...")

        tpl = fetch_template(c, token, tpl_id)
        schema = tpl["schema"]

        changes = fix_schema(schema)

        if changes > 0:
            ok = update_template(c, token, tpl_id, schema)
            if ok:
                # Count fields
                total = sum(len(s["fields"]) for s in schema["sections"])
                print(f"  → UPDATED ({changes} changes, {total} fields total)\n")
            else:
                print(f"  → UPDATE FAILED\n")
        else:
            print(f"  → No changes needed\n")

    c.close()
    print("DONE")


if __name__ == "__main__":
    main()
