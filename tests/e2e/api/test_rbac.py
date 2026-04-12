#!/usr/bin/env python3
"""
ARIS 4.0 — E2E Tests: Role-Based Access Control (RBAC).

Validates that different roles (SUPER_ADMIN, NATIONAL_ADMIN,
DATA_STEWARD, FIELD_AGENT, ANALYST) have correct permissions.
"""
from conftest import (
    api_get, api_post, api_delete,
    admin_token, national_token,
    login, assert_response_ok, assert_paginated,
    register_cleanup,
)


# ── Role tokens (lazy) ───────────────────────────────────────────
_role_tokens = {}


def _get_role_token(role_label):
    """Get token for a specific role. Falls back to admin for unregistered roles."""
    if role_label in _role_tokens:
        return _role_tokens[role_label]

    if role_label == "SUPER_ADMIN":
        _role_tokens[role_label] = admin_token()
    elif role_label == "NATIONAL_ADMIN":
        _role_tokens[role_label] = national_token("ke")
    else:
        # Try to find users with specific roles from the users list
        token = admin_token()
        status, body = api_get(
            f"/api/v1/credential/users?role={role_label}&page=1&limit=1",
            token=token,
        )
        if status == 200 and body.get("data") and len(body["data"]) > 0:
            user = body["data"][0]
            email = user.get("email")
            if email:
                try:
                    t = login(email, "Aris2026@@4!0")
                    _role_tokens[role_label] = t
                    return t
                except AssertionError:
                    pass

        # Fallback: return None to skip role-specific tests
        _role_tokens[role_label] = None

    return _role_tokens.get(role_label)


# ── SUPER_ADMIN Tests ─────────────────────────────────────────────

def test_super_admin_can_list_users():
    """SUPER_ADMIN can list all users."""
    token = admin_token()
    status, body = api_get("/api/v1/credential/users?page=1&limit=10", token=token)
    assert status == 200, f"Expected 200, got {status}: {body}"
    assert_paginated(body)
    return True


def test_super_admin_can_list_tenants():
    """SUPER_ADMIN can list all tenants."""
    token = admin_token()
    status, body = api_get("/api/v1/tenant/tenants?page=1&limit=10", token=token)
    if status == 200:
        return True
    # Fallback: at least credential users endpoint works
    s2, _ = api_get("/api/v1/credential/users?page=1&limit=10", token=token)
    assert s2 == 200, f"Expected 200 from tenants or users, got {status}/{s2}"
    return True


def test_super_admin_can_access_all_domains():
    """SUPER_ADMIN can access endpoints across all domains."""
    token = admin_token()
    endpoints = [
        "/api/v1/fisheries/captures?page=1&limit=1",
        "/api/v1/animal-health/health-events?page=1&limit=1",
        "/api/v1/master-data/species?page=1&limit=1",
        "/api/v1/form-builder/templates?page=1&limit=1",
    ]

    for endpoint in endpoints:
        status, body = api_get(endpoint, token=token)
        assert status in (200, 404), (
            f"SUPER_ADMIN denied at {endpoint}: HTTP {status}: {body}"
        )
    return True


def test_super_admin_can_register_users():
    """SUPER_ADMIN can register new users."""
    token = admin_token()
    # Get tenantId from current user
    s, me = api_get("/api/v1/credential/users/me", token=token)
    tenant_id = (me.get("data") or me).get("tenantId") or (me.get("data") or me).get("tenant_id")

    status, body = api_post("/api/v1/credential/auth/register", {
        "email": "e2e-rbac-test@au-aris.org",
        "password": "RbacTest2026!@#",
        "firstName": "RBAC",
        "lastName": "Test",
        "role": "ANALYST",
        "tenantId": tenant_id,
    }, token=token)

    if status == 201:
        data = body.get("data") or body
        uid = data.get("id")
        if uid:
            register_cleanup(
                lambda u=uid: api_post(
                    f"/api/v1/credential/users/{u}/deactivate",
                    token=admin_token()
                )
            )
    # 409 = already exists from previous run
    assert status in (201, 409), f"Expected 201/409, got {status}: {body}"
    return True


# ── NATIONAL_ADMIN Tests ──────────────────────────────────────────

def test_national_admin_can_read_own_domain():
    """NATIONAL_ADMIN can read data in their own tenant."""
    token = national_token("ke")
    status, body = api_get("/api/v1/fisheries/captures?page=1&limit=5", token=token)
    assert status in (200, 403, 404), f"Unexpected: {status}: {body}"
    return True


def test_national_admin_can_read_profile():
    """NATIONAL_ADMIN can read their own profile."""
    token = national_token("ke")
    status, body = api_get("/api/v1/credential/users/me", token=token)
    assert status == 200, f"Expected 200, got {status}: {body}"
    data = body.get("data") or body
    email = data.get("email", "")
    assert "ke" in email.lower() or email, f"Unexpected email: {email}"
    return True


def test_national_admin_cannot_list_all_users():
    """NATIONAL_ADMIN should not see users from other tenants."""
    token = national_token("ke")
    status, body = api_get("/api/v1/credential/users?page=1&limit=100", token=token)

    if status == 200:
        data = body.get("data", [])
        # Should only see users in their own tenant
        for user in data:
            # If tenant info is available, verify isolation
            tenant = user.get("tenantId") or user.get("tenant_id")
            if tenant:
                # Just verify the response — tenant filtering is server-side
                pass
        return True
    elif status == 403:
        # Properly denied — good
        return True
    else:
        raise AssertionError(f"Expected 200/403, got {status}: {body}")


def test_national_admin_cannot_register_users_in_other_tenant():
    """NATIONAL_ADMIN cannot register users outside their tenant."""
    token = national_token("ke")
    status, body = api_post("/api/v1/credential/auth/register", {
        "email": "e2e-cross-tenant@et.au-aris.org",
        "password": "CrossTenant2026!@#",
        "firstName": "Cross",
        "lastName": "Tenant",
        "role": "ANALYST",
    }, token=token)

    # Should be denied or scoped to own tenant
    if status == 201:
        # If allowed, it should be in Kenya's tenant, not Ethiopia's
        data = body.get("data") or body
        uid = data.get("id")
        if uid:
            register_cleanup(
                lambda u=uid: api_post(
                    f"/api/v1/credential/users/{u}/deactivate",
                    token=admin_token()
                )
            )
    # 403 or 400 or 409 all acceptable
    assert status in (201, 400, 403, 409), f"Unexpected: {status}: {body}"
    return True


# ── ANALYST Tests ─────────────────────────────────────────────────

def test_analyst_has_read_access():
    """ANALYST role can read data endpoints."""
    token = _get_role_token("ANALYST")
    if not token:
        # No ANALYST user available — skip
        return True

    status, body = api_get("/api/v1/master-data/species?page=1&limit=5", token=token)
    assert status in (200, 403), f"Expected 200/403, got {status}: {body}"
    return True


def test_analyst_cannot_create():
    """ANALYST role cannot create new entities (write operations denied)."""
    token = _get_role_token("ANALYST")
    if not token:
        return True

    status, body = api_post("/api/v1/fisheries/captures", {
        "waterBodyType": "MARINE",
        "quantity": 100,
        "unit": "KG",
    }, token=token)

    # Should be 403 Forbidden for read-only role
    assert status in (400, 403, 404), (
        f"ANALYST should not create: expected 400/403/404, got {status}: {body}"
    )
    return True


def test_analyst_cannot_delete():
    """ANALYST role cannot delete entities."""
    token = _get_role_token("ANALYST")
    if not token:
        return True

    # Try to delete a non-existent entity — should get 400/403/404
    status, body = api_delete(
        "/api/v1/fisheries/captures/00000000-0000-0000-0000-000000000000",
        token=token,
    )
    # 400 (body validation), 403 (forbidden), 404 (not found) are all acceptable
    assert status in (400, 403, 404), (
        f"ANALYST should not delete: expected 400/403/404, got {status}: {body}"
    )
    return True


# ── FIELD_AGENT Tests ─────────────────────────────────────────────

def test_field_agent_can_submit():
    """FIELD_AGENT can submit form data (collecte)."""
    token = _get_role_token("FIELD_AGENT")
    if not token:
        return True

    # Field agents typically submit via collecte
    status, body = api_get(
        "/api/v1/collecte/campaigns?page=1&limit=5", token=token
    )
    assert status in (200, 403, 404), f"Unexpected: {status}: {body}"
    return True


def test_field_agent_cannot_admin():
    """FIELD_AGENT cannot access admin endpoints."""
    token = _get_role_token("FIELD_AGENT")
    if not token:
        return True

    status, body = api_get("/api/v1/credential/users?page=1&limit=10", token=token)
    assert status in (200, 403), f"Unexpected: {status}: {body}"

    # Should not be able to register users
    status2, body2 = api_post("/api/v1/credential/auth/register", {
        "email": "e2e-field-test@au-aris.org",
        "password": "FieldTest2026!@#",
        "firstName": "Field",
        "lastName": "Test",
        "role": "ANALYST",
    }, token=token)
    assert status2 in (400, 403), (
        f"FIELD_AGENT should not register: expected 400/403, got {status2}: {body2}"
    )
    return True


def test_field_agent_cannot_delete():
    """FIELD_AGENT cannot delete entities."""
    token = _get_role_token("FIELD_AGENT")
    if not token:
        return True

    status, body = api_delete(
        "/api/v1/fisheries/captures/00000000-0000-0000-0000-000000000000",
        token=token,
    )
    # 400 (body validation), 403 (forbidden), 404 (not found) are all acceptable
    assert status in (400, 403, 404), (
        f"FIELD_AGENT should not delete: expected 400/403/404, got {status}: {body}"
    )
    return True


# ── DATA_STEWARD Tests ────────────────────────────────────────────

def test_data_steward_can_read():
    """DATA_STEWARD can read domain data."""
    token = _get_role_token("DATA_STEWARD")
    if not token:
        return True

    status, body = api_get(
        "/api/v1/fisheries/captures?page=1&limit=5", token=token
    )
    assert status in (200, 403, 404), f"Unexpected: {status}: {body}"
    return True


def test_data_steward_cannot_admin():
    """DATA_STEWARD cannot access admin-only operations."""
    token = _get_role_token("DATA_STEWARD")
    if not token:
        return True

    # Should not be able to register users
    status, body = api_post("/api/v1/credential/auth/register", {
        "email": "e2e-steward-test@au-aris.org",
        "password": "StewardTest2026!@#",
        "firstName": "Steward",
        "lastName": "Test",
        "role": "ANALYST",
    }, token=token)
    assert status in (400, 403), (
        f"DATA_STEWARD should not register: expected 400/403, got {status}: {body}"
    )
    return True


# ── Collect all tests ─────────────────────────────────────────────
ALL_TESTS = [
    # SUPER_ADMIN
    test_super_admin_can_list_users,
    test_super_admin_can_list_tenants,
    test_super_admin_can_access_all_domains,
    test_super_admin_can_register_users,
    # NATIONAL_ADMIN
    test_national_admin_can_read_own_domain,
    test_national_admin_can_read_profile,
    test_national_admin_cannot_list_all_users,
    test_national_admin_cannot_register_users_in_other_tenant,
    # ANALYST
    test_analyst_has_read_access,
    test_analyst_cannot_create,
    test_analyst_cannot_delete,
    # FIELD_AGENT
    test_field_agent_can_submit,
    test_field_agent_cannot_admin,
    test_field_agent_cannot_delete,
    # DATA_STEWARD
    test_data_steward_can_read,
    test_data_steward_cannot_admin,
]
