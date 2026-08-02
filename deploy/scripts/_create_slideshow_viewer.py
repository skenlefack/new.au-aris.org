#!/usr/bin/env python3
"""
ARIS 4.0 — Create slideshow viewer account.

Creates a read-only ANALYST user (viewer@au-aris.org) used by the
slideshow auto-auth system to generate JWT tokens for public iframe
embedding of dashboard pages (Home, PAID, etc.).

The account is created via the credential service's register API
using the super admin credentials.

Usage:
  export ARIS_DEPLOY_PASS='@u-1baR.0rg$U24'
  python -u _create_slideshow_viewer.py

  # For staging:
  python -u _create_slideshow_viewer.py --env staging
"""
import argparse
import json
import requests

# ── Configuration ────────────────────────────────────────────
ENVS = {
    "production": {
        "base_url": "https://au-aris.org/api/v1",
        "admin_email": "admin@au-aris.org",
        "admin_password": "Aris2026@@4!0",
    },
    "staging": {
        "base_url": "https://test.au-aris.org/api/v1",
        "admin_email": "admin@au-aris.org",
        "admin_password": "Aris2026@@4!0",
    },
}

VIEWER_EMAIL = "viewer@au-aris.org"
VIEWER_PASSWORD = "Aris2026@@Viewer!"
VIEWER_FIRST_NAME = "Slideshow"
VIEWER_LAST_NAME = "Viewer"
VIEWER_ROLE = "ANALYST"


def main():
    parser = argparse.ArgumentParser(description="Create slideshow viewer account")
    parser.add_argument("--env", choices=["production", "staging"], default="production")
    args = parser.parse_args()

    cfg = ENVS[args.env]
    base = cfg["base_url"]

    print(f"=== Creating slideshow viewer on {args.env} ===")
    print(f"Base URL: {base}")

    # Step 1: Login as super admin
    print("\n[1/3] Logging in as super admin...")
    login_res = requests.post(
        f"{base}/credential/auth/login",
        json={"email": cfg["admin_email"], "password": cfg["admin_password"]},
        timeout=15,
    )
    if login_res.status_code != 200:
        print(f"  ERROR: Login failed ({login_res.status_code}): {login_res.text}")
        return
    login_data = login_res.json()
    token = login_data.get("data", {}).get("accessToken") or login_data.get("accessToken")
    tenant_id = login_data.get("data", {}).get("user", {}).get("tenantId") or login_data.get("user", {}).get("tenantId")
    print(f"  OK — tenantId: {tenant_id}")

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "X-Tenant-Id": tenant_id,
    }

    # Step 2: Check if viewer already exists
    print("\n[2/3] Checking if viewer account exists...")
    users_res = requests.get(
        f"{base}/credential/users?search={VIEWER_EMAIL}&limit=5",
        headers=headers,
        timeout=15,
    )
    if users_res.status_code == 200:
        users = users_res.json().get("data", [])
        for u in users:
            if u.get("email") == VIEWER_EMAIL:
                print(f"  Viewer account already exists (id: {u['id']})")
                print("  Done — no action needed.")
                return

    # Step 3: Create viewer account
    print("\n[3/3] Creating viewer account...")
    register_res = requests.post(
        f"{base}/credential/auth/register",
        headers=headers,
        json={
            "email": VIEWER_EMAIL,
            "password": VIEWER_PASSWORD,
            "firstName": VIEWER_FIRST_NAME,
            "lastName": VIEWER_LAST_NAME,
            "role": VIEWER_ROLE,
            "tenantId": tenant_id,
        },
        timeout=15,
    )
    if register_res.status_code in (200, 201):
        user_data = register_res.json().get("data", {})
        user_id = user_data.get("id") or user_data.get("user", {}).get("id")
        print(f"  OK — viewer created (id: {user_id})")
    else:
        print(f"  ERROR: Register failed ({register_res.status_code}): {register_res.text}")
        return

    print("\n=== Done ===")
    print(f"Viewer email:    {VIEWER_EMAIL}")
    print(f"Viewer password: {VIEWER_PASSWORD}")
    print(f"Viewer role:     {VIEWER_ROLE}")
    print()
    print("Environment variables for analytics service docker-compose:")
    print(f"  SLIDESHOW_VIEWER_EMAIL={VIEWER_EMAIL}")
    print(f"  SLIDESHOW_VIEWER_PASSWORD={VIEWER_PASSWORD}")
    print(f"  CREDENTIAL_SERVICE_URL=http://aris-credential:3002")


if __name__ == "__main__":
    main()
