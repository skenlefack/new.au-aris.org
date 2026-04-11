#!/usr/bin/env python3
"""
Fix PAID campaigns on production:
  1. Delete Annual 2026 campaign (annual = automatic synthesis of quarterly)
  2. Create Q1, Q3, Q4 campaigns (Q2 already exists)
  3. All campaigns: CONTINENTAL scope only (no REC/country targets)
  4. Notifications continental level only
"""
import paramiko, json, sys, time

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HOST = "10.202.101.183"
ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, username="arisadmin", password="@u-1baR.0rg$U24",
            timeout=15, allow_agent=False, look_for_keys=False)
print("Connected.")

# Auth
_, stdout, _ = ssh.exec_command(
    'curl -sk -X POST "https://localhost/api/v1/credential/auth/login" '
    '-H "Content-Type: application/json" '
    """-d '{"email":"admin@au-aris.org","password":"Aris2026@@4!0"}' 2>/dev/null""",
    timeout=15)
TOKEN = json.loads(stdout.read().decode())["data"]["accessToken"]
print(f"Authenticated")

def api(method, path, body=None):
    data = json.dumps(body) if body else "{}"
    fname = f"/tmp/paid_fix_{int(time.time()*1000)}.json"
    sftp = ssh.open_sftp()
    with sftp.open(fname, "w") as f:
        f.write(data)
    sftp.close()
    _, stdout, _ = ssh.exec_command(
        f'curl -sk -X {method} "https://localhost{path}" '
        f'-H "Authorization: Bearer {TOKEN}" '
        f'-H "Content-Type: application/json" '
        f'{f"-d @{fname}" if body else ""} 2>/dev/null',
        timeout=30)
    resp = stdout.read().decode()
    try:
        return json.loads(resp)
    except:
        return {"error": resp[:200]}

# ── PAID template ID (created earlier) ──
TEMPLATE_ID = "6ca5e44b-a7a0-4b90-8276-9600e3bf4783"

# ── Step 1: Find and delete Annual campaign ──
print("\n1. Listing PAID campaigns...")
r = api("GET", "/api/v1/workflow/campaigns?domain=paid&limit=20")
campaigns = r.get("data", [])
if isinstance(campaigns, list):
    for c in campaigns:
        code = c.get("code", "")
        cid = c.get("id", "")
        name = c.get("name", "")
        if isinstance(name, dict):
            name = name.get("en", str(name))
        print(f"   {code}: {name} ({cid[:8]}...)")
        if "ANNUAL" in code.upper():
            print(f"   → Deleting annual campaign {cid}...")
            rd = api("DELETE", f"/api/v1/workflow/campaigns/{cid}")
            print(f"     Result: {rd.get('message', 'OK')[:50]}")
else:
    print(f"   No campaigns found or error: {r}")

# ── Step 2: Create Q1, Q3, Q4 campaigns ──
QUARTERS = [
    {
        "code": "PAID_Q1_2026",
        "name": {"en": "PAID Q1 2026 — Jan to Mar", "fr": "PAID T1 2026 — Jan à Mar"},
        "description": {"en": "PAID quarterly data collection — Q1 2026 (January to March)", "fr": "Collecte trimestrielle PAID — T1 2026 (Janvier à Mars)"},
        "startDate": "2026-01-01",
        "endDate": "2026-03-31",
    },
    {
        "code": "PAID_Q3_2026",
        "name": {"en": "PAID Q3 2026 — Jul to Sep", "fr": "PAID T3 2026 — Jul à Sep"},
        "description": {"en": "PAID quarterly data collection — Q3 2026 (July to September)", "fr": "Collecte trimestrielle PAID — T3 2026 (Juillet à Septembre)"},
        "startDate": "2026-07-01",
        "endDate": "2026-09-30",
    },
    {
        "code": "PAID_Q4_2026",
        "name": {"en": "PAID Q4 2026 — Oct to Dec", "fr": "PAID T4 2026 — Oct à Déc"},
        "description": {"en": "PAID quarterly data collection — Q4 2026 (October to December)", "fr": "Collecte trimestrielle PAID — T4 2026 (Octobre à Décembre)"},
        "startDate": "2026-10-01",
        "endDate": "2026-12-31",
    },
]

print("\n2. Creating quarterly campaigns...")
for q in QUARTERS:
    print(f"   {q['code']}...", end=" ", flush=True)
    r = api("POST", "/api/v1/workflow/campaigns", {
        "code": q["code"],
        "name": q["name"],
        "description": q["description"],
        "domain": "paid",
        "formTemplateId": TEMPLATE_ID,
        "startDate": q["startDate"],
        "endDate": q["endDate"],
        "targetCountries": [],          # Continental scope — no country targeting
        "targetSubmissions": 550,
        "targetPerAgent": 10,
        "frequency": "quarterly",
        "scope": "continental",
        "sendReminders": True,
        "reminderDaysBefore": 7,
        "status": "ACTIVE",
    })
    cid = r.get("data", {}).get("id")
    if cid:
        print(f"OK ({cid[:8]}...)")
    else:
        print(f"SKIP ({r.get('message', '')[:60]})")

# ── Step 3: Update Q2 to also be continental-only ──
print("\n3. Checking Q2 campaign...")
if isinstance(campaigns, list):
    for c in campaigns:
        if "Q2" in c.get("code", ""):
            q2_id = c["id"]
            print(f"   Q2 found: {q2_id[:8]}...")
            # Patch to clear targetCountries
            rp = api("PATCH", f"/api/v1/workflow/campaigns/{q2_id}", {
                "targetCountries": [],
                "scope": "continental",
            })
            print(f"   Updated: {rp.get('data', {}).get('id', rp.get('message', ''))[:40]}")

print("\n4. Final campaign list:")
r2 = api("GET", "/api/v1/workflow/campaigns?domain=paid&limit=20")
for c in (r2.get("data", []) if isinstance(r2.get("data"), list) else []):
    name = c.get("name", "")
    if isinstance(name, dict):
        name = name.get("en", "")
    code = c.get("code", "")
    status = c.get("status", "")
    start = c.get("startDate", "")[:10]
    end = c.get("endDate", "")[:10]
    print(f"   {code}: {status} ({start} → {end}) — {name}")

ssh.close()
print("\nDONE.")
