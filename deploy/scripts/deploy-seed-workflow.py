#!/usr/bin/env python3
"""
ARIS 4.0 — Seed Workflow Definitions via workflow service API.
Creates 54 country workflow definitions + 4 standard validation steps each.
Uses the workflow service REST API (port 3012 via Traefik).
"""
import sys
import json

from ssh_config import ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# ═══════════════════════════════════════════════════════════════
# 54 AU Member States grouped by REC
# ═══════════════════════════════════════════════════════════════

COUNTRIES = [
    # IGAD (8)
    {"code": "KE", "en": "Kenya", "fr": "Kenya", "rec": "IGAD"},
    {"code": "ET", "en": "Ethiopia", "fr": "Ethiopie", "rec": "IGAD"},
    {"code": "UG", "en": "Uganda", "fr": "Ouganda", "rec": "IGAD"},
    {"code": "SO", "en": "Somalia", "fr": "Somalie", "rec": "IGAD"},
    {"code": "DJ", "en": "Djibouti", "fr": "Djibouti", "rec": "IGAD"},
    {"code": "ER", "en": "Eritrea", "fr": "Erythree", "rec": "IGAD"},
    {"code": "SD", "en": "Sudan", "fr": "Soudan", "rec": "IGAD"},
    {"code": "SS", "en": "South Sudan", "fr": "Soudan du Sud", "rec": "IGAD"},
    # ECOWAS (15)
    {"code": "NG", "en": "Nigeria", "fr": "Nigeria", "rec": "ECOWAS"},
    {"code": "SN", "en": "Senegal", "fr": "Senegal", "rec": "ECOWAS"},
    {"code": "BJ", "en": "Benin", "fr": "Benin", "rec": "ECOWAS"},
    {"code": "BF", "en": "Burkina Faso", "fr": "Burkina Faso", "rec": "ECOWAS"},
    {"code": "CV", "en": "Cabo Verde", "fr": "Cap-Vert", "rec": "ECOWAS"},
    {"code": "CI", "en": "Cote d'Ivoire", "fr": "Cote d'Ivoire", "rec": "ECOWAS"},
    {"code": "GM", "en": "Gambia", "fr": "Gambie", "rec": "ECOWAS"},
    {"code": "GH", "en": "Ghana", "fr": "Ghana", "rec": "ECOWAS"},
    {"code": "GN", "en": "Guinea", "fr": "Guinee", "rec": "ECOWAS"},
    {"code": "GW", "en": "Guinea-Bissau", "fr": "Guinee-Bissau", "rec": "ECOWAS"},
    {"code": "LR", "en": "Liberia", "fr": "Liberia", "rec": "ECOWAS"},
    {"code": "ML", "en": "Mali", "fr": "Mali", "rec": "ECOWAS"},
    {"code": "NE", "en": "Niger", "fr": "Niger", "rec": "ECOWAS"},
    {"code": "SL", "en": "Sierra Leone", "fr": "Sierra Leone", "rec": "ECOWAS"},
    {"code": "TG", "en": "Togo", "fr": "Togo", "rec": "ECOWAS"},
    # SADC (13)
    {"code": "ZA", "en": "South Africa", "fr": "Afrique du Sud", "rec": "SADC"},
    {"code": "BW", "en": "Botswana", "fr": "Botswana", "rec": "SADC"},
    {"code": "KM", "en": "Comoros", "fr": "Comores", "rec": "SADC"},
    {"code": "SZ", "en": "Eswatini", "fr": "Eswatini", "rec": "SADC"},
    {"code": "LS", "en": "Lesotho", "fr": "Lesotho", "rec": "SADC"},
    {"code": "MG", "en": "Madagascar", "fr": "Madagascar", "rec": "SADC"},
    {"code": "MW", "en": "Malawi", "fr": "Malawi", "rec": "SADC"},
    {"code": "MU", "en": "Mauritius", "fr": "Maurice", "rec": "SADC"},
    {"code": "MZ", "en": "Mozambique", "fr": "Mozambique", "rec": "SADC"},
    {"code": "NA", "en": "Namibia", "fr": "Namibie", "rec": "SADC"},
    {"code": "SC", "en": "Seychelles", "fr": "Seychelles", "rec": "SADC"},
    {"code": "ZM", "en": "Zambia", "fr": "Zambie", "rec": "SADC"},
    {"code": "ZW", "en": "Zimbabwe", "fr": "Zimbabwe", "rec": "SADC"},
    # EAC (1 — Tanzania)
    {"code": "TZ", "en": "Tanzania", "fr": "Tanzanie", "rec": "EAC"},
    # ECCAS (11)
    {"code": "AO", "en": "Angola", "fr": "Angola", "rec": "ECCAS"},
    {"code": "BI", "en": "Burundi", "fr": "Burundi", "rec": "ECCAS"},
    {"code": "CM", "en": "Cameroon", "fr": "Cameroun", "rec": "ECCAS"},
    {"code": "CF", "en": "Central African Rep.", "fr": "Rep. Centrafricaine", "rec": "ECCAS"},
    {"code": "TD", "en": "Chad", "fr": "Tchad", "rec": "ECCAS"},
    {"code": "CG", "en": "Congo", "fr": "Congo", "rec": "ECCAS"},
    {"code": "CD", "en": "DR Congo", "fr": "RD Congo", "rec": "ECCAS"},
    {"code": "GQ", "en": "Equatorial Guinea", "fr": "Guinee Equatoriale", "rec": "ECCAS"},
    {"code": "GA", "en": "Gabon", "fr": "Gabon", "rec": "ECCAS"},
    {"code": "RW", "en": "Rwanda", "fr": "Rwanda", "rec": "ECCAS"},
    {"code": "ST", "en": "Sao Tome", "fr": "Sao Tome-et-Principe", "rec": "ECCAS"},
    # UMA (5)
    {"code": "DZ", "en": "Algeria", "fr": "Algerie", "rec": "UMA"},
    {"code": "LY", "en": "Libya", "fr": "Libye", "rec": "UMA"},
    {"code": "MR", "en": "Mauritania", "fr": "Mauritanie", "rec": "UMA"},
    {"code": "MA", "en": "Morocco", "fr": "Maroc", "rec": "UMA"},
    {"code": "TN", "en": "Tunisia", "fr": "Tunisie", "rec": "UMA"},
    # COMESA (1 — Egypt)
    {"code": "EG", "en": "Egypt", "fr": "Egypte", "rec": "COMESA"},
]

# ═══════════════════════════════════════════════════════════════
# 4 standard validation steps (Annex B §B4.1)
# ═══════════════════════════════════════════════════════════════

STANDARD_STEPS = [
    {
        "stepOrder": 0,
        "levelType": "national",
        "adminLevel": None,
        "name": {"en": "National Technical Validation", "fr": "Validation Technique Nationale"},
        "canEdit": True,
        "canValidate": True,
        "transmitDelayHours": None,
    },
    {
        "stepOrder": 1,
        "levelType": "national",
        "adminLevel": None,
        "name": {"en": "National Official Approval", "fr": "Approbation Officielle Nationale"},
        "canEdit": False,
        "canValidate": True,
        "transmitDelayHours": None,
    },
    {
        "stepOrder": 2,
        "levelType": "regional",
        "adminLevel": None,
        "name": {"en": "REC Harmonization", "fr": "Harmonisation CER"},
        "canEdit": False,
        "canValidate": True,
        "transmitDelayHours": None,
    },
    {
        "stepOrder": 3,
        "levelType": "continental",
        "adminLevel": None,
        "name": {"en": "Continental Publication", "fr": "Publication Continentale"},
        "canEdit": False,
        "canValidate": True,
        "transmitDelayHours": None,
    },
]


safe_print("=" * 60)
safe_print("  ARIS 4.0 — Seed Workflow Definitions")
safe_print("=" * 60)

# ── Step 1: Login ──
safe_print("\n=== 1. Logging in ===")
login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'"""
code, out, err = ssh(VM_APP, login_cmd, timeout=10)

login_data = json.loads(out)
token = login_data["data"]["accessToken"]
tenant_id = login_data["data"]["user"]["tenantId"]
safe_print(f"  Logged in (tenant: {tenant_id})")

# ── Step 2: Check existing definitions ──
safe_print("\n=== 2. Checking existing workflow definitions ===")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/definitions?limit=100' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)

existing = json.loads(out)
existing_codes = set()
for wf in existing.get("data", []):
    existing_codes.add(wf.get("countryCode", ""))
safe_print(f"  Existing: {len(existing_codes)} definitions")

# ── Step 3: Create workflow definitions for each country ──
safe_print("\n=== 3. Creating workflow definitions ===")

created = 0
skipped = 0
errors = 0

for country in COUNTRIES:
    cc = country["code"]
    rec = country["rec"]

    if cc in existing_codes:
        skipped += 1
        continue

    # Create the definition
    payload = {
        "countryCode": cc,
        "name": {
            "en": f"ARIS {country['en']} Data Validation and Transmission",
            "fr": f"ARIS {country['fr']} Validation et Transmission des Donnees",
        },
        "description": {
            "en": f"4-level validation pipeline: Data Steward > CVO > REC ({rec}) > AU-IBAR",
            "fr": f"Pipeline de validation a 4 niveaux : Data Steward > CVO > CER ({rec}) > UA-BIRA",
        },
        "startLevel": 4,
        "endLevel": 0,
        "defaultTransmitDelay": 72,
        "defaultValidationDelay": 48,
        "autoTransmitEnabled": True,
        "autoValidateEnabled": False,
        "requireComment": False,
        "allowReject": True,
        "allowReturn": True,
    }

    payload_json = json.dumps(payload).replace("'", "'\\''")

    code, out, err = ssh(VM_APP, f"""curl -s -X POST 'http://localhost:3012/api/v1/workflow/definitions' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}' -H 'Content-Type: application/json' -d '{payload_json}'""", timeout=15)

    try:
        resp = json.loads(out)
        wf_id = resp.get("data", {}).get("id")
        if wf_id:
            safe_print(f"  {cc} ({country['en']}) -> Created (id: {wf_id[:8]}...)")
            created += 1

            # Create the 4 standard steps
            for step_def in STANDARD_STEPS:
                step_payload = {
                    "stepOrder": step_def["stepOrder"],
                    "levelType": step_def["levelType"],
                    "name": step_def["name"],
                    "canEdit": step_def["canEdit"],
                    "canValidate": step_def["canValidate"],
                }
                if step_def["adminLevel"] is not None:
                    step_payload["adminLevel"] = step_def["adminLevel"]
                if step_def["transmitDelayHours"] is not None:
                    step_payload["transmitDelayHours"] = step_def["transmitDelayHours"]

                step_json = json.dumps(step_payload).replace("'", "'\\''")

                scode, sout, serr = ssh(VM_APP, f"""curl -s -X POST 'http://localhost:3012/api/v1/workflow/definitions/{wf_id}/steps' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}' -H 'Content-Type: application/json' -d '{step_json}'""", timeout=10)

                try:
                    sresp = json.loads(sout)
                    if sresp.get("data", {}).get("id"):
                        pass  # OK
                    else:
                        safe_print(f"    Step {step_def['stepOrder']} WARNING: {sout[:100]}")
                except:
                    safe_print(f"    Step {step_def['stepOrder']} ERROR: {sout[:100]}")
        else:
            safe_print(f"  {cc} ({country['en']}) -> ERROR: {out[:200]}")
            errors += 1
    except Exception as e:
        safe_print(f"  {cc} ({country['en']}) -> PARSE ERROR: {e} | {out[:200]}")
        errors += 1

safe_print(f"\n  Created: {created}, Skipped (existing): {skipped}, Errors: {errors}")

# ── Step 4: Verify ──
safe_print("\n=== 4. Verification ===")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/definitions?limit=100' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)

try:
    final = json.loads(out)
    total = final.get("meta", {}).get("total", len(final.get("data", [])))
    safe_print(f"  Total workflow definitions: {total}")
    for wf in final.get("data", [])[:5]:
        safe_print(f"    - {wf.get('countryCode')}: {json.dumps(wf.get('name', {}).get('en', '?'))} ({len(wf.get('steps', []))} steps)")
    if total > 5:
        safe_print(f"    ... +{total - 5} more")
except Exception as e:
    safe_print(f"  Parse error: {e}")
    safe_print(f"  Raw: {out[:500]}")

safe_print("\n" + "=" * 60)
safe_print("  Seed complete!")
safe_print("=" * 60)
