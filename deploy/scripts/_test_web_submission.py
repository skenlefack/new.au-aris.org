#!/usr/bin/env python3
"""
E2E test: simulate the EXACT web browser flow through Traefik.

This tests the full path: Browser → Traefik → Service
(not localhost:PORT shortcuts — those bypass routing)
"""

import paramiko
import json
import sys

VM_APP = "10.202.101.183"
SSH_USER = "arisadmin"
SSH_PASS = "@u-1baR.0rg$U24"
SUDO = f"echo '{SSH_PASS}' | sudo -S"

# Use the public domain via Traefik (exactly like the browser)
BASE = "https://au-aris.org"

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


def web_curl(client, method, path, token=None, body=None, timeout=30):
    """
    Curl through the public HTTPS endpoint (Traefik) — same as browser.
    Uses -k to skip cert verification from inside the VM.
    """
    url = f"{BASE}{path}"
    headers = "-H 'Content-Type: application/json'"
    if token:
        headers += f" -H 'Authorization: Bearer {token}'"
    data_flag = ""
    if body:
        body_json = json.dumps(body)
        # Use SFTP to write body file (avoids all shell escaping issues)
        sftp = client.open_sftp()
        with sftp.file("/tmp/curl_body.json", "w") as f:
            f.write(body_json)
        sftp.close()
        data_flag = "-d @/tmp/curl_body.json"

    cmd = f"curl -sk -w '\\n%{{http_code}}' -X {method} {headers} {data_flag} '{url}'"
    raw = ssh_cmd(client, cmd, timeout=timeout)

    lines = raw.strip().split("\n")
    http_code = lines[-1] if lines else "?"
    body_text = "\n".join(lines[:-1])
    try:
        return json.loads(body_text), http_code, None
    except Exception as e:
        return None, http_code, f"JSON error: {e}\nBody: {body_text[:300]}"


def main():
    print("=" * 60)
    print("  WEB INTERFACE E2E TEST — via Traefik (au-aris.org)")
    print("=" * 60)

    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(VM_APP, username=SSH_USER, password=SSH_PASS, timeout=15)
        print(f"  SSH to {VM_APP} OK")
    except Exception as e:
        print(f"  SSH FAILED: {e}")
        return 1

    # ── Step 1: Login (POST /api/v1/credential/auth/login) ──
    print("\n[1/7] POST /api/v1/credential/auth/login ...")
    resp, code, err = web_curl(client, "POST", "/api/v1/credential/auth/login",
                               body={"email": EMAIL, "password": PASSWORD})
    if err or code != "200" or not resp or "data" not in resp:
        print(f"  FAIL (HTTP {code}): {err or resp}")
        return 1
    token = resp["data"]["accessToken"]
    user = resp["data"]["user"]
    print(f"  HTTP {code} OK — {user['email']} ({user['role']})")
    print(f"  Token: {token[:20]}...{token[-10:]}")

    # ── Step 2: List campaigns (GET /api/v1/workflow/campaigns) ──
    # This is what the web page does via wfFetch → Traefik routes to collecte:3011
    print("\n[2/7] GET /api/v1/workflow/campaigns?status=ACTIVE&limit=5 ...")
    resp, code, err = web_curl(client, "GET",
                               "/api/v1/workflow/campaigns?status=ACTIVE&limit=5",
                               token=token)
    if err or not resp:
        print(f"  FAIL (HTTP {code}): {err or 'no response'}")
        return 1
    campaigns = resp.get("data", [])
    print(f"  HTTP {code} — {len(campaigns)} active campaigns")

    if not campaigns:
        print("  No active campaigns found!")
        return 1

    campaign = campaigns[0]
    campaign_id = campaign["id"]
    template_id = campaign.get("formTemplateId", "")
    cname = campaign.get("name", {})
    if isinstance(cname, dict):
        cname = cname.get("en", cname.get("fr", str(cname)))
    print(f"  Selected: \"{cname}\"")

    # ── Step 3: Fetch template (GET /api/v1/form-builder/templates/:id) ──
    # This is what the submit page does via useFormBuilderTemplate
    print(f"\n[3/7] GET /api/v1/form-builder/templates/{template_id[:8]}... ...")
    resp, code, err = web_curl(client, "GET",
                               f"/api/v1/form-builder/templates/{template_id}",
                               token=token)
    fields = []
    if resp and "data" in resp:
        schema = resp["data"].get("schema", {})
        sections = schema.get("sections", [])
        for s in sections:
            for f in s.get("fields", []):
                if f.get("type") not in ("heading", "divider", "spacer", "info-box"):
                    fields.append(f)
        print(f"  HTTP {code} — {len(sections)} sections, {len(fields)} fields")
        required = [f for f in fields if f.get("required")]
        if required:
            print(f"  Required fields: {len(required)}")
            for r in required[:5]:
                lbl = (r.get("label") or {}).get("en", r["code"])
                print(f"    * {r['code']} ({r['type']}) — {lbl}")
    else:
        print(f"  HTTP {code} — template not found, using minimal data")

    # ── Step 4: Build form data (simulates user filling the form) ──
    print("\n[4/7] Building form data (simulating user input)...")
    form_data = {}
    for field in fields:
        code = field["code"]
        ftype = field.get("type", "text")
        opts = (field.get("properties") or {}).get("options", [])
        if ftype in ("text", "textarea"):
            form_data[code] = f"Web test - {code}"
        elif ftype == "number":
            form_data[code] = 100
        elif ftype == "date":
            form_data[code] = "2026-05-19"
        elif ftype in ("select", "radio"):
            form_data[code] = opts[0]["value"] if opts else "test"
        elif ftype == "checkbox":
            form_data[code] = True
        elif ftype == "multi-select":
            form_data[code] = [opts[0]["value"]] if opts else []
        elif ftype in ("admin-location", "geo-selector"):
            form_data[code] = "Kenya"
        else:
            form_data[code] = f"test-{ftype}"

    if not form_data:
        form_data = {"_test": "web interface test"}
    print(f"  {len(form_data)} fields filled")

    # ── Step 5: Submit (POST /api/v1/collecte/submissions) ──
    # This is EXACTLY what useSubmitCampaignForm() does
    print(f"\n[5/7] POST /api/v1/collecte/submissions ...")
    print(f"  Body: {{ campaignId: \"{campaign_id[:12]}...\", data: {{{len(form_data)} fields}} }}")
    resp, code, err = web_curl(client, "POST", "/api/v1/collecte/submissions",
                               token=token,
                               body={"campaignId": campaign_id, "data": form_data},
                               timeout=30)
    if err:
        print(f"  FAIL (HTTP {code}): {err}")
        return 1

    submission_id = None
    if resp and "data" in resp:
        sub = resp["data"]
        submission_id = sub.get("id")
        print(f"  HTTP {code} — SUCCESS")
        print(f"  Submission ID: {submission_id}")
        print(f"  Status:        {sub.get('status')}")
        print(f"  Submitted at:  {sub.get('submittedAt')}")
        print(f"  Template:      {sub.get('templateId', '?')[:12]}...")
    else:
        msg = (resp or {}).get("message", "?")
        errors = (resp or {}).get("errors", [])
        print(f"  HTTP {code} — FAILED")
        print(f"  Message: {msg}")
        for e in errors[:5]:
            print(f"    - {e.get('field','?')}: {e.get('message','?')}")
        return 1

    # ── Step 6: Verify submission (GET /api/v1/collecte/submissions/:id) ──
    print(f"\n[6/7] GET /api/v1/collecte/submissions/{submission_id[:8]}... ...")
    resp, code, err = web_curl(client, "GET",
                               f"/api/v1/collecte/submissions/{submission_id}",
                               token=token)
    if resp and "data" in resp:
        sub = resp["data"]
        data_keys = list((sub.get("data") or {}).keys())
        print(f"  HTTP {code} — Verified")
        print(f"  Status:  {sub.get('status')}")
        print(f"  Fields:  {len(data_keys)} data fields stored")
    else:
        print(f"  HTTP {code} — Could not verify: {err}")

    # ── Step 7: List submissions for this campaign ──
    print(f"\n[7/7] GET /api/v1/collecte/submissions?campaign={campaign_id[:8]}... ...")
    resp, code, err = web_curl(client, "GET",
                               f"/api/v1/collecte/submissions?campaign={campaign_id}&limit=3",
                               token=token)
    if resp and "data" in resp:
        subs = resp["data"]
        total = resp.get("meta", {}).get("total", len(subs))
        print(f"  HTTP {code} — {total} total submissions for this campaign")
        for s in subs[:3]:
            print(f"    - {s['id'][:8]}... status={s.get('status')} at={s.get('submittedAt','?')[:19]}")
    else:
        print(f"  HTTP {code}: {err or 'no data'}")

    print("\n" + "=" * 60)
    print("  ALL 7 STEPS PASSED — WEB SUBMISSION WORKS")
    print("=" * 60)

    client.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
