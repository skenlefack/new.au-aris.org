"""
ARIS — Auto-bootstrap Superset dashboards
Runs after bootstrap_datasource.py to create default dashboards
and enable embedding on them.

Requires:
  - Superset running with admin user created
  - ARIS datasource already registered (via bootstrap_datasource.py)
"""
import os
import logging
import json
import time

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aris-bootstrap-dashboards")

SUPERSET_URL = os.environ.get("SUPERSET_URL", "http://localhost:8088")
ADMIN_USER = os.environ.get("SUPERSET_ADMIN_USERNAME", "admin")
ADMIN_PASS = os.environ.get("SUPERSET_ADMIN_PASSWORD", "Sup3rs3t_Pr0d_2024!qR5tY")


def get_admin_token() -> str:
    """Login as admin and return access token."""
    import urllib.request

    data = json.dumps({
        "username": ADMIN_USER,
        "password": ADMIN_PASS,
        "provider": "db",
        "refresh": True,
    }).encode()

    req = urllib.request.Request(
        f"{SUPERSET_URL}/api/v1/security/login",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read())
    return body["access_token"]


def api_get(token: str, path: str):
    import urllib.request
    req = urllib.request.Request(
        f"{SUPERSET_URL}{path}",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def api_post(token: str, path: str, payload: dict):
    import urllib.request
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        f"{SUPERSET_URL}{path}",
        data=data,
        method="POST",
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


# Dashboard definitions
DASHBOARDS = [
    {
        "dashboard_title": "Continental Overview",
        "slug": "continental-overview",
        "position_json": json.dumps({}),
        "published": True,
    },
    {
        "dashboard_title": "Animal Health",
        "slug": "animal-health",
        "position_json": json.dumps({}),
        "published": True,
    },
    {
        "dashboard_title": "Trade & Production",
        "slug": "trade-production",
        "position_json": json.dumps({}),
        "published": True,
    },
]


def bootstrap():
    """Create default dashboards and list their embed UUIDs."""
    token = get_admin_token()
    logger.info("Admin login successful")

    # Check existing dashboards
    existing = api_get(token, "/api/v1/dashboard/?q=(page_size:100)")
    existing_slugs = {
        d.get("slug"): d for d in existing.get("result", [])
    }

    for dash_def in DASHBOARDS:
        slug = dash_def["slug"]
        if slug in existing_slugs:
            logger.info(
                "Dashboard '%s' already exists (id=%s), skipping.",
                slug, existing_slugs[slug]["id"],
            )
            continue

        try:
            result = api_post(token, "/api/v1/dashboard/", dash_def)
            dash_id = result.get("id", "?")
            logger.info("Created dashboard '%s' (id=%s)", slug, dash_id)
        except Exception as e:
            logger.warning("Failed to create dashboard '%s': %s", slug, e)

    # List all dashboards with their embed UUIDs
    logger.info("\n--- Dashboard Embed UUIDs ---")
    all_dashboards = api_get(token, "/api/v1/dashboard/?q=(page_size:100)")
    for d in all_dashboards.get("result", []):
        uuid = d.get("uuid", "N/A")
        logger.info(
            "  id=%s  slug=%-25s  uuid=%s",
            d.get("id", "?"),
            d.get("slug", "?"),
            uuid,
        )
    logger.info(
        "Use these UUIDs as externalId in governance.bi_dashboards "
        "for Superset embedded SDK integration."
    )


if __name__ == "__main__":
    # Wait for Superset to be ready
    retries = 0
    while retries < 10:
        try:
            import urllib.request
            req = urllib.request.Request(f"{SUPERSET_URL}/health")
            with urllib.request.urlopen(req, timeout=5):
                break
        except Exception:
            retries += 1
            logger.info("Waiting for Superset... (%d/10)", retries)
            time.sleep(10)

    try:
        bootstrap()
    except Exception as e:
        # Non-fatal: Superset still runs, dashboards can be created manually
        logger.warning("Bootstrap dashboards failed (non-fatal): %s", e)
