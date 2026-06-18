#!/usr/bin/env python3
"""
Delete all collection campaigns created between May 11-15, 2026 on staging.
These are training test campaigns that should be cleaned up.

Prerequisites: the collecte service must have the DELETE /api/v1/workflow/campaigns/:id route deployed.

Usage: python3 deploy/scripts/_delete_training_campaigns.py
"""
import json
import urllib.request
import ssl
from datetime import datetime

BASE = "https://test.au-aris.org"
EMAIL = "admin@au-aris.org"
PASSWORD = "Aris2026@@4!0"

ctx = ssl.create_default_context()

def api_call(method, path, token, body=None):
    data = json.dumps(body).encode("utf-8") if body else (b"{}" if method in ("POST", "PUT") else None)
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=data,
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {token}",
        },
        method=method,
    )
    try:
        resp = urllib.request.urlopen(req, context=ctx)
        if resp.status == 204:
            return resp.status, {}
        return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()


def main():
    # Login
    login_data = json.dumps({"email": EMAIL, "password": PASSWORD}).encode()
    req = urllib.request.Request(
        f"{BASE}/api/v1/credential/auth/login",
        data=login_data,
        headers={"Content-Type": "application/json"},
    )
    resp = urllib.request.urlopen(req, context=ctx)
    token = json.loads(resp.read())["data"]["accessToken"]
    print("Logged in OK")

    # Collect all campaigns
    all_campaigns = []
    for page in range(1, 20):
        code, data = api_call("GET", f"/api/v1/workflow/campaigns?limit=100&page={page}", token)
        campaigns = data.get("data", [])
        all_campaigns.extend(campaigns)
        total = data.get("meta", {}).get("total", 0)
        if len(all_campaigns) >= total:
            break

    # Filter: created between May 11 and May 15, 2026
    start = datetime(2026, 5, 11, 0, 0, 0)
    end = datetime(2026, 5, 15, 23, 59, 59)

    targets = []
    for c in all_campaigns:
        created = c.get("createdAt", "")
        if not created:
            continue
        dt = datetime.fromisoformat(created.replace("Z", "").replace("+00:00", ""))
        if start <= dt <= end:
            targets.append(c)

    print(f"\nFound {len(targets)} campaigns to delete (May 11-15, 2026)")

    deleted = 0
    errors = 0

    for i, c in enumerate(targets):
        cid = c["id"]
        name = c.get("name", "")
        if isinstance(name, dict):
            name = name.get("fr") or name.get("en") or ""
        short = str(name)[:60]
        status = c.get("status", "")

        code, result = api_call("DELETE", f"/api/v1/workflow/campaigns/{cid}", token)
        if code == 204:
            print(f"  {i+1:2}/{len(targets)} DELETED  | {status:10} | {short}")
            deleted += 1
        else:
            err = result if isinstance(result, str) else json.dumps(result)
            print(f"  {i+1:2}/{len(targets)} FAIL({code}) | {status:10} | {short} | {err[:80]}")
            errors += 1

    print(f"\nDone: {deleted} deleted, {errors} failed out of {len(targets)}")


if __name__ == "__main__":
    main()
