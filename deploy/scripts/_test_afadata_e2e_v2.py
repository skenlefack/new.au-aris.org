#!/usr/bin/env python3
"""
E2E Test v2: AFAData Fisheries — uses real AFADATA campaigns + their linked templates.
"""
import json, sys, time, urllib.request, ssl
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

BASE = "https://test.au-aris.org"
CTX = ssl.create_default_context()
CTX.check_hostname = False
CTX.verify_mode = ssl.CERT_NONE

MG_TENANT = "00000000-0000-4000-a000-000000000306"
AU_TENANT = "00000000-0000-4000-a000-000000000001"
SADC_TENANT = "00000000-0000-4000-a000-000000000030"

RESULTS = []

def api(method, path, data=None, token=None, tenant=None):
    url = f"{BASE}{path}"
    headers = {"Content-Type": "application/json"}
    if token: headers["Authorization"] = f"Bearer {token}"
    if tenant: headers["X-Tenant-Id"] = tenant
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, body, headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=30, context=CTX)
        text = resp.read().decode()
        return resp.status, json.loads(text) if text else {}
    except urllib.error.HTTPError as e:
        b = e.read().decode()
        try: return e.code, json.loads(b)
        except: return e.code, {"message": b[:300]}
    except Exception as e:
        return 0, {"message": str(e)}

def step(msg):
    print(f"\n{'─'*60}\n  {msg}\n{'─'*60}")

def test(name, passed, detail=""):
    RESULTS.append({"name": name, "passed": passed, "detail": detail})
    print(f"  {'✓' if passed else '✗'} {name}{' — ' + detail if detail else ''}")

# ── STEP 1: LOGIN ──
step("1. Authentication")
_, r = api("POST", "/api/v1/credential/auth/login", {"email": "admin@au-aris.org", "password": "Aris2026@@4!0"})
admin_token = r["data"]["accessToken"]
test("Super Admin login", True)

# Create/login test users
users = {}
for email, role, tenant, label in [
    ("test.mg.fish@au-aris.org", "NATIONAL_ADMIN", MG_TENANT, "Madagascar"),
    ("test.sadc.fish@au-aris.org", "REC_ADMIN", SADC_TENANT, "SADC"),
    ("test.au.fish@au-aris.org", "CONTINENTAL_ADMIN", AU_TENANT, "AU-IBAR"),
]:
    api("POST", "/api/v1/credential/auth/register",
        {"email": email, "firstName": "Test", "lastName": label, "role": role,
         "tenantId": tenant, "password": "Test2026@@Fish!"}, admin_token, tenant)
    c, r = api("POST", "/api/v1/credential/auth/login", {"email": email, "password": "Test2026@@Fish!"})
    if c != 200:
        c, r = api("POST", "/api/v1/credential/auth/login", {"email": email, "password": "Aris2026@@4!0"})
    if c == 200:
        users[role] = {"token": r["data"]["accessToken"], "tenant": tenant}
        test(f"Login {label} ({role})", True)
    else:
        test(f"Login {label} ({role})", False, f"HTTP {c}")

# ── STEP 2: SPECIES CHECK ──
step("2. Species reference data")
c, r = api("GET", "/api/v1/master-data/species?limit=5&category=AQUATIC", token=admin_token, tenant=AU_TENANT)
total_sp = r.get("meta", {}).get("total", 0) if c == 200 else 0
test("Aquatic species available", total_sp > 13000, f"{total_sp} species")

# ── STEP 3: REFERENTIALS CHECK ──
step("3. Fishery referentials")
for cat in ["FISHERY_TYPE","FISHING_ENVIRONMENT","FISHING_SYSTEM","EFFORT_TYPE","OPERATIONAL_SIZE",
            "PRODUCTION_NODE","FARM_TYPE","PRODUCT_STATE","GEAR_TYPE","VESSEL_TYPE","TRADE_TYPE"]:
    c, r = api("GET", f"/api/v1/master-data/fishery-referentials?category={cat}", token=admin_token, tenant=AU_TENANT)
    n = len(r.get("data", [])) if c == 200 else 0
    test(f"{cat}", n > 0, f"{n} items")

# ── STEP 4: GET AFADATA CAMPAIGNS + TEMPLATES ──
step("4. AFADATA campaigns & submissions")

# Map: campaign_name -> {campaign_id, template_id}
AFADATA_CAMPAIGNS = {
    "AFADATA - Capture Fisheries":      {"cid": "5f2c8bfe-9fe1-4949-e415-eadde4310f01", "tid": "b3c54357-65bd-42e1-8e8d-47c29c34cd39"},
    "AFADATA - Fishing Vessels":        {"cid": "5e8d2c32-2d37-ef4f-2705-fd1c8530b5f8", "tid": "6c764800-66cd-4012-9b21-6f3071fc4de1"},
    "AFADATA - Aquaculture Farms":      {"cid": "5f4c4da2-909a-1966-fd14-1176c5754118", "tid": "fb89abc3-4a73-4d05-8968-47084f8e646d"},
    "AFADATA - Aquaculture Production": {"cid": "e2059f9d-a8a2-ab22-0835-e3f556db345e", "tid": "fa9c5e5d-f166-4ba0-9815-5027e1e149bf"},
    "AFADATA - Fishing Effort":         {"cid": "0244ddf6-945e-5e56-294e-37981d6d9acb", "tid": "5dbcb31a-3c4b-478c-bbe7-ca81e3ff9f94"},
    "AFADATA - Fish Trade":             {"cid": "596b57b9-361b-d1b3-832d-474b400ff7d4", "tid": "3d434ed8-8032-4294-a8bc-557ecc23798a"},
}

# Get template schemas
tmpl_schemas = {}
for name, info in AFADATA_CAMPAIGNS.items():
    c, r = api("GET", f"/api/v1/form-builder/templates/{info['tid']}", token=admin_token, tenant=AU_TENANT)
    if c == 200:
        tmpl_schemas[name] = r.get("data", {}).get("schema", r.get("schema", {}))
        test(f"Template: {name}", True)
    else:
        test(f"Template: {name}", False, f"HTTP {c}")

def build_data(schema):
    """Build test submission data from template schema field codes."""
    data = {}
    for section in schema.get("sections", []):
        for field in section.get("fields", []):
            code = field.get("code", "")
            ftype = field.get("type", "")
            opts = field.get("options", [])
            if not code: continue
            if ftype == "admin-location":
                data[code] = {"level0": "MG"}
            elif ftype == "geo-selector":
                continue
            elif ftype == "master-data-select":
                data[code] = "TLN"
            elif ftype == "select" and opts:
                v = opts[0].get("value", "") if isinstance(opts[0], dict) else str(opts[0])
                data[code] = v
            elif ftype == "number":
                data[code] = 150
            elif ftype == "date":
                data[code] = "2026-06-15"
            elif ftype == "textarea":
                data[code] = "E2E Madagascar fisheries test"
            elif ftype == "text":
                data[code] = f"MG-Test-{code}"
            else:
                data[code] = f"test-{code}"
    return data

# ── STEP 5: SUBMIT ON EACH AFADATA CAMPAIGN ──
step("5. Submit data on each AFADATA campaign")

submission_ids = []
nat_token = users.get("NATIONAL_ADMIN", {}).get("token", admin_token)

for name, info in AFADATA_CAMPAIGNS.items():
    if name not in tmpl_schemas:
        test(f"Submit: {name}", False, "no schema")
        continue

    data = build_data(tmpl_schemas[name])
    payload = {
        "formTemplateId": info["tid"],
        "campaignId": info["cid"],
        "data": data,
        "status": "SUBMITTED",
    }

    c, r = api("POST", "/api/v1/collecte/submissions", payload, nat_token, MG_TENANT)
    if c in (200, 201):
        sid = r.get("data", {}).get("id", "")
        submission_ids.append({"id": sid, "name": name})
        test(f"Submit: {name}", True, f"id={sid[:8]}...")
    else:
        test(f"Submit: {name}", False, f"HTTP {c}: {r.get('message','')[:80]}")

# ── STEP 6: VERIFY SUBMISSIONS ──
step("6. Verify submissions exist")
c, r = api("GET", "/api/v1/collecte/submissions?limit=50", token=nat_token, tenant=MG_TENANT)
total_subs = r.get("meta", {}).get("total", len(r.get("data", []))) if c == 200 else 0
test("Total submissions accessible", total_subs > 0, f"{total_subs} submissions")

# ── STEP 7: VALIDATION WORKFLOW (L1 National → L2 REC → L3 Continental) ──
step("7. Validation workflow")

for sub in submission_ids[:3]:
    sid = sub["id"]
    sname = sub["name"]

    # Start workflow for this submission
    c0, r0 = api("POST", f"/api/v1/workflow/submissions/{sid}/start", {}, nat_token, MG_TENANT)
    wf_id = r0.get("data", {}).get("id", "") if c0 in (200, 201) else ""
    test(f"Start workflow: {sname}", c0 in (200, 201), f"HTTP {c0}" + (f" wf={wf_id[:8]}" if wf_id else ""))

    if not wf_id:
        continue

    # L1: National Data Steward validates
    c1, r1 = api("POST", f"/api/v1/workflow/instances/{wf_id}/validate",
                  {"action": "APPROVE", "comment": "L1 validated by Madagascar"},
                  nat_token, MG_TENANT)
    test(f"L1 Validate: {sname}", c1 in (200, 201), f"HTTP {c1}")

    # L2: REC validates
    rec_token = users.get("REC_ADMIN", {}).get("token", admin_token)
    c2, r2 = api("POST", f"/api/v1/workflow/instances/{wf_id}/validate",
                  {"action": "APPROVE", "comment": "L2 validated by SADC"},
                  rec_token, SADC_TENANT)
    test(f"L2 Validate: {sname}", c2 in (200, 201), f"HTTP {c2}")

    # L3: Continental validates
    au_token = users.get("CONTINENTAL_ADMIN", {}).get("token", admin_token)
    c3, r3 = api("POST", f"/api/v1/workflow/instances/{wf_id}/validate",
                  {"action": "APPROVE", "comment": "L3 validated by AU-IBAR"},
                  au_token, AU_TENANT)
    test(f"L3 Validate: {sname}", c3 in (200, 201), f"HTTP {c3}")

# ── STEP 8: MULTI-USER ACCESS ──
step("8. Multi-user access verification")

for role, info in users.items():
    c, r = api("GET", "/api/v1/workflow/campaigns?domain=fisheries&limit=5",
               token=info["token"], tenant=info["tenant"])
    n = len(r.get("data", [])) if c == 200 else 0
    test(f"{role} sees fisheries campaigns", n > 0, f"{n} campaigns")

# ══════════════════════════════════════════════════════════
# REPORT
# ══════════════════════════════════════════════════════════
step("TEST REPORT")

passed = sum(1 for r in RESULTS if r["passed"])
failed = sum(1 for r in RESULTS if not r["passed"])
total = len(RESULTS)

print(f"\n  Total:   {total} tests")
print(f"  Passed:  {passed}")
print(f"  Failed:  {failed}")
print(f"  Rate:    {passed/total*100:.0f}%")

if failed > 0:
    print(f"\n  Failed tests:")
    for r in RESULTS:
        if not r["passed"]:
            print(f"    ✗ {r['name']} — {r['detail']}")

print(f"\n{'='*60}")
print(f"  AFAData Fisheries E2E — {'ALL PASSED' if failed == 0 else f'{failed} FAILED'}")
print(f"{'='*60}")
