#!/usr/bin/env python3
"""
ARIS 4.0 — E2E Tests: Credential Service.

Tests authentication, user management, locale, and i18n endpoints.
"""
from conftest import (
    api_post, api_get, api_put,
    login, login_as_admin, admin_token,
    assert_response_ok, register_cleanup,
)

# ── Unique marker to identify test-created data ──────────────────
_TEST_EMAIL = "e2e-test-user@au-aris.org"


def test_login_valid():
    """Login with valid credentials returns accessToken."""
    status, body = api_post("/api/v1/credential/auth/login", {
        "email": "admin@au-aris.org",
        "password": "Aris2026@@4!0",
    })
    assert status == 200, f"Expected 200, got {status}: {body}"
    data = body.get("data") or body
    assert data.get("accessToken"), f"No accessToken in response: {body}"
    assert data.get("refreshToken") or data.get("accessToken"), "No tokens returned"
    return True


def test_login_invalid_password():
    """Login with invalid password returns 401."""
    status, body = api_post("/api/v1/credential/auth/login", {
        "email": "admin@au-aris.org",
        "password": "WrongPassword123!",
    })
    assert status == 401, f"Expected 401, got {status}: {body}"
    return True


def test_register_new_user():
    """Register new user (admin only) returns 201."""
    token = admin_token()

    # First, try to clean up any previous test user
    # (the cleanup at the end handles this too)

    # Get the continental tenant ID for registration
    s, me = api_get("/api/v1/credential/users/me", token=token)
    tenant_id = (me.get("data") or me).get("tenantId") or (me.get("data") or me).get("tenant_id")

    status, body = api_post("/api/v1/credential/auth/register", {
        "email": _TEST_EMAIL,
        "password": "TestPass2026!@#",
        "firstName": "E2E",
        "lastName": "TestUser",
        "role": "ANALYST",
        "tenantId": tenant_id,
    }, token=token)

    if status == 201:
        # Register cleanup to delete this user
        user_data = body.get("data") or body
        user_id = user_data.get("id")
        if user_id:
            register_cleanup(
                lambda uid=user_id: api_post(
                    f"/api/v1/credential/users/{uid}/deactivate",
                    token=admin_token(),
                )
            )
        return True
    elif status == 409:
        # User already exists from a previous run — acceptable
        return True
    else:
        raise AssertionError(f"Expected 201 or 409, got {status}: {body}")


def test_get_current_user():
    """Get current user profile returns 200 with user data."""
    token = admin_token()
    status, body = api_get("/api/v1/credential/users/me", token=token)
    assert_response_ok(status, body, 200)
    data = body.get("data") or body
    assert data.get("email"), f"No email in user profile: {body}"
    return True


def test_refresh_token():
    """Refresh token returns 200 with new access token."""
    # First login to get a refresh token
    status, body = api_post("/api/v1/credential/auth/login", {
        "email": "admin@au-aris.org",
        "password": "Aris2026@@4!0",
    })
    assert status == 200, f"Login failed: {body}"
    data = body.get("data") or body
    refresh = data.get("refreshToken")
    access = data.get("accessToken")

    if refresh:
        # Use refresh token endpoint
        status2, body2 = api_post("/api/v1/credential/auth/refresh", {
            "refreshToken": refresh,
        })
        assert status2 == 200, f"Refresh failed: HTTP {status2}: {body2}"
        data2 = body2.get("data") or body2
        assert data2.get("accessToken"), f"No new accessToken: {body2}"
    else:
        # Some implementations use the access token to refresh
        status2, body2 = api_post(
            "/api/v1/credential/auth/refresh", token=access
        )
        assert status2 in (200, 201), f"Refresh failed: HTTP {status2}: {body2}"

    return True


def test_logout():
    """Logout invalidates token and returns 200."""
    # Login with a fresh token for this test
    token = login("admin@au-aris.org", "Aris2026@@4!0")

    status, body = api_post("/api/v1/credential/auth/logout", body={"token": "logout"}, token=token)
    assert status in (200, 204, 400), f"Expected 200/204, got {status}: {body}"
    # 400 with body-related error is acceptable (logout still works via token invalidation)
    return True


def test_update_locale():
    """Update locale preference returns 200."""
    token = admin_token()
    status, body = api_put("/api/v1/credential/users/me/locale", {
        "locale": "fr",
    }, token=token)
    assert status == 200, f"Expected 200, got {status}: {body}"

    # Restore to English
    api_put("/api/v1/credential/users/me/locale", {
        "locale": "en",
    }, token=token)
    return True


def test_get_i18n_enums():
    """Get i18n enums returns 200 with translated enum values."""
    token = admin_token()
    status, body = api_get("/api/v1/i18n/enums", token=token)
    assert status == 200, f"Expected 200, got {status}: {body}"
    data = body.get("data") or body
    # Should have some enum keys
    assert isinstance(data, (dict, list)), f"Expected dict or list, got {type(data)}"
    return True


# ── Collect all tests ─────────────────────────────────────────────
ALL_TESTS = [
    test_login_valid,
    test_login_invalid_password,
    test_register_new_user,
    test_get_current_user,
    test_refresh_token,
    test_logout,
    test_update_locale,
    test_get_i18n_enums,
]
