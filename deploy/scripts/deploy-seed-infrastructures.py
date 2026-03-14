#!/usr/bin/env python3
"""
ARIS 4.0 — Seed 45 infrastructure types via master-data REST API.
Uses the same pattern as deploy-seed-workflow.py / deploy-seed-validation-chains.py.
"""
import sys
import os
import json
import time
import tempfile

from ssh_config import get_client, ssh, VM_APP


def safe_print(text):
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode("ascii", errors="replace").decode())
    sys.stdout.flush()


# ── 45 Infrastructure Types (15 categories × 3 sub-types) ──
INFRASTRUCTURES = [
    # 1. Laboratory
    {"code": "INFRA-LAB-VET",       "name": {"en": "Veterinary Laboratory",           "fr": "Laboratoire vétérinaire"},              "category": "laboratory",         "subType": "veterinary",            "sortOrder": 100},
    {"code": "INFRA-LAB-RES",       "name": {"en": "Research Laboratory",             "fr": "Laboratoire de recherche"},             "category": "laboratory",         "subType": "research",              "sortOrder": 101},
    {"code": "INFRA-LAB-DIAG",      "name": {"en": "Diagnostic Laboratory",           "fr": "Laboratoire de diagnostic"},            "category": "laboratory",         "subType": "diagnostic",            "sortOrder": 102},
    # 2. Slaughterhouse
    {"code": "INFRA-ABAT-IND",      "name": {"en": "Industrial Slaughterhouse",       "fr": "Abattoir industriel"},                  "category": "slaughterhouse",     "subType": "industrial",            "sortOrder": 200},
    {"code": "INFRA-ABAT-MUN",      "name": {"en": "Municipal Slaughterhouse",        "fr": "Abattoir municipal"},                   "category": "slaughterhouse",     "subType": "municipal",             "sortOrder": 201},
    {"code": "INFRA-ABAT-AREA",     "name": {"en": "Slaughter Area",                  "fr": "Aire d'abattage"},                      "category": "slaughterhouse",     "subType": "slaughter_area",        "sortOrder": 202},
    # 3. Market
    {"code": "INFRA-MKT-LIVE",      "name": {"en": "Livestock Market",                "fr": "Marché à bétail"},                      "category": "market",             "subType": "livestock",             "sortOrder": 300},
    {"code": "INFRA-MKT-FISH",      "name": {"en": "Fish Market",                     "fr": "Marché de poisson"},                    "category": "market",             "subType": "fish",                  "sortOrder": 301},
    {"code": "INFRA-MKT-TERM",      "name": {"en": "Terminal Market",                 "fr": "Marché terminal"},                      "category": "market",             "subType": "terminal",              "sortOrder": 302},
    # 4. Storage
    {"code": "INFRA-STOR-COLD",     "name": {"en": "Cold Storage",                    "fr": "Entrepôt frigorifique"},                "category": "storage",            "subType": "cold_storage",          "sortOrder": 400},
    {"code": "INFRA-STOR-WARE",     "name": {"en": "Warehouse",                       "fr": "Entrepôt de stockage"},                 "category": "storage",            "subType": "warehouse",             "sortOrder": 401},
    {"code": "INFRA-STOR-ROOM",     "name": {"en": "Cold Room",                       "fr": "Chambre froide"},                       "category": "storage",            "subType": "cold_room",             "sortOrder": 402},
    # 5. Checkpoint / Control Post
    {"code": "INFRA-CHK-BORDER",    "name": {"en": "Border Inspection Post",          "fr": "Poste d'inspection frontalier"},         "category": "checkpoint",         "subType": "border_inspection",     "sortOrder": 500},
    {"code": "INFRA-CHK-QUAR",      "name": {"en": "Quarantine Station",              "fr": "Poste de quarantaine"},                 "category": "checkpoint",         "subType": "quarantine",            "sortOrder": 501},
    {"code": "INFRA-CHK-VET",       "name": {"en": "Veterinary Control Post",         "fr": "Poste de contrôle vétérinaire"},        "category": "checkpoint",         "subType": "veterinary_control",    "sortOrder": 502},
    # 6. Port / Airport
    {"code": "INFRA-PORT-SEA",      "name": {"en": "Seaport",                         "fr": "Port maritime"},                        "category": "port_airport",       "subType": "seaport",               "sortOrder": 600},
    {"code": "INFRA-PORT-FISH",     "name": {"en": "Fishing Port",                    "fr": "Port de pêche"},                        "category": "port_airport",       "subType": "fishing_port",          "sortOrder": 601},
    {"code": "INFRA-PORT-AIR",      "name": {"en": "Airport",                         "fr": "Aéroport"},                             "category": "port_airport",       "subType": "airport",               "sortOrder": 602},
    # 7. Training / Education Center
    {"code": "INFRA-TRAIN-AGR",     "name": {"en": "Agricultural Training Center",    "fr": "Centre de formation agricole"},         "category": "training_center",    "subType": "agricultural_training", "sortOrder": 700},
    {"code": "INFRA-TRAIN-VET",     "name": {"en": "Veterinary School",               "fr": "École vétérinaire"},                    "category": "training_center",    "subType": "veterinary_school",     "sortOrder": 701},
    {"code": "INFRA-TRAIN-RES",     "name": {"en": "Research Center",                 "fr": "Centre de recherche"},                  "category": "training_center",    "subType": "research_center",       "sortOrder": 702},
    # 8. Breeding / Livestock Station
    {"code": "INFRA-BREED-SEED",    "name": {"en": "Seed Farm",                       "fr": "Ferme semencière"},                     "category": "breeding_station",   "subType": "seed_farm",             "sortOrder": 800},
    {"code": "INFRA-BREED-STAT",    "name": {"en": "Breeding Station",                "fr": "Station d'élevage"},                    "category": "breeding_station",   "subType": "breeding_station",      "sortOrder": 801},
    {"code": "INFRA-BREED-RANCH",   "name": {"en": "Ranch",                           "fr": "Ranch"},                                "category": "breeding_station",   "subType": "ranch",                 "sortOrder": 802},
    # 9. Collection / Packaging Center
    {"code": "INFRA-COLL-MILK",     "name": {"en": "Milk Collection Center",          "fr": "Centre de collecte de lait"},           "category": "collection_center",  "subType": "milk_collection",       "sortOrder": 900},
    {"code": "INFRA-COLL-HONEY",    "name": {"en": "Honey Collection Center",         "fr": "Centre de collecte de miel"},           "category": "collection_center",  "subType": "honey_collection",      "sortOrder": 901},
    {"code": "INFRA-COLL-PACK",     "name": {"en": "Packaging Center",                "fr": "Centre de conditionnement"},            "category": "collection_center",  "subType": "packaging",             "sortOrder": 902},
    # 10. Park / Reserve
    {"code": "INFRA-PARK-NAT",      "name": {"en": "National Park",                   "fr": "Parc national"},                        "category": "protected_area",     "subType": "national_park",         "sortOrder": 1000},
    {"code": "INFRA-PARK-RES",      "name": {"en": "Nature Reserve",                  "fr": "Réserve naturelle"},                    "category": "protected_area",     "subType": "nature_reserve",        "sortOrder": 1001},
    {"code": "INFRA-PARK-CONS",     "name": {"en": "Conservation Area",               "fr": "Zone de conservation"},                 "category": "protected_area",     "subType": "conservation_area",     "sortOrder": 1002},
    # 11. Processing Industry
    {"code": "INFRA-IND-TAN",       "name": {"en": "Tannery",                         "fr": "Tannerie"},                             "category": "industry",           "subType": "tannery",               "sortOrder": 1100},
    {"code": "INFRA-IND-DAIRY",     "name": {"en": "Dairy",                           "fr": "Laiterie"},                             "category": "industry",           "subType": "dairy",                 "sortOrder": 1101},
    {"code": "INFRA-IND-PROC",      "name": {"en": "Processing Plant",                "fr": "Usine de transformation"},              "category": "industry",           "subType": "processing_plant",      "sortOrder": 1102},
    # 12. Water Infrastructure
    {"code": "INFRA-WATER-POINT",   "name": {"en": "Water Point",                     "fr": "Point d'eau"},                          "category": "water_infrastructure", "subType": "water_point",         "sortOrder": 1200},
    {"code": "INFRA-WATER-DAM",     "name": {"en": "Pastoral Dam",                    "fr": "Barrage pastoral"},                     "category": "water_infrastructure", "subType": "pastoral_dam",        "sortOrder": 1201},
    {"code": "INFRA-WATER-BORE",    "name": {"en": "Borehole",                        "fr": "Forage"},                               "category": "water_infrastructure", "subType": "borehole",            "sortOrder": 1202},
    # 13. Veterinary Center
    {"code": "INFRA-VETC-CLIN",     "name": {"en": "Veterinary Clinic",               "fr": "Clinique vétérinaire"},                 "category": "veterinary_center",  "subType": "veterinary_clinic",     "sortOrder": 1300},
    {"code": "INFRA-VETC-PHARM",    "name": {"en": "Veterinary Pharmacy",             "fr": "Pharmacie vétérinaire"},                "category": "veterinary_center",  "subType": "veterinary_pharmacy",   "sortOrder": 1301},
    {"code": "INFRA-VETC-POST",     "name": {"en": "Veterinary Post",                 "fr": "Poste vétérinaire"},                    "category": "veterinary_center",  "subType": "veterinary_post",       "sortOrder": 1302},
    # 14. Administrative Office
    {"code": "INFRA-ADM-DIR",       "name": {"en": "Veterinary Directorate",          "fr": "Direction des services vétérinaires"},  "category": "admin_office",       "subType": "veterinary_directorate","sortOrder": 1400},
    {"code": "INFRA-ADM-REG",       "name": {"en": "Regional Office",                 "fr": "Bureau régional"},                      "category": "admin_office",       "subType": "regional_office",       "sortOrder": 1401},
    {"code": "INFRA-ADM-DIST",      "name": {"en": "District Office",                 "fr": "Bureau de district"},                   "category": "admin_office",       "subType": "district_office",       "sortOrder": 1402},
    # 15. Other
    {"code": "INFRA-OTH-HATCH",     "name": {"en": "Hatchery",                        "fr": "Couvoir"},                              "category": "other",              "subType": "hatchery",              "sortOrder": 1500},
    {"code": "INFRA-OTH-APIARY",    "name": {"en": "Teaching Apiary",                 "fr": "Rucher école"},                         "category": "other",              "subType": "teaching_apiary",       "sortOrder": 1501},
    {"code": "INFRA-OTH-FREEZONE",  "name": {"en": "Free Zone",                       "fr": "Zone franche"},                         "category": "other",              "subType": "free_zone",             "sortOrder": 1502},
]


safe_print("=" * 60)
safe_print("  ARIS 4.0 — Seed Infrastructure Types (45)")
safe_print("=" * 60)

# ── 1. Check master-data service health ──
safe_print("\n=== 1. Checking master-data service ===")
code, out, err = ssh(VM_APP, "docker ps --filter name=aris-master-data --format '{{.Status}}'", timeout=10)
safe_print(f"  Container: {out if out else 'NOT RUNNING'}")

code, out, err = ssh(VM_APP, "curl -s http://localhost:3003/health", timeout=10)
safe_print(f"  Health: {out[:200] if out else 'NO RESPONSE'}")

# ── 2. Login as super admin ──
safe_print("\n=== 2. Login as super admin ===")
login_cmd = """curl -s -X POST http://localhost:3002/api/v1/credential/auth/login -H 'Content-Type: application/json' -d '{"email":"admin@au-aris.org","password":"Aris2024!"}'"""
code, out, err = ssh(VM_APP, login_cmd, timeout=10)

try:
    login_data = json.loads(out)
    token = login_data["data"]["accessToken"]
    tid = login_data["data"]["user"]["tenantId"]
    safe_print(f"  OK (tenant: {tid})")
except Exception as e:
    safe_print(f"  FAILED: {e}")
    safe_print(f"  Raw: {out[:500]}")
    sys.exit(1)

# ── 3. Check existing data ──
safe_print("\n=== 3. Check existing infrastructure types ===")
code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3003/api/v1/master-data/ref/infrastructures?limit=1' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=10)

try:
    resp = json.loads(out)
    existing_total = resp.get("meta", {}).get("total", 0)
    safe_print(f"  Existing: {existing_total}")
    if existing_total >= 45:
        safe_print("  Already seeded! Skipping.")
        sys.exit(0)
except Exception as e:
    safe_print(f"  Check failed: {e}")
    safe_print(f"  Raw: {out[:500]}")

# ── 4. Upload payload file and seed via file-based curl ──
safe_print(f"\n=== 4. Seeding {len(INFRASTRUCTURES)} infrastructure types ===")

# Upload all payloads as a single JSON array, then seed via a shell loop
all_payloads = []
for infra in INFRASTRUCTURES:
    all_payloads.append({
        "code": infra["code"],
        "name": infra["name"],
        "category": infra["category"],
        "subType": infra["subType"],
        "status": "operational",
        "scope": "continental",
        "ownerType": "continental",
        "isActive": True,
        "isDefault": False,
        "sortOrder": infra["sortOrder"],
    })

# Upload as SFTP file
local_tmp = os.path.join(tempfile.gettempdir(), "aris-infra-seed.json")
with open(local_tmp, "w", encoding="utf-8") as f:
    json.dump(all_payloads, f, ensure_ascii=False)

c = get_client(VM_APP)
sftp = c.open_sftp()
sftp.put(local_tmp, "/tmp/aris-infra-seed.json", confirm=False)
sftp.close()
c.close()
safe_print("  Uploaded payload file to server")

# Run a Python one-liner on the server to seed each item
seed_script = r'''
import json, urllib.request, sys
payloads = json.load(open("/tmp/aris-infra-seed.json"))
TOKEN = sys.argv[1]
TID = sys.argv[2]
created = errors = skipped = 0
for i, p in enumerate(payloads):
    body = json.dumps(p).encode("utf-8")
    req = urllib.request.Request(
        "http://localhost:3003/api/v1/master-data/ref/infrastructures",
        data=body,
        headers={"Authorization": f"Bearer {TOKEN}", "X-Tenant-Id": TID, "Content-Type": "application/json"},
        method="POST",
    )
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read().decode())
        if data.get("data", {}).get("id"):
            created += 1
        else:
            skipped += 1
    except urllib.error.HTTPError as e:
        err_body = e.read().decode()
        if "unique" in err_body.lower() or "duplicate" in err_body.lower():
            skipped += 1
        else:
            errors += 1
            print(f"ERR {p['code']}: {err_body[:200]}")
    except Exception as e:
        errors += 1
        print(f"ERR {p['code']}: {e}")
    if (i + 1) % 10 == 0 or i == 0:
        print(f"[{i+1}/{len(payloads)}] created={created} skipped={skipped} errors={errors}")
print(f"DONE: created={created} skipped={skipped} errors={errors}")
'''

# Upload seed script
with open(os.path.join(tempfile.gettempdir(), "aris-infra-runner.py"), "w") as f:
    f.write(seed_script)

c = get_client(VM_APP)
sftp = c.open_sftp()
sftp.put(os.path.join(tempfile.gettempdir(), "aris-infra-runner.py"), "/tmp/aris-infra-runner.py", confirm=False)
sftp.close()
c.close()
safe_print("  Uploaded seed runner script")

# Execute in background on server, then poll for completion
code, out, err = ssh(VM_APP, f'nohup python3 /tmp/aris-infra-runner.py "{token}" "{tid}" > /tmp/aris-infra-seed.log 2>&1 &', timeout=10)
safe_print("  Script launched in background...")

# Poll for completion (check log file)
for attempt in range(30):  # max 5 min (30 * 10s)
    time.sleep(10)
    code, out, err = ssh(VM_APP, "cat /tmp/aris-infra-seed.log 2>/dev/null", timeout=10)
    if "DONE:" in out:
        for line in out.splitlines():
            safe_print(f"  {line}")
        break
    # Show progress
    lines = [l for l in out.splitlines() if l.strip()]
    if lines:
        safe_print(f"  [{attempt+1}] {lines[-1]}")
else:
    safe_print("  Timeout waiting for completion — check /tmp/aris-infra-seed.log on server")

# ── 5. Verify ──
safe_print("\n=== 5. Verification ===")

# Re-login in case token expired
code, out, err = ssh(VM_APP, login_cmd, timeout=10)
try:
    login_data = json.loads(out)
    token = login_data["data"]["accessToken"]
except:
    pass

code, out, err = ssh(VM_APP, f"""curl -s 'http://localhost:3003/api/v1/master-data/ref/infrastructures?limit=100' -H 'Authorization: Bearer {token}' -H 'X-Tenant-Id: {tid}'""", timeout=15)

try:
    resp = json.loads(out)
    items = resp.get("data", [])
    total = resp.get("meta", {}).get("total", 0)
    safe_print(f"  Total in DB: {total}")

    # Group by category
    by_cat = {}
    for item in items:
        cat = item.get("category", "?")
        by_cat[cat] = by_cat.get(cat, 0) + 1

    safe_print(f"  Categories ({len(by_cat)}):")
    for cat in sorted(by_cat.keys()):
        safe_print(f"    {cat}: {by_cat[cat]}")
except Exception as e:
    safe_print(f"  Error: {e}")
    safe_print(f"  Raw: {out[:500]}")

safe_print("\n" + "=" * 60)
safe_print("  Infrastructure seed complete!")
safe_print("=" * 60)
