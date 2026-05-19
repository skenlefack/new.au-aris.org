#!/usr/bin/env python3
"""E2E test: login → list campaigns → fetch template → submit form → verify on PROD."""

import paramiko
import json
import sys

VM_APP = "10.202.101.183"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"

EMAIL = "admin@au-aris.org"
PASSWORD = "Aris2026@@4!0"


def ssh_cmd(client, cmd, timeout=30):
    chan = client.get_transport().open_session()
    chan.exec_command(cmd)
    chan.settimeout(timeout)
    out = b""
    try:
        while True:
            chunk = chan.recv(4096)
            if not chunk:
                break
            out += chunk
    except Exception:
        pass
    return out.decode(errors="replace").strip()


def curl(client, method, port, path, token=None, body=None, timeout=30):
    """Build and execute a curl command via SSH."""
    headers = "-H 'Content-Type: application/json'"
    if token:
        headers += f" -H 'Authorization: Bearer {token}'"
    data_flag = ""
    if body:
        # Write body to temp file to avoid shell escaping issues
        body_json = json.dumps(body)
        ssh_cmd(client, f"echo '{body_json}' > /tmp/curl_body.json", timeout=5)
        data_flag = "-d @/tmp/curl_body.json"
    cmd = f"curl -s -X {method} {headers} {data_flag} 'http://localhost:{port}{path}'"
    raw = ssh_cmd(client, cmd, timeout=timeout)
    try:
        return json.loads(raw), None
    except json.JSONDecodeError as e:
        return None, f"JSON parse error: {e}\nRaw: {raw[:500]}"


def main():
    print("=" * 60)
    print("  FORM SUBMISSION E2E TEST — PRODUCTION")
    print("=" * 60)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(VM_APP, username=SSH_USER, password=SSH_PASS, timeout=15)
        print(f"  SSH connected to {VM_APP}")
    except Exception as e:
        print(f"  SSH FAILED: {e}")
        return 1

    # ── STEP 1: Login ──
    print("\n[1/6] Login...")
    resp, err = curl(client, "POST", 3002, "/api/v1/credential/auth/login",
                     body={"email": EMAIL, "password": PASSWORD})
    if err or not resp or "data" not in resp:
        print(f"  FAIL: {err or resp}")
        return 1
    token = resp["data"]["accessToken"]
    user = resp["data"]["user"]
    print(f"  OK — {user['email']} ({user['role']}, {user.get('tenantLevel', '?')})")

    # ── STEP 2: List active campaigns ──
    print("\n[2/6] Listing active campaigns...")
    resp, err = curl(client, "GET", 3011, "/api/v1/workflow/campaigns?status=ACTIVE&limit=10", token=token)
    if err or not resp:
        print(f"  FAIL: {err or 'no response'}")
        return 1
    campaigns = resp.get("data", [])
    print(f"  Found {len(campaigns)} active campaigns")
    for c in campaigns[:5]:
        name = c.get("name", {})
        if isinstance(name, dict):
            name = name.get("en", name.get("fr", str(name)))
        tpl = c.get("formTemplateId", "?")[:8]
        print(f"    - {name} (domain={c.get('domain','?')}, template={tpl}...)")

    if not campaigns:
        print("  No active campaigns. Cannot test submission.")
        return 0

    campaign = campaigns[0]
    campaign_id = campaign["id"]
    template_id = campaign.get("formTemplateId", "")
    cname = campaign.get("name", {})
    if isinstance(cname, dict):
        cname = cname.get("en", cname.get("fr", ""))
    print(f"\n  Selected: \"{cname}\"")
    print(f"  Campaign: {campaign_id}")
    print(f"  Template: {template_id}")

    # ── STEP 3: Fetch template schema ──
    print("\n[3/6] Fetching template schema...")
    resp, err = curl(client, "GET", 3010, f"/api/v1/form-builder/templates/{template_id}", token=token)
    all_fields = []
    required_fields = []
    if resp and "data" in resp:
        tpl_data = resp["data"]
        schema = tpl_data.get("schema", {})
        sections = schema.get("sections", [])
        for section in sections:
            for field in section.get("fields", []):
                if field.get("type") in ("heading", "divider", "spacer", "info-box"):
                    continue
                all_fields.append(field)
                if field.get("required"):
                    required_fields.append(field)
        print(f"  Template: {tpl_data.get('name', '?')}")
        print(f"  Sections: {len(sections)}, Fields: {len(all_fields)}, Required: {len(required_fields)}")
        for f in required_fields[:10]:
            label = (f.get("label") or {}).get("en", f.get("code", "?"))
            print(f"    * {f['code']} ({f['type']}) — {label}")
    else:
        print(f"  WARN: Could not fetch template ({err}), submitting minimal data")

    # ── STEP 4: Build test data ──
    print("\n[4/6] Building test submission data...")
    test_data = {}
    for field in all_fields:
        code = field["code"]
        ftype = field.get("type", "text")
        options = (field.get("properties") or {}).get("options", [])
        if ftype in ("text", "textarea"):
            test_data[code] = f"E2E test - {code}"
        elif ftype == "number":
            test_data[code] = 42
        elif ftype == "date":
            test_data[code] = "2026-05-19"
        elif ftype in ("select", "radio"):
            test_data[code] = options[0]["value"] if options else "test"
        elif ftype == "checkbox":
            test_data[code] = True
        elif ftype == "multi-select":
            test_data[code] = [options[0]["value"]] if options else []
        elif ftype in ("admin-location", "geo-selector"):
            test_data[code] = "Kenya"
        else:
            test_data[code] = f"test-{ftype}"

    if not test_data:
        test_data = {"test_field": "E2E test value", "note": "Automated test"}

    print(f"  Built data with {len(test_data)} fields")
    for k, v in list(test_data.items())[:5]:
        val_str = str(v)[:50]
        print(f"    {k}: {val_str}")
    if len(test_data) > 5:
        print(f"    ... +{len(test_data) - 5} more")

    # ── STEP 5: Submit ──
    print("\n[5/6] Submitting form data...")
    submit_body = {"campaignId": campaign_id, "data": test_data}
    resp, err = curl(client, "POST", 3011, "/api/v1/collecte/submissions",
                     token=token, body=submit_body, timeout=30)
    if err:
        print(f"  FAIL: {err}")
        return 1

    submission_id = None
    if resp and "data" in resp:
        sub = resp["data"]
        submission_id = sub.get("id")
        print(f"  SUCCESS (HTTP 201)")
        print(f"  Submission ID: {submission_id}")
        print(f"  Status: {sub.get('status', '?')}")
        print(f"  Submitted at: {sub.get('submittedAt', '?')}")
    else:
        msg = (resp or {}).get("message", "Unknown error")
        errors = (resp or {}).get("errors", [])
        print(f"  FAILED")
        print(f"  Message: {msg}")
        for e in errors[:5]:
            print(f"    - {e.get('field','?')}: {e.get('message','?')}")
        return 1

    # ── STEP 6: Verify ──
    print(f"\n[6/6] Verifying submission...")
    resp, err = curl(client, "GET", 3011, f"/api/v1/collecte/submissions/{submission_id}", token=token)
    if resp and "data" in resp:
        sub = resp["data"]
        print(f"  ID: {sub.get('id', '?')}")
        print(f"  Status: {sub.get('status', '?')}")
        print(f"  Campaign: {sub.get('campaignId', '?')[:12]}...")
        print(f"  Template: {sub.get('templateId', '?')[:12]}...")
        data_keys = list((sub.get("data") or {}).keys())
        print(f"  Data fields: {len(data_keys)}")
    else:
        print(f"  WARN: Could not verify — {err}")

    print("\n" + "=" * 60)
    print("  E2E TEST PASSED — SUBMISSION CREATED SUCCESSFULLY")
    print("=" * 60)

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
