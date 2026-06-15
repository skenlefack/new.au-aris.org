#!/usr/bin/env python3
"""
ARIS 4.0 — Create Training Accounts for Cabo Verde Formation
=============================================================
Creates NATIONAL_ADMIN accounts for all training participants
on STAGING (test.au-aris.org) and triggers welcome emails.

Run: python deploy/scripts/_create_training_accounts_cv.py
"""

import json
import sys
import io
import time
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# ── Config ────────────────────────────────────────────────────
BASE_URL = "https://test.au-aris.org/api/v1"
ADMIN_EMAIL = "admin@au-aris.org"
ADMIN_PASSWORD = "Aris2026@@4!0"
DEFAULT_PASSWORD = "Aris2026@@"

# ── Tenant UUIDs ──────────────────────────────────────────────
TENANTS = {
    "ST": "00000000-0000-4000-a000-00000000050b",  # Sao Tome et Principe
    "MZ": "00000000-0000-4000-a000-000000000309",  # Mozambique
    "AO": "00000000-0000-4000-a000-000000000501",  # Angola
    "CV": "00000000-0000-4000-a000-000000000205",  # Cabo Verde
}

# ── Training Participants ─────────────────────────────────────
USERS = [
    {
        "no": 1,
        "country": "ST",
        "countryName": "Sao Tome et Principe",
        "firstName": "Eugenio Antonio Sacramento",
        "lastName": "Da Graca",
        "title": "Responsavel Dept. Fiscalizacao Saude Publica Veterinaria",
        "email": "eugenio.graca@hotmail.com",
    },
    {
        "no": 2,
        "country": "ST",
        "countryName": "Sao Tome et Principe",
        "firstName": "Alfredo De Sousa Pontes Rodrigues",
        "lastName": "Da Mata",
        "title": "Responsavel Dept. Saude Animal",
        "email": "alfredodamata66@gmail.com",
    },
    {
        "no": 3,
        "country": "MZ",
        "countryName": "Mozambique",
        "firstName": "Antonio Francisco Da Silva",
        "lastName": "Sumbana",
        "title": "Head of Division of Surveillance, Disease Control",
        "email": "manitosumbana@gmail.com",
    },
    {
        "no": 4,
        "country": "MZ",
        "countryName": "Mozambique",
        "firstName": "Dercilia De Rosario Mudanisse",
        "lastName": "Arone",
        "title": "Head of Animal Health Department - PPR Focal Point",
        "email": "dercilia.arone@gmail.com",
    },
    {
        "no": 5,
        "country": "AO",
        "countryName": "Angola",
        "firstName": "Ezequiel Avelino",
        "lastName": "Dala",
        "title": "Coordinator Subprogram Small Ruminant Production",
        "email": "ezequielavelinodala221@gmail.com",
    },
    {
        "no": 6,
        "country": "AO",
        "countryName": "Angola",
        "firstName": "Jose Bonifacio",
        "lastName": "Sucumula",
        "title": "Technicien Veterinaire",
        "email": "sucumulajose07@gmail.com",
    },
    {
        "no": 7,
        "country": "CV",
        "countryName": "Cabo Verde",
        "firstName": "Solange",
        "lastName": "Ferreira",
        "title": "Ingenieur en Sciences Animales",
        "email": "solange.ferreira@maa.gov.cv",
    },
    {
        "no": 8,
        "country": "CV",
        "countryName": "Cabo Verde",
        "firstName": "Ana Lina",
        "lastName": "Olende",
        "title": "Directrice des DSPSA",
        "email": "analina.olende@maa.gov.cv",
    },
    {
        "no": 9,
        "country": "CV",
        "countryName": "Cabo Verde",
        "firstName": "Viviene",
        "lastName": "Goncalves",
        "title": "Point Focal Surveillance Epidemiologique",
        "email": "viviene.goncalves@maa.gov.cv",
    },
    {
        "no": 12,
        "country": "CV",
        "countryName": "Cabo Verde",
        "firstName": "Iolanda",
        "lastName": "Santos",
        "title": "Responsable du Laboratoire Veterinaire",
        "email": "iolanda.santos@maa.gov.cv",
    },
    {
        "no": 13,
        "country": "CV",
        "countryName": "Cabo Verde",
        "firstName": "Hailton",
        "lastName": "Spencer",
        "title": "Professeur de Biologie - Universite du Cap-Vert",
        "email": "hailton.spencer@docente.unicv.edu.cv",
    },
    {
        "no": 21,
        "country": "CV",
        "countryName": "Cabo Verde",
        "firstName": "Isabel",
        "lastName": "Da Lomba",
        "title": "Technicien Veterinaire",
        "email": "isabel.lomba@maa.gov.cv",
    },
]


def api(method, path, token=None, body=None):
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        resp = requests.request(method, url, headers=headers, json=body,
                                verify=False, timeout=30)
        try:
            return resp.json()
        except Exception:
            return {"raw": resp.text, "status": resp.status_code}
    except Exception as e:
        return {"error": str(e)}


def main():
    print("=" * 65)
    print("  ARIS 4.0 - Create Training Accounts (Staging)")
    print("=" * 65)

    # 1. Login
    print("\n[1] Login as Super Admin...")
    result = api("POST", "/credential/auth/login", body={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })
    if "data" not in result or "accessToken" not in result.get("data", {}):
        print(f"  FAIL: {json.dumps(result, indent=2)[:300]}")
        sys.exit(1)
    token = result["data"]["accessToken"]
    print(f"  OK - token: {token[:20]}...")

    # 2. Create accounts
    print(f"\n[2] Creating {len(USERS)} accounts...")
    print("-" * 65)

    created = []
    failed = []

    for user in USERS:
        tenant_id = TENANTS[user["country"]]
        email = user["email"].lower().strip()
        print(f"\n  #{user['no']} {user['firstName']} {user['lastName']}")
        print(f"      Country: {user['countryName']}")
        print(f"      Email:   {email}")
        print(f"      Role:    NATIONAL_ADMIN")

        result = api("POST", "/settings/users", token=token, body={
            "email": email,
            "password": DEFAULT_PASSWORD,
            "firstName": user["firstName"],
            "lastName": user["lastName"],
            "role": "NATIONAL_ADMIN",
            "tenantId": tenant_id,
            "locale": "pt" if user["country"] in ("ST", "MZ", "AO", "CV") else "fr",
        })

        if "data" in result and isinstance(result["data"], dict) and "id" in result["data"]:
            uid = result["data"]["id"]
            print(f"      OK - ID: {uid}")
            print(f"      -> Welcome email sent automatically via Kafka")
            created.append({**user, "id": uid, "email": email})
        elif result.get("statusCode") == 409 or "already" in str(result).lower():
            print(f"      SKIP - Account already exists")
            created.append({**user, "id": "existing", "email": email})
        else:
            print(f"      FAIL - {json.dumps(result, indent=2)[:200]}")
            failed.append({**user, "error": str(result)[:100], "email": email})

        time.sleep(0.3)  # Rate limiting

    # 3. Summary
    print("\n" + "=" * 65)
    print("  SUMMARY")
    print("=" * 65)

    print(f"\n  URL:      https://test.au-aris.org")
    print(f"  Password: {DEFAULT_PASSWORD}")
    print(f"  Role:     NATIONAL_ADMIN (all accounts)")
    print(f"  Created:  {len(created)}")
    print(f"  Failed:   {len(failed)}")

    print(f"\n  {'No':<4} {'Country':<6} {'Name':<45} {'Email':<40} {'Status'}")
    print(f"  {'--':<4} {'------':<6} {'----':<45} {'-----':<40} {'------'}")

    for u in created:
        name = f"{u['firstName']} {u['lastName']}"
        status = "OK" if u["id"] != "existing" else "EXISTS"
        print(f"  {u['no']:<4} {u['country']:<6} {name:<45} {u['email']:<40} {status}")

    for u in failed:
        name = f"{u['firstName']} {u['lastName']}"
        print(f"  {u['no']:<4} {u['country']:<6} {name:<45} {u['email']:<40} FAILED")

    if failed:
        print(f"\n  ERRORS:")
        for u in failed:
            print(f"    #{u['no']} {u['firstName']} {u['lastName']}: {u['error']}")

    print(f"""
  NOTES:
  - All accounts use password: {DEFAULT_PASSWORD}
  - Users must change password on first login
  - Welcome email is sent automatically via Kafka -> Message service
  - All users are NATIONAL_ADMIN of their respective country
  - Locale set to Portuguese (pt) for all lusophone countries
""")


if __name__ == "__main__":
    main()
