#!/usr/bin/env python3
"""
ARIS 4.0 — Seed Validation Chains via workflow service API.
Creates the 3-level validation pipeline:
  Level 1 (national):     DATA_STEWARD  → NATIONAL_ADMIN     (54 chains)
  Level 2 (regional):     NATIONAL_ADMIN → REC_DATA_STEWARD   (54 chains)
  Level 3 (continental):  REC_DATA_STEWARD → CONTINENTAL_ADMIN (8 chains)
Total: 116 validation chains
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
# User IDs (from seed-credential.ts — verified in production)
# ═══════════════════════════════════════════════════════════════

SUPER_ADMIN = "10000000-0000-4000-a000-000000000001"
CONTINENTAL_ADMIN = "11000000-0000-4000-a000-000000000001"

REC_ADMINS = {
    "IGAD":    "10000000-0000-4000-a000-000000000010",
    "ECOWAS":  "10000000-0000-4000-a000-000000000020",
    "SADC":    "10000000-0000-4000-a000-000000000030",
    "EAC":     "10000000-0000-4000-a000-000000000040",
    "ECCAS":   "10000000-0000-4000-a000-000000000050",
    "UMA":     "10000000-0000-4000-a000-000000000060",
    "CEN_SAD": "10000000-0000-4000-a000-000000000070",
    "COMESA":  "10000000-0000-4000-a000-000000000080",
}

REC_STEWARDS = {
    "IGAD":    "12000000-0000-4000-a000-000000000010",
    "ECOWAS":  "12000000-0000-4000-a000-000000000020",
    "SADC":    "12000000-0000-4000-a000-000000000030",
    "EAC":     "12000000-0000-4000-a000-000000000040",
    "ECCAS":   "12000000-0000-4000-a000-000000000050",
    "UMA":     "12000000-0000-4000-a000-000000000060",
    "CEN_SAD": "12000000-0000-4000-a000-000000000070",
    "COMESA":  "12000000-0000-4000-a000-000000000080",
}

# Country → admin/steward IDs + REC
COUNTRIES = [
    # IGAD (8)
    {"code": "KE", "en": "Kenya",           "rec": "IGAD",   "adminId": "10000000-0000-4000-a000-000000000101", "stewardId": "12000000-0000-4000-a000-000000000101"},
    {"code": "ET", "en": "Ethiopia",         "rec": "IGAD",   "adminId": "10000000-0000-4000-a000-000000000102", "stewardId": "12000000-0000-4000-a000-000000000102"},
    {"code": "UG", "en": "Uganda",           "rec": "IGAD",   "adminId": "10000000-0000-4000-a000-000000000103", "stewardId": "12000000-0000-4000-a000-000000000103"},
    {"code": "SO", "en": "Somalia",          "rec": "IGAD",   "adminId": "10000000-0000-4000-a000-000000000104", "stewardId": "12000000-0000-4000-a000-000000000104"},
    {"code": "DJ", "en": "Djibouti",         "rec": "IGAD",   "adminId": "10000000-0000-4000-a000-000000000105", "stewardId": "12000000-0000-4000-a000-000000000105"},
    {"code": "ER", "en": "Eritrea",          "rec": "IGAD",   "adminId": "10000000-0000-4000-a000-000000000106", "stewardId": "12000000-0000-4000-a000-000000000106"},
    {"code": "SD", "en": "Sudan",            "rec": "IGAD",   "adminId": "10000000-0000-4000-a000-000000000107", "stewardId": "12000000-0000-4000-a000-000000000107"},
    {"code": "SS", "en": "South Sudan",      "rec": "IGAD",   "adminId": "10000000-0000-4000-a000-000000000108", "stewardId": "12000000-0000-4000-a000-000000000108"},
    # ECOWAS (15)
    {"code": "NG", "en": "Nigeria",          "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-000000000201", "stewardId": "12000000-0000-4000-a000-000000000201"},
    {"code": "SN", "en": "Senegal",          "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-000000000202", "stewardId": "12000000-0000-4000-a000-000000000202"},
    {"code": "BJ", "en": "Benin",            "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-000000000203", "stewardId": "12000000-0000-4000-a000-000000000203"},
    {"code": "BF", "en": "Burkina Faso",     "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-000000000204", "stewardId": "12000000-0000-4000-a000-000000000204"},
    {"code": "CV", "en": "Cabo Verde",       "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-000000000205", "stewardId": "12000000-0000-4000-a000-000000000205"},
    {"code": "CI", "en": "Cote d'Ivoire",    "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-000000000206", "stewardId": "12000000-0000-4000-a000-000000000206"},
    {"code": "GM", "en": "Gambia",           "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-000000000207", "stewardId": "12000000-0000-4000-a000-000000000207"},
    {"code": "GH", "en": "Ghana",            "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-000000000208", "stewardId": "12000000-0000-4000-a000-000000000208"},
    {"code": "GN", "en": "Guinea",           "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-000000000209", "stewardId": "12000000-0000-4000-a000-000000000209"},
    {"code": "GW", "en": "Guinea-Bissau",    "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-00000000020a", "stewardId": "12000000-0000-4000-a000-00000000020a"},
    {"code": "LR", "en": "Liberia",          "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-00000000020b", "stewardId": "12000000-0000-4000-a000-00000000020b"},
    {"code": "ML", "en": "Mali",             "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-00000000020c", "stewardId": "12000000-0000-4000-a000-00000000020c"},
    {"code": "NE", "en": "Niger",            "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-00000000020d", "stewardId": "12000000-0000-4000-a000-00000000020d"},
    {"code": "SL", "en": "Sierra Leone",     "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-00000000020e", "stewardId": "12000000-0000-4000-a000-00000000020e"},
    {"code": "TG", "en": "Togo",             "rec": "ECOWAS", "adminId": "10000000-0000-4000-a000-00000000020f", "stewardId": "12000000-0000-4000-a000-00000000020f"},
    # SADC (13)
    {"code": "ZA", "en": "South Africa",     "rec": "SADC",   "adminId": "10000000-0000-4000-a000-000000000301", "stewardId": "12000000-0000-4000-a000-000000000301"},
    {"code": "BW", "en": "Botswana",         "rec": "SADC",   "adminId": "10000000-0000-4000-a000-000000000302", "stewardId": "12000000-0000-4000-a000-000000000302"},
    {"code": "KM", "en": "Comoros",          "rec": "SADC",   "adminId": "10000000-0000-4000-a000-000000000303", "stewardId": "12000000-0000-4000-a000-000000000303"},
    {"code": "SZ", "en": "Eswatini",         "rec": "SADC",   "adminId": "10000000-0000-4000-a000-000000000304", "stewardId": "12000000-0000-4000-a000-000000000304"},
    {"code": "LS", "en": "Lesotho",          "rec": "SADC",   "adminId": "10000000-0000-4000-a000-000000000305", "stewardId": "12000000-0000-4000-a000-000000000305"},
    {"code": "MG", "en": "Madagascar",       "rec": "SADC",   "adminId": "10000000-0000-4000-a000-000000000306", "stewardId": "12000000-0000-4000-a000-000000000306"},
    {"code": "MW", "en": "Malawi",           "rec": "SADC",   "adminId": "10000000-0000-4000-a000-000000000307", "stewardId": "12000000-0000-4000-a000-000000000307"},
    {"code": "MU", "en": "Mauritius",        "rec": "SADC",   "adminId": "10000000-0000-4000-a000-000000000308", "stewardId": "12000000-0000-4000-a000-000000000308"},
    {"code": "MZ", "en": "Mozambique",       "rec": "SADC",   "adminId": "10000000-0000-4000-a000-000000000309", "stewardId": "12000000-0000-4000-a000-000000000309"},
    {"code": "NA", "en": "Namibia",          "rec": "SADC",   "adminId": "10000000-0000-4000-a000-00000000030a", "stewardId": "12000000-0000-4000-a000-00000000030a"},
    {"code": "SC", "en": "Seychelles",       "rec": "SADC",   "adminId": "10000000-0000-4000-a000-00000000030b", "stewardId": "12000000-0000-4000-a000-00000000030b"},
    {"code": "ZM", "en": "Zambia",           "rec": "SADC",   "adminId": "10000000-0000-4000-a000-00000000030c", "stewardId": "12000000-0000-4000-a000-00000000030c"},
    {"code": "ZW", "en": "Zimbabwe",         "rec": "SADC",   "adminId": "10000000-0000-4000-a000-00000000030d", "stewardId": "12000000-0000-4000-a000-00000000030d"},
    # EAC (1)
    {"code": "TZ", "en": "Tanzania",         "rec": "EAC",    "adminId": "10000000-0000-4000-a000-000000000401", "stewardId": "12000000-0000-4000-a000-000000000401"},
    # ECCAS (11)
    {"code": "AO", "en": "Angola",           "rec": "ECCAS",  "adminId": "10000000-0000-4000-a000-000000000501", "stewardId": "12000000-0000-4000-a000-000000000501"},
    {"code": "BI", "en": "Burundi",          "rec": "ECCAS",  "adminId": "10000000-0000-4000-a000-000000000502", "stewardId": "12000000-0000-4000-a000-000000000502"},
    {"code": "CM", "en": "Cameroon",         "rec": "ECCAS",  "adminId": "10000000-0000-4000-a000-000000000503", "stewardId": "12000000-0000-4000-a000-000000000503"},
    {"code": "CF", "en": "Central African Rep.", "rec": "ECCAS", "adminId": "10000000-0000-4000-a000-000000000504", "stewardId": "12000000-0000-4000-a000-000000000504"},
    {"code": "TD", "en": "Chad",             "rec": "ECCAS",  "adminId": "10000000-0000-4000-a000-000000000505", "stewardId": "12000000-0000-4000-a000-000000000505"},
    {"code": "CG", "en": "Congo",            "rec": "ECCAS",  "adminId": "10000000-0000-4000-a000-000000000506", "stewardId": "12000000-0000-4000-a000-000000000506"},
    {"code": "CD", "en": "DR Congo",         "rec": "ECCAS",  "adminId": "10000000-0000-4000-a000-000000000507", "stewardId": "12000000-0000-4000-a000-000000000507"},
    {"code": "GQ", "en": "Equatorial Guinea", "rec": "ECCAS", "adminId": "10000000-0000-4000-a000-000000000508", "stewardId": "12000000-0000-4000-a000-000000000508"},
    {"code": "GA", "en": "Gabon",            "rec": "ECCAS",  "adminId": "10000000-0000-4000-a000-000000000509", "stewardId": "12000000-0000-4000-a000-000000000509"},
    {"code": "RW", "en": "Rwanda",           "rec": "ECCAS",  "adminId": "10000000-0000-4000-a000-00000000050a", "stewardId": "12000000-0000-4000-a000-00000000050a"},
    {"code": "ST", "en": "Sao Tome",         "rec": "ECCAS",  "adminId": "10000000-0000-4000-a000-00000000050b", "stewardId": "12000000-0000-4000-a000-00000000050b"},
    # UMA (5)
    {"code": "DZ", "en": "Algeria",          "rec": "UMA",    "adminId": "10000000-0000-4000-a000-000000000601", "stewardId": "12000000-0000-4000-a000-000000000601"},
    {"code": "LY", "en": "Libya",            "rec": "UMA",    "adminId": "10000000-0000-4000-a000-000000000602", "stewardId": "12000000-0000-4000-a000-000000000602"},
    {"code": "MR", "en": "Mauritania",       "rec": "UMA",    "adminId": "10000000-0000-4000-a000-000000000603", "stewardId": "12000000-0000-4000-a000-000000000603"},
    {"code": "MA", "en": "Morocco",          "rec": "UMA",    "adminId": "10000000-0000-4000-a000-000000000604", "stewardId": "12000000-0000-4000-a000-000000000604"},
    {"code": "TN", "en": "Tunisia",          "rec": "UMA",    "adminId": "10000000-0000-4000-a000-000000000605", "stewardId": "12000000-0000-4000-a000-000000000605"},
    # COMESA (1)
    {"code": "EG", "en": "Egypt",            "rec": "COMESA", "adminId": "10000000-0000-4000-a000-000000000801", "stewardId": "12000000-0000-4000-a000-000000000801"},
]


def create_chain(token, tenant_id, payload):
    """Create a single validation chain via the workflow API."""
    payload_json = json.dumps(payload).replace("'", "'\\''")
    code, out, err = ssh(VM_APP, f"""curl -s -X POST 'http://localhost:3012/api/v1/workflow/validation-chains' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}' -H 'Content-Type: application/json' -d '{payload_json}'""", timeout=10)
    try:
        resp = json.loads(out)
        if resp.get("data", {}).get("id"):
            return "OK", resp["data"]["id"][:8]
        else:
            msg = resp.get("message", out[:150])
            return "ERROR", msg
    except:
        return "ERROR", out[:150]


safe_print("=" * 60)
safe_print("  ARIS 4.0 — Seed Validation Chains")
safe_print("=" * 60)

# ── Login ──
safe_print("\n=== 1. Logging in ===")
login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'"""
code, out, err = ssh(VM_APP, login_cmd, timeout=10)

login_data = json.loads(out)
token = login_data["data"]["accessToken"]
tenant_id = login_data["data"]["user"]["tenantId"]
safe_print(f"  Logged in (tenant: {tenant_id})")

# ── Check existing chains ──
safe_print("\n=== 2. Checking existing validation chains ===")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/validation-chains?limit=1' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=10)

existing_total = 0
try:
    resp = json.loads(out)
    existing_total = resp.get("meta", {}).get("total", 0)
except:
    pass
safe_print(f"  Existing chains: {existing_total}")

if existing_total > 0:
    safe_print("  Chains already exist — skipping to avoid duplicates")
    safe_print("  (Delete existing chains first if you want to re-seed)")
else:
    # ── Level 1: National — DATA_STEWARD → NATIONAL_ADMIN ──
    safe_print("\n=== 3. Level 1 (national): DATA_STEWARD → NATIONAL_ADMIN ===")
    l1_ok = 0
    l1_err = 0

    for country in COUNTRIES:
        payload = {
            "userId": country["stewardId"],
            "validatorId": country["adminId"],
            "backupValidatorId": SUPER_ADMIN,
            "levelType": "national",
            "priority": 1,
        }
        status, detail = create_chain(token, tenant_id, payload)
        if status == "OK":
            l1_ok += 1
        else:
            l1_err += 1
            safe_print(f"  {country['code']} ERROR: {detail}")

    safe_print(f"  National chains: {l1_ok} OK, {l1_err} errors")

    # ── Level 2: Regional — NATIONAL_ADMIN → REC_DATA_STEWARD ──
    safe_print("\n=== 4. Level 2 (regional): NATIONAL_ADMIN → REC_DATA_STEWARD ===")
    l2_ok = 0
    l2_err = 0

    for country in COUNTRIES:
        rec = country["rec"]
        rec_steward = REC_STEWARDS.get(rec)
        rec_admin = REC_ADMINS.get(rec)
        if not rec_steward:
            safe_print(f"  {country['code']} SKIP: no REC steward for {rec}")
            continue

        payload = {
            "userId": country["adminId"],
            "validatorId": rec_steward,
            "backupValidatorId": rec_admin,
            "levelType": "regional",
            "priority": 1,
        }
        status, detail = create_chain(token, tenant_id, payload)
        if status == "OK":
            l2_ok += 1
        else:
            l2_err += 1
            safe_print(f"  {country['code']} ERROR: {detail}")

    safe_print(f"  Regional chains: {l2_ok} OK, {l2_err} errors")

    # ── Level 3: Continental — REC_DATA_STEWARD → CONTINENTAL_ADMIN ──
    safe_print("\n=== 5. Level 3 (continental): REC_DATA_STEWARD → CONTINENTAL_ADMIN ===")
    l3_ok = 0
    l3_err = 0

    for rec_name, rec_steward in REC_STEWARDS.items():
        payload = {
            "userId": rec_steward,
            "validatorId": CONTINENTAL_ADMIN,
            "backupValidatorId": SUPER_ADMIN,
            "levelType": "continental",
            "priority": 1,
        }
        status, detail = create_chain(token, tenant_id, payload)
        if status == "OK":
            l3_ok += 1
            safe_print(f"  {rec_name}: OK")
        else:
            l3_err += 1
            safe_print(f"  {rec_name} ERROR: {detail}")

    safe_print(f"  Continental chains: {l3_ok} OK, {l3_err} errors")

# ── Verification ──
safe_print("\n=== 6. Verification ===")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3012/api/v1/workflow/validation-chains?limit=200' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tenant_id}'""", timeout=15)

try:
    resp = json.loads(out)
    chains = resp.get("data", [])
    total = resp.get("meta", {}).get("total", len(chains))
    safe_print(f"  Total validation chains: {total}")

    # Count by level
    by_level = {}
    for ch in chains:
        lt = ch.get("levelType", "?")
        by_level[lt] = by_level.get(lt, 0) + 1

    for lt in sorted(by_level.keys()):
        safe_print(f"    {lt}: {by_level[lt]} chains")

    # Show a few examples
    safe_print(f"\n  Examples:")
    for ch in chains[:5]:
        user_email = ch.get("user", {}).get("email", ch.get("userId", "?")[:12])
        val_email = ch.get("validator", {}).get("email", ch.get("validatorId", "?")[:12])
        safe_print(f"    {ch.get('levelType', '?'):14s} | {user_email} → {val_email}")

except Exception as e:
    safe_print(f"  Parse error: {e}")
    safe_print(f"  Raw: {out[:500]}")

safe_print("\n" + "=" * 60)
safe_print("  Validation chains seed complete!")
safe_print("=" * 60)
