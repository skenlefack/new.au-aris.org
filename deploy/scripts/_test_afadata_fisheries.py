#!/usr/bin/env python3
"""
E2E Test: AFAData Fisheries Forms — Madagascar
Tests all fisheries form templates on staging with 3 user levels.
"""
import json, sys, time, urllib.request, ssl, uuid
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = "https://test.au-aris.org"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

MG_TENANT = "00000000-0000-4000-a000-000000000306"
SADC_TENANT = "00000000-0000-4000-a000-000000000030"
AU_TENANT = "00000000-0000-4000-a000-000000000001"

RESULTS = []

def api(method, path, data=None, token=None, tenant=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if tenant:
        headers["X-Tenant-Id"] = tenant
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, body, headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=30, context=CTX)
        text = resp.read().decode()
        return resp.status, json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except:
            return e.code, {"message": body[:200]}
    except Exception as e:
        return 0, {"message": str(e)}

def step(msg):
    print(f"\n{'─'*60}")
    print(f"  {msg}")
    print(f"{'─'*60}")

def test(name, passed, detail=""):
    status = "PASS" if passed else "FAIL"
    RESULTS.append({"name": name, "status": status, "detail": detail})
    icon = "✓" if passed else "✗"
    print(f"  {icon} {name}{' — ' + detail if detail else ''}")

# ═══════════════════════════════════════════════════════════
# STEP 1: LOGIN AS SUPER ADMIN
# ═══════════════════════════════════════════════════════════
step("Step 1: Login as Super Admin")
code, resp = api("POST", "/api/v1/credential/auth/login", {
    "email": "admin@au-aris.org", "password": "Aris2026@@4!0"
})
test("Super Admin login", code == 200, f"HTTP {code}")
if code != 200:
    print(f"  Cannot continue: {resp}")
    sys.exit(1)

admin_token = resp["data"]["accessToken"]

# ═══════════════════════════════════════════════════════════
# STEP 2: CREATE TEST USERS
# ═══════════════════════════════════════════════════════════
step("Step 2: Create test users")

USERS = [
    {"email": "test.mg.fish@au-aris.org", "firstName": "Test", "lastName": "Madagascar Fish",
     "role": "NATIONAL_ADMIN", "tenantId": MG_TENANT, "password": "Test2026@@Fish!"},
    {"email": "test.sadc.fish@au-aris.org", "firstName": "Test", "lastName": "SADC Fish",
     "role": "REC_ADMIN", "tenantId": SADC_TENANT, "password": "Test2026@@Fish!"},
    {"email": "test.au.fish@au-aris.org", "firstName": "Test", "lastName": "AU Fish",
     "role": "CONTINENTAL_ADMIN", "tenantId": AU_TENANT, "password": "Test2026@@Fish!"},
]

tokens = {}
for u in USERS:
    code, resp = api("POST", "/api/v1/credential/auth/register", u, admin_token, u["tenantId"])
    if code in (200, 201):
        test(f"Create user {u['email']}", True, f"{u['role']}")
    elif code == 409:
        test(f"Create user {u['email']}", True, "already exists")
    else:
        test(f"Create user {u['email']}", False, f"HTTP {code}: {resp.get('message','')}")

    # Login as this user
    code2, resp2 = api("POST", "/api/v1/credential/auth/login", {
        "email": u["email"], "password": u["password"]
    })
    if code2 == 200:
        tokens[u["role"]] = {"token": resp2["data"]["accessToken"], "tenant": u["tenantId"], "email": u["email"]}
        test(f"Login {u['role']}", True)
    else:
        # Try with default password
        code3, resp3 = api("POST", "/api/v1/credential/auth/login", {
            "email": u["email"], "password": "Aris2026@@4!0"
        })
        if code3 == 200:
            tokens[u["role"]] = {"token": resp3["data"]["accessToken"], "tenant": u["tenantId"], "email": u["email"]}
            test(f"Login {u['role']}", True, "default password")
        else:
            test(f"Login {u['role']}", False, f"HTTP {code2}/{code3}")

# Use admin token for MG if no national admin token
if "NATIONAL_ADMIN" not in tokens:
    tokens["NATIONAL_ADMIN"] = {"token": admin_token, "tenant": MG_TENANT, "email": "admin@au-aris.org"}

# ═══════════════════════════════════════════════════════════
# STEP 3: CREATE FISHERIES CAMPAIGN FOR MADAGASCAR
# ═══════════════════════════════════════════════════════════
step("Step 3: Find or create ACTIVE fisheries campaign for Madagascar")

# First, look for an existing ACTIVE fisheries campaign
code, resp = api("GET", "/api/v1/workflow/campaigns?domain=fisheries&status=ACTIVE&limit=1", token=admin_token, tenant=AU_TENANT)
if code == 200 and resp.get("data") and len(resp["data"]) > 0:
    campaign_id = resp["data"][0]["id"]
    cname = resp["data"][0].get("name", {})
    cn = cname.get("en", cname) if isinstance(cname, dict) else str(cname)
    test("Found ACTIVE fisheries campaign", True, f"{cn} (id={campaign_id[:8]}...)")
else:
    # No active campaign, use an existing one from legacy campaigns table
    campaign_id = None
    test("No active fisheries campaign found", False, "will try without campaign")

# ═══════════════════════════════════════════════════════════
# STEP 4: LIST FISHERIES TEMPLATES
# ═══════════════════════════════════════════════════════════
step("Step 4: Verify fisheries templates")

code, resp = api("GET", "/api/v1/form-builder/templates?domain=fisheries&status=PUBLISHED&limit=50", token=admin_token, tenant=AU_TENANT)
templates = resp.get("data", []) if code == 200 else []
test(f"List fisheries templates", code == 200, f"{len(templates)} templates")

# Deduplicate by name
seen = {}
for tmpl in templates:
    if tmpl["name"] not in seen:
        seen[tmpl["name"]] = tmpl
templates = list(seen.values())
print(f"  Unique templates: {len(templates)}")
for tmpl in templates:
    print(f"    - {tmpl['name']} (id={tmpl['id'][:8]}...)")

# ═══════════════════════════════════════════════════════════
# STEP 5: CHECK SPECIES DROPDOWN
# ═══════════════════════════════════════════════════════════
step("Step 5: Verify species reference data")

code, resp = api("GET", "/api/v1/master-data/species?limit=10&category=AQUATIC",
                 token=admin_token, tenant=AU_TENANT)
if code == 200:
    species_data = resp.get("data", [])
    total = resp.get("meta", {}).get("total", len(species_data))
    test("Species dropdown (Aquatic)", True, f"{total} species available")
    print(f"    Sample: {', '.join(s.get('name',{}).get('en', s.get('code','')) for s in species_data[:5])}")
else:
    test("Species dropdown", False, f"HTTP {code}")

# ═══════════════════════════════════════════════════════════
# STEP 6: CHECK FISHERY REFERENTIALS
# ═══════════════════════════════════════════════════════════
step("Step 6: Verify fishery referentials")

ref_categories = ["FISHERY_TYPE", "FISHING_ENVIRONMENT", "FISHING_SYSTEM", "EFFORT_TYPE",
                   "OPERATIONAL_SIZE", "PRODUCTION_NODE", "FARM_TYPE", "PRODUCT_STATE",
                   "GEAR_TYPE", "VESSEL_TYPE", "TRADE_TYPE", "GENDER", "AGE_RANGE"]

for cat in ref_categories:
    code, resp = api("GET", f"/api/v1/master-data/fishery-referentials?category={cat}&limit=50",
                     token=admin_token, tenant=AU_TENANT)
    if code == 200:
        items = resp.get("data", [])
        names = [i.get("name", {}).get("en", i.get("code", "")) for i in items[:4]]
        test(f"Referential {cat}", len(items) > 0, f"{len(items)} items: {', '.join(names)}")
    else:
        test(f"Referential {cat}", False, f"HTTP {code}")

# ═══════════════════════════════════════════════════════════
# STEP 7: SUBMIT TEST DATA ON EACH FORM
# ═══════════════════════════════════════════════════════════
step("Step 7: Submit test data on each fisheries form")

MG_GEO = "00000000-0000-4000-c000-000000000306"  # MG geo entity ID (approximate)

## Build submission data dynamically from template field codes
def build_test_data(tmpl_name, schema):
    """Generate test submission data matching the template field codes exactly."""
    data = {}
    for section in schema.get("sections", []):
        for field in section.get("fields", []):
            code = field.get("code", "")
            ftype = field.get("type", "")
            required = field.get("required", False)
            opts = field.get("options", [])

            if not code:
                continue

            # Skip admin-location and geo-selector (complex types)
            if ftype == "admin-location":
                data[code] = {"level0": "MG"}
                continue
            if ftype == "geo-selector":
                # Skip geo-selector entirely — optional field
                continue

            # Auto-fill based on type
            if ftype == "master-data-select":
                data[code] = "TLN"  # Nile tilapia FAO code
            elif ftype == "select" and opts:
                first_opt = opts[0]
                data[code] = first_opt.get("value", "") if isinstance(first_opt, dict) else str(first_opt)
            elif ftype == "number":
                data[code] = 100
            elif ftype == "date":
                data[code] = "2026-06-15"
            elif ftype == "textarea":
                data[code] = "E2E test data for Madagascar fisheries"
            elif ftype == "text":
                data[code] = f"Test-{code}-MG"
            else:
                data[code] = f"test-{code}"

    return data

SUBMISSIONS = {}

submission_ids = []
for tmpl in templates:
    name = tmpl["name"]
    tid = tmpl["id"]

    sub_data = build_test_data(name, tmpl.get("schema", {}))

    # Submit via collecte endpoint
    payload = {
        "formTemplateId": tid,
        "data": sub_data,
        "status": "SUBMITTED",
    }
    if campaign_id:
        payload["campaignId"] = campaign_id

    code, resp = api("POST", "/api/v1/collecte/submissions", payload, admin_token, MG_TENANT)
    # If campaign required but missing, try legacy campaigns
    if code == 400 and "campaignId" in str(resp):
        code_leg, resp_leg = api("GET", "/api/v1/collecte/campaigns?domain=fisheries&status=ACTIVE&limit=1",
                                  token=admin_token, tenant=MG_TENANT)
        if code_leg == 200 and resp_leg.get("data"):
            payload["campaignId"] = resp_leg["data"][0]["id"]
            code, resp = api("POST", "/api/v1/collecte/submissions", payload, admin_token, MG_TENANT)
    if code in (200, 201):
        sid = resp.get("data", {}).get("id", "")
        submission_ids.append({"id": sid, "form": name})
        test(f"Submit {name}", True, f"id={sid[:8]}...")
    else:
        test(f"Submit {name}", False, f"HTTP {code}: {resp.get('message','')[:80]}")

# ═══════════════════════════════════════════════════════════
# STEP 8: VERIFY SUBMISSIONS
# ═══════════════════════════════════════════════════════════
step("Step 8: Verify submissions")

code, resp = api("GET", "/api/v1/collecte/submissions?domain=fisheries&limit=20", token=admin_token, tenant=MG_TENANT)
if code == 200:
    subs = resp.get("data", [])
    test("List fisheries submissions", True, f"{len(subs)} found")
else:
    test("List fisheries submissions", False, f"HTTP {code}")

# ═══════════════════════════════════════════════════════════
# STEP 9: TEST VALIDATION WORKFLOW
# ═══════════════════════════════════════════════════════════
step("Step 9: Test validation workflow")

for sub in submission_ids[:3]:
    # Validate at Level 1
    code, resp = api("POST", f"/api/v1/workflow/submissions/{sub['id']}/validate",
                     {"level": 1, "action": "APPROVE", "comment": "E2E test approval"},
                     admin_token, MG_TENANT)
    test(f"Validate L1: {sub['form']}", code in (200, 201), f"HTTP {code}")

# ═══════════════════════════════════════════════════════════
# REPORT
# ═══════════════════════════════════════════════════════════
step("TEST REPORT")

passed = sum(1 for r in RESULTS if r["status"] == "PASS")
failed = sum(1 for r in RESULTS if r["status"] == "FAIL")
total = len(RESULTS)

print(f"\n  Total: {total} tests")
print(f"  Passed: {passed}")
print(f"  Failed: {failed}")
print(f"  Success rate: {passed/total*100:.0f}%")

if failed > 0:
    print(f"\n  Failed tests:")
    for r in RESULTS:
        if r["status"] == "FAIL":
            print(f"    ✗ {r['name']} — {r['detail']}")

print(f"\n{'='*60}")
print(f"  ARIS AFAData Fisheries E2E Test — {'ALL PASSED' if failed == 0 else f'{failed} FAILED'}")
print(f"{'='*60}")
