#!/usr/bin/env python3
"""
ARIS 4.0 — E2E API Test Configuration & Helpers.

SSH-based API testing against the staging environment (test.au-aris.org).
All requests are executed via curl over SSH to the staging VM-APP.

Environment variables:
  ARIS_DEPLOY_PASS  — SSH password for arisadmin
  ARIS_DEPLOY_KEY   — (optional) path to SSH private key
  ARIS_VM_APP_STG   — (optional) override staging IP (default: 10.202.101.146)
"""
import json
import os
import time
import paramiko

# ── Configuration ────────────────────────────────────────────────
VM_APP_STG = os.environ.get("ARIS_VM_APP_STG", "10.202.101.146")
SSH_USER = os.environ.get("ARIS_DEPLOY_USER", "arisadmin")
SSH_PASS = os.environ.get("ARIS_DEPLOY_PASS")
SSH_KEY = os.environ.get("ARIS_DEPLOY_KEY")
HOST_HEADER = "test.au-aris.org"

# Default test credentials
ADMIN_EMAIL = "admin@au-aris.org"
ADMIN_PASSWORD = "Aris2026@@4!0"

# Country admin emails follow pattern: admin@{cc}.au-aris.org
NATIONAL_COUNTRIES = ["ke", "et", "ng", "sn", "za"]


def _check_credentials():
    """Ensure SSH credentials are available."""
    if not SSH_PASS and not SSH_KEY:
        raise RuntimeError(
            "No SSH credentials configured. "
            "Set ARIS_DEPLOY_PASS or ARIS_DEPLOY_KEY environment variable."
        )


def _get_ssh_client():
    """Create and return a connected SSH client."""
    _check_credentials()
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())

    kwargs = dict(
        hostname=VM_APP_STG,
        port=22,
        username=SSH_USER,
        timeout=15,
        allow_agent=False,
        look_for_keys=False,
    )
    if SSH_KEY:
        kwargs["key_filename"] = SSH_KEY
    else:
        kwargs["password"] = SSH_PASS

    client.connect(**kwargs)
    return client


def _ssh_curl(method, path, body=None, token=None, timeout=30):
    """Execute a curl command via SSH and return parsed JSON response.

    Args:
        method: HTTP method (GET, POST, PATCH, PUT, DELETE)
        path: API path (e.g., /api/v1/credential/auth/login)
        body: Optional dict to send as JSON body
        token: Optional Bearer token
        timeout: Command timeout in seconds

    Returns:
        Tuple of (status_code: int, body: dict)
    """
    headers = [
        f'-H "Host: {HOST_HEADER}"',
        '-H "Content-Type: application/json"',
        '-H "Accept: application/json"',
    ]
    if token:
        headers.append(f'-H "Authorization: Bearer {token}"')

    header_str = " ".join(headers)

    body_str = ""
    if body is not None:
        # Escape single quotes in JSON for shell safety
        json_str = json.dumps(body).replace("'", "'\\''")
        body_str = f"-d '{json_str}'"

    curl_cmd = (
        f"curl -sk -X {method} -w '\\n%{{http_code}}' "
        f"{header_str} {body_str} "
        f"'https://localhost{path}'"
    )

    client = _get_ssh_client()
    try:
        stdin, stdout, stderr = client.exec_command(curl_cmd, timeout=timeout)
        raw = stdout.read().decode("utf-8", errors="replace").strip()
        client.close()
    except Exception:
        client.close()
        raise

    # Last line is HTTP status code, everything before is the body
    lines = raw.rsplit("\n", 1)
    if len(lines) == 2:
        body_raw, status_raw = lines
    else:
        body_raw = lines[0]
        status_raw = "0"

    try:
        status_code = int(status_raw.strip())
    except ValueError:
        status_code = 0

    try:
        parsed = json.loads(body_raw)
    except (json.JSONDecodeError, ValueError):
        parsed = {"_raw": body_raw}

    return status_code, parsed


def api_get(path, token=None):
    """HTTP GET request. Returns (status_code, response_body)."""
    return _ssh_curl("GET", path, token=token)


def api_post(path, body=None, token=None):
    """HTTP POST request. Returns (status_code, response_body)."""
    return _ssh_curl("POST", path, body=body, token=token)


def api_patch(path, body=None, token=None):
    """HTTP PATCH request. Returns (status_code, response_body)."""
    return _ssh_curl("PATCH", path, body=body, token=token)


def api_put(path, body=None, token=None):
    """HTTP PUT request. Returns (status_code, response_body)."""
    return _ssh_curl("PUT", path, body=body, token=token)


def api_delete(path, token=None):
    """HTTP DELETE request. Returns (status_code, response_body)."""
    return _ssh_curl("DELETE", path, token=token)


def login(email, password):
    """Login and return the access token.

    Args:
        email: User email
        password: User password

    Returns:
        Access token string

    Raises:
        AssertionError: If login fails
    """
    status, body = api_post("/api/v1/credential/auth/login", {
        "email": email,
        "password": password,
    })
    assert status == 200, f"Login failed for {email}: HTTP {status} — {body}"
    token = (body.get("data") or body).get("accessToken")
    assert token, f"No accessToken in login response for {email}: {body}"
    return token


def login_as_admin():
    """Login as the super admin (admin@au-aris.org). Returns token."""
    return login(ADMIN_EMAIL, ADMIN_PASSWORD)


def login_as_national(country_code):
    """Login as a national admin (admin@{cc}.au-aris.org). Returns token."""
    email = f"admin@{country_code}.au-aris.org"
    return login(email, ADMIN_PASSWORD)


def assert_response_ok(status, body, expected_status=200):
    """Assert that the response has the expected status and valid structure."""
    assert status == expected_status, (
        f"Expected HTTP {expected_status}, got {status}: {body}"
    )
    # Most ARIS endpoints return { data, meta? } or { data }
    if isinstance(body, dict) and "statusCode" in body:
        # Error response
        raise AssertionError(
            f"API error {body.get('statusCode')}: {body.get('message')}"
        )


def assert_paginated(body):
    """Assert the response has paginated structure with data array and meta."""
    assert isinstance(body, dict), f"Expected dict response, got {type(body)}"
    assert "data" in body, f"Missing 'data' key in response: {list(body.keys())}"
    assert isinstance(body["data"], list), (
        f"Expected 'data' to be a list, got {type(body['data'])}"
    )
    if "meta" in body:
        meta = body["meta"]
        assert isinstance(meta, dict), f"Expected 'meta' to be dict, got {type(meta)}"


# ── Token cache (avoid repeated logins) ──────────────────────────
_token_cache = {}


def get_cached_token(key, login_fn):
    """Get or create a cached token to avoid repeated logins."""
    if key not in _token_cache:
        _token_cache[key] = login_fn()
    return _token_cache[key]


def admin_token():
    """Get cached admin token."""
    return get_cached_token("admin", login_as_admin)


def national_token(cc):
    """Get cached national admin token for a country."""
    return get_cached_token(f"national_{cc}", lambda: login_as_national(cc))


# ── Test cleanup registry ────────────────────────────────────────
_cleanup_tasks = []


def register_cleanup(fn):
    """Register a cleanup function to run after tests."""
    _cleanup_tasks.append(fn)


def run_cleanup():
    """Run all registered cleanup tasks."""
    for fn in reversed(_cleanup_tasks):
        try:
            fn()
        except Exception as e:
            print(f"  Cleanup warning: {e}")
    _cleanup_tasks.clear()
