#!/usr/bin/env python3
"""
ARIS 4.0 — Setup Cape Verde (Cabo Verde) Validation Workflow Test
=================================================================
Creates generic test users at all validation levels and configures
the full 4-level validation chain on STAGING (test.au-aris.org).

Validation flow:
  Agent Terrain (Admin2/Praia) → Validateur Régional (Admin1/Santiago)
  → CVO National (Cabo Verde) → Admin REC (ECOWAS) → Admin Continental (AU-IBAR)

Run: python deploy/scripts/_setup_cv_validation_test.py
"""

import json
import sys
import io
import requests
import urllib3

# Force UTF-8 output on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

# Disable SSL warnings for staging self-signed cert
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# ── Staging Base URL ─────────────────────────────────────────
BASE_URL = "https://test.au-aris.org/api/v1"

# ── Tenant UUIDs ─────────────────────────────────────────────
TENANT_AU      = "00000000-0000-4000-a000-000000000001"  # AU-IBAR Continental
TENANT_ECOWAS  = "00000000-0000-4000-a000-000000000020"  # ECOWAS REC
TENANT_CV      = "00000000-0000-4000-a000-000000000205"  # Cabo Verde

# ── Admin credentials (staging) ──────────────────────────────
ADMIN_EMAIL    = "admin@au-aris.org"
ADMIN_PASSWORD = "Aris2026@@4!0"

# ── Default password for new test users ──────────────────────
TEST_PASSWORD  = "Test2026@@CV!"

# ── Users to create ──────────────────────────────────────────
USERS = [
    {
        "id_label":   "agent_terrain",
        "email":      "agent.terrain.praia@test.au-aris.org",
        "firstName":  "Amadou",
        "lastName":   "Diallo",
        "role":       "FIELD_AGENT",
        "tenantId":   TENANT_CV,
        "description": "Agent Terrain — Admin2 Praia (collecte terrain)",
    },
    {
        "id_label":   "validateur_admin1",
        "email":      "validateur.santiago@test.au-aris.org",
        "firstName":  "Fatima",
        "lastName":   "Tavares",
        "role":       "DATA_STEWARD",
        "tenantId":   TENANT_CV,
        "description": "Validateur Admin1 — Santiago (validation technique)",
    },
    {
        "id_label":   "cvo_national",
        "email":      "cvo.national.cv@test.au-aris.org",
        "firstName":  "Carlos",
        "lastName":   "Monteiro",
        "role":       "NATIONAL_ADMIN",
        "tenantId":   TENANT_CV,
        "description": "CVO National — Cabo Verde (validation officielle)",
    },
    {
        "id_label":   "admin_rec",
        "email":      "admin.rec.ecowas@test.au-aris.org",
        "firstName":  "Ousmane",
        "lastName":   "Sy",
        "role":       "REC_ADMIN",
        "tenantId":   TENANT_ECOWAS,
        "description": "Admin REC — ECOWAS (harmonisation régionale)",
    },
    {
        "id_label":   "admin_continental",
        "email":      "admin.continental.test@test.au-aris.org",
        "firstName":  "Grace",
        "lastName":   "Okonkwo",
        "role":       "CONTINENTAL_ADMIN",
        "tenantId":   TENANT_AU,
        "description": "Admin Continental — AU-IBAR (publication continentale)",
    },
]

# ── Validation chains (userId → validatorId) ────────────────
CHAINS = [
    {
        "label":     "Admin2 → Admin1",
        "from_user": "agent_terrain",
        "to_user":   "validateur_admin1",
        "levelType": "national",
        "priority":  1,
    },
    {
        "label":     "Admin1 → CVO National",
        "from_user": "validateur_admin1",
        "to_user":   "cvo_national",
        "levelType": "national",
        "priority":  2,
    },
    {
        "label":     "CVO National → Admin REC",
        "from_user": "cvo_national",
        "to_user":   "admin_rec",
        "levelType": "regional",
        "priority":  1,
    },
    {
        "label":     "Admin REC → Admin Continental",
        "from_user": "admin_rec",
        "to_user":   "admin_continental",
        "levelType": "continental",
        "priority":  1,
    },
]


def step(msg):
    print(f"\n{'='*60}")
    print(f"  {msg}")
    print(f"{'='*60}")


def api(method, path, token=None, tenant_id=None, body=None):
    """Make an API call to staging."""
    url = f"{BASE_URL}{path}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    if tenant_id:
        headers["X-Tenant-Id"] = tenant_id

    try:
        resp = requests.request(method, url, headers=headers, json=body,
                                verify=False, timeout=30)
        try:
            return resp.json()
        except Exception:
            return {"raw": resp.text, "status": resp.status_code}
    except requests.exceptions.ConnectionError as e:
        return {"error": f"Connection failed: {e}"}
    except requests.exceptions.Timeout:
        return {"error": "Request timed out"}


def login():
    """Login as super admin and return JWT token."""
    step("1. Login as Super Admin on STAGING")
    result = api("POST", "/credential/auth/login", body={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD,
    })

    if "data" in result and "accessToken" in result.get("data", {}):
        token = result["data"]["accessToken"]
        print(f"  OK Login successful — token: {token[:20]}...")
        return token
    else:
        print(f"  FAIL Login failed: {json.dumps(result, indent=2)[:300]}")
        sys.exit(1)


def create_users(token):
    """Create all test users and return dict of id_label → user_id."""
    step("2. Create Test Users")
    user_ids = {}

    for user in USERS:
        print(f"\n  Creating: {user['description']}")
        print(f"    Email: {user['email']}")
        print(f"    Role:  {user['role']}")

        result = api("POST", "/credential/auth/register", token=token, body={
            "email":     user["email"],
            "password":  TEST_PASSWORD,
            "firstName": user["firstName"],
            "lastName":  user["lastName"],
            "role":      user["role"],
            "tenantId":  user["tenantId"],
        })

        if "data" in result and isinstance(result["data"], dict) and "id" in result["data"]:
            uid = result["data"]["id"]
            user_ids[user["id_label"]] = uid
            print(f"    OK Created — ID: {uid}")
        else:
            print(f"    WARN Response: {json.dumps(result, indent=2)[:200]}")
            # Try to find existing user
            found_id = find_user_by_email(token, user["email"], user["tenantId"])
            if found_id:
                user_ids[user["id_label"]] = found_id
                print(f"    OK Found existing user — ID: {found_id}")
            else:
                print(f"    FAIL Could not create or find user {user['email']}")
                user_ids[user["id_label"]] = None

    return user_ids


def find_user_by_email(token, email, tenant_id):
    """Search for an existing user by email."""
    result = api("GET", f"/credential/users?search={email}&limit=10",
                 token=token, tenant_id=tenant_id)
    if "data" in result:
        data = result["data"]
        items = data if isinstance(data, list) else data.get("items", []) if isinstance(data, dict) else []
        for u in items:
            if u.get("email") == email:
                return u.get("id")
    return None


def create_validation_chains(token, user_ids):
    """Create the 4-level validation chain."""
    step("3. Configure Validation Chains")
    chain_ids = []

    for chain in CHAINS:
        from_id = user_ids.get(chain["from_user"])
        to_id   = user_ids.get(chain["to_user"])

        if not from_id or not to_id:
            print(f"  SKIP chain '{chain['label']}' — missing user IDs")
            continue

        print(f"\n  Chain: {chain['label']}")
        print(f"    From: {chain['from_user']} ({from_id[:12]}...)")
        print(f"    To:   {chain['to_user']} ({to_id[:12]}...)")
        print(f"    Level: {chain['levelType']}, Priority: {chain['priority']}")

        from_user_config = next(u for u in USERS if u["id_label"] == chain["from_user"])
        tenant_id = from_user_config["tenantId"]

        result = api("POST", "/workflow/validation-chains",
                     token=token, tenant_id=tenant_id, body={
            "userId":      from_id,
            "validatorId": to_id,
            "levelType":   chain["levelType"],
            "priority":    chain["priority"],
        })

        if "data" in result and result["data"]:
            chain_id = result["data"].get("id", "ok")
            chain_ids.append(chain_id)
            print(f"    OK Chain created — ID: {chain_id}")
        else:
            print(f"    WARN Response: {json.dumps(result, indent=2)[:200]}")
            chain_ids.append("?")

    return chain_ids


def configure_notifications(token):
    """Verify notification settings are active for workflow events."""
    step("4. Verify Notification Configuration")

    result = api("GET", "/messages?limit=1", token=token, tenant_id=TENANT_AU)
    if "error" not in result:
        print("  OK Message service is accessible")
    else:
        print(f"  WARN Message service: {result}")

    print("""
  INFO: Notifications are triggered automatically via Kafka events:
    - au.workflow.validation.approved.v1 -> Notifies submitter + next validator
    - au.workflow.validation.rejected.v1 -> Notifies submitter
    - au.workflow.validation.submitted.v1 -> Notifies assigned validator

  The message service consumer sends:
    - IN_APP notifications (visible in the app bell icon)
    - EMAIL notifications (via configured SMTP/Mailpit)
""")


def verify_chains(token):
    """Verify the created validation chains."""
    step("5. Verify Validation Chains")

    for tenant_name, tenant_id in [("Cabo Verde", TENANT_CV),
                                     ("ECOWAS", TENANT_ECOWAS),
                                     ("AU-IBAR", TENANT_AU)]:
        result = api("GET", "/workflow/validation-chains?limit=50",
                     token=token, tenant_id=tenant_id)
        if "data" in result:
            data = result["data"]
            if isinstance(data, list):
                count = len(data)
            elif isinstance(data, dict):
                count = len(data.get("items", data.get("data", [])))
            else:
                count = 0
            print(f"  OK {count} validation chain(s) for {tenant_name}")
        else:
            print(f"  WARN Could not verify chains for {tenant_name}: {str(result)[:100]}")


def print_summary(user_ids):
    """Print the complete summary."""
    step("RECAPITULATIF — Test Validation Cabo Verde (Staging)")

    print("""
+========================================================================+
|                    CIRCUIT DE VALIDATION — CABO VERDE                  |
+========================================================================+
|                                                                        |
|  Niveau 1: COLLECTE (Admin2 — Praia)                                   |
|  +-----------------------------------------------------+              |
|  | Agent Terrain: Amadou Diallo                        |              |
|  | Email: agent.terrain.praia@test.au-aris.org         |              |
|  | Role: FIELD_AGENT                                   |              |
|  | Tenant: Cabo Verde                                  |              |
|  +-------------------------+---------------------------+              |
|                            | soumet les donnees                       |
|                            v                                          |
|  Niveau 2: VALIDATION TECHNIQUE (Admin1 — Santiago)                    |
|  +-----------------------------------------------------+              |
|  | Validateur Regional: Fatima Tavares                  |              |
|  | Email: validateur.santiago@test.au-aris.org          |              |
|  | Role: DATA_STEWARD                                  |              |
|  | Tenant: Cabo Verde                                  |              |
|  +-------------------------+---------------------------+              |
|                            | valide -> envoie au CVO                  |
|                            v                                          |
|  Niveau 3: VALIDATION OFFICIELLE (National — CVO)                      |
|  +-----------------------------------------------------+              |
|  | CVO National: Carlos Monteiro                       |              |
|  | Email: cvo.national.cv@test.au-aris.org             |              |
|  | Role: NATIONAL_ADMIN                                |              |
|  | Tenant: Cabo Verde                                  |              |
|  +-------------------------+---------------------------+              |
|                            | valide -> envoie a la REC                |
|                            v                                          |
|  Niveau 4: HARMONISATION REGIONALE (REC — ECOWAS)                      |
|  +-----------------------------------------------------+              |
|  | Admin REC: Ousmane Sy                               |              |
|  | Email: admin.rec.ecowas@test.au-aris.org            |              |
|  | Role: REC_ADMIN                                     |              |
|  | Tenant: ECOWAS                                      |              |
|  +-------------------------+---------------------------+              |
|                            | valide -> envoie au Continental          |
|                            v                                          |
|  Niveau 5: PUBLICATION CONTINENTALE (AU-IBAR)                          |
|  +-----------------------------------------------------+              |
|  | Admin Continental: Grace Okonkwo                    |              |
|  | Email: admin.continental.test@test.au-aris.org      |              |
|  | Role: CONTINENTAL_ADMIN                             |              |
|  | Tenant: AU-IBAR                                     |              |
|  +-----------------------------------------------------+              |
+========================================================================+
""")

    print("-- Identifiants de connexion ------------------------------------")
    print(f"  URL Staging:    https://test.au-aris.org")
    print(f"  Mot de passe:   {TEST_PASSWORD}")
    print()

    print("-- Comptes crees ------------------------------------------------")
    for user in USERS:
        uid = user_ids.get(user["id_label"], "N/A")
        print(f"  {user['description']}")
        print(f"    Email: {user['email']}")
        print(f"    ID:    {uid}")
        print()

    print("-- Circuit de validation (chaines) ------------------------------")
    for chain in CHAINS:
        print(f"  {chain['label']} (level: {chain['levelType']})")
    print()

    print("-- Notifications ------------------------------------------------")
    print("  [x] Notification IN_APP a chaque validation/rejet (automatique)")
    print("  [x] Notification EMAIL a chaque validation/rejet (automatique)")
    print("  [x] Les validateurs recoivent une alerte quand des donnees")
    print("      arrivent dans leur file d'attente de validation")
    print()

    print("-- Scenario de test ---------------------------------------------")
    print("""
  1. Connectez-vous comme Agent Terrain (agent.terrain.praia@test.au-aris.org)
     -> Allez dans Collecte -> Remplir un formulaire -> Soumettre

  2. Connectez-vous comme Validateur Santiago (validateur.santiago@test.au-aris.org)
     -> Allez dans Validation -> Vous voyez les donnees soumises
     -> Approuver ou Rejeter (avec commentaire)

  3. Si approuve, connectez-vous comme CVO National (cvo.national.cv@test.au-aris.org)
     -> Validation -> Donnees en attente -> Approuver/Rejeter

  4. Si approuve, connectez-vous comme Admin REC (admin.rec.ecowas@test.au-aris.org)
     -> Validation -> Harmonisation regionale -> Approuver/Rejeter

  5. Si approuve, connectez-vous comme Admin Continental (admin.continental.test@test.au-aris.org)
     -> Validation -> Publication continentale -> Approuver/Rejeter -> Publie!

  A chaque etape:
    - Le validateur recoit une notification (cloche)
    - En cas de rejet, l'emetteur est notifie avec la raison
    - En cas de renvoi (return), les donnees redescendent d'un niveau
""")


def main():
    print("=" * 60)
    print("  ARIS 4.0 — Setup Validation Test — Cabo Verde (Staging)")
    print("=" * 60)

    # 1. Login
    token = login()

    # 2. Create users
    user_ids = create_users(token)

    missing = [k for k, v in user_ids.items() if not v]
    if missing:
        print(f"\n  WARN Missing user IDs for: {missing}")
        print("    The script will continue but some chains may fail.")

    # 3. Create validation chains
    chain_ids = create_validation_chains(token, user_ids)

    # 4. Configure notifications
    configure_notifications(token)

    # 5. Verify chains
    verify_chains(token)

    # 6. Print summary
    print_summary(user_ids)


if __name__ == "__main__":
    main()
